export type ArithmeticOperationMode = 'addition' | 'subtraction' | 'mixed';
export type ArithmeticToolMode = 'soroban' | 'finger' | 'both' | 'none';

export type ArithmeticSettings = {
  operationMode: ArithmeticOperationMode;
  additionDigits: number[];
  subtractionDigits: number[];
  allowDirectAddition: boolean;
  allowDirectSubtraction: boolean;
  questionCount: number;
  operationsPerQuestion: number;
  minDigits: number;
  maxDigits: number;
  transitionSeconds: number;
  maxValue: number | null;
  firstNumberRespectMaxValue: boolean;
  sorobanRodCount: 4 | 5 | 6 | 7;
  allowNegativeResults: boolean;
  toolMode: ArithmeticToolMode;
  inputMode: 'keypad' | 'keyboard' | 'both';
};

export type ValidationIssue = {
  code: string;
  title: string;
  description: string;
  field?: keyof ArithmeticSettings;
  severity: 'error' | 'warning' | 'info';
};

export type ArithmeticStep = {
  order: number;
  operator: '+' | '-';
  operand: number;
  resultAfterStep: number;
  ruleMetadata: { digitFamily: number[]; directOperation: boolean };
};

export type ArithmeticQuestion = {
  id: string;
  initialValue: number;
  steps: ArithmeticStep[];
  finalAnswer: number;
  metadata: {
    difficultyScore: number;
    generatedAt: string;
    operationCount: number;
    minDigits: number;
    maxDigits: number;
  };
};

export const defaultArithmeticSettings: ArithmeticSettings = {
  operationMode: 'addition',
  additionDigits: [1,2,3,4,5,6,7,8,9],
  subtractionDigits: [1,2,3,4,5,6,7,8,9],
  allowDirectAddition: false,
  allowDirectSubtraction: false,
  questionCount: 10,
  operationsPerQuestion: 3,
  minDigits: 1,
  maxDigits: 1,
  transitionSeconds: 0,
  maxValue: 99,
  firstNumberRespectMaxValue: true,
  sorobanRodCount: 5,
  allowNegativeResults: false,
  toolMode: 'both',
  inputMode: 'both',
};

export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function activeOperations(settings: ArithmeticSettings) {
  return settings.operationMode === 'mixed' ? ['+','-'] as const : settings.operationMode === 'addition' ? ['+'] as const : ['-'] as const;
}

function usesOnlyDigits(value: number, pool: number[]) {
  return String(Math.abs(value)).split('').every(digit => pool.includes(Number(digit)));
}

function isDirectAddition(current: number, operand: number) {
  const width = Math.max(String(current).length, String(operand).length);
  const a = String(current).padStart(width, '0');
  const b = String(operand).padStart(width, '0');
  return Array.from(a).every((digit, index) => Number(digit) + Number(b[index]) <= 9);
}

function isDirectSubtraction(current: number, operand: number) {
  const width = Math.max(String(current).length, String(operand).length);
  const a = String(current).padStart(width, '0');
  const b = String(operand).padStart(width, '0');
  return Array.from(a).every((digit, index) => Number(b[index]) <= Number(digit));
}

function issue(code: string, title: string, description: string, field: keyof ArithmeticSettings | undefined, severity: ValidationIssue['severity']): ValidationIssue {
  return { code, title, description, field, severity };
}

export function validateArithmeticSettings(settings: ArithmeticSettings) {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const suggestions: ValidationIssue[] = [];
  const needsAdd = settings.operationMode !== 'subtraction';
  const needsSubtract = settings.operationMode !== 'addition';
  if (needsAdd && !settings.additionDigits.length) errors.push(issue('ADD001','Toplama rakamı seçilmedi','En az bir toplama rakamı seçin.','additionDigits','error'));
  if (needsSubtract && !settings.subtractionDigits.length) errors.push(issue('SUB001','Çıkarma rakamı seçilmedi','En az bir çıkarma rakamı seçin.','subtractionDigits','error'));
  if (settings.minDigits > settings.maxDigits || settings.minDigits < 1 || settings.maxDigits > 5) errors.push(issue('DIG001','Hane aralığı geçersiz','Minimum hane 1–5 arasında ve maksimum haneden küçük ya da ona eşit olmalıdır.','minDigits','error'));
  if (!Number.isInteger(settings.questionCount) || settings.questionCount < 1 || settings.questionCount > 30) errors.push(issue('COUNT001','Soru sayısı geçersiz','Soru sayısını 1–30 arasında seçin.','questionCount','error'));
  if (!Number.isInteger(settings.operationsPerQuestion) || settings.operationsPerQuestion < 1 || settings.operationsPerQuestion > 20) errors.push(issue('COUNT002','İşlem sayısı geçersiz','Her soru için 1–20 işlem seçin.','operationsPerQuestion','error'));
  if (!Number.isFinite(settings.transitionSeconds) || settings.transitionSeconds < 0 || settings.transitionSeconds > 60) errors.push(issue('SPEED001','Süre geçersiz','Süreyi 0–60 saniye arasında seçin.','transitionSeconds','error'));
  const theoreticalMin = 10 ** (settings.minDigits - 1);
  if (settings.maxValue !== null && settings.maxValue < theoreticalMin) errors.push(issue('MAX001','Maksimum değer çok düşük',`En az ${settings.minDigits} haneli soru için maksimum değer ${theoreticalMin} veya daha büyük olmalıdır.`,'maxValue','error'));
  if (![4,5,6,7].includes(settings.sorobanRodCount)) errors.push(issue('ROD001','Soroban basamak sayısı geçersiz','Soroban için 4, 5, 6 veya 7 basamak seçin.','sorobanRodCount','error'));
  if (settings.maxDigits > settings.sorobanRodCount) errors.push(issue('ROD002','Hane sayısı sorobana sığmıyor',`Maksimum hane sayısını ${settings.sorobanRodCount} veya daha düşük seçin ya da daha geniş bir soroban kullanın.`,'maxDigits','error'));
  if (settings.maxValue !== null && settings.maxValue >= 10 ** settings.sorobanRodCount) warnings.push(issue('ROD003','Maksimum değer sorobandan geniş','Üretilen sayıların sorobana sığması için maksimum değer soroban basamak sayısına göre sınırlandırılacak.','maxValue','warning'));
  if (settings.operationMode === 'mixed' && (!settings.additionDigits.length || !settings.subtractionDigits.length)) errors.push(issue('MIX001','Karışık çalışma hazır değil','Toplama ve çıkarma için ayrı ayrı en az bir rakam seçin.','operationMode','error'));
  if (settings.transitionSeconds > 0 && settings.transitionSeconds < 3) warnings.push(issue('SPEED002','Süre çok kısa','Yeni başlayan öğrenciler için en az 3 saniye daha dengeli olabilir.','transitionSeconds','warning'));
  if (settings.operationsPerQuestion > 10) warnings.push(issue('COUNT003','Uzun işlem zinciri','Uzun zincirlerde önce doğruluğu gözleyin; gerekirse işlem sayısını azaltın.','operationsPerQuestion','warning'));
  if (settings.toolMode === 'none') suggestions.push(issue('TOOL001','Destek araçları kapalı','Bu ayar zihinden çalışma içindir. Öğrenme aşamasında Soroban veya Parmak desteği açılabilir.','toolMode','info'));
  return { valid: errors.length === 0, errors, warnings, suggestions };
}

function range(settings: ArithmeticSettings) {
  const min = 10 ** (settings.minDigits - 1);
  const digitMax = 10 ** Math.min(settings.maxDigits, settings.sorobanRodCount) - 1;
  return { min, max: Math.min(digitMax, settings.maxValue ?? digitMax) };
}

function operands(settings: ArithmeticSettings, pool: number[]) {
  const { min, max } = range(settings);
  const result: number[] = [];
  for (let value = min; value <= max && result.length < 10000; value += 1) if (usesOnlyDigits(value, pool)) result.push(value);
  return result;
}

export class QuestionGenerationError extends Error {
  constructor() { super('Seçilen ayarlarla güvenli soru üretilemedi. Rakam havuzunu genişletin, işlem sayısını azaltın veya maksimum değeri yükseltin.'); }
}

export function generateArithmeticQuestion(settings: ArithmeticSettings, random: () => number = Math.random): ArithmeticQuestion {
  const validation = validateArithmeticSettings(settings);
  if (!validation.valid) throw new QuestionGenerationError();
  const { min, max } = range(settings);
  const addValues = operands(settings, settings.additionDigits);
  const subtractValues = operands(settings, settings.subtractionDigits);
  const pick = <T,>(values: T[]) => values[Math.min(values.length - 1, Math.floor(random() * values.length))];
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let current = min + Math.floor(random() * (max - min + 1));
    if (settings.firstNumberRespectMaxValue) current = Math.min(current, max);
    const initialValue = current;
    const steps: ArithmeticStep[] = [];
    for (let order = 1; order <= settings.operationsPerQuestion; order += 1) {
      let operators = [...activeOperations(settings)];
      if (settings.operationMode === 'mixed' && order % 2 === 0) operators = operators.reverse();
      const candidates: { operator: '+' | '-'; operand: number; result: number; direct: boolean; pool: number[] }[] = [];
      for (const operator of operators) {
        const values = operator === '+' ? addValues : subtractValues;
        for (const operand of values) {
          const result = operator === '+' ? current + operand : current - operand;
          if (!settings.allowNegativeResults && result < 0) continue;
          if (settings.maxValue !== null && (result > settings.maxValue || Math.abs(result) > settings.maxValue)) continue;
          const direct = operator === '+' ? isDirectAddition(current, operand) : isDirectSubtraction(current, operand);
          if (operator === '+' && settings.allowDirectAddition && !direct) continue;
          if (operator === '-' && settings.allowDirectSubtraction && !direct) continue;
          candidates.push({ operator, operand, result, direct, pool: operator === '+' ? settings.additionDigits : settings.subtractionDigits });
        }
      }
      if (!candidates.length) break;
      const selected = pick(candidates);
      current = selected.result;
      steps.push({ order, operator: selected.operator, operand: selected.operand, resultAfterStep: current, ruleMetadata: { digitFamily: selected.pool, directOperation: selected.direct } });
    }
    if (steps.length === settings.operationsPerQuestion) return {
      id: crypto.randomUUID(),
      initialValue,
      steps,
      finalAnswer: current,
      metadata: {
        difficultyScore: settings.maxDigits * 10 + settings.operationsPerQuestion + (settings.operationMode === 'mixed' ? 5 : 0),
        generatedAt: new Date().toISOString(),
        operationCount: settings.operationsPerQuestion,
        minDigits: settings.minDigits,
        maxDigits: settings.maxDigits,
      },
    };
  }
  throw new QuestionGenerationError();
}
