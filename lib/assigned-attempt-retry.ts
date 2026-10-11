import type { Attempt } from './exercise-engine';
export type PendingAssignedAttempt = {
  sessionId: string;
  questionIndex: number;
  attempt: Attempt;
  payload: Record<string, unknown>;
};
const key = (sessionId: string) => `cza-assigned-answer-v1:${sessionId}`;
/** Preserve exact request identity, answer and timings after an uncertain acknowledgement. */
export function readPendingAssignedAttempt(
  sessionId: string,
  questionIndex: number,
) {
  try {
    const raw = sessionStorage.getItem(key(sessionId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingAssignedAttempt;
    if (p.sessionId !== sessionId || p.questionIndex !== questionIndex) {
      sessionStorage.removeItem(key(sessionId));
      return null;
    }
    if (
      !p.attempt ||
      !p.payload ||
      typeof p.payload.clientAttemptId !== 'string' ||
      p.payload.questionIndex !== questionIndex ||
      p.payload.studentNumericAnswer !== p.attempt.given
    )
      return null;
    return p;
  } catch {
    return null;
  }
}
export function savePendingAssignedAttempt(p: PendingAssignedAttempt) {
  try {
    sessionStorage.setItem(key(p.sessionId), JSON.stringify(p));
  } catch {
    /* Memory retry remains available. */
  }
}
export function clearPendingAssignedAttempt(sessionId: string) {
  try {
    sessionStorage.removeItem(key(sessionId));
  } catch {
    /* Server progress remains authoritative. */
  }
}
