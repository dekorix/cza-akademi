const TRUNCATED_MARK = 'TRUNCATED|';

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
export type AdaptiveDomain = 'math' | 'lang' | 'memory' | 'spatial' | 'plan' | 'flex';
export type AdaptiveIntegrity = 'review' | 'insufficient';

const STATS = /^AV\|n=(\d+)\|math=(\d+)\/(\d+)\|lang=(\d+)\/(\d+)\|memory=(\d+)\/(\d+)\|spatial=(\d+)\/(\d+)\|plan=(\d+)\/(\d+)\|flex=(\d+)\/(\d+)/;
const DOMAINS: AdaptiveDomain[] = ['math', 'lang', 'memory', 'spatial', 'plan', 'flex'];
const DOMAIN_BY_ID: Record<string, AdaptiveDomain> = {
  MA1: 'math', MA2: 'math', LA1: 'lang', LA2: 'lang', ME1: 'memory', ME2: 'memory',
  SP1: 'spatial', SP2: 'spatial', PL1: 'plan', PL2: 'plan', FL1: 'flex', FL2: 'flex',
};
const SKILL_FIELD: Record<AdaptiveSkillCode, AdaptiveDomain> = {
  S02: 'math', S04: 'lang', S07: 'memory', S09: 'spatial', S11: 'plan', S12: 'flex',
};

type Row = { id: string; domain: AdaptiveDomain; answer: string; score: number; max: number };

export function parseAdaptiveTransfer(answer: string): AdaptiveTransferStats | null {
  const m = answer.match(STATS);
  if (!m) return null;
  return {
    total: Number(m[1]),
    math: Number(m[2]), mathMax: Number(m[3]),
    lang: Number(m[4]), langMax: Number(m[5]),
    memory: Number(m[6]), memoryMax: Number(m[7]),
    spatial: Number(m[8]), spatialMax: Number(m[9]),
    plan: Number(m[10]), planMax: Number(m[11]),
    flex: Number(m[12]), flexMax: Number(m[13]),
  };
}

function rowsOf(answer: string): Row[] | null {
  const found = answer.match(/\|r=([\s\S]*)$/);
  if (!found || found[1] === '') return [];
  const rows: Row[] = [];
  for (const part of found[1].split(',')) {
    const bits = part.split('~');
    if (bits.length < 5) return null;
    const id = bits[0];
    const domain = DOMAIN_BY_ID[id];
    const score = Number(bits[bits.length - 3]);
    const answerText = bits.slice(1, -3).join('~');
    if (!domain || !Number.isInteger(score) || score < 0 || score > 1) return null;
    const skipped = answerText === 'SKIP';
    if (skipped && score !== 0) return null;
    rows.push({ id, domain, answer: answerText, score, max: skipped ? 0 : 1 });
  }
  return rows;
}

function countsMatch(stats: AdaptiveTransferStats, rows: Row[]) {
  for (const domain of DOMAINS) {
    const own = rows.filter((row) => row.domain === domain);
    const max = own.reduce((sum, row) => sum + row.max, 0);
    const score = own.reduce((sum, row) => sum + row.score, 0);
    if (stats[domain] !== score || stats[`${domain}Max`] !== max) return false;
    if (max > 2) return false;
  }
  return true;
}

export function assessAdaptiveTransfer(answer: string): { status: AdaptiveIntegrity } {
  if (String(answer || '').startsWith(TRUNCATED_MARK)) return { status: 'insufficient' };
  const stats = parseAdaptiveTransfer(answer);
  const rows = rowsOf(answer);
  if (!stats || !rows) return { status: 'insufficient' };
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) return { status: 'insufficient' };
    seen.add(row.id);
  }
  if (DOMAINS.some((domain) => stats[`${domain}Max`] > 2)) return { status: 'insufficient' };
  if (rows.length !== stats.total || !countsMatch(stats, rows)) return { status: 'insufficient' };
  const perDomain = DOMAINS.map((domain) => rows.filter((row) => row.domain === domain).length);
  const legacyPair = perDomain.filter((count) => count === 2).length === 3 && perDomain.filter((count) => count === 0).length === 3;
  const legacySingle = perDomain.every((count) => count === 1);
  const fullBank = stats.total === 12 && perDomain.every((count) => count === 2);
  const legacyBank = stats.total === 6 && (legacyPair || legacySingle);
  if (!fullBank && !legacyBank) return { status: 'insufficient' };
  if (rows.length > 0 && rows.every((row) => row.answer === 'SKIP')) return { status: 'insufficient' };
  return { status: 'review' };
}

export function adaptiveTransferCorrectness(answer: string): AdaptiveIntegrity {
  return assessAdaptiveTransfer(answer).status;
}

export function adaptiveTransferSkill(answer: string, code: string): { parsed: boolean; included: boolean; base: number | null; evidence: number } {
  const empty = { parsed: Boolean(parseAdaptiveTransfer(answer)), included: false, base: null, evidence: 0 };
  if (assessAdaptiveTransfer(answer).status !== 'review') return empty;
  const stats = parseAdaptiveTransfer(answer);
  const field = SKILL_FIELD[code as AdaptiveSkillCode];
  if (!stats || !field) return empty;
  const max = stats[`${field}Max`];
  if (max === 0) return { parsed: true, included: false, base: null, evidence: 0 };
  return { parsed: true, included: true, base: Math.max(0.2, Math.min(1, stats[field] / max)), evidence: max };
}

export function educatorAttemptBadge(correctness: string) {
  if (correctness === 'correct') return 'Doğru';
  if (correctness === 'incorrect') return 'Destek/inceleme';
  if (correctness === 'insufficient') return 'Eksik kanıt · eğitmen incelemesi';
  return 'Eğitmen incelemesi';
}

export function educatorAttemptBadgeClass(correctness: string) {
  if (correctness === 'correct') return 'cza-badge-good';
  if (correctness === 'incorrect') return 'cza-badge-low';
  return 'cza-badge-mid';
}
