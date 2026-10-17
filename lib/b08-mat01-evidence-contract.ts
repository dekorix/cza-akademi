/**
 * Pure, synthetic-only B08 review contract. No runtime imports, I/O, scores,
 * authentication claims, student profile writes, or assignment side effects.
 */
export const B08_VERSION = 'B08_MAT01_EVIDENCE_V1.0' as const;
export const B08_SOURCES = Object.freeze({
  baseCommit: '30de9c8641163c865d4863f3bcaf8e3e3c62faa2',
  taskVersion: 'MAT01_SOURCE_30de9c8',
  rubricVersion: 'B08_AI_REV1_OBSERVABLE_V1.0',
  contractIssue: 'https://github.com/dekorix/cza-akademi/issues/106#issuecomment-6163243221',
  designIssue: 'https://github.com/dekorix/cza-akademi/issues/106#issuecomment-6163081902',
  protocol: 'https://github.com/dekorix/cza-akademi/issues/108',
  curriculum: 'https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/116',
  prerequisite: 'https://tymm.meb.gov.tr/ilkokul-matematik-dersi/unite/45',
  sourceAccessDate: '2026-10-13',
  rights: 'SOURCE_UNVERIFIED',
  runtimeNotWired: true,
});
export const B08_TRANSFER_PROPOSAL = Object.freeze({
  title: 'Aynı Sayı, Farklı Gösterimler',
  instruction: '52 sayısını iki farklı şekilde göster. Gösterimlerinden en az birinde onluk ve birlik gruplarını belirt. İki gösterimin de 52 olduğunu anlat ya da göster.',
  status: 'DESIGN_ONLY_NOT_PUBLISHED',
});

export type Mat01Task = 'MAT-01A' | 'MAT-01S' | 'MAT-01B' | 'MAT-01T' | 'finger_read';
export type EvidencePhase = 'firstIndependent' | 'supported' | 'probe' | 'newTransfer';
export type RelationStatus = 'RELATION_OBSERVED' | 'PARTIAL_EVIDENCE' |
  'INCORRECT_RELATION' | 'AMBIGUOUS_REVIEW' | 'NOT_ASSESSED';
export type CriterionStatus = 'OBSERVED' | 'PARTIAL' | 'INCORRECT' | 'NOT_ASSESSED';
export type Provenance = 'client_reported' | 'server_evaluated' | 'educator_observed' | 'legacy_unknown';
export type TeachingOpportunity = 'TAUGHT' | 'PARTLY_TAUGHT' | 'NOT_TAUGHT' | 'UNKNOWN';
export type BCriterion = 'B1' | 'B2' | 'B3' | 'B4' | 'B5';
export type TCriterion = 'T1' | 'T2' | 'T3' | 'T4' | 'T5';

export interface Mat01Observation {
  ref: string;
  rawRef: string;
  provenance: Provenance;
  taskVersion: string;
  rubricVersion: string;
  observedAt: string;
  observerRef: string;
  rationale: string;
  criteria?: Partial<Record<BCriterion | TCriterion, CriterionStatus>>;
  supportRelationObserved?: boolean;
}
export interface Mat01Evidence {
  /** References are caller-owned source references, never a new student ID. */
  assessmentRef: string;
  rawRef: string;
  sequence: number;
  task: Mat01Task;
  phase: EvidencePhase;
  raw: string;
  provenance: Provenance;
  observedAt: string;
  source: {
    taskVersion: string;
    rubricVersion: string;
    stimulusVersion: string | null;
  };
  access: 'VALID' | 'UNKNOWN' | 'UNAVAILABLE';
  responseMode: 'TEXT' | 'SPEAK' | 'DRAW' | 'SELECT';
  responseChannelAvailable: boolean | null;
  accommodation: 'PRESERVES_CONSTRUCT' | 'CHANGES_CONSTRUCT' | 'UNKNOWN';
  teachingHint: 'NONE' | 'PROMPT' | 'MODEL' | 'ANSWER_PROVIDED' | 'UNKNOWN';
  opportunity: TeachingOpportunity;
  stimulusMode: 'VERBAL_DESCRIPTION' | 'MATERIAL' | 'UNKNOWN';
  novelty?: {
    status: 'UNSEEN' | 'SEEN' | 'UNKNOWN';
    variantRef: string;
    version: string;
    historyRef: string;
  };
  observation?: Mat01Observation;
  previousEvaluation?: { contractVersion: string; rawRef: string };
}
export interface Mat01Result {
  rawRef: string;
  raw: string;
  assessmentRef: string;
  task: Mat01Task;
  phase: EvidencePhase;
  provenance: Provenance;
  opportunity: TeachingOpportunity;
  contractVersion: typeof B08_VERSION;
  source: Readonly<Mat01Evidence['source']>;
  status: RelationStatus;
  /** Number recognition is not a score or evidence of conceptual mastery. */
  answerStatus: 'CORRECT_NUMBER' | 'INCORRECT_NUMBER' | null;
  score: null;
  mastery: 'INSUFFICIENT';
  assignment: 'BLOCKED';
  delayedRetention: 'NOT_ASSESSED';
  reasons: readonly string[];
  observationRef: string | null;
  criteria: Readonly<Partial<Record<BCriterion | TCriterion, CriterionStatus>>>;
}

const present = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;
const validDate = (s: string) => present(s) && Number.isFinite(Date.parse(s));
const words: Readonly<Record<string, number>> = Object.freeze({
  sıfır: 0, bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6,
  yedi: 7, sekiz: 8, dokuz: 9, on: 10, kırk: 40,
});
const amount = (s: string): number | undefined => /^\d{1,3}$/.test(s) ? Number(s) : words[s];
const normalize = (s: string) => s.normalize('NFC').toLocaleLowerCase('tr-TR')
  .trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();

/** Bounded grammar: unrecognized explanations are reviewed, never guessed. */
export function classifyMat01A(raw: string): RelationStatus {
  const text = normalize(raw);
  if (!text) return 'NOT_ASSESSED';
  if (/^(?:4\s*,\s*7|4\s+7)$/.test(text)) return 'AMBIGUOUS_REVIEW';
  if (/^47\s*=\s*(?:4\s*,\s*7|dört virgül yedi)$/.test(text)) return 'INCORRECT_RELATION';
  if (/^(?:40\s*\+\s*7|47)$/.test(text)) return 'PARTIAL_EVIDENCE';
  if (/^(?:onlar basamağının değeri 4|47'de onlar basamağının değeri 4(?:'tür)?)$/.test(text)) {
    return 'INCORRECT_RELATION';
  }
  const token = '(\\d{1,3}|sıfır|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|kırk)';
  const forward = text.match(new RegExp(`^${token} onluk(?: ve|,)? ${token} birlik$`));
  const reverse = text.match(new RegExp(`^${token} birlik(?: ve|,)? ${token} onluk$`));
  const labelled = text.match(new RegExp(`^onluk\\s*:\\s*${token}\\s*,?\\s*birlik\\s*:\\s*${token}$`));
  const match = forward ?? reverse ?? labelled;
  if (!match) return 'AMBIGUOUS_REVIEW';
  const tens = amount(match[reverse ? 2 : 1]);
  const units = amount(match[reverse ? 1 : 2]);
  return tens === 4 && units === 7 ? 'RELATION_OBSERVED' : 'INCORRECT_RELATION';
}

function observationReasons(e: Mat01Evidence): string[] {
  const o = e.observation;
  if (!o) return ['OBSERVATION_MISSING'];
  const reasons: string[] = [];
  if (o.provenance !== 'educator_observed') reasons.push('OBSERVATION_PROVENANCE_UNVERIFIED');
  if (!present(o.ref) || !present(o.observerRef) || !present(o.rationale) || !validDate(o.observedAt)) {
    reasons.push('OBSERVATION_CONTEXT_MISSING');
  }
  if (o.rawRef !== e.rawRef || o.taskVersion !== e.source.taskVersion ||
      o.rubricVersion !== B08_SOURCES.rubricVersion) reasons.push('OBSERVATION_SOURCE_MISMATCH');
  const allowed = e.task === 'MAT-01B' ? ['B1', 'B2', 'B3', 'B4', 'B5'] :
    e.task === 'MAT-01T' ? ['T1', 'T2', 'T3', 'T4', 'T5'] : [];
  for (const [key, value] of Object.entries(o.criteria ?? {})) {
    if (!allowed.includes(key) || !['OBSERVED', 'PARTIAL', 'INCORRECT', 'NOT_ASSESSED'].includes(value)) {
      reasons.push('OBSERVATION_CRITERION_INVALID');
    }
  }
  return reasons;
}

function gateReasons(e: Mat01Evidence): string[] {
  const reasons: string[] = [];
  if (!present(e.rawRef) || !present(e.assessmentRef) || !validDate(e.observedAt) ||
      !Number.isInteger(e.sequence) || e.sequence < 0) reasons.push('SOURCE_REFERENCE_MISSING');
  if (e.source.taskVersion !== B08_SOURCES.taskVersion ||
      e.source.rubricVersion !== B08_SOURCES.rubricVersion) reasons.push('SOURCE_VERSION_UNVERIFIED');
  if (e.previousEvaluation && (e.previousEvaluation.contractVersion !== B08_VERSION ||
      e.previousEvaluation.rawRef !== e.rawRef)) reasons.push('SILENT_RESCORE_BLOCKED');
  if (!['client_reported', 'server_evaluated', 'educator_observed'].includes(e.provenance)) {
    reasons.push('RAW_PROVENANCE_UNVERIFIED');
  }
  if (e.access !== 'VALID' || e.responseChannelAvailable !== true) reasons.push('ACCESS_NOT_ASSESSED');
  if (!['TEXT', 'SPEAK', 'DRAW', 'SELECT'].includes(e.responseMode)) reasons.push('RESPONSE_MODE_UNVERIFIED');
  if (e.accommodation !== 'PRESERVES_CONSTRUCT') reasons.push('CONSTRUCT_NOT_ASSESSED');
  if (!['NONE', 'PROMPT', 'MODEL', 'ANSWER_PROVIDED'].includes(e.teachingHint)) reasons.push('HELP_NOT_ASSESSED');
  if (!['TAUGHT', 'PARTLY_TAUGHT', 'NOT_TAUGHT', 'UNKNOWN'].includes(e.opportunity)) {
    reasons.push('TEACHING_OPPORTUNITY_INVALID');
  }
  const phase = { 'MAT-01A': 'firstIndependent', 'MAT-01S': 'supported',
    'MAT-01B': 'probe', 'MAT-01T': 'newTransfer', finger_read: 'probe' }[e.task];
  if (!phase || e.phase !== phase) reasons.push('PHASE_MISMATCH');
  if ((e.task === 'MAT-01A' || e.task === 'MAT-01T') && e.teachingHint !== 'NONE') {
    reasons.push('INDEPENDENCE_NOT_ASSESSED');
  }
  if (e.task === 'MAT-01S') {
    if (!['VERBAL_DESCRIPTION', 'MATERIAL'].includes(e.stimulusMode)) reasons.push('STIMULUS_UNVERIFIED');
  }
  if (e.stimulusMode === 'MATERIAL' && !present(e.source.stimulusVersion)) reasons.push('MATERIAL_VERSION_MISSING');
  if (e.teachingHint === 'ANSWER_PROVIDED') reasons.push('ANSWER_IMITATION');
  if (e.task === 'MAT-01T') {
    const n = e.novelty;
    if (!n || n.status !== 'UNSEEN' || !present(n.variantRef) ||
        !present(n.version) || !present(n.historyRef)) reasons.push('NOVELTY_NOT_ASSESSED');
    if (e.observation?.criteria?.T5 !== 'OBSERVED') reasons.push('TRANSFER_CONDITIONS_NOT_OBSERVED');
  }
  if (e.task === 'MAT-01B' && e.observation?.criteria?.B5 === 'INCORRECT') {
    reasons.push('OBSERVATION_PROCESS_CONFLICT');
  }
  if (e.observation || e.task === 'MAT-01B' || e.task === 'MAT-01T' || e.responseMode !== 'TEXT') {
    reasons.push(...observationReasons(e));
  }
  return reasons;
}

function rubricRelation(e: Mat01Evidence): RelationStatus {
  const c = e.observation?.criteria ?? {};
  const values = Object.values(c);
  if (values.every(v => v === 'NOT_ASSESSED')) return 'NOT_ASSESSED';
  if (values.includes('INCORRECT')) return 'INCORRECT_RELATION';
  if (e.task === 'MAT-01B') {
    // A valid short explanation of one digit is sufficient for the why-question,
    // without claiming that every digit or the entire curriculum was assessed.
    if (c.B4 === 'OBSERVED' && (c.B2 === 'OBSERVED' || c.B2 === 'PARTIAL')) return 'RELATION_OBSERVED';
  } else if (c.T1 === 'OBSERVED' && c.T2 === 'OBSERVED' && c.T3 === 'OBSERVED') {
    return 'RELATION_OBSERVED';
  }
  return 'PARTIAL_EVIDENCE';
}

export function evaluateMat01Evidence(e: Mat01Evidence): Mat01Result {
  const reasons = gateReasons(e);
  let status: RelationStatus = 'NOT_ASSESSED';
  let answerStatus: Mat01Result['answerStatus'] = null;
  if (e.task === 'finger_read') reasons.push('FINGER_READ_ACADEMIC_LINK_NO_GO');
  if (!reasons.length) {
    if (e.task === 'MAT-01A') {
      status = e.responseMode === 'TEXT' ? classifyMat01A(e.raw) : 'NOT_ASSESSED';
      // A teacher can supply a separate labelled explanation, never rewrite raw.
      if (e.responseMode !== 'TEXT') reasons.push('OPEN_RESPONSE_REQUIRES_SEPARATE_LABELLED_EVIDENCE');
      if (!present(e.raw)) reasons.push('NO_RESPONSE_OBSERVED');
    } else if (e.task === 'MAT-01S') {
      const text = normalize(e.raw);
      answerStatus = ['47', 'kırk yedi'].includes(text) ? 'CORRECT_NUMBER' :
        /^\d+$/.test(text) ? 'INCORRECT_NUMBER' : null;
      if (answerStatus === 'INCORRECT_NUMBER') status = 'INCORRECT_RELATION';
      else if (answerStatus === 'CORRECT_NUMBER') status = 'PARTIAL_EVIDENCE';
      else status = present(e.raw) ? 'AMBIGUOUS_REVIEW' : 'NOT_ASSESSED';
      if (e.observation?.supportRelationObserved === true && !observationReasons(e).length &&
          answerStatus === 'CORRECT_NUMBER') status = 'RELATION_OBSERVED';
    } else status = rubricRelation(e);
  }
  return Object.freeze({
    rawRef: e.rawRef, raw: e.raw, assessmentRef: e.assessmentRef, task: e.task,
    phase: e.phase, provenance: e.provenance, opportunity: e.opportunity,
    contractVersion: B08_VERSION, source: Object.freeze({ ...e.source }), status,
    answerStatus, score: null, mastery: 'INSUFFICIENT', assignment: 'BLOCKED',
    delayedRetention: 'NOT_ASSESSED', reasons: Object.freeze([...new Set(reasons)]),
    observationRef: e.observation?.ref ?? null,
    criteria: Object.freeze({ ...e.observation?.criteria }),
  });
}

/** Deduplicates raw source references across both maps; never replaces first A. */
export function evaluateMat01Collection(inputs: readonly Mat01Evidence[]) {
  const seen = new Map<string, Mat01Evidence>();
  const conflicts: string[] = [];
  for (const e of inputs) {
    const previous = seen.get(e.rawRef);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(e)) conflicts.push('RAW_REFERENCE_CONFLICT');
    } else seen.set(e.rawRef, e);
  }
  const unique = [...seen.values()].sort((a, b) => a.sequence - b.sequence);
  if (new Set(unique.map(e => e.assessmentRef)).size > 1) conflicts.push('ASSESSMENT_SCOPE_CONFLICT');
  const first = unique.filter(e => e.task === 'MAT-01A' && e.phase === 'firstIndependent');
  if (first.length > 1) conflicts.push('FIRST_RESPONSE_ALREADY_PRESENT');
  const results = unique.map(evaluateMat01Evidence);
  const conflict = conflicts.length > 0;
  return Object.freeze({
    results: Object.freeze(results), uniqueRawCount: unique.length,
    distinctGroupCount: unique.some(e => e.task !== 'finger_read') ? 1 : 0,
    firstIndependent: conflicts.includes('ASSESSMENT_SCOPE_CONFLICT') ? null :
      results.find(r => r.task === 'MAT-01A') ?? null,
    supported: Object.freeze(results.filter(r => r.task === 'MAT-01S')),
    probes: Object.freeze(results.filter(r => r.task === 'MAT-01B')),
    newTransfer: Object.freeze(results.filter(r => r.task === 'MAT-01T')),
    conflicts: Object.freeze([...new Set(conflicts)]), status: conflict ? 'REVIEW_REQUIRED' : 'INSUFFICIENT',
    score: null, mastery: 'INSUFFICIENT', delayedRetention: 'NOT_ASSESSED',
    assignment: 'BLOCKED', runtimeNotWired: true,
  });
}
