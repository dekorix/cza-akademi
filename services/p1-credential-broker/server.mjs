#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { CredentialBroker, BrokerError } from './broker.mjs';
import { GithubOidcVerifier } from './github-oidc.mjs';
import { JsonLeaseStore } from './lease-store.mjs';
import { NeonAdminClient } from './neon-admin-client.mjs';

const json = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(`${JSON.stringify(body)}\n`);
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

export function createBrokerServer(broker) {
  return createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/healthz') return json(response, 200, { status: 'ok' });
      if (request.method === 'POST' && request.url === '/v1/exchange') return json(response, 200, await broker.exchange({ token: bearer(request), request: await body(request) }));
      if (request.method === 'POST' && request.url === '/v1/revoke') return json(response, 200, await broker.revoke({ token: bearer(request), request: await body(request) }));
      return json(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const status = error instanceof BrokerError ? error.status : 503;
      return json(response, status, { error: error instanceof BrokerError ? error.code : 'BROKER_UNAVAILABLE' });
    }
  });
}

async function main() {
  const policyPath = resolve(process.env.CZA_RUNTIME_POLICY_FILE || 'security/faz3/oidc/p1-neon-runtime-policy.json');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  const broker = new CredentialBroker({
    oidcVerifier: new GithubOidcVerifier({ policy }),
    neonClient: new NeonAdminClient({ adminApiKey: process.env.CZA_NEON_ADMIN_API_KEY, organizationId: process.env.CZA_NEON_ORGANIZATION_ID }),
    leaseStore: new JsonLeaseStore(process.env.CZA_BROKER_LEASE_STORE || '/var/lib/cza-p1-broker/leases.json'),
    currentP0c: process.env.CZA_CURRENT_P0C_SHA256,
    productionDenylist: String(process.env.CZA_PRODUCTION_ENDPOINT_SHA256_DENYLIST || '').split(',').filter(Boolean),
  });
  const sweep = async () => broker.sweepExpired().catch(() => {});
  const timer = setInterval(sweep, 60_000);
  timer.unref();
  createBrokerServer(broker).listen(Number(process.env.PORT || 8080), '0.0.0.0');
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) await main();
