import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/b08-mat01-evidence-contract.ts', import.meta.url), 'utf8');
// Only the new pure module is loaded. No application, DB, auth or HTTP imports.
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { B08_VERSION, B08_SOURCES, B08_TRANSFER_PROPOSAL, classifyMat01A,
  evaluateMat01Evidence: evaluate, evaluateMat01Collection: collection } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

// Synthetic labels only: no students, accounts, tenant IDs or production data.
function fixture(task = 'MAT-01A', raw = '4 onluk 7 birlik') {
  return {
    assessmentRef: 'synthetic-assessment', rawRef: `synthetic-${task}`, sequence: 1,
    task, phase: { 'MAT-01A': 'firstIndependent', 'MAT-01S': 'supported',
      'MAT-01B': 'probe', 'MAT-01T': 'newTransfer', finger_read: 'probe' }[task],
    raw, provenance: 'client_reported', observedAt: '2026-01-01T00:00:00Z',
    source: { taskVersion: B08_SOURCES.taskVersion, rubricVersion: B08_SOURCES.rubricVersion,
      stimulusVersion: null },
    access: 'VALID', responseMode: 'TEXT', responseChannelAvailable: true,
    accommodation: 'PRESERVES_CONSTRUCT', teachingHint: 'NONE', opportunity: 'TAUGHT',
    stimulusMode: 'VERBAL_DESCRIPTION',
  };
}
function observe(e, criteria = {}) {
  e.observation = {
    ref: `synthetic-observation-${e.task}`, rawRef: e.rawRef,
    provenance: 'educator_observed', taskVersion: e.source.taskVersion,
    rubricVersion: B08_SOURCES.rubricVersion, observedAt: e.observedAt,
    observerRef: 'synthetic-reviewer', rationale: 'Synthetic observable relation fixture', criteria,
  };
  return e;
}
function transfer(criteria = {}) {
  const e = observe(fixture('MAT-01T', '5 onluk 2 birlik; 50+2'), {
    T1: 'OBSERVED', T2: 'OBSERVED', T3: 'OBSERVED', T4: 'NOT_ASSESSED', T5: 'OBSERVED', ...criteria,
  });
  e.novelty = { status: 'UNSEEN', variantRef: 'synthetic-variant-52', version: 'synthetic-v1',
    historyRef: 'synthetic-history-snapshot' };
  return e;
}
function invariant(r) {
  assert.equal(r.score, null);
  assert.equal(r.mastery, 'INSUFFICIENT');
  assert.equal(r.delayedRetention, 'NOT_ASSESSED');
  assert.equal(r.assignment, 'BLOCKED');
}

for (const [name, raw, status] of [
  ['A+1 word amounts', 'dört onluk yedi birlik', 'RELATION_OBSERVED'],
  ['A+2 reversed labels', '7 birlik ve 4 onluk', 'RELATION_OBSERVED'],
  ['A+2 explicit fields', 'onluk:4, birlik:7', 'RELATION_OBSERVED'],
  ['A-1 decimal ambiguity', '4,7', 'AMBIGUOUS_REVIEW'],
  ['A-1 unlabelled pair', '4 7', 'AMBIGUOUS_REVIEW'],
  ['A-2 explicit decimal equality', '47=4,7', 'INCORRECT_RELATION'],
  ['A-2 word decimal equality', '47=dört virgül yedi', 'INCORRECT_RELATION'],
  ['A-3 forty tens', '40 onluk 7 birlik', 'INCORRECT_RELATION'],
  ['A-3 reversed roles', '7 onluk 4 birlik', 'INCORRECT_RELATION'],
  ['A-3 digit versus value', "47'de onlar basamağının değeri 4'tür", 'INCORRECT_RELATION'],
  ['A±1 decomposition alone', '40+7', 'PARTIAL_EVIDENCE'],
  ['A±1 number repetition', '47', 'PARTIAL_EVIDENCE'],
  ['A empty', '', 'NOT_ASSESSED'],
  ['A unknown explanation', 'bir şey yazdım', 'AMBIGUOUS_REVIEW'],
  ['A contradictory trailing explanation', '4 onluk 7 birlik ama 47=4,7', 'AMBIGUOUS_REVIEW'],
]) {
  await test(name, () => {
    assert.equal(classifyMat01A(raw), status);
    const e = fixture('MAT-01A', raw), r = evaluate(e);
    assert.equal(r.status, status); assert.equal(r.raw, raw); assert.equal(r.rawRef, e.rawRef); invariant(r);
  });
}
await test('A labelled punctuation and whitespace keep their mathematical roles', () => {
  for (const raw of ['4 onluk ve 7 birlik.', '  DÖRT  onluk yedi birlik! ', '4 onluk, 7 birlik']) {
    assert.equal(classifyMat01A(raw), 'RELATION_OBSERVED');
  }
});
await test('S+1 result correct is not automatically the conceptual relation', () => {
  const e = fixture('MAT-01S', '47'); e.teachingHint = 'MODEL';
  const r = evaluate(e); assert.equal(r.phase, 'supported');
  assert.equal(r.answerStatus, 'CORRECT_NUMBER'); assert.equal(r.status, 'PARTIAL_EVIDENCE'); invariant(r);
  observe(e); e.observation.supportRelationObserved = true;
  assert.equal(evaluate(e).status, 'RELATION_OBSERVED');
  e.raw = 'kırk yedi'; assert.equal(evaluate(e).answerStatus, 'CORRECT_NUMBER');
});
await test('S-1 teacher-given answer is imitation, not independently solved', () => {
  const e = observe(fixture('MAT-01S', '47')); e.teachingHint = 'ANSWER_PROVIDED';
  e.observation.supportRelationObserved = true;
  const r = evaluate(e); assert.equal(r.status, 'NOT_ASSESSED'); assert.equal(r.answerStatus, null);
  assert.ok(r.reasons.includes('ANSWER_IMITATION')); invariant(r);
});
await test('S-2 verbal description is preserved, material without a version is not attested', () => {
  const e = fixture('MAT-01S', '47');
  assert.equal(evaluate(e).source.stimulusVersion, null);
  assert.equal(evaluate(e).status, 'PARTIAL_EVIDENCE');
  e.stimulusMode = 'MATERIAL'; assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  e.source.stimulusVersion = 'synthetic-block-v1'; assert.equal(evaluate(e).status, 'PARTIAL_EVIDENCE');
});
await test('S±1 not administered is absent, not zero or no lifetime support need', () => {
  const r = collection([fixture()]); assert.deepEqual(r.supported, []); invariant(r);
});
await test('S wrong number stays in supported phase and never changes first A', () => {
  const a = fixture('MAT-01A', '7 onluk 4 birlik');
  const s = fixture('MAT-01S', '11'); s.sequence = 2;
  const before = JSON.stringify([a, s]); const r = collection([a, s]);
  assert.equal(r.firstIndependent.status, 'INCORRECT_RELATION');
  assert.equal(r.supported[0].status, 'INCORRECT_RELATION');
  assert.equal(JSON.stringify([a, s]), before); invariant(r);
});
await test('B+1 two number decompositions remain observation-sourced', () => {
  const e = observe(fixture('MAT-01B', '40+7 ve 70+4'), {
    B1: 'OBSERVED', B2: 'OBSERVED', B3: 'OBSERVED', B4: 'OBSERVED', B5: 'OBSERVED',
  });
  const r = evaluate(e); assert.equal(r.status, 'RELATION_OBSERVED');
  assert.equal(r.observationRef, e.observation.ref); assert.equal(r.provenance, 'client_reported'); invariant(r);
});
await test('B+2 valid short explanation is not rejected for missing other digit coverage', () => {
  const e = observe(fixture('MAT-01B', '7 onlarda 70, birlerde 7'), {
    B2: 'PARTIAL', B4: 'OBSERVED', B5: 'OBSERVED',
  });
  const r = evaluate(e); assert.equal(r.status, 'RELATION_OBSERVED');
  assert.equal(r.criteria.B2, 'PARTIAL'); invariant(r);
});
await test('B-1 place changed or larger number alone is partial, never a full explanation', () => {
  for (const raw of ['yerleri değişti', '74 daha büyük']) {
    const e = observe(fixture('MAT-01B', raw), { B1: 'PARTIAL', B3: 'PARTIAL', B4: 'NOT_ASSESSED' });
    assert.equal(evaluate(e).status, 'PARTIAL_EVIDENCE');
  }
});
await test('B-2 same digits therefore equal is an observed incorrect relation', () => {
  const e = observe(fixture('MAT-01B', 'aynı rakamlar, eşit'), { B3: 'INCORRECT', B4: 'INCORRECT' });
  assert.equal(evaluate(e).status, 'INCORRECT_RELATION');
});
await test('B-3 absent communication access is not incorrect mathematics', () => {
  const e = observe(fixture('MAT-01B', ''), { B1: 'NOT_ASSESSED', B4: 'NOT_ASSESSED' });
  e.access = 'UNAVAILABLE'; assert.equal(evaluate(e).status, 'NOT_ASSESSED');
});
await test('B and T raw text cannot generate a concept rating without observations', () => {
  for (const task of ['MAT-01B', 'MAT-01T']) {
    const e = fixture(task, 'perfect sounding answer');
    assert.equal(evaluate(e).status, 'NOT_ASSESSED');
    assert.ok(evaluate(e).reasons.includes('OBSERVATION_MISSING'));
  }
});
await test('T+1 observed unseen independent representations are not delayed retention', () => {
  const r = evaluate(transfer()); assert.equal(r.status, 'RELATION_OBSERVED'); invariant(r);
  assert.equal(B08_TRANSFER_PROPOSAL.title, 'Aynı Sayı, Farklı Gösterimler');
});
await test('T+2 regrouped 4 tens 12 units is not rejected for a noncanonical form', () => {
  const e = transfer({ T4: 'OBSERVED' }); e.raw = '4 onluk 12 birlik; 5 onluk 2 birlik';
  assert.equal(evaluate(e).status, 'RELATION_OBSERVED');
});
await test('T-1 two spellings do not establish two conceptual representations', () => {
  const e = transfer({ T1: 'NOT_ASSESSED', T2: 'PARTIAL', T3: 'PARTIAL' });
  e.raw = '52; elli iki'; assert.equal(evaluate(e).status, 'PARTIAL_EVIDENCE');
});
for (const status of ['SEEN', 'UNKNOWN']) {
  await test(`T-2 ${status} novelty prevents transfer`, () => {
    const e = transfer(); e.novelty.status = status;
    const r = evaluate(e); assert.equal(r.status, 'NOT_ASSESSED');
    assert.ok(r.reasons.includes('NOVELTY_NOT_ASSESSED')); invariant(r);
  });
}
await test('T-2 history, variant and version all need explicit source references', () => {
  for (const key of ['historyRef', 'variantRef', 'version']) {
    const e = transfer(); e.novelty[key] = '';
    assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  }
});
await test('T-3 guided or modelled new example is not independent transfer', () => {
  for (const hint of ['PROMPT', 'MODEL', 'ANSWER_PROVIDED', 'UNKNOWN']) {
    const e = transfer(); e.teachingHint = hint;
    assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  }
});
await test('T-4 declared DRAW without an available response channel is not evidence', () => {
  const e = transfer(); e.responseMode = 'DRAW'; e.responseChannelAvailable = false;
  assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  e.responseChannelAvailable = true; assert.equal(evaluate(e).status, 'RELATION_OBSERVED');
});
await test('T incorrect relation and missing assistance observation remain distinct', () => {
  assert.equal(evaluate(transfer({ T3: 'INCORRECT' })).status, 'INCORRECT_RELATION');
  for (const T5 of ['INCORRECT', 'PARTIAL', 'NOT_ASSESSED']) {
    assert.equal(evaluate(transfer({ T5 })).status, 'NOT_ASSESSED');
  }
});
await test('F+1 and F-1 motor outcome cannot grant or erase academic mastery', () => {
  for (const raw of ['correct code reading', 'wrong code reading']) {
    const r = evaluate(fixture('finger_read', raw));
    assert.equal(r.status, 'NOT_ASSESSED');
    assert.ok(r.reasons.includes('FINGER_READ_ACADEMIC_LINK_NO_GO')); invariant(r);
  }
});
await test('F-2 single digit preset cannot produce an academic assignment', () => {
  const e = fixture('finger_read', 'synthetic single-digit preset');
  invariant(evaluate(e));
  assert.match(B08_SOURCES.rights, /SOURCE_UNVERIFIED/);
});
await test('G-1 raw refs are counted once across maps, same group never grants mastery', () => {
  const a = fixture(), s = fixture('MAT-01S', '47'); s.sequence = 2;
  const r = collection([a, s, structuredClone(a)]);
  assert.equal(r.uniqueRawCount, 2); assert.equal(r.distinctGroupCount, 1); invariant(r);
});
await test('G-1 conflicting replay and second initial preserve original raw, request review', () => {
  const a = fixture('MAT-01A', '4,7'), altered = structuredClone(a); altered.raw = '4 onluk 7 birlik';
  const r = collection([a, altered]);
  assert.equal(r.firstIndependent.raw, '4,7'); assert.ok(r.conflicts.includes('RAW_REFERENCE_CONFLICT'));
  const next = structuredClone(altered); next.rawRef = 'synthetic-second-initial'; next.sequence = 2;
  const duplicate = collection([next, a]);
  assert.equal(duplicate.firstIndependent.raw, '4,7');
  assert.ok(duplicate.conflicts.includes('FIRST_RESPONSE_ALREADY_PRESENT')); invariant(duplicate);
});
await test('G-2 zero evidence and teaching opportunity are not incorrect scores', () => {
  const zero = collection([]); assert.equal(zero.firstIndependent, null); invariant(zero);
  for (const opportunity of ['NOT_TAUGHT', 'PARTLY_TAUGHT', 'UNKNOWN']) {
    const e = fixture(); e.opportunity = opportunity;
    const r = evaluate(e); assert.equal(r.opportunity, opportunity); invariant(r);
  }
});
await test('G-2 access, accommodation, hint or source unknown is NOT_ASSESSED', () => {
  for (const patch of [{ access: 'UNKNOWN' }, { accommodation: 'UNKNOWN' },
    { accommodation: 'CHANGES_CONSTRUCT' }, { teachingHint: 'UNKNOWN' },
    { responseChannelAvailable: null }, { provenance: 'legacy_unknown' }]) {
    const r = evaluate({ ...fixture(), ...patch }); assert.equal(r.status, 'NOT_ASSESSED'); invariant(r);
  }
});
await test('G-3 old evaluation version cannot be silently rescored', () => {
  const e = fixture(); e.previousEvaluation = { rawRef: e.rawRef, contractVersion: 'legacy-v1' };
  const r = evaluate(e); assert.equal(r.status, 'NOT_ASSESSED');
  assert.ok(r.reasons.includes('SILENT_RESCORE_BLOCKED'));
  e.previousEvaluation.contractVersion = B08_VERSION; assert.equal(evaluate(e).status, 'RELATION_OBSERVED');
});
await test('G-4 observation versions, provenance, scope and references are gated', () => {
  for (const key of ['rawRef', 'rubricVersion', 'taskVersion', 'provenance']) {
    const e = transfer(); e.observation[key] = 'unverified';
    assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  }
  const e = fixture(); e.source.taskVersion = 'unknown';
  assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  const other = fixture('MAT-01S', '47'); other.assessmentRef = 'synthetic-other-scope';
  const r = collection([fixture(), other]); assert.equal(r.firstIndependent, null);
  assert.ok(r.conflicts.includes('ASSESSMENT_SCOPE_CONFLICT')); invariant(r);
});
await test('phase spoofing, invalid criterion and missing reviewer context are rejected', () => {
  const s = fixture('MAT-01S', '47'); s.phase = 'firstIndependent';
  assert.equal(evaluate(s).status, 'NOT_ASSESSED');
  const t = transfer(); t.observation.criteria.B1 = 'OBSERVED';
  assert.equal(evaluate(t).status, 'NOT_ASSESSED');
  const b = observe(fixture('MAT-01B'), { B2: 'OBSERVED', B4: 'OBSERVED' });
  b.observation.rationale = ''; assert.equal(evaluate(b).status, 'NOT_ASSESSED');
});
await test('whole synthetic trajectory never converts supported success into initial or transfer', () => {
  const a = fixture('MAT-01A', '7 onluk 4 birlik');
  const s = observe(fixture('MAT-01S', '47')); s.sequence = 2; s.teachingHint = 'MODEL';
  s.observation.supportRelationObserved = true;
  const b = observe(fixture('MAT-01B', 'yerleri değişti'), { B1: 'PARTIAL' }); b.sequence = 3;
  const t = transfer(); t.sequence = 4; t.novelty.status = 'UNKNOWN';
  const before = JSON.stringify([a, s, b, t]); const r = collection([a, s, b, t]);
  assert.equal(r.firstIndependent.status, 'INCORRECT_RELATION');
  assert.equal(r.supported[0].status, 'RELATION_OBSERVED');
  assert.equal(r.probes[0].status, 'PARTIAL_EVIDENCE');
  assert.equal(r.newTransfer[0].status, 'NOT_ASSESSED'); invariant(r);
  assert.equal(JSON.stringify([a, s, b, t]), before);
  assert.ok(Object.isFrozen(r)); assert.ok(Object.isFrozen(r.results[0]));
});
await test('runtime boundary: new module has no imports, network, process or DB side effects', () => {
  assert.doesNotMatch(source, /\bimport\s|\bfetch\(|\bprocess\.|\bDate\.now\(|\bMath\.random\(/);
  assert.equal(B08_SOURCES.runtimeNotWired, true);
});
await test('unversioned transfer material and unknown response modes fail closed', () => {
  const e = transfer(); e.stimulusMode = 'MATERIAL';
  assert.equal(evaluate(e).status, 'NOT_ASSESSED');
  e.source.stimulusVersion = 'synthetic-visual-v1';
  assert.equal(evaluate(e).status, 'RELATION_OBSERVED');
  e.responseMode = 'UNSUPPORTED'; assert.equal(evaluate(e).status, 'NOT_ASSESSED');
});
