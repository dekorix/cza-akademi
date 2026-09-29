import { createHash } from 'node:crypto';
import { assessmentRoutingRuleSet, assessmentTasks } from './assessment-routing';

// The existing P2 task bank remains the single source for assessment content.
// A changed task bank must receive a new definition; old pinned sessions fail closed.
const identity = Object.freeze({
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

export function currentP2Definition() {
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

export type P2DefinitionContract = ReturnType<typeof currentP2Definition>;

export function p2DefinitionStatus(
  value: unknown,
): 'legacy_unversioned' | 'current' | 'mismatch' {
  if (value == null) return 'legacy_unversioned';
  if (typeof value !== 'object' || Array.isArray(value)) return 'mismatch';
  const candidate = value as Record<string, unknown>;
  const expected = currentP2Definition();
  const keys = Object.keys(expected);
  return Object.keys(candidate).length === keys.length &&
    keys.every((key) => candidate[key] === expected[key as keyof P2DefinitionContract])
    ? 'current'
    : 'mismatch';
}
