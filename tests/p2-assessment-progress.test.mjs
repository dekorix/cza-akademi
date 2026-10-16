import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mathAttitudeFollowUp } from '../apps/assessment-appdeploy/src/mathAttitudeFollowUp.ts';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

function taskGraph(source) {
  const tasks = new Map();
  const marks = [];
  const idRe = /\{id:'([A-Z0-9]+)'/g;
  let mark;
  while ((mark = idRe.exec(source))) marks.push({ id: mark[1], index: mark.index });
  for (let i = 0; i < marks.length; i++) {
    const body = source.slice(marks[i].index, i + 1 < marks.length ? marks[i + 1].index : source.length);
    if (!body.includes('groupId:')) continue;
    const next = {};
    const nextMatch = body.match(/next:\{([^}]*)\}/);
    if (nextMatch) {
      for (const key of ['correct', 'incorrect', 'default']) {
        const found = nextMatch[1].match(new RegExp(key + ":'([A-Z0-9]+)'"));
        if (found) next[key] = found[1];
      }
    }
    tasks.set(marks[i].id, next);
  }
  return tasks;
}

function step(tasks, id, policy) {
  const next = tasks.get(id);
  if (!next) return null;
  if (policy === 'correct' && next.correct) return next.correct;
  if (policy === 'incorrect' && next.incorrect) return next.incorrect;
  return next.default ?? null;
}

function walk(tasks, policy) {
  const seen = [];
  let id = 'W1';
  const guard = new Set();
  while (id) {
    if (guard.has(id + '|' + seen.length)) break;
    guard.add(id);
    seen.push(id);
    id = step(tasks, id, policy);
    if (seen.length > 80) break;
  }
  return seen;
}

const REQUIRED = ['W3', 'W4', 'ZG1', 'DA1', 'M1A', 'L1A', 'GV1', 'WM1', 'HB1', 'EX1', 'ZX1', 'DU1', 'DK1', 'AV1', 'MC1', 'RF1', 'SV1', 'DX1', 'MA1', 'EA1', 'SL1', 'CG1', 'MV1'];

test('review or skip on the grade-2 math anchor continues instead of ending the session', () => {
  const tasks = taskGraph(read('apps/assessment-appdeploy/backend/index.ts'));
  assert.equal(step(tasks, 'M1A', 'review'), 'M1S');
  assert.equal(step(tasks, 'M2A', 'review'), 'M2S');
  assert.equal(step(tasks, 'M3A', 'review'), 'M3S');
  assert.equal(step(tasks, 'C1A', 'review'), 'C1S');
  for (const policy of ['correct', 'incorrect', 'review']) {
    const path = walk(tasks, policy);
    assert.equal(path.at(-1), 'MV1', policy);
    for (const id of REQUIRED) assert.ok(path.includes(id), policy + ' missing ' + id);
  }
  assert.ok(walk(tasks, 'incorrect').includes('DA1S'));
  assert.ok(walk(tasks, 'review').includes('M1S'));
});

test('skipping the math-attitude choice still has a follow-up question', () => {
  for (const picked of [undefined, '', 'SKIP', 'bilinmeyen']) {
    const follow = mathAttitudeFollowUp(picked);
    assert.equal(follow.display, '4 + 3');
    assert.deepEqual(follow.options, ['6', '7', '8']);
  }
  assert.equal(mathAttitudeFollowUp('explore').display, '16 + 7');
  assert.equal(mathAttitudeFollowUp('middle').correct, '14');
  assert.equal(mathAttitudeFollowUp('SKIP').fallback, true);
  assert.equal(mathAttitudeFollowUp('short').fallback, false);
  const lab = read('apps/assessment-appdeploy/src/MathAttitudeLab.tsx');
  assert.match(lab, /mathAttitudeFollowUp\(/);
  assert.equal(lab.includes('challenge[picked]'), false);
});

test('math and language scans no longer finish before the last bank item', () => {
  const math = read('apps/assessment-appdeploy/src/CzaApp.tsx');
  const language = read('apps/assessment-appdeploy/src/LanguageScan.tsx');
  assert.equal(math.includes('coreCorrect<='), false);
  assert.equal(language.includes('coreCorrect<='), false);
  assert.match(math, /idx===mathScanItems\.length-1\)\{onFinish/);
  assert.match(language, /idx===items\.length-1\)\{onFinish/);
});

test('transfer lab shows every question in the six-domain bank', () => {
  const source = read('apps/assessment-appdeploy/src/AdaptiveTransferLab.tsx');
  assert.match(source, /items:domains\.flatMap\(d=>bank\[d\]\)/);
  assert.equal(source.includes('bank[d][0]'), false);
  assert.match(source, /\{items\.length\} hedefli görev/);
});

test('the grade-2 inventory lists every previously cut-off bank item', () => {
  const doc = read('docs/assessment-14-skill-questions.md');
  for (const title of ['Zihinsel İşlem Hızı', 'Sayısal Mantık ve Akıl Yürütme', 'Görsel-Mekânsal Algı ve Hafıza', 'İşitsel Dikkat ve Hafıza', 'Matematik Tutumu ve Özgüven', 'Okuma Becerisi', 'Hafıza ve Hatırlama', 'Organize Etme Becerisi', 'Dikkat ve Odaklanma', 'Düşünme ve Problem Çözme', 'Duygusal Farkındalık', 'Koçluk Prensipleri ve Öz Liderlik', 'Karakter ve Ahlaki Gelişim', 'Manevi Farkındalık ve Değerler']) {
    assert.ok(doc.includes(title), title);
  }
  for (const id of ['P1', 'X1', 'X5']) assert.ok(doc.includes('| M1A | ' + id + ' |'), id);
  for (const id of ['K1', 'P5']) assert.ok(doc.includes('| L1A | ' + id + ' |'), id);
  for (const id of ['MA1', 'MA2', 'FL1', 'FL2']) assert.ok(doc.includes('| AV1 | ' + id + ' |'), id);
  assert.ok(doc.includes('| MA1 | A8-explore |'));
  assert.ok(doc.includes('| SL1 | S2-puzzle |'));
  assert.equal(doc.includes('5dde0173'), false);
});

test('an assessment render error keeps a recoverable screen', () => {
  const app = read('apps/assessment-appdeploy/src/CzaApp.tsx');
  const boundary = read('apps/assessment-appdeploy/src/AssessmentErrorBoundary.tsx');
  assert.match(app, /<AssessmentErrorBoundary><AcademicAssessmentTimer/);
  assert.match(app, /<\/AssessmentErrorBoundary>;\}if\(route\.path==='\/veli-paylas'\)/);
  assert.match(boundary, /getDerivedStateFromError/);
  assert.match(boundary, /Kaldığın yerden devam et/);
});
