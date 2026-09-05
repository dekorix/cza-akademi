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
  /** Flash/Anzan controls. They are optional so older saved pilot programs remain readable. */
  minDigits?: number;
  maxDigits?: number;
  additionPool?: number[];
  subtractionPool?: number[];
  maxValue?: number;
  firstWithinMax?: boolean;
  showNumbers?: boolean;
  fontSize?: number;
  backgroundColor?: string;
  textColor?: string;
  freePractice?: boolean;
};
export type ExerciseQuestion = { sequence: number[]; answer: number };
export type Attempt = { sequence: number[]; expected: number; given: number; correct: boolean; elapsedMs: number; stimulusDurationMs?: number; responseLatencyMs?: number; pattern?: string };
export type SessionResult = { id: string; at: string; config: ExerciseConfig; attempts: Attempt[]; durationMs: number };

export const defaultConfig: ExerciseConfig = {
  mode: 'soroban-read', digits: 2, terms: 4, rounds: 5, interval: 1.5,
  operation: 'mixed', pool: [1,2,3,4,5,6,7,8,9],
  maxValue: 900, firstWithinMax: true, showNumbers: true, fontSize: 95,
  backgroundColor: '#ffffff', textColor: '#111827', freePractice: false,
};
export const modeLabels: Record<ExerciseMode, string> = { 'soroban-read': 'Soroban okuma', 'soroban-write': 'Soroban yazma', flash: 'Flash Anzan', audio: 'Sesli Anzan' };

export function validateConfig(config: ExerciseConfig): void {
  if (!Object.hasOwn(modeLabels, config.mode)) throw new Error('Geçerli bir egzersiz seçin.');
  if (!Number.isInteger(config.digits) || config.digits < 1 || config.digits > 5) throw new Error('Basamak sayısı 1–5 arasında olmalı.');
  if (!Number.isInteger(config.terms) || config.terms < 2 || config.terms > 30) throw new Error('Terim sayısı 2–30 arasında olmalı.');
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 100) throw new Error('Soru sayısı 1–100 arasında olmalı.');
  if (!Number.isFinite(config.interval) || (config.interval !== 0 && (config.interval < .1 || config.interval > 10))) throw new Error('Gösterim süresi adımlı veya 0,1–10 saniye olmalı.');
  if (!['add','subtract','mixed'].includes(config.operation)) throw new Error('İşlem türü geçersiz.');
  if (!Array.isArray(config.pool) || !config.pool.length || config.pool.some(n => !Number.isInteger(n) || n < 1 || n > 9)) throw new Error('En az bir 1–9 rakamı seçin.');
  const minDigits = config.minDigits ?? config.digits;
  const maxDigits = config.maxDigits ?? config.digits;
  if (!Number.isInteger(minDigits) || minDigits < 1 || minDigits > 5 || !Number.isInteger(maxDigits) || maxDigits < minDigits || maxDigits > 5) throw new Error('Minimum ve maksimum basamak sayısı 1–5 arasında olmalı.');
  for (const pool of [config.additionPool ?? config.pool, config.subtractionPool ?? config.pool]) {
    if (!Array.isArray(pool) || !pool.length || pool.some(n => !Number.isInteger(n) || n < 1 || n > 9)) throw new Error('Toplama ve çıkarma havuzlarında en az bir 1–9 rakamı seçin.');
  }
  if (config.maxValue !== undefined && (!Number.isInteger(config.maxValue) || config.maxValue < 1 || config.maxValue > 99999)) throw new Error('Maksimum değer 1–99.999 arasında olmalı.');
  if (config.fontSize !== undefined && (!Number.isInteger(config.fontSize) || config.fontSize < 48 || config.fontSize > 180)) throw new Error('Rakam boyutu 48–180 arasında olmalı.');
  for (const color of [config.backgroundColor, config.textColor]) if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Renkler #RRGGBB biçiminde olmalı.');
}

export function createQuestion(config: ExerciseConfig, random: () => number = Math.random): ExerciseQuestion {
  validateConfig(config);
  const pick = (values: number[]) => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  const minDigits = config.minDigits ?? config.digits;
  const maxDigits = config.maxDigits ?? config.digits;
  const requestedDigits = minDigits === maxDigits ? minDigits : minDigits + Math.floor(random() * (maxDigits - minDigits + 1));
  const min = 10 ** (requestedDigits - 1), max = 10 ** requestedDigits - 1;
  const maxValue = config.maxValue ?? max;
  const values = requestedDigits === 1 ? [...new Set(config.pool)].sort((a,b) => a-b) : Array.from({ length: Math.max(1, Math.min(max, maxValue) - min + 1) }, (_,i) => min+i);
  if (config.mode.startsWith('soroban')) { const answer = pick(values); return { sequence: [answer], answer }; }
  const additionPool = config.additionPool ?? config.pool;
  const subtractionPool = config.subtractionPool ?? config.pool;
  const positiveValues = requestedDigits === 1 ? [...new Set(additionPool)].sort((a,b) => a-b) : values;
  const negativeValues = requestedDigits === 1 ? [...new Set(subtractionPool)].sort((a,b) => a-b) : values;
  const minReserve = config.operation === 'subtract' ? Math.min(...negativeValues) * (config.terms - 1) : 0;
  const firstValues = config.firstWithinMax === false || config.operation === 'subtract' ? values.filter(v => v <= maxValue) : values.filter(v => v + minReserve <= maxValue);
  let first = pick(firstValues.length ? firstValues : values);
  if (config.operation === 'subtract') {
    const initialValues = firstValues.filter(v => v >= Math.min(...negativeValues) * (config.terms - 1));
    if (!initialValues.length) throw new Error('Bu havuz ve terim sayısıyla negatif olmayan çıkarma üretilemiyor. Terim sayısını azaltın veya terim sayısını düşürün.');
    first = pick(initialValues);
  }
  const sequence = [first];
  let total = first;
  for (let i = 1; i < config.terms; i++) {
    const reserve = config.operation === 'subtract' ? Math.min(...negativeValues) * (config.terms - i - 1) : 0;
    const subtractValues = negativeValues.filter(v => v <= total-reserve);
    const canSubtract = subtractValues.length > 0;
    const subtract = config.operation === 'subtract' || (config.operation === 'mixed' && random() < .5 && canSubtract);
    const underMax = config.operation === 'add' ? positiveValues : positiveValues.filter(value => total + value <= maxValue);
    const term = subtract && canSubtract ? -pick(subtractValues) : underMax.length ? pick(underMax) : canSubtract ? -pick(subtractValues) : pick(positiveValues);
    sequence.push(term); total += term;
  }
  return { sequence, answer: total };
}

export function score(attempts: Attempt[]) {
  const correct = attempts.filter(a => a.correct).length;
  return { total: attempts.length, correct, accuracy: attempts.length ? Math.round(correct / attempts.length * 100) : 0 };
}
