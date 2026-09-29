import type { AssessmentTask, SkillId } from './assessment-engine';
import type { P2DefinitionStatus } from './assessment-definition';

export type EvidenceSource = 'server_evaluated' | 'educator_observed' | 'client_reported';
export type OutcomeStatus = 'scored' | 'insufficient_evidence';
type Verdict = 'correct' | 'incorrect';
export interface P2OutcomeAttempt {
  id?: string;
  task_code: string;
  client_attempt_id?: string | null;
  server_evaluation?: unknown;
  educator_review?: unknown;
  educator_reviewed_by?: string | null;
  educator_reviewed_at?: string | Date | null;
}
export interface OutcomeEvidence {
  attemptId: string | null;
  taskCode: string;
  source: EvidenceSource | null;
  verdict: Verdict | 'unassessable' | null;
  score: number | null;
}
export interface SkillOutcome {
  skillId: SkillId;
  status: OutcomeStatus;
  score: number | null;
  serverTaskCount: number;
  distinctGroupCount: number;
}
export interface P2LearningOutcome {
  status: OutcomeStatus;
  score: number | null;
  evidence: OutcomeEvidence[];
  counts: Record<EvidenceSource | 'unclassified', number>;
  skills: SkillOutcome[];
  criteria: { tasksPerSkill: 2; groupsPerSkill: 2; scoredSkillsForOverall: 2 };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function verdict(value: unknown): value is Verdict {
  return value === 'correct' || value === 'incorrect';
}

export function deriveP2LearningOutcome(
  attempts: P2OutcomeAttempt[],
  tasks: AssessmentTask[],
  definitionStatus: P2DefinitionStatus,
): P2LearningOutcome {
  const evidence: OutcomeEvidence[] = [];
  for (const attempt of attempts) {
    const evaluation = object(attempt.server_evaluation);
    const review = object(attempt.educator_review);
    let source: EvidenceSource | null = null;
    let decision: Verdict | 'unassessable' | null = null;
    if (definitionStatus === 'current_t4' && attempt.client_attempt_id && evaluation
      && evaluation.evaluatorId === 'P2_DETERMINISTIC_TEXT'
      && evaluation.evaluatorVersion === '1') {
      if (evaluation.responseOrigin === 'server_evaluated'
        && evaluation.needsEducatorReview === false && !review
        && verdict(evaluation.verdict)) {
        source = 'server_evaluated';
        decision = evaluation.verdict;
      } else if (evaluation.responseOrigin === 'client_reported'
        && evaluation.verdict === 'unassessable') {
        source = 'client_reported';
        decision = 'unassessable';
      }
    } else if ((definitionStatus === 'current' || definitionStatus === 'legacy_unversioned')
      && !attempt.client_attempt_id && !evaluation && !review) {
      source = 'client_reported';
    }
    evidence.push({
      attemptId: attempt.id ?? null, taskCode: attempt.task_code, source,
      verdict: decision, score: source === 'server_evaluated'
        ? decision === 'correct' ? 100 : 0 : null,
    });
    if (source === 'client_reported' && review?.origin === 'educator_observed'
      && verdict(review.decision) && evaluation?.needsEducatorReview === true
      && attempt.educator_reviewed_by && attempt.educator_reviewed_at) {
      evidence.push({
        attemptId: attempt.id ?? null, taskCode: attempt.task_code,
        source: 'educator_observed', verdict: review.decision, score: null,
      });
    }
  }
  const counts = { server_evaluated: 0, educator_observed: 0,
    client_reported: 0, unclassified: 0 };
  for (const item of evidence) counts[item.source ?? 'unclassified']++;
  const byTask = new Map(tasks.map((task) => [task.id, task]));
  const occurrences = new Map<string, number>();
  for (const item of evidence) if (item.source === 'server_evaluated') {
    occurrences.set(item.taskCode, (occurrences.get(item.taskCode) ?? 0) + 1);
  }
  const skillIds = new Set<SkillId>();
  for (const task of tasks) for (const weight of task.skillWeights) skillIds.add(weight.skillId);
  const skills: SkillOutcome[] = [...skillIds].map((skillId) => {
    const samples = evidence.flatMap((item) => {
      if (item.source !== 'server_evaluated' || item.score == null
        || occurrences.get(item.taskCode) !== 1) return [];
      const task = byTask.get(item.taskCode);
      const weight = task?.skillWeights.find((entry) => entry.skillId === skillId)?.weight;
      return task && typeof weight === 'number' && Number.isFinite(weight) && weight > 0
        ? [{ score: item.score, groupId: task.groupId, weight }] : [];
    });
    const groups = new Set(samples.map((sample) => sample.groupId)).size;
    const sufficient = samples.length >= 2 && groups >= 2;
    const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
    return {
      skillId, status: sufficient ? 'scored' : 'insufficient_evidence',
      score: sufficient ? Math.round(samples.reduce(
        (sum, sample) => sum + sample.score * sample.weight, 0) / totalWeight) : null,
      serverTaskCount: samples.length, distinctGroupCount: groups,
    };
  });
  const scored = skills.filter((skill) => skill.status === 'scored');
  const sufficient = scored.length >= 2;
  return {
    status: sufficient ? 'scored' : 'insufficient_evidence',
    score: sufficient ? Math.round(scored.reduce(
      (sum, skill) => sum + Number(skill.score), 0) / scored.length) : null,
    evidence, counts, skills,
    criteria: { tasksPerSkill: 2, groupsPerSkill: 2, scoredSkillsForOverall: 2 },
  };
}
