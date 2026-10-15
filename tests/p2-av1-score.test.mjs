import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  adaptiveTransferCorrectness,
  adaptiveTransferSkill,
  educatorAttemptBadge,
} from '../apps/assessment-appdeploy/backend/adaptiveTransferScore.ts';
import { ANSWER_BYTE_LIMIT, isTruncatedAnswer, rawAnswerByteLength, takeRawAnswer } from '../apps/assessment-appdeploy/backend/answerIntegrity.ts';
import { encodeMathAttitude, mathAttitudeFollowUp } from '../apps/assessment-appdeploy/src/mathAttitudeFollowUp.ts';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');
const CODES = ['S02', 'S04', 'S07', 'S09', 'S11', 'S12'];
const DOMAINS = ['math', 'lang', 'memory', 'spatial', 'plan', 'flex'];
const IDS = { math: ['MA1', 'MA2'], lang: ['LA1', 'LA2'], memory: ['ME1', 'ME2'], spatial: ['SP1', 'SP2'], plan: ['PL1', 'PL2'], flex: ['FL1', 'FL2'] };

function row(id, score, answer = 'a') {
  return id + '~' + answer + '~' + score + '~10~0';
}
function skip(id) {
  return id + '~SKIP~0~10~0';
}
function payload(n, pairs, rows) {
  return 'AV|n=' + n + '|' + DOMAINS.map((domain) => domain + '=' + (pairs[domain] || '0/0')).join('|') + '|focus=memory+lang+math|r=' + rows.join(',');
}
function skills(answer) {
  return Object.fromEntries(CODES.map((code) => [code, adaptiveTransferSkill(answer, code)]));
}

const OLD_SIX = payload(6, { math: '2/2', lang: '1/2', memory: '0/2' }, [
  row('MA1', 1, '14+22'), row('MA2', 1, '16'),
  row('LA1', 1, 'moist'), row('LA2', 0, 'late'),
  row('ME1', 0, 'x'), row('ME2', 0, 'y'),
]);
const NEW_TWELVE = payload(12, { math: '2/2', lang: '1/2', memory: '0/2', spatial: '1/2', plan: '2/2', flex: '1/2' }, [
  row('MA1', 1), row('MA2', 1), row('LA1', 1), row('LA2', 0), row('ME1', 0), row('ME2', 0),
  row('SP1', 1), row('SP2', 0), row('PL1', 1), row('PL2', 1), row('FL1', 1), row('FL2', 0),
]);
const ALL_SKIP = payload(12, {}, DOMAINS.flatMap((domain) => IDS[domain].map(skip)));

test('incomplete AV1 evidence is not incorrect and adds no skill score', () => {
  for (const answer of [
    payload(5, { math: '1/1', lang: '1/1', memory: '1/1', spatial: '1/1', flex: '1/1' }, [row('MA1', 1), row('LA1', 1), row('ME1', 1), row('SP1', 1), row('FL1', 1)]),
    payload(11, { math: '2/2', lang: '1/2', memory: '0/2', spatial: '1/2', plan: '2/2', flex: '1/1' }, [row('MA1', 1), row('MA2', 1), row('LA1', 1), row('LA2', 0), row('ME1', 0), row('ME2', 0), row('SP1', 1), row('SP2', 0), row('PL1', 1), row('PL2', 1), row('FL1', 1)]),
    'not-a-transfer',
    ALL_SKIP,
    payload(12, { math: '2/2', spatial: '1/999999' }, [row('MA1', 1), row('MA2', 1)]),
    payload(6, { math: '2/2', lang: '1/2', memory: '0/2' }, [row('MA1', 1, '14+22')]),
  ]) {
    assert.equal(adaptiveTransferCorrectness(answer), 'insufficient', answer.slice(0, 48));
    assert.notEqual(adaptiveTransferCorrectness(answer), 'incorrect');
    assert.equal(educatorAttemptBadge('insufficient'), 'Eksik kanıt · eğitmen incelemesi');
    for (const code of CODES) {
      const skill = adaptiveTransferSkill(answer, code);
      assert.equal(skill.included, false, code);
      assert.equal(skill.base, null, code);
      assert.equal(skill.evidence, 0, code);
    }
  }
  assert.equal(educatorAttemptBadge('incorrect'), 'Destek/inceleme');
});

test('a consistent stored 6-item record keeps the previous skill bases', () => {
  assert.equal(adaptiveTransferCorrectness(OLD_SIX), 'review');
  assert.equal(educatorAttemptBadge('review'), 'Eğitmen incelemesi');
  const scored = skills(OLD_SIX);
  assert.deepEqual(scored.S02, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(scored.S04, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(scored.S07, { parsed: true, included: true, base: 0.2, evidence: 2 });
  for (const code of ['S09', 'S11', 'S12']) assert.equal(scored[code].included, false);
  const coldStart = payload(6, { math: '1/1', lang: '1/1', memory: '0/1', spatial: '1/1', plan: '1/1', flex: '0/1' }, [
    row('MA1', 1), row('LA1', 1), row('ME1', 0), row('SP1', 1), row('PL1', 1), row('FL1', 0),
  ]);
  assert.equal(adaptiveTransferCorrectness(coldStart), 'review');
  assert.equal(adaptiveTransferSkill(coldStart, 'S09').base, 1);
  assert.equal(adaptiveTransferSkill(coldStart, 'S12').base, 0.2);
});

test('a complete 12-item record scores all six domains, including S09 S11 and S12', () => {
  assert.equal(adaptiveTransferCorrectness(NEW_TWELVE), 'review');
  const scored = skills(NEW_TWELVE);
  assert.deepEqual(scored.S02, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(scored.S04, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(scored.S07, { parsed: true, included: true, base: 0.2, evidence: 2 });
  assert.deepEqual(scored.S09, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(scored.S11, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(scored.S12, { parsed: true, included: true, base: 0.5, evidence: 2 });
});

test('a raw answer is accepted at 16 KB and rejected one byte later without changing the record', () => {
  const record = { id: 'session-1', attempts: [{ answer: 'önceki kanıt' }] };
  const exact = 'a'.repeat(ANSWER_BYTE_LIMIT);
  assert.equal(rawAnswerByteLength(exact), ANSWER_BYTE_LIMIT);
  const accepted = takeRawAnswer(record, exact);
  assert.equal(accepted.status, 200);
  if (accepted.status === 200) assert.equal(accepted.text, exact);
  const over = exact + 'b';
  assert.equal(rawAnswerByteLength(over), ANSWER_BYTE_LIMIT + 1);
  const rejected = takeRawAnswer(record, over);
  assert.equal(rejected.status, 413);
  assert.equal(rejected.record, record);
  assert.deepEqual(rejected.record.attempts, [{ answer: 'önceki kanıt' }]);
  const turkishUnit = 'ğ';
  assert.equal(rawAnswerByteLength(turkishUnit), 2);
  const turkish = turkishUnit.repeat(ANSWER_BYTE_LIMIT / 2);
  assert.equal(rawAnswerByteLength(turkish), ANSWER_BYTE_LIMIT);
  assert.equal(turkish.length, ANSWER_BYTE_LIMIT / 2);
  const turkishOk = takeRawAnswer(record, turkish);
  assert.equal(turkishOk.status, 200);
  const turkishOver = takeRawAnswer(record, turkish + 'x');
  assert.equal(rawAnswerByteLength(turkish + 'x'), ANSWER_BYTE_LIMIT + 1);
  assert.equal(turkishOver.status, 413);
  assert.equal(turkishOver.record, record);
  const legitimate = 'LS|n=20|c=14|read=8/10|comp=4/6|infer=2/4|r=' + 'L1~doğru~1~900~0,'.repeat(53);
  assert.equal(legitimate.length > 900 && legitimate.length < 1000, true);
  const kept = takeRawAnswer(record, legitimate);
  assert.equal(kept.status, 200);
  if (kept.status === 200) assert.equal(kept.text, legitimate);
  const legacy = 'TRUNCATED|AV|n=12|math=0/0';
  assert.equal(isTruncatedAnswer(legacy), true);
  assert.equal(adaptiveTransferCorrectness(legacy), 'insufficient');
  for (const code of CODES) assert.equal(adaptiveTransferSkill(legacy, code).included, false);
  const backend = read('apps/assessment-appdeploy/backend/index.ts');
  const answerRoute = backend.slice(backend.indexOf("POST /api/session/:id/answer"));
  const gateAt = answerRoute.indexOf('takeRawAnswer(s,rawAnswer)');
  const writeAt = answerRoute.indexOf("db.update('assessment_sessions'");
  assert.equal(gateAt > 0 && writeAt > gateAt, true);
  assert.match(answerRoute, /gated\.status===413\)return error\('Yanıt 16 KB sınırını aşıyor',413\)/);
  assert.equal(backend.includes('prepareStoredAnswer'), false);
  assert.equal(backend.includes('.slice(0,2000)'), false);
  assert.match(backend, /isTruncatedAnswer\(a\.answer\)\)continue/);
  assert.match(backend, /if\(!skill\.included\|\|skill\.base==null\)continue/);
  assert.equal(backend.includes('restart-warmup') && !backend.slice(backend.indexOf('restart-warmup'), backend.indexOf('restart-math-scan')).includes('answer:'), true);
});

test('repeated AV1 item ids are insufficient evidence and add no score', () => {
  const rows = ['MA1', 'MA1', 'LA1', 'LA1', 'ME1', 'ME1', 'SP1', 'SP1', 'PL1', 'PL1', 'FL1', 'FL1'].map((id, index) => row(id, index % 2, 'a' + index));
  const answer = payload(12, { math: '1/2', lang: '1/2', memory: '1/2', spatial: '1/2', plan: '1/2', flex: '1/2' }, rows);
  assert.equal(adaptiveTransferCorrectness(answer), 'insufficient');
  for (const code of CODES) {
    const skill = adaptiveTransferSkill(answer, code);
    assert.equal(skill.included, false);
    assert.equal(skill.base, null);
  }
});

test('the short A8 path is stamped FALLBACK and is not an independent success', () => {
  assert.equal(mathAttitudeFollowUp('SKIP').fallback, true);
  assert.equal(mathAttitudeFollowUp(undefined).fallback, true);
  assert.equal(mathAttitudeFollowUp('short').fallback, false);
  const base = (id, answer, correct) => ({ id, answer, correct, ms: 1, changes: 0, help: 0, listens: 0 });
  const rows = [
    base('A2', '9', 1), base('A4', '8', 1), base('A5', '13', 1),
    base('A7', 'SKIP', -1), base('A8', '7', 1),
  ];
  const fallback = encodeMathAttitude(rows);
  assert.match(fallback, /\|a8=FALLBACK\|/);
  assert.match(fallback, /\|math=3\/3\|/);
  assert.match(fallback, /\|challenge=SKIP\|/);
  const chosen = encodeMathAttitude(rows.map((row) => row.id === 'A7' ? { ...row, answer: 'explore' } : row));
  assert.match(chosen, /\|a8=7\|/);
  assert.match(chosen, /\|math=4\/4\|/);
  assert.equal(chosen.includes('FALLBACK'), false);
});
