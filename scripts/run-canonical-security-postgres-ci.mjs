import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseProductionEndpointManifest } from './production-endpoint-manifest.mjs';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const NETWORK_AUDIT_MARKER = Symbol.for('cza.postgresNetworkAuditInstalled');
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const AUDIT_PRELOAD = fileURLToPath(
  new URL('./postgres-network-audit.cjs', import.meta.url),
);

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing-environment:${name}`);
  return value;
}

function readDotEnv(file) {
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        const key = line.slice(0, separator).trim();
        let value = line.slice(separator + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        return [key, value];
      }),
  );
}

function maskForGitHub(value) {
  if (process.env.GITHUB_ACTIONS === 'true') {
    process.stdout.write(`::add-mask::${value}\n`);
  }
}

function sanitizedErrorCode(error) {
  if (typeof error?.code === 'string' && /^[A-Z0-9_]+$/.test(error.code)) {
    return error.code;
  }
  return 'CZA_SECURITY_CI_FAILED';
}

function redact(output, secrets) {
  let safe = output.replace(
    /postgres(?:ql)?:\/\/[^\s'"`]+/gi,
    '<redacted-postgres-url>',
  );
  for (const secret of secrets.filter(Boolean)) {
    safe = safe.replaceAll(secret, '<redacted>');
  }
  return safe;
}

function guardedHashes() {
  const hashes = (process.env.CZA_KNOWN_PRODUCTION_HOST_HASHES || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    hashes.length === 0 ||
    hashes.some((value) => !/^[0-9a-f]{64}$/.test(value))
  ) {
    throw new Error('network-guard-hashes-invalid');
  }
  return new Set(hashes);
}

export function launchGuardedNode({
  script,
  productionHostHashes,
  networkAuditFile,
  environment = {},
  stdio = 'inherit',
}) {
  if (
    !path.isAbsolute(script) ||
    !path.isAbsolute(networkAuditFile) ||
    !Array.isArray(productionHostHashes) ||
    productionHostHashes.length === 0 ||
    productionHostHashes.some((hash) => !/^[0-9a-f]{64}$/.test(hash))
  ) {
    throw new Error('guarded-runner-configuration-invalid');
  }
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ['--require', AUDIT_PRELOAD, script],
      {
        env: {
          ...process.env,
          ...environment,
          CZA_KNOWN_PRODUCTION_HOST_HASHES: productionHostHashes.join(','),
          CZA_NETWORK_AUDIT_FILE: networkAuditFile,
        },
        stdio,
      },
    );
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 1));
  });
}

function runSecurityTests(environment, secrets, networkAuditFile) {
  return new Promise((resolve, reject) => {
    const nodeOptions = [process.env.NODE_OPTIONS, `--require=${AUDIT_PRELOAD}`]
      .filter(Boolean)
      .join(' ');
    const child = spawn('pnpm', ['test:security:postgres'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...environment,
        CZA_NETWORK_AUDIT_FILE: networkAuditFile,
        NODE_OPTIONS: nodeOptions,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const chunks = [];
    let byteLength = 0;
    const collect = (chunk) => {
      byteLength += chunk.byteLength;
      if (byteLength > 10 * 1024 * 1024) {
        child.kill('SIGTERM');
        reject(new Error('test-output-limit-exceeded'));
        return;
      }
      chunks.push(chunk);
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', reject);
    child.on('close', (code) => {
      const output = redact(Buffer.concat(chunks).toString('utf8'), secrets);
      resolve({ code: code ?? 1, output });
    });
  });
}

function readNetworkAudit(file) {
  if (!fs.existsSync(file)) throw new Error('network-audit-missing');
  const records = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (
    records.length === 0 ||
    records.some(
      (record) =>
        typeof record !== 'object' ||
        !/^[0-9a-f]{64}$/.test(record.hostSha256 || '') ||
        typeof record.blocked !== 'boolean',
    )
  ) {
    throw new Error('network-audit-invalid');
  }
  return records;
}

export function summarizeNetworkAudit(
  records,
  temporaryHostSha256,
  productionHostHashes,
) {
  const observedHostHashes = [
    ...new Set(records.map((record) => record.hostSha256)),
  ];
  const productionMatches = observedHostHashes.filter((hash) =>
    productionHostHashes.has(hash),
  );
  if (!observedHostHashes.includes(temporaryHostSha256)) {
    throw new Error('temporary-host-not-observed');
  }
  return Object.freeze({
    source: 'runtime-net-socket-instrumentation',
    temporaryHostSha256,
    observedHostHashes: Object.freeze(observedHostHashes),
    productionMatches: Object.freeze(productionMatches),
    productionAccessed: productionMatches.length > 0,
  });
}

function writeReport(reportDirectory, report, testOutput = '') {
  fs.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    path.join(reportDirectory, 'summary.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    { mode: 0o600 },
  );
  if (testOutput) {
    fs.writeFileSync(
      path.join(reportDirectory, 'postgres-test.log'),
      testOutput,
      { mode: 0o600 },
    );
  }
}

async function main() {
  if (globalThis[NETWORK_AUDIT_MARKER] !== true) {
    throw new Error('network-guard-not-installed');
  }
  const productionManifest = parseProductionEndpointManifest(
    requiredEnvironment('CZA_PRODUCTION_DB_ENDPOINT_MANIFEST'),
  );
  const productionHostHashes = new Set(productionManifest.hashes);
  const activeGuardHashes = guardedHashes();
  if (
    activeGuardHashes.size !== productionHostHashes.size ||
    [...productionHostHashes].some((hash) => !activeGuardHashes.has(hash))
  ) {
    throw new Error('network-guard-manifest-mismatch');
  }
  const { default: postgres } = await import('postgres');

  const neonEnvironmentFile = requiredEnvironment('CZA_NEON_ENV_FILE');
  const reportDirectory =
    process.env.CZA_SECURITY_REPORT_DIR ||
    path.join(process.cwd(), 'security-test-results');
  fs.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
  const neonEnvironment = readDotEnv(neonEnvironmentFile);
  const directConnection = neonEnvironment.DATABASE_URL_UNPOOLED;
  if (!directConnection) throw new Error('direct-connection-missing');

  const adminUrl = new URL(directConnection);
  if (!POSTGRES_PROTOCOLS.has(adminUrl.protocol)) {
    throw new Error('direct-connection-protocol-invalid');
  }
  if (adminUrl.hostname.toLowerCase().includes('-pooler.')) {
    throw new Error('pooled-connection-rejected');
  }

  maskForGitHub(directConnection);
  maskForGitHub(adminUrl.hostname);
  maskForGitHub(adminUrl.username);
  maskForGitHub(adminUrl.password);

  const testHostHash = createHash('sha256')
    .update(adminUrl.hostname.toLowerCase())
    .digest('hex');
  if (productionHostHashes.has(testHostHash)) {
    throw new Error('production-test-host-collision');
  }

  const runSuffix = (process.env.GITHUB_RUN_ID || 'local').replace(
    /[^a-zA-Z0-9]/g,
    '',
  );
  const databaseName =
    `cza_security_test_${runSuffix}_${randomBytes(5).toString('hex')}`.slice(
      0,
      63,
    );
  const testUrl = new URL(adminUrl);
  testUrl.pathname = `/${databaseName}`;
  const testConnection = testUrl.toString();
  maskForGitHub(testConnection);
  const networkAuditFile = path.join(reportDirectory, 'network-audit.jsonl');

  const report = {
    schemaVersion: 1,
    productionAccessed: 'not-evaluated',
    productionEndpointManifest: {
      complete: productionManifest.complete,
      endpointNames: productionManifest.endpoints.map((entry) => entry.name),
      endpointCount: productionManifest.endpoints.length,
    },
    hostnameSeparation: 'passed',
    connectionAudit: 'not-started',
    connectionMode: 'direct-unpooled',
    fixture: 'synthetic-pr31-upgrade',
    migrationRunsRequired: 2,
    postgresTests: 'not-started',
    syntheticDatabaseCleanup: 'not-started',
  };
  const administrator = postgres(adminUrl.toString(), {
    max: 1,
    prepare: false,
    connect_timeout: 20,
    idle_timeout: 5,
  });
  let databaseCreated = false;
  let testOutput = '';
  let executionError;

  try {
    await administrator`SELECT 1`;
    await administrator`CREATE DATABASE ${administrator(databaseName)}`;
    databaseCreated = true;

    const result = await runSecurityTests(
      {
        CZA_TEST_DATABASE_URL: testConnection,
        CZA_TEST_DATABASE_CONFIRM: 'ephemeral',
        CZA_KNOWN_PRODUCTION_HOST_HASHES: [...productionHostHashes].join(','),
      },
      [
        directConnection,
        testConnection,
        adminUrl.hostname,
        adminUrl.username,
        adminUrl.password,
      ],
      networkAuditFile,
    );
    testOutput = result.output;
    process.stdout.write(testOutput);
    report.postgresTests = result.code === 0 ? 'passed' : 'failed';

    if (result.code !== 0) throw new Error('postgres-security-tests-failed');
  } catch (error) {
    executionError = error;
  } finally {
    if (databaseCreated) {
      try {
        await administrator`DROP DATABASE ${administrator(databaseName)} WITH (FORCE)`;
        report.syntheticDatabaseCleanup = 'passed';
      } catch {
        report.syntheticDatabaseCleanup = 'failed';
      }
    } else {
      report.syntheticDatabaseCleanup = 'not-required';
    }
    await administrator.end({ timeout: 5 }).catch(() => {});
    try {
      const connectionAudit = summarizeNetworkAudit(
        readNetworkAudit(networkAuditFile),
        testHostHash,
        productionHostHashes,
      );
      report.connectionAudit = connectionAudit;
      report.productionAccessed = connectionAudit.productionAccessed;
    } catch (error) {
      report.connectionAudit = 'failed';
      report.productionAccessed = 'not-evaluated';
      executionError ||= error;
    }
    writeReport(reportDirectory, report, testOutput);
  }

  if (report.productionAccessed === true) {
    throw new Error('production-network-attempt-detected');
  }
  if (report.syntheticDatabaseCleanup !== 'passed') {
    throw new Error('synthetic-database-cleanup-failed');
  }
  if (executionError) throw executionError;
}

async function entrypoint() {
  if (globalThis[NETWORK_AUDIT_MARKER] === true) {
    await main();
    return;
  }
  const productionManifest = parseProductionEndpointManifest(
    requiredEnvironment('CZA_PRODUCTION_DB_ENDPOINT_MANIFEST'),
  );
  const reportDirectory =
    process.env.CZA_SECURITY_REPORT_DIR ||
    path.join(process.cwd(), 'security-test-results');
  fs.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
  const networkAuditFile = path.join(reportDirectory, 'network-audit.jsonl');
  fs.writeFileSync(networkAuditFile, '', { flag: 'wx', mode: 0o600 });
  const exitCode = await launchGuardedNode({
    script: SCRIPT_FILE,
    productionHostHashes: productionManifest.hashes,
    networkAuditFile,
  });
  process.exitCode = exitCode;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  entrypoint().catch((error) => {
    process.stderr.write(
      `CZA security CI stopped: ${sanitizedErrorCode(error)}\n`,
    );
    process.exitCode = 1;
  });
}
