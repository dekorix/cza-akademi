import type { AssessmentTask } from './assessment-engine';

export type LearningResponseStatus =
  | 'DIRECT_MASTERY'
  | 'HIGH_RESPONSE'
  | 'MODERATE_RESPONSE'
  | 'NEEDS_SUPPORT'
  | 'INCOMPLETE';

export interface AssessmentAttemptRecord {
  id?: string;
  task_code: string;
  support_level?: number | null;
  rubric_scores?: Record<string, number> | null;
  answer_payload?: Record<string, unknown> | null;
}

export interface LearningResponseFamily {
  groupId: string;
  anchorTaskCode: string;
  supportTaskCode?: string;
  transferTaskCode?: string;
  initialScore: number | null;
  supportedScore: number | null;
  transferScore: number | null;
  independenceScore: number;
  supportTriggered: boolean;
  supportBenefit: number | null;
  index: number | null;
  status: LearningResponseStatus;
  evidenceCompleteness: number;
}

export interface LearningResponseSummary {
  index: number | null;
  label: string;
  directMasteryFamilies: number;
  responsiveFamilies: number;
  needsSupportFamilies: number;
  completedFamilies: number;
  totalFamilies: number;
  families: LearningResponseFamily[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function routeCorrectness(attempt?: AssessmentAttemptRecord) {
  const value = attempt?.answer_payload?.routeCorrectness;
  if (value === 'correct') return 100;
  if (value === 'incorrect') return 0;
  return null;
}

function rubricPercent(attempt: AssessmentAttemptRecord | undefined, task: AssessmentTask | undefined, preferred: string[]) {
  if (!attempt || !task) return null;
  const scores = attempt.rubric_scores || {};
  for (const id of preferred) {
    const dimension = task.rubric.find((item) => item.id === id);
    const raw = scores[id];
    if (dimension && typeof raw === 'number' && Number.isFinite(raw)) {
      return clamp((raw / Math.max(1, dimension.max)) * 100);
    }
  }
  const scored = task.rubric
    .map((dimension) => ({ dimension, raw: scores[dimension.id] }))
    .filter((item) => typeof item.raw === 'number' && Number.isFinite(item.raw));
  if (!scored.length) return null;
  const earned = scored.reduce((sum, item) => sum + Number(item.raw), 0);
  const possible = scored.reduce((sum, item) => sum + item.dimension.max, 0);
  return possible ? clamp((earned / possible) * 100) : null;
}

function scoreFor(attempt: AssessmentAttemptRecord | undefined, task: AssessmentTask | undefined, preferred: string[]) {
  return routeCorrectness(attempt) ?? rubricPercent(attempt, task, preferred);
}

function weightedAvailable(parts: Array<{ value: number | null; weight: number }>) {
  const available = parts.filter((part): part is { value: number; weight: number } => typeof part.value === 'number');
  const totalWeight = available.reduce((sum, part) => sum + part.weight, 0);
  if (!totalWeight) return null;
  return Math.round(available.reduce((sum, part) => sum + part.value * part.weight, 0) / totalWeight);
}

function statusFor(index: number | null, supportTriggered: boolean, initialScore: number | null): LearningResponseStatus {
  if (index == null) return 'INCOMPLETE';
  if (!supportTriggered && (initialScore ?? 0) >= 80) return 'DIRECT_MASTERY';
  if (index >= 80) return 'HIGH_RESPONSE';
  if (index >= 60) return 'MODERATE_RESPONSE';
  return 'NEEDS_SUPPORT';
}

function labelFor(index: number | null, completed: number, direct: number) {
  if (index == null || completed === 0) return 'Henüz yeterli öğrenme tepkisi kanıtı yok';
  if (direct >= Math.max(2, Math.ceil(completed * 0.6)) && index >= 80) return 'Doğrudan yeterlilik ve transfer güçlü';
  if (index >= 85) return 'Çok güçlü öğrenme tepkisi';
  if (index >= 70) return 'Güçlü öğrenme tepkisi';
  if (index >= 55) return 'Gelişen öğrenme tepkisi';
  return 'Daha yapılandırılmış destekle izlenmeli';
}

export function calculateLearningResponse(
  attempts: AssessmentAttemptRecord[],
  tasks: AssessmentTask[],
): LearningResponseSummary {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const attemptsByTask = new Map<string, AssessmentAttemptRecord[]>();
  for (const attempt of attempts) {
    const bucket = attemptsByTask.get(attempt.task_code) ?? [];
    bucket.push(attempt);
    attemptsByTask.set(attempt.task_code, bucket);
  }

  const groups = new Map<string, AssessmentTask[]>();
  for (const task of tasks) {
    if (task.role === 'WARMUP') continue;
    const bucket = groups.get(task.groupId) ?? [];
    bucket.push(task);
    groups.set(task.groupId, bucket);
  }

  const families: LearningResponseFamily[] = [];
  for (const [groupId, groupTasks] of groups) {
    const anchorTask = groupTasks.find((task) => task.role === 'ACADEMIC_ANCHOR');
    if (!anchorTask) continue;
    const supportTask = groupTasks.find((task) => task.role === 'SUPPORT_PROBE');
    const transferTask = groupTasks.find((task) => task.role === 'TRANSFER');
    const anchorAttempt = attemptsByTask.get(anchorTask.id)?.at(-1);
    if (!anchorAttempt) continue;
    const supportAttempt = supportTask ? attemptsByTask.get(supportTask.id)?.at(-1) : undefined;
    const transferAttempt = transferTask ? attemptsByTask.get(transferTask.id)?.at(-1) : undefined;

    const initialScore = scoreFor(anchorAttempt, taskById.get(anchorTask.id), ['accuracy']);
    const supportedScore = scoreFor(supportAttempt, supportTask, ['accuracy', 'strategy']);
    const transferScore = scoreFor(transferAttempt, transferTask, ['transfer', 'accuracy', 'strategy']);
    const supportTriggered = Boolean(anchorAttempt.answer_payload?.supportTriggered) || Boolean(supportAttempt);
    const maxSupport = Math.max(Number(anchorAttempt.support_level ?? 0), Number(supportAttempt?.support_level ?? 0));
    const independenceScore = clamp(100 - maxSupport * 14);
    const supportBenefit = initialScore != null && supportedScore != null ? Math.round(supportedScore - initialScore) : null;

    const index = supportTriggered
      ? weightedAvailable([
          { value: initialScore, weight: 0.15 },
          { value: supportedScore, weight: 0.35 },
          { value: transferScore, weight: 0.40 },
          { value: independenceScore, weight: 0.10 },
        ])
      : weightedAvailable([
          { value: initialScore, weight: 0.45 },
          { value: transferScore, weight: 0.40 },
          { value: independenceScore, weight: 0.15 },
        ]);

    const availableEvidence = [initialScore, supportedScore, transferScore].filter((value) => value != null).length;
    const expectedEvidence = supportTriggered ? 3 : 2;
    const evidenceCompleteness = Math.round((Math.min(availableEvidence, expectedEvidence) / expectedEvidence) * 100);
    families.push({
      groupId,
      anchorTaskCode: anchorTask.id,
      supportTaskCode: supportTask?.id,
      transferTaskCode: transferTask?.id,
      initialScore,
      supportedScore,
      transferScore,
      independenceScore,
      supportTriggered,
      supportBenefit,
      index,
      status: statusFor(index, supportTriggered, initialScore),
      evidenceCompleteness,
    });
  }

  const usable = families.filter((family) => family.index != null && family.evidenceCompleteness >= 50);
  const overall = usable.length
    ? Math.round(usable.reduce((sum, family) => sum + Number(family.index) * Math.max(0.5, family.evidenceCompleteness / 100), 0) /
        usable.reduce((sum, family) => sum + Math.max(0.5, family.evidenceCompleteness / 100), 0))
    : null;
  const directMasteryFamilies = usable.filter((family) => family.status === 'DIRECT_MASTERY').length;
  const responsiveFamilies = usable.filter((family) => family.status === 'HIGH_RESPONSE' || family.status === 'MODERATE_RESPONSE').length;
  const needsSupportFamilies = usable.filter((family) => family.status === 'NEEDS_SUPPORT').length;

  return {
    index: overall,
    label: labelFor(overall, usable.length, directMasteryFamilies),
    directMasteryFamilies,
    responsiveFamilies,
    needsSupportFamilies,
    completedFamilies: usable.length,
    totalFamilies: families.length,
    families,
  };
}
