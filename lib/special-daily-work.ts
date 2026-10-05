import type { SpecialEducationProgramDraft, SpecialProgramPriority } from './special-education-program';

export type SpecialDailyWork = {
  sessionIndex: number;
  totalSessions: number;
  week: 1 | 2 | 3 | 4;
  sessionInWeek: number;
  title: string;
  focus: string;
  minutes: number;
  priorityKeys: string[];
  activities: {
    priorityKey: string;
    label: string;
    activity: string;
    successCriterion: string;
  }[];
  educatorHint: string;
  measurement: string;
  isReassessment: boolean;
};

function safeWeek(index: number, sessionsPerWeek: number): 1 | 2 | 3 | 4 {
  return Math.min(4, Math.max(1, Math.floor((index - 1) / sessionsPerWeek) + 1)) as 1 | 2 | 3 | 4;
}

function rotate<T>(items: T[], offset: number) {
  if (!items.length) return [] as T[];
  const normalized = ((offset % items.length) + items.length) % items.length;
  return [...items.slice(normalized), ...items.slice(0, normalized)];
}

function activityFor(priority: SpecialProgramPriority, sessionIndex: number) {
  const list = priority.activities.length ? priority.activities : [priority.label];
  return list[(sessionIndex - 1) % list.length];
}

export function buildSpecialDailyWork(
  draft: SpecialEducationProgramDraft,
  completedSessions: number,
): SpecialDailyWork | null {
  const totalSessions = draft.durationWeeks * draft.sessionsPerWeek;
  const sessionIndex = completedSessions + 1;
  if (sessionIndex > totalSessions) return null;

  const week = safeWeek(sessionIndex, draft.sessionsPerWeek);
  const sessionInWeek = ((sessionIndex - 1) % draft.sessionsPerWeek) + 1;
  const weekPlan = draft.weeks.find(item => item.week === week) || draft.weeks[week - 1];
  const rotated = rotate(draft.priorities, sessionIndex - 1);
  const chosen = rotated.slice(0, Math.min(3, rotated.length));
  const isReassessment = week === 4 && sessionInWeek === draft.sessionsPerWeek;

  return {
    sessionIndex,
    totalSessions,
    week,
    sessionInWeek,
    title: isReassessment
      ? '4. hafta yeniden ölçüm'
      : `${week}. hafta · ${sessionInWeek}. çalışma`,
    focus: isReassessment ? 'Kalıcılık ve yeni örneklerle yeniden ölçüm' : weekPlan.focus,
    minutes: draft.sessionMinutes,
    priorityKeys: chosen.map(item => item.key),
    activities: chosen.map(priority => ({
      priorityKey: priority.key,
      label: priority.label,
      activity: isReassessment
        ? `${priority.label}: daha önce kullanılmamış yeni bir örnekle bağımsız deneme`
        : activityFor(priority, sessionIndex),
      successCriterion: priority.successCriterion,
    })),
    educatorHint: isReassessment
      ? draft.reassessment.rule
      : weekPlan.educatorAction,
    measurement: weekPlan.measurement,
    isReassessment,
  };
}
