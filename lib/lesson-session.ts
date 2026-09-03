import { validateLessonRecord, type LessonRecord } from './soroban-curriculum';

const KEY = 'cza-teaching-pilot-results-v1';
export function readLessonRecords(): LessonRecord[] {
  try {
    const records: unknown = JSON.parse(sessionStorage.getItem(KEY) || '[]');
    return Array.isArray(records) ? records.filter(validateLessonRecord).slice(0,40) : [];
  } catch { return []; }
}
export function saveLessonRecord(record: LessonRecord): boolean {
  if (!validateLessonRecord(record)) return false;
  try {
    sessionStorage.setItem(KEY,JSON.stringify([record,...readLessonRecords().filter(r=>r.id!==record.id)].slice(0,40)));
    return true;
  } catch { return false; }
}
