const ASSIGNED_ENGINE_PATHS = Object.freeze({
  finger_read: '/studio',
  soroban_read: '/studio',
  soroban_write: '/studio',
  flash_anzan: '/studio',
  audio_anzan: '/studio',
} as const);

const FREE_PRACTICE_PATHS = Object.freeze({
  finger_read: '/paritmetik',
  finger_press: '/paritmetik',
  soroban_read: '/studio?mode=soroban-read',
  soroban_write: '/studio?mode=soroban-write',
  arithmetic: '/arithmetic',
  flash_anzan: '/studio?mode=flash',
  audio_anzan: '/studio?mode=audio',
} as const);

export type AssignedEngineModule = keyof typeof ASSIGNED_ENGINE_PATHS;
export type WorkAssignmentState =
  | 'assigned'
  | 'available'
  | 'in_progress'
  | 'completed'
  | 'expired'
  | 'cancelled'
  | 'closed';

export function isAssignedEngineModule(
  moduleCode: string,
): moduleCode is AssignedEngineModule {
  return Object.hasOwn(ASSIGNED_ENGINE_PATHS, moduleCode);
}

export function assignedEnginePath(moduleCode: string, recipeId: string) {
  if (!isAssignedEngineModule(moduleCode)) return null;
  return `${ASSIGNED_ENGINE_PATHS[moduleCode]}?program=assigned&recipe=${encodeURIComponent(recipeId)}`;
}

export function freePracticePath(moduleCode: string) {
  return Object.hasOwn(FREE_PRACTICE_PATHS, moduleCode)
    ? FREE_PRACTICE_PATHS[moduleCode as keyof typeof FREE_PRACTICE_PATHS]
    : null;
}

export function workStateLabel(state: WorkAssignmentState) {
  if (state === 'assigned') return 'Yakında';
  if (state === 'available') return 'Başlamaya hazır';
  if (state === 'in_progress') return 'Devam ediyor';
  if (state === 'completed') return 'Tamamlandı';
  if (state === 'expired') return 'Süresi doldu';
  if (state === 'cancelled') return 'İptal edildi';
  return 'Kapalı';
}
