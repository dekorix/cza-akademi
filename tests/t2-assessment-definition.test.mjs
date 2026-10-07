import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'lib/assessment-definition.ts'), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test('T2 definition pins item content and fails closed on version drift', () => {
  const tasks = [{ id: 'MAT-01A', childInstruction: 'Original', rubric: [{ id: 'accuracy', max: 4 }] }];
  const routing = { anchorAnswers: { 'MAT-01A': ['4'] }, fixedNext: {}, adaptiveNext: {} };
  const commonJsModule = { exports: {} };
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated TypeScript module harness
  new Function('require', 'module', 'exports', js)(
    (id) => {
      if (id === 'node:crypto') return { createHash };
      if (id.includes('assessment-routing')) return { assessmentTasks: tasks, assessmentRoutingRuleSet: () => routing };
      throw new Error('unexpected import: ' + id);
    },
    commonJsModule,
    commonJsModule.exports,
  );
  const { currentP2Definition, p2DefinitionStatus } = commonJsModule.exports;
  const pinned = currentP2Definition();
  assert.equal(pinned.definitionId, 'CZA_1_TO_2');
  assert.equal(pinned.assessmentVersion, 1);
  assert.equal(pinned.serverEvaluatorId, 'NONE_CLIENT_REPORTED');
  assert.match(pinned.itemBankSha256, /^[0-9a-f]{64}$/);
  assert.match(pinned.routingSha256, /^[0-9a-f]{64}$/);
  assert.equal(p2DefinitionStatus(pinned), 'current');
  assert.equal(p2DefinitionStatus(null), 'legacy_unversioned');
  assert.equal(p2DefinitionStatus({ ...pinned, assessmentVersion: 2 }), 'mismatch');
  assert.equal(p2DefinitionStatus({ ...pinned, rubricVersion: 'OTHER' }), 'mismatch');
  tasks[0].childInstruction = 'Changed after publication';
  assert.notEqual(currentP2Definition().itemBankSha256, pinned.itemBankSha256);
  assert.equal(p2DefinitionStatus(pinned), 'mismatch');
  tasks[0].childInstruction = 'Original';
  routing.anchorAnswers['MAT-01A'] = ['5'];
  assert.notEqual(currentP2Definition().routingSha256, pinned.routingSha256);
  assert.equal(p2DefinitionStatus(pinned), 'mismatch');
});
