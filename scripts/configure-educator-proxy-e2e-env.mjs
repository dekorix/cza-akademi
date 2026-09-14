import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);
const PRODUCTION_ENVIRONMENT_NAMES = Object.freeze([
  'CZA_PRODUCTION_DATABASE_URL',
  'CZA_PRODUCTION_DATABASE_URL_POOLED',
  'CZA_PRODUCTION_DATABASE_URL_UNPOOLED',
  'PRODUCTION_DATABASE_URL',
]);
const CLOUDFLARE_ACCOUNT_ENVIRONMENT_NAMES = Object.freeze([
  'CF_API_TOKEN',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_ZONE_ID',
]);

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

function appendEnvironment(file, name, value) {
  if (/[\r\n]/.test(name) || /\r/.test(value)) {
    throw new Error('github-environment-value-invalid');
  }
  const delimiter = `CZA_${randomBytes(12).toString('hex')}`;
  fs.appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`, {
    mode: 0o600,
  });
}

function mask(value) {
  process.stdout.write(`::add-mask::${value}\n`);
}

const neonEnvironment = readDotEnv(requiredEnvironment('CZA_NEON_ENV_FILE'));
const directConnection = neonEnvironment.DATABASE_URL_UNPOOLED;
if (!directConnection) throw new Error('direct-connection-missing');
if (process.env.DATABASE_URL) throw new Error('ambient-database-url-rejected');
if (PRODUCTION_ENVIRONMENT_NAMES.some((name) => process.env[name])) {
  throw new Error('production-database-configuration-rejected');
}
if (
  CLOUDFLARE_ACCOUNT_ENVIRONMENT_NAMES.some((name) => process.env[name])
) {
  throw new Error('cloudflare-account-configuration-rejected');
}

const databaseUrl = new URL(directConnection);
if (!POSTGRES_PROTOCOLS.has(databaseUrl.protocol)) {
  throw new Error('direct-connection-protocol-invalid');
}
if (databaseUrl.hostname.toLowerCase().includes('-pooler.')) {
  throw new Error('pooled-connection-rejected');
}

const githubEnvironment = requiredEnvironment('GITHUB_ENV');
const runnerTemporary = requiredEnvironment('RUNNER_TEMP');
const reportDirectory = requiredEnvironment('CZA_SECURITY_REPORT_DIR');
const trustedProxySecret = randomBytes(48).toString('base64url');
const previewAccessToken = randomBytes(32).toString('base64url');
const temporaryHostSha256 = createHash('sha256')
  .update(databaseUrl.hostname.toLowerCase())
  .digest('hex');

for (const value of [
  directConnection,
  databaseUrl.hostname,
  databaseUrl.username,
  databaseUrl.password,
  trustedProxySecret,
  previewAccessToken,
]) {
  if (value) mask(value);
}

const paths = {
  cloudflaredLog: path.join(runnerTemporary, 'cza-cloudflared.log'),
  networkAudit: path.join(reportDirectory, 'proxy-network-audit.jsonl'),
  originLog: path.join(runnerTemporary, 'cza-proxy-origin.log'),
  proxyLog: path.join(reportDirectory, 'proxy-events.jsonl'),
  report: path.join(reportDirectory, 'proxy-e2e-summary.json'),
  testLog: path.join(reportDirectory, 'proxy-e2e-test.log'),
};

fs.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });
for (const file of [paths.networkAudit, paths.proxyLog]) {
  fs.writeFileSync(file, '', { flag: 'wx', mode: 0o600 });
}

const environment = {
  DATABASE_URL: directConnection,
  CZA_ALLOWED_POSTGRES_HOST_SHA256: temporaryHostSha256,
  CZA_TRUSTED_PROXY_HMAC_SECRET: trustedProxySecret,
  CZA_PROXY_E2E_HMAC_SECRET: trustedProxySecret,
  CZA_PROXY_E2E_ACCESS_TOKEN: previewAccessToken,
  CZA_PROXY_E2E_OWNER_EMAIL: 'habipcann65@gmail.com',
  CZA_PROXY_E2E_ORIGIN_URL: 'http://127.0.0.1:8787',
  CZA_PROXY_E2E_PROXY_URL: 'http://127.0.0.1:8790',
  CZA_PROXY_E2E_CLOUDFLARED_LOG: paths.cloudflaredLog,
  CZA_PROXY_E2E_NETWORK_AUDIT: paths.networkAudit,
  CZA_PROXY_E2E_ORIGIN_LOG: paths.originLog,
  CZA_PROXY_E2E_PROXY_LOG: paths.proxyLog,
  CZA_PROXY_E2E_REPORT: paths.report,
  CZA_PROXY_E2E_TEST_LOG: paths.testLog,
  CZA_PROXY_E2E_PRODUCTION_CONFIGURATION_PRESENT: 'false',
  CZA_PROXY_E2E_CLOUDFLARE_ACCOUNT_CONFIGURATION_PRESENT: 'false',
};

for (const [name, value] of Object.entries(environment)) {
  appendEnvironment(githubEnvironment, name, value);
}

process.stdout.write(
  `${JSON.stringify({
    configured: true,
    connectionMode: 'direct-unpooled',
    productionConfigurationPresent: false,
    cloudflareAccountConfigurationPresent: false,
    temporaryHostSha256,
  })}\n`,
);
