#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const RUN_ID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const PROVIDER_HOSTS = ['api.cloudflare.com', 'console.neon.tech'];
const SAFE_ID = /^[A-Za-z0-9_-]{1,160}$/;

function checkedIdentity(history) {
  const first = history[0];
  if (!RUN_ID.test(first?.runId || '') || typeof first?.label !== 'string' || !first.label.startsWith(`cza-f3-${first.runId.toLowerCase()}-`)) throw new Error('RECOVERY_IDENTITY_MISSING');
  if (/(^|[-_])(prod|production|main)([-_]|$)/i.test(first.label)) throw new Error('RECOVERY_SCOPE_FORBIDDEN');
  return { runId: first.runId, labelPrefix: `cza-f3-${first.runId.toLowerCase()}` };
}

async function api(fetchImpl, url, token, method = 'GET') {
  const response = await fetchImpl(url, { method, headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!response.ok) throw new Error(`RECOVERY_PROVIDER_HTTP_${response.status}`);
  if (method === 'DELETE' || response.status === 204) return {};
  return response.json();
}

function safeId(value) {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Error('RECOVERY_PROVIDER_ID_INVALID');
  return value;
}

function assertEgressContract(credential) {
  if (!Array.isArray(credential.providerEndpoints) || !Array.isArray(credential.productionEndpointSha256Denylist) || credential.productionEndpointSha256Denylist.length === 0) throw new Error('RECOVERY_EGRESS_POLICY_MISSING');
  const hosts = credential.providerEndpoints.map(value => new URL(value).hostname.toLowerCase()).sort();
  if (JSON.stringify(hosts) !== JSON.stringify(PROVIDER_HOSTS)) throw new Error('RECOVERY_PROVIDER_ENDPOINT_SET_INVALID');
  const denied = new Set(credential.productionEndpointSha256Denylist);
  for (const host of hosts) if (denied.has(createHash('sha256').update(host).digest('hex'))) throw new Error('RECOVERY_PRODUCTION_ENDPOINT_REJECTED');
}

async function discoverRunResources(fetchImpl, credential, identity) {
  const cf = 'https://api.cloudflare.com/client/v4';
  const neon = 'https://console.neon.tech/api/v2';
  const discovered = [];
  const add = (provider, kind, id, url) => discovered.push({ provider, kind, id: safeId(id), url });

  const projects = await api(fetchImpl, `${neon}/projects?limit=400`, credential.neonApiKey);
  for (const project of projects.projects || []) if (project.name?.startsWith(identity.labelPrefix)) add('neon', 'project', project.id, `${neon}/projects/${safeId(project.id)}`);

  const tunnels = await api(fetchImpl, `${cf}/accounts/${credential.cloudflareAccountId}/cfd_tunnel?name=${encodeURIComponent(identity.labelPrefix)}`, credential.cloudflareApiToken);
  for (const tunnel of tunnels.result || []) if (tunnel.name?.startsWith(identity.labelPrefix)) add('cloudflare', 'tunnel', tunnel.id, `${cf}/accounts/${credential.cloudflareAccountId}/cfd_tunnel/${safeId(tunnel.id)}`);

  const applications = await api(fetchImpl, `${cf}/accounts/${credential.cloudflareAccountId}/access/apps`, credential.cloudflareApiToken);
  for (const app of applications.result || []) if (app.name?.startsWith(identity.labelPrefix)) add('cloudflare', 'access-app', app.id, `${cf}/accounts/${credential.cloudflareAccountId}/access/apps/${safeId(app.id)}`);

  const policies = await api(fetchImpl, `${cf}/accounts/${credential.cloudflareAccountId}/access/policies`, credential.cloudflareApiToken);
  for (const policy of policies.result || []) if (policy.name?.startsWith(identity.labelPrefix)) add('cloudflare', 'access-policy', policy.id, `${cf}/accounts/${credential.cloudflareAccountId}/access/policies/${safeId(policy.id)}`);

  const rulesets = await api(fetchImpl, `${cf}/zones/${credential.cloudflareZoneId}/rulesets`, credential.cloudflareApiToken);
  for (const ruleset of rulesets.result || []) if (ruleset.name?.startsWith(identity.labelPrefix)) add('cloudflare', 'ruleset', ruleset.id, `${cf}/zones/${credential.cloudflareZoneId}/rulesets/${safeId(ruleset.id)}`);

  const scripts = await api(fetchImpl, `${cf}/accounts/${credential.cloudflareAccountId}/workers/scripts`, credential.cloudflareApiToken);
  for (const script of scripts.result || []) if (script.id?.startsWith(identity.labelPrefix)) add('cloudflare', 'worker', script.id, `${cf}/accounts/${credential.cloudflareAccountId}/workers/scripts/${safeId(script.id)}`);

  const routes = await api(fetchImpl, `${cf}/zones/${credential.cloudflareZoneId}/workers/routes`, credential.cloudflareApiToken);
  for (const route of routes.result || []) if (route.script?.startsWith(identity.labelPrefix)) add('cloudflare', 'worker-route', route.id, `${cf}/zones/${credential.cloudflareZoneId}/workers/routes/${safeId(route.id)}`);

  if (credential.transportAuthority) {
    const dns = await api(fetchImpl, `${cf}/zones/${credential.cloudflareZoneId}/dns_records?name=${encodeURIComponent(credential.transportAuthority)}`, credential.cloudflareApiToken);
    for (const record of dns.result || []) if (record.name === credential.transportAuthority) add('cloudflare', 'dns', record.id, `${cf}/zones/${credential.cloudflareZoneId}/dns_records/${safeId(record.id)}`);
  }
  return discovered;
}

export async function reconcileRun({ history, credential, execute = false, fetchImpl = fetch }) {
  const identity = checkedIdentity(history);
  if (!execute) return { result: 'DRY_RUN', providerMutationAttempted: false, discoveryQuery: identity };
  for (const key of ['cloudflareApiToken', 'neonApiKey', 'cloudflareAccountId', 'cloudflareZoneId']) if (typeof credential?.[key] !== 'string' || !credential[key]) throw new Error('RECOVERY_CREDENTIAL_INVALID');
  if (!/^[0-9a-f]{32}$/.test(credential.cloudflareAccountId) || !/^[0-9a-f]{32}$/.test(credential.cloudflareZoneId)) throw new Error('RECOVERY_CREDENTIAL_SCOPE_INVALID');
  assertEgressContract(credential);
  const discovered = await discoverRunResources(fetchImpl, credential, identity);
  const deletionOrder = ['worker-route', 'dns', 'worker', 'ruleset', 'access-app', 'access-policy', 'tunnel', 'project'];
  const deleted = [];
  for (const kind of deletionOrder) {
    for (const item of discovered.filter(value => value.kind === kind)) {
      await api(fetchImpl, item.url, item.provider === 'neon' ? credential.neonApiKey : credential.cloudflareApiToken, 'DELETE');
      deleted.push({ provider: item.provider, kind: item.kind, id: item.id });
    }
  }
  const remaining = await discoverRunResources(fetchImpl, credential, identity);
  if (remaining.length !== 0) throw new Error(`RECOVERY_RESOURCES_REMAIN:${remaining.map(item => `${item.kind}:${item.id}`).join(',')}`);
  return { result: 'RECONCILED', providerMutationAttempted: deleted.length > 0, runId: identity.runId, discovered: discovered.length, deleted, remaining: 0 };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const journal = process.argv[2];
  const credentialFile = process.argv[3];
  if (!journal) throw new Error('JOURNAL_REQUIRED');
  const history = (await readFile(journal, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  const execute = process.env.CZA_P1_RECOVERY_EXECUTE === 'true';
  const credential = execute && credentialFile ? JSON.parse(await readFile(credentialFile, 'utf8')) : {};
  process.stdout.write(`${JSON.stringify(await reconcileRun({ history, credential, execute }))}\n`);
}
