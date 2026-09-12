import { validateConfig, type ExerciseConfig } from './exercise-engine';

const ASSIGNED_PROGRAM_KEY = 'cza-assigned-program-v1';

type AssignedProgram = { recipeId: string; config: ExerciseConfig; savedAt: number };

export function saveAssignedProgram(recipeId: string, config: ExerciseConfig): boolean {
  validateConfig(config);
  try {
    sessionStorage.setItem(ASSIGNED_PROGRAM_KEY, JSON.stringify({ recipeId, config, savedAt: Date.now() } satisfies AssignedProgram));
    return true;
  } catch { return false; }
}

export function readAssignedProgram(recipeId: string): ExerciseConfig | null {
  try {
    const raw = sessionStorage.getItem(ASSIGNED_PROGRAM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AssignedProgram>;
    if (parsed.recipeId !== recipeId || !parsed.config) return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > 15 * 60 * 1000) return null;
    validateConfig(parsed.config);
    return parsed.config;
  } catch { return null; }
}

export function clearAssignedProgram() {
  try { sessionStorage.removeItem(ASSIGNED_PROGRAM_KEY); } catch { /* ignore storage errors */ }
}
