export type EarlyDevelopmentRating =
  | 'independent'
  | 'prompted'
  | 'verbal_prompt'
  | 'visual_prompt'
  | 'modeled'
  | 'physical_assist'
  | 'not_observed'
  | 'not_assessed';

export type EarlyDevelopmentResponse = {
  itemId: string;
  rating: EarlyDevelopmentRating;
  note?: string;
  metrics?: Record<string, number>;
  recordedAt?: string;
};

export type V7LanguageLevel = 'single_word' | 'two_word' | 'short_sentence';
export type V7AttentionSpan = 'short' | 'medium' | 'long';
export type V7Interest = 'animals' | 'vehicles' | 'kitchen' | 'outdoor';
export type V7AdaptiveProfile = {
  languageLevel: V7LanguageLevel;
  interests: V7Interest[];
  attentionSpan: V7AttentionSpan;
  developmentalNote?: string;
  configuredAt: string;
  previousCategoryPerformance?: Record<string, number>;
};
export type V7SectionId = 'VIS' | 'CON' | 'REL' | 'PRO' | 'AUD' | 'MEM' | 'ATT' | 'NAT';

export const V7_SECTIONS: Array<{ id: V7SectionId; title: string; bankCount: number }> = [
  { id: 'VIS', title: 'Görsel Eşleme ve Kategorizasyon', bankCount: 20 },
  { id: 'CON', title: 'Kavramlar ve Karşılaştırma', bankCount: 25 },
  { id: 'REL', title: 'Yer–Eylem ve İlişkilendirme', bankCount: 20 },
  { id: 'PRO', title: 'Meslek–Araç ve İşlev Keşfi', bankCount: 15 },
  { id: 'AUD', title: 'Yansıma Sesler ve İşitsel Ayırt Etme', bankCount: 15 },
  { id: 'MEM', title: 'Hafıza ve Çalışma Belleği', bankCount: 20 },
  { id: 'ATT', title: 'Dikkat ve Yürütücü İşlevler', bankCount: 15 },
  { id: 'NAT', title: 'Doğal Dil, Oyun ve Transfer', bankCount: 8 },
];

const countBySection: Record<V7SectionId, number> = { VIS: 20, CON: 25, REL: 20, PRO: 15, AUD: 15, MEM: 20, ATT: 15, NAT: 8 };
const idsFor = (section: V7SectionId) => Array.from({ length: countBySection[section] }, (_, index) => `E7_${section}_${String(index + 1).padStart(2, '0')}`);
export const V7_ALL_IDS = V7_SECTIONS.flatMap((section) => idsFor(section.id));

export function v7SectionFromId(itemId: string): V7SectionId | null {
  const match = itemId.match(/^E7_(VIS|CON|REL|PRO|AUD|MEM|ATT|NAT)_\d{2}$/);
  return match ? match[1] as V7SectionId : null;
}

const difficultyPattern: Record<V7SectionId, number[]> = {
  VIS: [1,2,3,4],
  CON: [1,1,2,3,4],
  REL: [1,2,3,4],
  PRO: [1,3,4],
  AUD: [1,2,3],
  MEM: [1,2,3,4],
  ATT: [1,2,3],
  NAT: [1,1,1,1,2,2,3,3],
};

export function v7DifficultyFromId(itemId: string) {
  const section = v7SectionFromId(itemId);
  if (!section) return 1;
  const n = Number(itemId.slice(-2));
  const pattern = difficultyPattern[section];
  if (!Number.isInteger(n) || n < 1) return 1;
  if (section === 'NAT') return pattern[n - 1] ?? 1;
  return pattern[(n - 1) % pattern.length] ?? 1;
}

export function v7MinAge(itemId: string) {
  const section = v7SectionFromId(itemId);
  const difficulty = v7DifficultyFromId(itemId);
  if (section === 'PRO') return difficulty <= 1 ? 30 : 33;
  if (difficulty === 1) return 24;
  if (difficulty === 2) return 27;
  if (difficulty === 3) return 30;
  return 33;
}

export function v7IsNeutral(itemId: string) {
  return v7SectionFromId(itemId) === 'PRO' || v7DifficultyFromId(itemId) === 4;
}

export const v7NeutralProbeIds = new Set(V7_ALL_IDS.filter(v7IsNeutral));

export function v7EligiblePoolIds(ageMonths?: number) {
  const age = Number.isFinite(ageMonths) ? Number(ageMonths) : 24;
  return V7_ALL_IDS.filter((id) => age >= v7MinAge(id));
}

export function v7IsItemAllowed(itemId: string, ageMonths?: number) {
  return V7_ALL_IDS.includes(itemId) && v7EligiblePoolIds(ageMonths).includes(itemId);
}

export function v7AgeBandLabel(ageMonths?: number) {
  const age = Number.isFinite(ageMonths) ? Number(ageMonths) : 24;
  if (age <= 27) return '24–27 ay · temel tanıma ve eşleme rotası';
  if (age <= 30) return '28–30 ay · ayırt etme ve ilişki rotası';
  if (age <= 33) return '31–33 ay · ilişkilendirme ve çalışma belleği rotası';
  return '34–35 ay · ileri ilişki + nötr keşif rotası';
}

export function v7TargetForSection(ageMonths: number | undefined, profile: V7AdaptiveProfile | undefined, section: V7SectionId) {
  const age = Number.isFinite(ageMonths) ? Number(ageMonths) : 24;
  const eligibleCount = idsFor(section).filter((id) => age >= v7MinAge(id)).length;
  if (!eligibleCount) return 0;
  let target = section === 'NAT' ? 8 : age <= 27 ? 6 : age <= 30 ? 7 : 8;
  if (section !== 'NAT' && profile?.attentionSpan === 'short') target -= 1;
  if (section !== 'NAT' && profile?.attentionSpan === 'long') target += 1;
  return Math.min(eligibleCount, Math.max(1, Math.min(9, target)));
}

export function v7TargetTotal(ageMonths?: number, profile?: V7AdaptiveProfile) {
  return V7_SECTIONS.reduce((sum, section) => sum + v7TargetForSection(ageMonths, profile, section.id), 0);
}

export function normalizeV7AdaptiveProfile(input: unknown, previousCategoryPerformance?: Record<string, number>): V7AdaptiveProfile | null {
  const body = (input ?? {}) as { languageLevel?: string; interests?: unknown; attentionSpan?: string; developmentalNote?: string };
  if (!['single_word','two_word','short_sentence'].includes(body.languageLevel || '')) return null;
  if (!['short','medium','long'].includes(body.attentionSpan || '')) return null;
  const interests = Array.isArray(body.interests) ? [...new Set(body.interests.map(String).filter((value) => ['animals','vehicles','kitchen','outdoor'].includes(value)))].slice(0, 4) as V7Interest[] : [];
  if (!interests.length) return null;
  return {
    languageLevel: body.languageLevel as V7LanguageLevel,
    interests,
    attentionSpan: body.attentionSpan as V7AttentionSpan,
    developmentalNote: (body.developmentalNote || '').trim().slice(0, 600),
    configuredAt: new Date().toISOString(),
    previousCategoryPerformance,
  };
}

const sectionDomains: Record<V7SectionId, string[]> = {
  VIS: ['COG','VIS','RL'], CON: ['RL','COG','VIS'], REL: ['RL','EL','COG','SC'], PRO: ['RL','EL','COG'],
  AUD: ['RL','EL','SPEECH','ATT','IM'], MEM: ['MEM','ATT','COG'], ATT: ['ATT','MEM','ADAPT'], NAT: ['EL','SPEECH','SC','JA','IM','PLAY','COG','ATT','ADAPT','FINE','GROSS'],
};
const sectionPrecursors: Record<V7SectionId, string[]> = {
  VIS: ['MATCH','CLASS'], CON: ['CONCEPT','QUANTITY'], REL: ['CONCEPT','PROBLEM'], PRO: ['CLASS','PROBLEM'], AUD: ['LEARNING'], MEM: ['LEARNING','PATTERN'], ATT: [], NAT: ['LEARNING','PROBLEM'],
};
export const v7ItemDomains: Record<string, string[]> = Object.fromEntries(V7_ALL_IDS.map((id) => [id, sectionDomains[v7SectionFromId(id)!]]));
export const v7PrecursorDomains: Record<string, string[]> = Object.fromEntries(V7_ALL_IDS.filter((id) => sectionPrecursors[v7SectionFromId(id)!].length > 0).map((id) => [id, sectionPrecursors[v7SectionFromId(id)!]]));

export function v7SectionResponseCount(responses: EarlyDevelopmentResponse[], section: V7SectionId) {
  return new Set(responses.filter((response) => v7SectionFromId(response.itemId) === section).map((response) => response.itemId)).size;
}

export function buildV7SectionProgress(ageMonths: number | undefined, profile: V7AdaptiveProfile | undefined, responses: EarlyDevelopmentResponse[], completedSections: string[] = []) {
  const completed = new Set(completedSections);
  return V7_SECTIONS.map((section) => ({
    id: section.id,
    title: section.title,
    completed: v7SectionResponseCount(responses, section.id),
    total: v7TargetForSection(ageMonths, profile, section.id),
    bankCount: section.bankCount,
    status: completed.has(section.id) ? 'completed' : v7SectionResponseCount(responses, section.id) > 0 ? 'in_progress' : 'not_started',
  }));
}

export function buildV7CategoryPerformance(responses: EarlyDevelopmentResponse[]) {
  return V7_SECTIONS.map((section) => {
    const values = responses.filter((response) => v7SectionFromId(response.itemId) === section.id && response.rating !== 'not_assessed' && !v7IsNeutral(response.itemId));
    const independent = values.filter((response) => response.rating === 'independent').length;
    const supported = values.filter((response) => ['prompted','verbal_prompt','visual_prompt','modeled','physical_assist'].includes(response.rating)).length;
    const notObserved = values.filter((response) => response.rating === 'not_observed').length;
    const latencies = values.map((response) => Number(response.metrics?.latencyMs)).filter((value) => Number.isFinite(value) && value >= 0);
    const attempts = values.map((response) => Number(response.metrics?.touchCount)).filter((value) => Number.isFinite(value) && value > 0);
    const assessed = independent + supported + notObserved;
    return {
      code: section.id,
      title: section.title,
      assessed,
      independent,
      supported,
      notObserved,
      independentRate: assessed ? Math.round(independent / assessed * 100) : null,
      supportRate: assessed ? Math.round(supported / assessed * 100) : null,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
      averageTouches: attempts.length ? Math.round(attempts.reduce((a, b) => a + b, 0) / attempts.length * 10) / 10 : null,
    };
  });
}
