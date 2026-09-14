import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  captureContextRecoveryRecord,
  captureRecoveryRecord,
  updateRecoveryStatus,
} from '../scripts/claimable-neon-recovery.mjs';
import { parseProductionEndpointManifest } from '../scripts/production-endpoint-manifest.mjs';
import {
  launchGuardedNode,
  summarizeNetworkAudit,
} from '../scripts/run-canonical-security-postgres-ci.mjs';
import {
  generateRecoveryDrillKeyFiles,
  recoverAndDelete,
  sealRecoveryFiles,
} from '../scripts/neon-cleanup-recovery.mjs';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function endpoint(name, seed) {
  return {
    name,
    sha256: createHash('sha256').update(seed).digest('hex'),
  };
}

test('production endpoint manifest requires pooled and unpooled fingerprints', () => {
  const parsed = parseProductionEndpointManifest(
    JSON.stringify({
      schemaVersion: 1,
      complete: true,
      endpoints: [
        endpoint('DATABASE_URL', 'pooled-production-host'),
        endpoint('DATABASE_URL_UNPOOLED', 'direct-production-host'),
        endpoint('ANALYTICS_DATABASE_URL', 'analytics-production-host'),
      ],
    }),
  );
  assert.equal(parsed.complete, true);
  assert.equal(parsed.endpoints.length, 3);

  assert.throws(
    () =>
      parseProductionEndpointManifest(
        JSON.stringify({
          schemaVersion: 1,
          complete: true,
          endpoints: [endpoint('DATABASE_URL', 'only-pooled-host')],
        }),
      ),
    /production-endpoint-manifest-invalid/,
  );
  assert.throws(
    () =>
      parseProductionEndpointManifest(
        JSON.stringify({
          schemaVersion: 1,
          complete: true,
          endpoints: [
            endpoint('DATABASE_URL', 'same-host'),
            endpoint('DATABASE_URL_UNPOOLED', 'same-host'),
          ],
        }),
      ),
    /production-endpoint-manifest-duplicate/,
  );
});

test('Neon recovery evidence retains only a project ID, expiry and cleanup state', () => {
  const recovery = captureRecoveryRecord({
    project_id: 'winter-sun-12345678',
    project_expires_at: '2026-09-15T12:00:00.000Z',
    connection_uri: 'sensitive-connection-value',
    identityAssertion: 'secret-assertion',
  });
  assert.deepEqual(recovery, {
    schemaVersion: 1,
    projectId: 'winter-sun-12345678',
    projectExpiresAt: '2026-09-15T12:00:00.000Z',
    cleanupStatus: 'pending',
  });
  assert.equal(
    updateRecoveryStatus(recovery, 'orphaned').cleanupStatus,
    'orphaned',
  );
  assert.throws(
    () => updateRecoveryStatus(recovery, 'ignored'),
    /claimable-recovery-status-invalid/,
  );
  assert.deepEqual(
    captureContextRecoveryRecord({
      projectId: 'winter-sun-12345678',
      branch: 'br-test-secret-free',
    }),
    {
      schemaVersion: 1,
      projectId: 'winter-sun-12345678',
      projectExpiresAt: null,
      cleanupStatus: 'pending',
    },
  );
});

test('runtime socket guard blocks a production hostname fingerprint', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cza-network-audit-'),
  );
  try {
    const auditFile = path.join(temporaryDirectory, 'audit.jsonl');
    const hostname = '127.0.0.1';
    const hostnameHash = createHash('sha256').update(hostname).digest('hex');
    const preload = path.join(
      repositoryRoot,
      'scripts/postgres-network-audit.cjs',
    );
    const child = spawnSync(
      process.execPath,
      [
        '--require',
        preload,
        '--eval',
        "require('node:net').createConnection({host:'127.0.0.1',port:9})",
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          CZA_NETWORK_AUDIT_FILE: auditFile,
          CZA_KNOWN_PRODUCTION_HOST_HASHES: hostnameHash,
        },
      },
    );
    assert.notEqual(child.status, 0);
    assert.match(
      `${child.stdout}${child.stderr}`,
      /CZA_PRODUCTION_NETWORK_BLOCKED/,
    );
    assert.deepEqual(
      fs
        .readFileSync(auditFile, 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line)),
      [{ hostSha256: hostnameHash, blocked: true }],
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('guarded orchestrator blocks an immediate top-level PostgreSQL admin connection', async () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cza-guarded-orchestrator-'),
  );
  try {
    const hostname = '127.0.0.1';
    const hostnameHash = createHash('sha256').update(hostname).digest('hex');
    const auditFile = path.join(temporaryDirectory, 'audit.jsonl');
    const probe = path.join(temporaryDirectory, 'admin-probe.mjs');
    const postgresModule = import.meta.resolve('postgres');
    fs.writeFileSync(
      probe,
      `import postgres from ${JSON.stringify(postgresModule)};
const administrator = postgres('postgres://fixture:fixture@127.0.0.1:9/postgres', {
  connect_timeout: 1,
});
try {
  await administrator\`SELECT 1\`;
} finally {
  await administrator.end({timeout: 1}).catch(() => {});
}
`,
      { mode: 0o700 },
    );
    const exitCode = await launchGuardedNode({
      script: probe,
      productionHostHashes: [hostnameHash],
      networkAuditFile: auditFile,
      stdio: 'ignore',
    });
    assert.notEqual(exitCode, 0);
    assert.deepEqual(
      fs
        .readFileSync(auditFile, 'utf8')
        .trim()
        .split(/\r?\n/)
        .map((line) => JSON.parse(line)),
      [{ hostSha256: hostnameHash, blocked: true }],
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('encrypted cleanup artifact restores authority and deletes through the pinned CLI contract', () => {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'cza-cleanup-recovery-'),
  );
  try {
    const sourceDirectory = path.join(temporaryDirectory, 'source');
    const configDirectory = path.join(sourceDirectory, 'config');
    const contextFile = path.join(sourceDirectory, '.neon');
    const recoveryFile = path.join(temporaryDirectory, 'recovery.json');
    const bundleFile = path.join(temporaryDirectory, 'recovery.encrypted.json');
    const privateKeyFile = path.join(temporaryDirectory, 'private.pem');
    const publicKeyFile = path.join(temporaryDirectory, 'public.b64');
    const fakeNeonBin = path.join(temporaryDirectory, 'neon-fixture.cjs');
    const markerFile = path.join(temporaryDirectory, 'delete-marker.json');
    const projectId = 'winter-sun-12345678';
    fs.mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
    const context = { projectId, branch: 'br-test' };
    const credential = {
      version: 1,
      origin: 'https://claimable.invalid',
      registrationId: 'registration-fixture',
      projectId,
      branchId: 'br-test',
      identityAssertion: 'synthetic-identity-assertion',
      expiresAt: '2026-09-17T12:00:00.000Z',
      assertionExpires: 1_789_473_600,
    };
    fs.writeFileSync(contextFile, JSON.stringify(context), { mode: 0o600 });
    fs.writeFileSync(
      path.join(configDirectory, `claimable-credential.${projectId}.json`),
      JSON.stringify(credential),
      { mode: 0o600 },
    );
    fs.writeFileSync(
      recoveryFile,
      JSON.stringify({
        schemaVersion: 1,
        projectId,
        projectExpiresAt: credential.expiresAt,
        cleanupStatus: 'pending',
      }),
      { mode: 0o600 },
    );
    generateRecoveryDrillKeyFiles({
      publicKeyFile,
      privateKeyFile,
    });
    sealRecoveryFiles({
      recoveryFile,
      contextFile,
      configDirectory,
      outputFile: bundleFile,
      encodedPublicKey: fs.readFileSync(publicKeyFile, 'utf8').trim(),
    });
    const encryptedArtifact = fs.readFileSync(bundleFile, 'utf8');
    assert.doesNotMatch(encryptedArtifact, /synthetic-identity-assertion/);
    assert.doesNotMatch(encryptedArtifact, /registration-fixture/);
    assert.equal(
      JSON.parse(encryptedArtifact).authorityExpiresAt,
      '2026-09-15T12:00:00.000Z',
    );
    fs.rmSync(sourceDirectory, { recursive: true, force: true });

    fs.writeFileSync(
      fakeNeonBin,
      `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const projectId = args[args.indexOf('delete') + 1];
const configDirectory = value('--config-dir');
const contextFile = value('--context-file');
const context = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
const credential = JSON.parse(fs.readFileSync(
  path.join(configDirectory, 'claimable-credential.' + projectId + '.json'),
  'utf8',
));
if (context.projectId !== projectId || credential.projectId !== projectId ||
    credential.identityAssertion !== 'synthetic-identity-assertion') process.exit(9);
fs.writeFileSync(process.env.CZA_RECOVERY_TEST_MARKER, JSON.stringify({
  recoveryDirectory: path.dirname(contextFile),
}));
process.stdout.write(JSON.stringify({project_id: projectId, state: 'deleted'}));
`,
      { mode: 0o700 },
    );
    const previousMarker = process.env.CZA_RECOVERY_TEST_MARKER;
    process.env.CZA_RECOVERY_TEST_MARKER = markerFile;
    try {
      const recoveryResult = recoverAndDelete({
        bundleFile,
        privateKeyFile,
        neonBin: fakeNeonBin,
      });
      assert.equal(recoveryResult.projectId, projectId);
      assert.equal(recoveryResult.state, 'deleted');
      assert.equal(recoveryResult.recoveryMode, 'encrypted-claimable-bundle');
      assert.match(recoveryResult.bundleSha256, /^[0-9a-f]{64}$/);
    } finally {
      if (previousMarker === undefined) {
        delete process.env.CZA_RECOVERY_TEST_MARKER;
      } else {
        process.env.CZA_RECOVERY_TEST_MARKER = previousMarker;
      }
    }
    const marker = JSON.parse(fs.readFileSync(markerFile, 'utf8'));
    assert.equal(fs.existsSync(marker.recoveryDirectory), false);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('productionAccessed is derived from observed runtime connection hashes', () => {
  const temporaryHash = createHash('sha256')
    .update('temporary-host')
    .digest('hex');
  const productionHash = createHash('sha256')
    .update('production-host')
    .digest('hex');
  const safe = summarizeNetworkAudit(
    [{ hostSha256: temporaryHash, blocked: false }],
    temporaryHash,
    new Set([productionHash]),
  );
  assert.equal(safe.productionAccessed, false);
  assert.deepEqual(safe.productionMatches, []);

  const blocked = summarizeNetworkAudit(
    [
      { hostSha256: temporaryHash, blocked: false },
      { hostSha256: productionHash, blocked: true },
    ],
    temporaryHash,
    new Set([productionHash]),
  );
  assert.equal(blocked.productionAccessed, true);
  assert.deepEqual(blocked.productionMatches, [productionHash]);
});

test('security workflows use immutable action and local Neon CLI references', () => {
  const canonicalWorkflow = fs.readFileSync(
    path.join(
      repositoryRoot,
      '.github/workflows/canonical-security-postgres.yml',
    ),
    'utf8',
  );
  const assessmentWorkflow = fs.readFileSync(
    path.join(repositoryRoot, '.github/workflows/assessment-ci.yml'),
    'utf8',
  );
  for (const workflow of [canonicalWorkflow, assessmentWorkflow]) {
    assert.doesNotMatch(workflow, /uses:\s+[^\s]+@v\d/);
    const actionReferences = [
      ...workflow.matchAll(/uses:\s+[^@\s]+@([^\s]+)/g),
    ];
    assert.ok(actionReferences.length > 0);
    for (const [, reference] of actionReferences) {
      assert.match(reference, /^[0-9a-f]{40}$/);
    }
  }
  assert.doesNotMatch(canonicalWorkflow, /\bnpx\b/);
  assert.match(canonicalWorkflow, /CZA_PRODUCTION_DB_ENDPOINT_MANIFEST/);
  assert.match(canonicalWorkflow, /neon-project-recovery\.json/);
  assert.match(canonicalWorkflow, /claimable-neon-recovery\.mjs/);
  assert.match(canonicalWorkflow, /neon-cleanup-recovery\.encrypted\.json/);
  assert.match(canonicalWorkflow, /generate-drill-key/);
  assert.match(canonicalWorkflow, /recover-delete/);
  assert.match(canonicalWorkflow, /neon-recovery-drill\.json/);
  assert.doesNotMatch(canonicalWorkflow, /productionAccessed:\s*false/);

  const packageManifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8'),
  );
  assert.equal(packageManifest.devDependencies.neon, '4.17.3');
  const neonVersion = spawnSync(
    path.join(repositoryRoot, 'node_modules/.bin/neon'),
    ['--version'],
    { encoding: 'utf8' },
  );
  assert.equal(neonVersion.status, 0);
  assert.equal(neonVersion.stdout.trim(), '4.17.3');
});
