import { createHash } from 'node:crypto';
import { assessmentRoutingRuleSet, assessmentTasks } from './assessment-routing';

// T2 is immutable: old sessions retain a client-reported evaluator identity.
const legacyIdentity = Object.freeze({
  definitionId: 'CZA_1_TO_2',
  assessmentVersion: 1,
  blueprintId: 'P2_1_TO_2',
  blueprintVersion: 1,
  taskMappingVersion: 'LEGACY_ROUTING_V1',
  serverEvaluatorId: 'NONE_CLIENT_REPORTED',
  serverEvaluatorVersion: '0',
  rubricVersion: 'LEGACY_P2_RUBRIC_V1',
  answerKeyVersion: 'LEGACY_P2_ANSWER_KEY_V1',
});
const t4Identity = Object.freeze({
  ...legacyIdentity,
  assessmentVersion: 2,
  serverEvaluatorId: 'P2_DETERMINISTIC_TEXT',
  serverEvaluatorVersion: '1',
});

function definition(identity: typeof legacyIdentity | typeof t4Identity) {
  return {
    ...identity,
    itemBankSha256: createHash('sha256')
      .update(JSON.stringify(assessmentTasks))
      .digest('hex'),
    routingSha256: createHash('sha256')
      .update(JSON.stringify(assessmentRoutingRuleSet()))
      .digest('hex'),
  };
}
export function currentP2Definition() {
  return definition(legacyIdentity);
}
export function t4P2Definition() {
  return definition(t4Identity);
}

export type P2DefinitionContract = ReturnType<typeof currentP2Definition>;
export type P2DefinitionStatus = 'legacy_unversioned' | 'current' | 'current_t4' | 'mismatch';

function matches(candidate: Record<string, unknown>, expected: P2DefinitionContract) {
  const keys = Object.keys(expected);
  return Object.keys(candidate).length === keys.length &&
    keys.every((key) => candidate[key] === expected[key as keyof P2DefinitionContract]);
}

export function p2DefinitionStatus(value: unknown): P2DefinitionStatus {
  if (value == null) return 'legacy_unversioned';
  if (typeof value !== 'object' || Array.isArray(value)) return 'mismatch';
  const candidate = value as Record<string, unknown>;
  if (matches(candidate, currentP2Definition())) return 'current';
  if (matches(candidate, t4P2Definition())) return 'current_t4';
  return 'mismatch';
}
