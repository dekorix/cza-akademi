#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CredentialBroker, BrokerError } from './broker.mjs';
import { GithubOidcVerifier } from './github-oidc.mjs';
import { PostgresLeaseStore } from './lease-store.mjs';
import { NeonAdminClient } from './neon-admin-client.mjs';

const json = (response, status, value) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(value)}\n`);
};

const body = async request => {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 16 * 1024) throw new BrokerError('REQUEST_TOO_LARGE', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new BrokerError('REQUEST_JSON_INVALID', 400); }
};

const bearer = request => {
  const match = /^Bearer ([A-Za-z0-9._~-]+)$/.exec(request.headers.authorization || '');
  if (!match) throw new BrokerError('BEARER_REQUIRED', 401);
  return match[1];
};

const leaseToken = request => {
  const value = request.headers['x-cza-lease-token'];
  if (typeof value !== 'string' || !/^cza_p1_[A-Za-z0-9_-]{43}$/.test(value)) throw new BrokerError('LEASE_TOKEN_REQUIRED', 401);
  return value;
};

export function createBrokerServer(broker) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://broker.invalid');
      if (url.search) throw new BrokerError('QUERY_PARAMETERS_FORBIDDEN', 400);
      if (request.method === 'GET' && url.pathname === '/healthz') return json(response, 200, await broker.health());
      if (request.method === 'POST' && url.pathname === '/v1/exchange') {
        return json(response, 200, await broker.exchange({ token: bearer(request), request: await body(request) }));
      }
      if (request.method === 'POST' && url.pathname === '/v1/neon/projects') {
        return json(response, 200, await broker.createProject({ token: bearer(request), leaseToken: leaseToken(request), request: await body(request) }));
      }
      const projectMatch = /^\/v1\/neon\/projects\/([0-9a-f-]{36})$/.exec(url.pathname);
      if (request.method === 'GET' && projectMatch) {
        return json(response, 200, await broker.inspectProject({ token: bearer(request), leaseToken: leaseToken(request), leaseProjectId: projectMatch[1] }));
      }
      if (request.method === 'DELETE' && projectMatch) {
        return json(response, 200, await broker.deleteProject({ token: bearer(request), leaseToken: leaseToken(request), leaseProjectId: projectMatch[1] }));
      }
      if (request.method === 'POST' && url.pathname === '/v1/revoke') {
        return json(response, 200, await broker.revoke({ token: bearer(request), leaseToken: leaseToken(request), request: await body(request) }));
      }
      return json(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const status = error instanceof BrokerError ? error.status : 503;
      return json(response, status, { error: error instanceof BrokerError ? error.code : 'BROKER_UNAVAILABLE' });
    }
  });
}

export function configurationFromEnvironment(environment) {
  if (environment.CZA_NEON_ADMIN_API_KEY || environment.CZA_NEON_ORGANIZATION_ID) throw new Error('LEGACY_NEON_ADMIN_CONFIGURATION_FORBIDDEN');
  const required = [
    'CZA_BROKER_DATABASE_URL', 'CZA_BROKER_CAPABILITY_SECRET', 'CZA_STAGING_NEON_API_KEY',
    'CZA_STAGING_NEON_ORG_ID', 'CZA_CURRENT_P0C_SHA256', 'CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST',
  ];
  for (const key of required) if (!environment[key]) throw new Error(`${key}_REQUIRED`);
  return {
    databaseUrl: environment.CZA_BROKER_DATABASE_URL,
    capabilitySecret: environment.CZA_BROKER_CAPABILITY_SECRET,
    stagingApiKey: environment.CZA_STAGING_NEON_API_KEY,
    stagingOrganizationId: environment.CZA_STAGING_NEON_ORG_ID,
    region: environment.CZA_STAGING_NEON_REGION || 'aws-eu-central-1',
    currentP0c: environment.CZA_CURRENT_P0C_SHA256,
    productionDenylist: environment.CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST.split(',').filter(Boolean),
    policyFile: resolve(environment.CZA_RUNTIME_POLICY_FILE || 'security/faz3/oidc/p1-neon-runtime-policy.json'),
  };
}

async function main() {
  const configuration = configurationFromEnvironment(process.env);
  const [{ default: postgres }, policy] = await Promise.all([
    import('postgres'),
    readFile(configuration.policyFile, 'utf8').then(JSON.parse),
  ]);
  const sql = postgres(configuration.databaseUrl, { max: 10, ssl: 'require', prepare: true });
  const leaseStore = new PostgresLeaseStore(sql);
  const migration = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), 'migrations/001_p1_broker_leases.sql'), 'utf8');
  await leaseStore.migrate(migration);
  const broker = new CredentialBroker({
    oidcVerifier: new GithubOidcVerifier({ policy }),
    neonClient: new NeonAdminClient({
      stagingApiKey: configuration.stagingApiKey,
      stagingOrganizationId: configuration.stagingOrganizationId,
      region: configuration.region,
    }),
    leaseStore,
    capabilitySecret: configuration.capabilitySecret,
    currentP0c: configuration.currentP0c,
    productionDenylist: configuration.productionDenylist,
  });
  const sweep = async () => broker.sweepExpired().catch(() => {});
  const timer = setInterval(sweep, 60_000);
  timer.unref();
  createBrokerServer(broker).listen(Number(process.env.PORT || 8080), '0.0.0.0');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
