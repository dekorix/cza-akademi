import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const serverSource = fs.readFileSync(
  new URL('../lib/learning-contract-server.ts', import.meta.url),
  'utf8',
);
const serverJs = ts.transpileModule(serverSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const serverContract = await import(
  `data:text/javascript;base64,${Buffer.from(serverJs).toString('base64')}`
);

const canonicalRecord = {
  recordType: 'module_record',
  schemaVersion: 'CZA_MODULE_RECORD_V1',
  contractVersion: '1.0.0',
  clientRecordId: '11111111-1111-4111-8111-111111111111',
  trainingSessionId: '22222222-2222-4222-8222-222222222222',
  moduleId: 'finger_read',
  moduleVersion: '1.0.0',
  activityType: 'number_recognition',
  startedAt: '2026-09-13T10:00:00.000Z',
  completedAt: '2026-09-13T10:00:10.000Z',
  supportLevel: 'independent',
  performance: { correct: 8, total: 10 },
  skills: ['visual_attention', 'number_recognition'],
  metadata: { level: 1 },
};

const parsed = serverContract.parseCanonicalLearningRecord(canonicalRecord, '1.0.0');
assert.equal(parsed.moduleId, 'finger_read');
assert.equal(parsed.trainingSessionId, canonicalRecord.trainingSessionId);
assert.equal(parsed.startedAt, '2026-09-13T10:00:00.000Z');

assert.throws(
  () => serverContract.parseCanonicalLearningRecord(
    { ...canonicalRecord, studentId: 'untrusted' },
    '1.0.0',
  ),
  /cza_record_unknown_field/,
);

assert.throws(
  () => serverContract.parseCanonicalLearningRecord(
    { ...canonicalRecord, trainingSessionId: 'not-a-uuid' },
    '1.0.0',
  ),
  /cza_training_session_id_invalid/,
);

const runtime = await import('../public/cza/core/cza-core-runtime.js');
const modules = new runtime.CzaModuleRegistry();
modules.register({
  id: 'finger_read',
  name: 'Parmak Okuma',
  version: '1.0.0',
  activityTypes: ['number_recognition'],
});
const learning = new runtime.CzaLearningContract({
  modules,
  now: () => new Date('2026-09-13T10:00:10.000Z'),
});
const clientRecord = learning.createRecord({
  trainingSessionId: canonicalRecord.trainingSessionId,
  moduleId: 'finger_read',
  activityType: 'number_recognition',
  clientRecordId: canonicalRecord.clientRecordId,
  startedAt: canonicalRecord.startedAt,
  completedAt: canonicalRecord.completedAt,
});
assert.equal(clientRecord.moduleId, 'finger_read');
assert.ok(Object.isFrozen(clientRecord));

const { CzaCoreTransportAdapter } = await import('../public/cza/core/cza-core-transport.js');
let requestBody;
const transport = new CzaCoreTransportAdapter({
  contractVersion: '1.0.0',
  fetchImpl: async (_url, options) => {
    requestBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 201,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true, learningRecordId: 'record-1', replayed: false }),
    };
  },
});
await transport.publish(clientRecord);
assert.equal(requestBody.action, 'module_record');
assert.equal(requestBody.record.clientRecordId, canonicalRecord.clientRecordId);

const migration = fs.readFileSync(
  new URL('../db/migrations/20260913_canonical_learning_ledger_v1.sql', import.meta.url),
  'utf8',
);
assert.match(migration, /UNIQUE \(academy_id, client_record_id\)/);
assert.match(migration, /IDEMPOTENCY_KEY_REUSED/);
assert.match(migration, /CZA_SESSION_OWNERSHIP_INVALID/);
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.learning_evidence/);

const route = fs.readFileSync(new URL('../app/api/core/route.ts', import.meta.url), 'utf8');
for (const existingAction of ['login', 'me', 'start', 'finish', 'interaction', 'attempt', 'logout']) {
  assert.match(route, new RegExp(`'${existingAction}'`));
}
assert.match(route, /'module_record'/);
assert.match(route, /authenticatedStudent\(request\)/);

console.log('canonical learning persistence: 20 assertions passed');
