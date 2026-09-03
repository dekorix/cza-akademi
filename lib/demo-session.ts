import type { ExerciseConfig, SessionResult } from './exercise-engine';
import { validateConfig } from './exercise-engine';

const RESULT_KEY = 'cza-preview-results-v1';
const PROGRAM_KEY = 'cza-preview-program-v1';

export function readDemoResults(): SessionResult[] {
  try {
    const values: unknown = JSON.parse(sessionStorage.getItem(RESULT_KEY) || '[]');
    if (!Array.isArray(values)) return [];
    return values.filter((v): v is SessionResult => typeof v?.id === 'string' && typeof v?.at === 'string' && Array.isArray(v?.attempts) && v?.config).slice(0,30);
  } catch { return []; }
}
export function saveDemoResult(result: SessionResult): boolean {
  try { sessionStorage.setItem(RESULT_KEY, JSON.stringify([result, ...readDemoResults()].slice(0,30))); return true; } catch { return false; }
}
export function saveDemoProgram(config: ExerciseConfig): boolean {
  validateConfig(config);
  try { sessionStorage.setItem(PROGRAM_KEY, JSON.stringify(config)); return true; } catch { return false; }
}
export function readDemoProgram(): ExerciseConfig | null {
  try { const config = JSON.parse(sessionStorage.getItem(PROGRAM_KEY) || 'null'); if (!config) return null; validateConfig(config); return config; } catch { return null; }
}
