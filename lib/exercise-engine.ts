export type ExerciseMode = 'finger-read' | 'soroban-read' | 'soroban-write' | 'flash' | 'audio';
export type Operation = 'add' | 'subtract' | 'mixed';
export type ExerciseConfig = {
  mode: ExerciseMode;
  digits: number;
  terms: number;
  rounds: number;
  interval: number;
  presentationDurationMs?: number;
  answerDurationMs?: number;
  countdownEnabled?: boolean;
  rods?: 4 | 5 | 6 | 7;
  minValue?: number;
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
export type Attempt = { sequence: number[]; expected: number; given: number; correct: boolean; elapsedMs: number; stimulusDurationMs?: number; responseLatencyMs?: number; pattern?: string; timeout?: boolean; answerDurationLimitMs?: number; presentationStartedAt?: string; presentationEndedAt?: string; answerStartedAt?: string; answeredAt?: string };
export type SessionResult = { id: string; at: string; config: ExerciseConfig; attempts: Attempt[]; durationMs: number };

export const defaultConfig: ExerciseConfig = {
  mode: 'soroban-read', digits: 2, terms: 4, rounds: 10, interval: 1.5,
  presentationDurationMs: 1000, answerDurationMs: 10000, countdownEnabled: true, rods: 5, minValue: 1,
  operation: 'mixed', pool: [1,2,3,4,5,6,7,8,9],
  maxValue: 900, firstWithinMax: true, showNumbers: true, fontSize: 95,
  backgroundColor: '#ffffff', textColor: '#111827', freePractice: false,
};
export const modeLabels: Record<ExerciseMode, string> = { 'finger-read': 'Paritmetik Parmak Okuma', 'soroban-read': 'Soroban okuma', 'soroban-write': 'Soroban yazma', flash: 'Flash Anzan', audio: 'Sesli Anzan' };

export function validateConfig(config: ExerciseConfig): void {
  const presentationDurationMs = config.presentationDurationMs ?? 1000;
  const answerDurationMs = config.answerDurationMs ?? 0;
  const rods = config.rods ?? 5;
  if (!Object.hasOwn(modeLabels, config.mode)) throw new Error('Geçerli bir egzersiz seçin.');
  if (!Number.isInteger(config.digits) || config.digits < 1 || config.digits > 7) throw new Error('Basamak sayısı 1–7 arasında olmalı.');
  if (config.mode === 'finger-read' && config.digits > 2) throw new Error('Parmak Okuma en fazla 2 basamaklı olabilir.');
  if (!Number.isInteger(config.terms) || config.terms < 2 || config.terms > 30) throw new Error('Terim sayısı 2–30 arasında olmalı.');
  if (!Number.isInteger(config.rounds) || config.rounds < 1 || config.rounds > 100) throw new Error('Soru sayısı 1–100 arasında olmalı.');
  if (!Number.isFinite(config.interval) || (config.interval !== 0 && (config.interval < .1 || config.interval > 10))) throw new Error('Gösterim süresi adımlı veya 0,1–10 saniye olmalı.');
  if (['finger-read','soroban-read'].includes(config.mode) && (!Number.isInteger(presentationDurationMs) || presentationDurationMs < 80 || presentationDurationMs > 10000)) throw new Error('Gösterim süresi 80–10.000 ms arasında olmalı.');
  if (!Number.isInteger(answerDurationMs) || answerDurationMs < 0 || answerDurationMs > 60000) throw new Error('Cevap süresi sınırsız veya en fazla 60 saniye olmalı.');
  if (!Number.isInteger(rods) || ![4,5,6,7].includes(rods)) throw new Error('Soroban çubuk sayısı 4, 5, 6 veya 7 olmalı.');
  if (!['add','subtract','mixed'].includes(config.operation)) throw new Error('İşlem türü geçersiz.');
  if (!Array.isArray(config.pool) || !config.pool.length || config.pool.some(n => !Number.isInteger(n) || n < 1 || n > 9)) throw new Error('En az bir 1–9 rakamı seçin.');
  const minDigits = config.minDigits ?? config.digits;
  const maxDigits = config.maxDigits ?? config.digits;
  if (!Number.isInteger(minDigits) || minDigits < 1 || minDigits > 7 || !Number.isInteger(maxDigits) || maxDigits < minDigits || maxDigits > 7) throw new Error('Minimum ve maksimum basamak sayısı 1–7 arasında olmalı.');
  if (maxDigits > rods && config.mode.startsWith('soroban')) throw new Error('Basamak aralığı seçilen soroban çubuk sayısını aşamaz.');
  if (config.minValue !== undefined && (!Number.isInteger(config.minValue) || config.minValue < 0)) throw new Error('Minimum değer sıfır veya daha büyük olmalı.');
  for (const pool of [config.additionPool ?? config.pool, config.subtractionPool ?? config.pool]) {
    if (!Array.isArray(pool) || !pool.length || pool.some(n => !Number.isInteger(n) || n < 1 || n > 9)) throw new Error('Toplama ve çıkarma havuzlarında en az bir 1–9 rakamı seçin.');
  }
  if (config.maxValue !== undefined && (!Number.isInteger(config.maxValue) || config.maxValue < 1 || config.maxValue > 9999999)) throw new Error('Maksimum değer 1–9.999.999 arasında olmalı.');
  if ((config.minValue ?? 0) > (config.maxValue ?? 9999999)) throw new Error('Minimum değer maksimum değerden büyük olamaz.');
  if ((config.maxValue ?? 9999999) < 10 ** (minDigits - 1)) throw new Error('Seçilen maksimum değer bu basamak aralığında soru üretmiyor.');
  if (config.fontSize !== undefined && (!Number.isInteger(config.fontSize) || config.fontSize < 48 || config.fontSize > 180)) throw new Error('Rakam boyutu 48–180 arasında olmalı.');
  for (const color of [config.backgroundColor, config.textColor]) if (color !== undefined && !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Renkler #RRGGBB biçiminde olmalı.');
}

export function createQuestion(config: ExerciseConfig, random: () => number = Math.random): ExerciseQuestion {
  validateConfig(config);
  const pick = (values: number[]) => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  const minDigits = config.minDigits ?? config.digits;
  const maxDigits = config.maxDigits ?? config.digits;
  const requestedDigits = minDigits === maxDigits ? minDigits : minDigits + Math.floor(random() * (maxDigits - minDigits + 1));
  const digitMinimum = 10 ** (requestedDigits - 1);
  const min = Math.max(config.minValue ?? digitMinimum, digitMinimum), max = 10 ** requestedDigits - 1;
  const maxValue = Math.min(config.maxValue ?? max, max);
  const singleDigitValues = [...new Set(config.pool)].sort((a,b) => a-b).filter(value => value >= min && value <= maxValue);
  if (config.mode.startsWith('soroban') || config.mode === 'finger-read') {
    const answer = requestedDigits === 1 ? pick(singleDigitValues) : min + Math.floor(random() * (maxValue - min + 1));
    if (!Number.isInteger(answer)) throw new Error('Seçilen sayı aralığı ve rakam havuzu soru üretmiyor.');
    return { sequence: [answer], answer };
  }
  const values = requestedDigits === 1 ? singleDigitValues : Array.from({ length: Math.max(1, maxValue - min + 1) }, (_,i) => min+i);
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
  const timeout = attempts.filter(a => a.timeout).length;
  const elapsed = attempts.map(a => a.elapsedMs).filter(Number.isFinite);
  const fastestCorrect = attempts.filter(a => a.correct).map(a => a.elapsedMs).filter(Number.isFinite);
  return {
    total: attempts.length,
    correct,
    wrong: attempts.length - correct - timeout,
    timeout,
    accuracy: attempts.length ? Math.round(correct / attempts.length * 100) : 0,
    averageResponseMs: elapsed.length ? Math.round(elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length) : 0,
    fastestCorrectMs: fastestCorrect.length ? Math.min(...fastestCorrect) : null,
  };
}
