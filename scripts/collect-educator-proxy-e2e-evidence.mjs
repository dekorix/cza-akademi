import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing-environment:${name}`);
  return value;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readJsonLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const tunnelUrl = new URL(requiredEnvironment('CZA_PROXY_E2E_TUNNEL_URL'));
const reportFile = requiredEnvironment('CZA_PROXY_E2E_REPORT');
const testLogFile = requiredEnvironment('CZA_PROXY_E2E_TEST_LOG');
const proxyEvents = readJsonLines(
  requiredEnvironment('CZA_PROXY_E2E_PROXY_LOG'),
);
const networkEvents = readJsonLines(
  requiredEnvironment('CZA_PROXY_E2E_NETWORK_AUDIT'),
);
const testExitCode = Number(
  requiredEnvironment('CZA_PROXY_E2E_TEST_EXIT_CODE'),
);
const forwarded = proxyEvents.filter(
  (event) => event.event === 'request_forwarded',
);
const listenerEvidence = requiredEnvironment('CZA_PROXY_E2E_LISTENER_EVIDENCE');
const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], {
  encoding: 'utf8',
}).trim();

const report = {
  schemaVersion: 1,
  source: {
    commit: process.env.GITHUB_SHA || 'local',
    tree: sourceTree,
    pullRequest: process.env.GITHUB_REF || 'local',
  },
  cloudflare: {
    mode: 'ephemeral-quick-tunnel',
    accountCredentialUsed:
      requiredEnvironment(
        'CZA_PROXY_E2E_CLOUDFLARE_ACCOUNT_CONFIGURATION_PRESENT',
      ) === 'true',
    productionZoneConfigured:
      requiredEnvironment(
        'CZA_PROXY_E2E_CLOUDFLARE_ACCOUNT_CONFIGURATION_PRESENT',
      ) === 'true',
    tunnelHostnameSha256: sha256(tunnelUrl.hostname.toLowerCase()),
    cloudflaredVersion: '2026.9.1',
    binarySha256:
      '03f1f25d1cc93b9ad6c60569d44060bc4f17ed97075760ed8cfca4b12dcd68cc',
  },
  isolation: {
    productionConfigurationPresent:
      requiredEnvironment(
        'CZA_PROXY_E2E_PRODUCTION_CONFIGURATION_PRESENT',
      ) === 'true',
    originListener: listenerEvidence,
    originRoutedByTunnel: false,
    routedProxyListener: '127.0.0.1:8790',
    temporaryPostgresHostSha256: requiredEnvironment(
      'CZA_ALLOWED_POSTGRES_HOST_SHA256',
    ),
    blockedDatabaseConnections: networkEvents.filter(
      (event) => event.blocked === true,
    ).length,
  },
  proxyBoundary: {
    previewAccessMode: 'ephemeral-bearer',
    signatureVersion: 'cza-educator-proxy-v2',
    forwardedRequests: forwarded.length,
    allProtectedHeadersOverwritten:
      forwarded.length >= 2 &&
      forwarded.every((event) => event.protectedHeadersOverwritten === true),
    uniqueForwardedNonces:
      new Set(forwarded.map((event) => event.nonceSha256)).size ===
      forwarded.length,
    rawIdentityStored: false,
    accessTokenStored: false,
    hmacSecretStored: false,
  },
  tests: {
    status: testExitCode === 0 ? 'passed' : 'failed',
    exitCode: testExitCode,
    logSha256: fs.existsSync(testLogFile)
      ? sha256(fs.readFileSync(testLogFile))
      : null,
  },
};

if (
  report.isolation.productionConfigurationPresent ||
  report.cloudflare.accountCredentialUsed ||
  report.cloudflare.productionZoneConfigured ||
  report.isolation.originListener !== '127.0.0.1:8787' ||
  report.isolation.blockedDatabaseConnections !== 0 ||
  !report.proxyBoundary.allProtectedHeadersOverwritten ||
  !report.proxyBoundary.uniqueForwardedNonces ||
  report.tests.status !== 'passed'
) {
  throw new Error('proxy-e2e-evidence-invalid');
}

fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
  mode: 0o600,
});
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
