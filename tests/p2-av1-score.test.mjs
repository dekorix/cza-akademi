import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  adaptiveTransferCorrectness,
  adaptiveTransferSkill,
  educatorAttemptBadge,
  educatorAttemptBadgeClass,
} from '../apps/assessment-appdeploy/backend/adaptiveTransferScore.ts';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

const OLD_SIX = 'AV|n=6|math=2/2|lang=1/2|memory=0/2|spatial=0/0|plan=0/0|flex=0/0|focus=memory+lang+math|r=MA1~14+22~1~10~0';
const NEW_TWELVE = 'AV|n=12|math=2/2|lang=1/2|memory=0/2|spatial=1/2|plan=2/2|flex=1/2|focus=memory+lang+spatial|r=FL2~right~1~10~0';
const CODES = ['S02', 'S04', 'S07', 'S09', 'S11', 'S12'];

function legacyCorrectness(answer) {
  const parsed = /^AV\|n=(\d+)\|math=(\d+)\/(\d+)\|lang=(\d+)\/(\d+)\|memory=(\d+)\/(\d+)\|spatial=(\d+)\/(\d+)\|plan=(\d+)\/(\d+)\|flex=(\d+)\/(\d+)/.test(answer);
  const total = Number(answer.match(/^AV\|n=(\d+)/)?.[1]);
  return parsed && total === 6 ? 'review' : 'incorrect';
}

function legacySkill(answer, code) {
  const m = answer.match(/^AV\|n=(\d+)\|math=(\d+)\/(\d+)\|lang=(\d+)\/(\d+)\|memory=(\d+)\/(\d+)\|spatial=(\d+)\/(\d+)\|plan=(\d+)\/(\d+)\|flex=(\d+)\/(\d+)/);
  if (!m) return { parsed: false, included: false, base: null, evidence: 0 };
  const stats = {
    math: [Number(m[2]), Number(m[3])],
    lang: [Number(m[4]), Number(m[5])],
    memory: [Number(m[6]), Number(m[7])],
    spatial: [Number(m[8]), Number(m[9])],
    plan: [Number(m[10]), Number(m[11])],
    flex: [Number(m[12]), Number(m[13])],
  };
  const field = { S02: 'math', S04: 'lang', S07: 'memory', S09: 'spatial', S11: 'plan', S12: 'flex' }[code];
  const pair = stats[field];
  if (pair[1] === 0) return { parsed: true, included: false, base: null, evidence: 0 };
  return { parsed: true, included: true, base: Math.max(0.2, Math.min(1, pair[0] / pair[1])), evidence: pair[1] };
}

test('a complete 12-item transfer is educator review, and a stored 6-item record stays review', () => {
  assert.equal(adaptiveTransferCorrectness(OLD_SIX), 'review');
  assert.equal(adaptiveTransferCorrectness(OLD_SIX), legacyCorrectness(OLD_SIX));
  assert.equal(adaptiveTransferCorrectness(NEW_TWELVE), 'review');
  assert.equal(legacyCorrectness(NEW_TWELVE), 'incorrect');
  assert.equal(adaptiveTransferCorrectness('AV|n=5|math=1/1|lang=1/1|memory=1/1|spatial=0/0|plan=0/0|flex=1/2|focus=a+b+c|r=x'), 'incorrect');
  assert.equal(adaptiveTransferCorrectness('AV|n=11|math=2/2|lang=1/2|memory=0/2|spatial=1/2|plan=2/2|flex=1/1|focus=a+b+c|r=x'), 'incorrect');
  assert.equal(adaptiveTransferCorrectness('not-a-transfer'), 'incorrect');
  assert.equal(educatorAttemptBadge(adaptiveTransferCorrectness(NEW_TWELVE)), 'Eğitmen incelemesi');
  assert.equal(educatorAttemptBadgeClass(adaptiveTransferCorrectness(NEW_TWELVE)), 'cza-badge-mid');
  assert.equal(educatorAttemptBadge('incorrect'), 'Destek/inceleme');
  assert.equal(educatorAttemptBadge('correct'), 'Doğru');
});

test('six-item skill ratios stay on the old formula and twelve items score all six domains', () => {
  const before = Object.fromEntries(CODES.map((code) => [code, legacySkill(OLD_SIX, code)]));
  const afterSix = Object.fromEntries(CODES.map((code) => [code, adaptiveTransferSkill(OLD_SIX, code)]));
  assert.deepEqual(afterSix, before);
  assert.deepEqual(afterSix.S02, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(afterSix.S04, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(afterSix.S07, { parsed: true, included: true, base: 0.2, evidence: 2 });
  for (const code of ['S09', 'S11', 'S12']) assert.equal(afterSix[code].included, false);

  const twelve = Object.fromEntries(CODES.map((code) => [code, adaptiveTransferSkill(NEW_TWELVE, code)]));
  assert.deepEqual(twelve.S02, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(twelve.S04, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(twelve.S07, { parsed: true, included: true, base: 0.2, evidence: 2 });
  assert.deepEqual(twelve.S09, { parsed: true, included: true, base: 0.5, evidence: 2 });
  assert.deepEqual(twelve.S11, { parsed: true, included: true, base: 1, evidence: 2 });
  assert.deepEqual(twelve.S12, { parsed: true, included: true, base: 0.5, evidence: 2 });
  for (const code of CODES) assert.notEqual(twelve[code].base, 0.32);
});

test('the live scorer and educator badge use the twelve-item rule', () => {
  const backend = read('apps/assessment-appdeploy/backend/index.ts');
  const app = read('apps/assessment-appdeploy/src/CzaApp.tsx');
  assert.match(backend, /if\(task\.id==='AV1'\)return adaptiveTransferCorrectness\(answer\)/);
  assert.match(backend, /adaptiveTransferSkill\(a\.answer,code\)/);
  assert.equal(backend.includes('total===6'), false);
  assert.equal(backend.includes('Altı hedefli görev'), false);
  assert.match(backend, /On iki görev altı alanın her birinden ikişer madde/);
  assert.match(app, /educatorAttemptBadge\(a\.correctness\)/);
  assert.match(app, /educatorAttemptBadgeClass\(a\.correctness\)/);
});
