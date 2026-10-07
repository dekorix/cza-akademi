import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const text = path => readFile(resolve(path), 'utf8');

test('P0 root has no provider or provisioning surface', async () => {
  const source = (await Promise.all((await readdir('infra/staging/p0-static')).filter(name => name.endsWith('.tf')).map(name => text(`infra/staging/p0-static/${name}`)))).join('\n');
  assert.doesNotMatch(source, /^\s*(resource|data|module|provider|import|removed)\s+["{]/m);
  assert.doesNotMatch(source, /backend\s+"|\b(local-exec|remote-exec)\b/);
});

test('generated graph covers each native provider control with a real HCL resource', async () => {
  const graph = JSON.parse(await text('infra/staging/generated/offline-resource-graph.json'));
  assert.equal(graph.source, 'GENERATED_FROM_HCL_AND_CONTROL_CLASSIFICATION');
  const resources = new Set(graph.nodes.filter(node => node.kind === 'resource').map(node => node.type));
  for (const required of [
    'cloudflare_ruleset', 'cloudflare_zero_trust_access_policy', 'cloudflare_zero_trust_access_application',
    'cloudflare_workers_script', 'cloudflare_workers_route', 'cloudflare_zero_trust_tunnel_cloudflared',
    'cloudflare_zero_trust_tunnel_cloudflared_config', 'cloudflare_dns_record', 'neon_project',
  ]) assert.ok(resources.has(required), required);
  for (const control of graph.controls.filter(item => item.class === 'NATIVE_PROVIDER_RESOURCE')) {
    assert.ok([...resources].some(type => control.implementation.includes(type)), control.id);
  }
});

test('header truncation and duplicate admission controls precede Worker trust markers', async () => {
  const hcl = await text('infra/staging/modules/cloudflare/main.tf');
  const worker = await text('infra/staging/worker/src/worker.mjs');
  assert.match(hcl, /http\.request\.headers\.truncated/);
  assert.match(hcl, /len\(http\.request\.headers\[\\"content-type\\"\]\) gt 1/);
  assert.match(hcl, /http_request_firewall_custom/);
  assert.match(hcl, /http_request_late_transform/);
  assert.match(worker, /x-cza-edge-header-state/);
  assert.doesNotMatch(worker, /headersTruncated\s*:\s*false/);
});

test('all workflow actions are immutable full SHA references', async () => {
  for (const name of (await readdir('.github/workflows')).filter(name => /\.ya?ml$/.test(name))) {
    const source = await text(`.github/workflows/${name}`);
    for (const line of source.split('\n').filter(value => /\buses:/.test(value) && !value.includes('./.github/'))) {
      assert.match(line, /@[0-9a-f]{40}(?:\s|#|$)/, `${name}: ${line}`);
    }
  }
});

test('Node dependency graph is bound by a frozen npm lockfile', async () => {
  const lock = JSON.parse(await text('package-lock.json'));
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.packages[''].name, 'sites-project');
  assert.equal(lock.packages[''].version, '0.1.0');
  for (const [path, entry] of Object.entries(lock.packages)) {
    assert.notEqual(entry.link, true, `local dependency link is forbidden: ${path}`);
    assert.doesNotMatch(entry.resolved || '', /^(?:\.\.?\/|file:)/, `non-registry dependency is forbidden: ${path}`);
  }
});

test('adapter and intent-only staging sources are absent', async () => {
  const paths = [
    'infra/staging/validation/schema-transport-adapter.json',
    'infra/staging/cloudflare/edge-ruleset.intent.json',
    'infra/staging/access/access-policy.json',
    'infra/staging/network/egress-policy.json',
  ];
  for (const path of paths) await assert.rejects(readFile(path), error => error.code === 'ENOENT');
});

test('P1 recovery executes with a scoped credential without publishing secrets', async () => {
  const workflow = await text('.github/workflows/faz3-p1-provision-reusable.yml');
  assert.match(workflow, /CZA_P1_RECOVERY_EXECUTE:\s*'true'/);
  assert.match(workflow, /reconcile-staging-v4\.mjs[^\n]*scoped-credential\.json/);
  assert.match(workflow, /faz3-wal-postgres-requested-/);
  assert.match(workflow, /faz3-wal-cleanup-requested-/);
  assert.match(workflow, /steps\.cleanup_requested_upload\.outcome == 'success'/);
  assert.match(workflow, /zero-live-resources/);
  assert.match(workflow, /p0cAttestationSha256:process\.env\.P0C_SHA/);
  assert.match(workflow, /rm -f recovery\/scoped-credential\.json recovery\/migrator-url\.txt/);

  const finalArtifact = workflow.slice(workflow.indexOf('- name: Preserve non-secret recovery identity'));
  assert.match(finalArtifact, /recovery\/\*\.jsonl/);
  assert.match(finalArtifact, /recovery\/\*\.receipt/);
  assert.doesNotMatch(finalArtifact, /scoped-credential|migrator-url|\.tfstate|path:\s*recovery\s*$/m);
});

test('offline delivery gate verifies its signed vendored toolchain before use', async () => {
  const gate = await text('scripts/faz3/run-offline-gate-v4.sh');
  const staticPreflight = gate.indexOf('verify-delivery-v4.mjs --static-only');
  const toolchainCheck = gate.indexOf('verify-vendored-toolchain.mjs');
  const firstTofu = gate.indexOf('"$tofu_bin"');
  assert.ok(staticPreflight >= 0 && staticPreflight < toolchainCheck && toolchainCheck < firstTofu);
  assert.doesNotMatch(gate, /npm ci|packages\.opentofu\.org|registry\.opentofu\.org/);
  const builder = await text('scripts/faz3/build-delivery-v4.mjs');
  assert.match(builder, /git', \['ls-files', '\.github\/workflows'\]/);
  assert.match(builder, /vendoredToolchainInventory/);
  const inventory = await text('scripts/faz3/toolchain-inventory.mjs');
  assert.match(inventory, /exclude: \['\.vite'\]/);
});
