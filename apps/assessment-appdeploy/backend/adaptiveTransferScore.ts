export type AdaptiveTransferStats = {
  total: number;
  math: number;
  mathMax: number;
  lang: number;
  langMax: number;
  memory: number;
  memoryMax: number;
  spatial: number;
  spatialMax: number;
  plan: number;
  planMax: number;
  flex: number;
  flexMax: number;
};

export type AdaptiveSkillCode = 'S02' | 'S04' | 'S07' | 'S09' | 'S11' | 'S12';

const STATS = /^AV\|n=(\d+)\|math=(\d+)\/(\d+)\|lang=(\d+)\/(\d+)\|memory=(\d+)\/(\d+)\|spatial=(\d+)\/(\d+)\|plan=(\d+)\/(\d+)\|flex=(\d+)\/(\d+)/;

const SKILL_FIELD: Record<AdaptiveSkillCode, 'math' | 'lang' | 'memory' | 'spatial' | 'plan' | 'flex'> = {
  S02: 'math',
  S04: 'lang',
  S07: 'memory',
  S09: 'spatial',
  S11: 'plan',
  S12: 'flex',
};

export function parseAdaptiveTransfer(answer: string): AdaptiveTransferStats | null {
  const m = answer.match(STATS);
  if (!m) return null;
  return {
    total: Number(m[1]),
    math: Number(m[2]),
    mathMax: Number(m[3]),
    lang: Number(m[4]),
    langMax: Number(m[5]),
    memory: Number(m[6]),
    memoryMax: Number(m[7]),
    spatial: Number(m[8]),
    spatialMax: Number(m[9]),
    plan: Number(m[10]),
    planMax: Number(m[11]),
    flex: Number(m[12]),
    flexMax: Number(m[13]),
  };
}

export function adaptiveTransferCorrectness(answer: string): 'review' | 'incorrect' {
  const total = parseAdaptiveTransfer(answer)?.total;
  if (total === 6 || total === 12) return 'review';
  return 'incorrect';
}

export function adaptiveTransferSkill(answer: string, code: string): { parsed: boolean; included: boolean; base: number | null; evidence: number } {
  const stats = parseAdaptiveTransfer(answer);
  const field = SKILL_FIELD[code as AdaptiveSkillCode];
  if (!stats || !field) return { parsed: Boolean(stats), included: false, base: null, evidence: 0 };
  const max = stats[`${field}Max`];
  if (max === 0) return { parsed: true, included: false, base: null, evidence: 0 };
  return { parsed: true, included: true, base: Math.max(0.2, Math.min(1, stats[field] / max)), evidence: max };
}

export function educatorAttemptBadge(correctness: string) {
  if (correctness === 'correct') return 'Doğru';
  if (correctness === 'incorrect') return 'Destek/inceleme';
  return 'Eğitmen incelemesi';
}

export function educatorAttemptBadgeClass(correctness: string) {
  if (correctness === 'correct') return 'cza-badge-good';
  if (correctness === 'incorrect') return 'cza-badge-low';
  return 'cza-badge-mid';
}
