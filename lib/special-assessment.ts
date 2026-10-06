export const SPECIAL_PROFILE_CODES = [
  'SP-DYS',
  'SP-SLD',
  'SP-DYSC',
  'SP-DYSG',
  'SP-ASD',
  'SP-LANG',
  'SP-ATTN',
  'SP-DELAY',
  'SP-COG',
  'SP-MIX',
] as const;

export type SpecialProfileCode = typeof SPECIAL_PROFILE_CODES[number];

export const SPECIAL_TEMPLATE_VERSION = 1;
export const SPECIAL_MODULE_CODE = 'special_education_assessment';

const TASK_PATTERNS: Record<SpecialProfileCode, RegExp> = {
  'SP-DYS': /^DYS-(?:PH|LS|OR|BL|DE|RA|WM|FL|CO|DI|ER|TR)\d{2}$/,
  'SP-SLD': /^SLD\d{2}$/,
  'SP-DYSC': /^DYC\d{2}$/,
  'SP-DYSG': /^DYG\d{2}$/,
  'SP-ASD': /^ASD\d{2}$/,
  'SP-LANG': /^LAN\d{2}$/,
  'SP-ATTN': /^ATT\d{2}$/,
  'SP-DELAY': /^DEL\d{2}$/,
  'SP-COG': /^COG\d{2}$/,
  'SP-MIX': /^MIX\d{2}$/,
};

export const SPECIAL_SUPPORT_LEVELS = [
  'INDEPENDENT',
  'VERBAL_PROMPT',
  'VISUAL_PROMPT',
  'MODELED',
  'PHYSICAL_ASSIST',
  'NOT_OBSERVED',
  'NOT_ASSESSED',
] as const;

export type SpecialSupportLevel = typeof SPECIAL_SUPPORT_LEVELS[number];

export const SPECIAL_VERDICTS = ['MATCH', 'PARTIAL', 'DIFFERENT', 'NO_RESPONSE'] as const;
export type SpecialVerdict = typeof SPECIAL_VERDICTS[number];

export const supportLevelNumber: Record<SpecialSupportLevel, number> = {
  INDEPENDENT: 0,
  VERBAL_PROMPT: 1,
  VISUAL_PROMPT: 2,
  MODELED: 3,
  PHYSICAL_ASSIST: 4,
  NOT_OBSERVED: 5,
  NOT_ASSESSED: 5,
};

export function isSpecialProfileCode(value: unknown): value is SpecialProfileCode {
  return typeof value === 'string' && SPECIAL_PROFILE_CODES.includes(value as SpecialProfileCode);
}

export function isSpecialSupportLevel(value: unknown): value is SpecialSupportLevel {
  return typeof value === 'string' && SPECIAL_SUPPORT_LEVELS.includes(value as SpecialSupportLevel);
}

export function isSpecialVerdict(value: unknown): value is SpecialVerdict {
  return typeof value === 'string' && SPECIAL_VERDICTS.includes(value as SpecialVerdict);
}

export function specialTemplateCode(profileCode: SpecialProfileCode) {
  return `CZA_SPECIAL_V${SPECIAL_TEMPLATE_VERSION}_${profileCode.replace(/^SP-/, '')}`;
}

export function isTaskAllowedForProfile(profileCode: SpecialProfileCode, taskCode: unknown) {
  return typeof taskCode === 'string' && TASK_PATTERNS[profileCode].test(taskCode);
}

export function sanitizeShortText(value: unknown, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function sanitizeStringList(value: unknown, maxItems = 24, maxItemLength = 80) {
  if (!Array.isArray(value)) return [] as string[];
  return value
    .map((item) => String(item).trim().slice(0, maxItemLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeSpecialEvidence(profileCode: SpecialProfileCode, input: Record<string, unknown>) {
  const taskCode = sanitizeShortText(input.taskCode, 40);
  if (!isTaskAllowedForProfile(profileCode, taskCode)) throw new Error('special_task_not_allowed');

  const supportLevel = isSpecialSupportLevel(input.supportLevel) ? input.supportLevel : 'NOT_ASSESSED';
  const verdict = isSpecialVerdict(input.verdict) ? input.verdict : 'NO_RESPONSE';
  const responseLatencyMs = input.responseLatencyMs == null
    ? null
    : Math.max(0, Math.min(60 * 60 * 1000, Number(input.responseLatencyMs) || 0));
  const totalResponseTimeMs = input.totalResponseTimeMs == null
    ? null
    : Math.max(0, Math.min(2 * 60 * 60 * 1000, Number(input.totalResponseTimeMs) || 0));

  const payload = {
    profileCode,
    verdict,
    supportLevel,
    choice: sanitizeShortText(input.choice, 500) || null,
    firstMatch: typeof input.firstMatch === 'boolean' ? input.firstMatch : null,
    flags: sanitizeStringList(input.flags),
    note: sanitizeShortText(input.note, 4000) || null,
    phase: sanitizeShortText(input.phase, 120) || null,
    area: sanitizeShortText(input.area, 160) || null,
    title: sanitizeShortText(input.title, 200) || null,
    source: 'EDUCATOR',
    schemaVersion: 1,
  };

  return {
    taskCode,
    answerText: sanitizeShortText(input.answerText, 4000) || null,
    supportLevel,
    supportLevelNumber: supportLevelNumber[supportLevel],
    verdict,
    selfCorrected: Boolean(input.selfCorrected) || payload.flags.includes('Kendini düzeltti'),
    responseLatencyMs,
    totalResponseTimeMs,
    payload,
  };
}
