import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPECIAL_PROFILE_CODES,
  isTaskAllowedForProfile,
  normalizeSpecialEvidence,
  specialTemplateCode,
} from '../lib/special-assessment.ts';

test('all special profiles have stable central template codes', () => {
  assert.equal(SPECIAL_PROFILE_CODES.length, 10);
  assert.equal(specialTemplateCode('SP-DYS'), 'CZA_SPECIAL_V1_DYS');
  assert.equal(specialTemplateCode('SP-DYSC'), 'CZA_SPECIAL_V1_DYSC');
});

test('task codes cannot cross profile boundaries', () => {
  assert.equal(isTaskAllowedForProfile('SP-DYS', 'DYS-PH01'), true);
  assert.equal(isTaskAllowedForProfile('SP-DYS', 'DYS-TR06'), true);
  assert.equal(isTaskAllowedForProfile('SP-DYSC', 'DYC10'), true);
  assert.equal(isTaskAllowedForProfile('SP-DYSC', 'DYS-PH01'), false);
  assert.equal(isTaskAllowedForProfile('SP-ASD', 'ASD10'), true);
  assert.equal(isTaskAllowedForProfile('SP-ASD', 'ATT01'), false);
});

test('special evidence is normalized for canonical assessment storage', () => {
  const normalized = normalizeSpecialEvidence('SP-DYS', {
    taskCode: 'DYS-PH01',
    answerText: 'al',
    verdict: 'MATCH',
    supportLevel: 'INDEPENDENT',
    flags: ['Kendini düzeltti'],
    responseLatencyMs: 1400,
    totalResponseTimeMs: 4200,
  });
  assert.equal(normalized.taskCode, 'DYS-PH01');
  assert.equal(normalized.supportLevelNumber, 0);
  assert.equal(normalized.selfCorrected, true);
  assert.equal(normalized.payload.profileCode, 'SP-DYS');
});

test('invalid task code is rejected', () => {
  assert.throws(
    () => normalizeSpecialEvidence('SP-DYS', { taskCode: 'DROP-TABLE-01' }),
    /special_task_not_allowed/,
  );
});
