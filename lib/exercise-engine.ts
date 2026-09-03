export type ExerciseMode = 'soroban-read' | 'soroban-write' | 'flash' | 'audio';
export type Operation = 'add' | 'subtract' | 'mixed';
export type ExerciseConfig = {
  mode: ExerciseMode;
  digits: number;
  terms: number;
  rounds: number;
  interval: number;
  operation: Operation;
  pool: number[];
};
export type ExerciseQuestion = { sequence: number[]; answer: number };
export type Attempt = { sequence: number[]; expected: number; given: number; correct: boolean; elapsedMs: number };
export type SessionResult = { id: string; at: string; config: ExerciseConfig; attempts: Attempt[]; durationMs: number };

export const defaultConfig: ExerciseConfig = { mode: 'soroban-read', digits: 2, terms: 4, rounds: 5, interval: 1.5, operation: 'mixed', pool: [1,2,3,4,5,6,7,8,9] };
export const modeLabels: Record<ExerciseMode, string> = { 'soroban-read': 'Soroban okuma', 'soroban-write': 'Soroban yazma', flash: 'Flash Anzan', audio: 'Sesli Anzan' };

export function validateConfig(config: ExerciseConfig): void {
  if (!Object.hasOwn(modeLabels, config.mode)) throw new Error('Geçerli bir egzersiz seçin.');
  if (!Number.isInteger(config.digits) || config.digits < 1 || config.digits > 3) throw new Error('Basamak sayısı 1–3 arasında olmalı.');
  if (!Number.isInteger(config.terms) || config.terms < 2 || config.terms > 10) throw new Error('Terim sayısı 2–10 arasında olmalı.');
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 20) throw new Error('Soru sayısı 1–20 arasında olmalı.');
  if (!Number.isFinite(config.interval) || (config.interval !== 0 && (config.interval < .8 || config.interval > 5))) throw new Error('Gösterim süresi adımlı veya 0,8–5 saniye olmalı.');
  if (!['add','subtract','mixed'].includes(config.operation)) throw new Error('İşlem türü geçersiz.');
  if (!Array.isArray(config.pool) || !config.pool.length || config.pool.some(n => !Number.isInteger(n) || n < 1 || n > 9)) throw new Error('En az bir 1–9 rakamı seçin.');
}

export function createQuestion(config: ExerciseConfig, random: () => number = Math.random): ExerciseQuestion {
  validateConfig(config);
  const pick = (values: number[]) => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  const min = 10 ** (config.digits - 1), max = 10 ** config.digits - 1;
  const values = config.digits === 1 ? [...new Set(config.pool)].sort((a,b) => a-b) : Array.from({ length: max-min+1 }, (_,i) => min+i);
  if (config.mode.startsWith('soroban')) { const answer = pick(values); return { sequence: [answer], answer }; }
  let first = pick(values);
  if (config.operation === 'subtract') {
    const initialValues = values.filter(v => v >= values[0] * (config.terms - 1));
    if (!initialValues.length) throw new Error('Bu rakam havuzu ve terim sayısıyla negatif olmayan çıkarma üretilemiyor. Terim sayısını azaltın veya havuza 1 ekleyin.');
    first = pick(initialValues);
  }
  const sequence = [first];
  let total = first;
  for (let i = 1; i < config.terms; i++) {
    const reserve = config.operation === 'subtract' ? values[0] * (config.terms - i - 1) : 0;
    const subtractValues = values.filter(v => v <= total-reserve);
    const subtract = config.operation === 'subtract' || (config.operation === 'mixed' && random() < .5 && subtractValues.length > 0);
    const term = subtract ? -pick(subtractValues) : pick(values);
    sequence.push(term); total += term;
  }
  return { sequence, answer: total };
}

export function score(attempts: Attempt[]) {
  const correct = attempts.filter(a => a.correct).length;
  return { total: attempts.length, correct, accuracy: attempts.length ? Math.round(correct / attempts.length * 100) : 0 };
}
