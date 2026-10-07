import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createPublicKey } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const registry = JSON.parse(await readFile('security/faz3/attestation/trust-roots.json', 'utf8'));
const active = registry.roots.filter(root => root.status === 'ACTIVE');
const retiredUnknown = registry.roots.filter(root => root.status === 'RETIRED_UNKNOWN');

test('trust-root registry has exactly one active staging root', () => {
  assert.equal(registry.schemaVersion, 'CZA-P0C-TRUST-ROOTS-V1');
  assert.equal(active.length, 1);
  assert.equal(active[0].algorithm, 'Ed25519');
  assert.equal(active[0].newSignaturesAccepted, true);
  assert.equal(active[0].productionEligible, false);
  assert.equal(active[0].scope, 'P0C_STAGING_ONLY_INTERIM');
});

test('retired unknown root cannot authorize new signatures', () => {
  assert.equal(retiredUnknown.length, 1);
  assert.equal(retiredUnknown[0].newSignaturesAccepted, false);
  assert.equal(retiredUnknown[0].historicalVerificationAllowed, true);
});

test('active fingerprint matches canonical SPKI public key', async () => {
  const pem = await readFile(active[0].publicKeyPath);
  const der = createPublicKey(pem).export({ type: 'spki', format: 'der' });
  const fingerprint = createHash('sha256').update(der).digest('hex');
  assert.equal(fingerprint, active[0].fingerprint);
});
