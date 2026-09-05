import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/arithmetic-engine.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const engine = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const settings = (overrides = {}) => ({ ...engine.defaultArithmeticSettings, ...overrides });

test('toplama, çıkarma ve karışık mod doğru sonuç üretir', () => {
  for (const operationMode of ['addition','subtraction','mixed']) {
    const question = engine.generateArithmeticQuestion(settings({ operationMode, operationsPerQuestion: 2, maxValue: 99 }), engine.seededRandom(41));
    assert.equal(question.steps.length, 2);
    const calculated = question.steps.reduce((value, step) => step.operator === '+' ? value + step.operand : value - step.operand, question.initialValue);
    assert.equal(calculated, question.finalAnswer);
    if (operationMode === 'addition') assert.ok(question.steps.every(step => step.operator === '+'));
    if (operationMode === 'subtraction') assert.ok(question.steps.every(step => step.operator === '-'));
  }
});

test('hane, maksimum değer ve rakam havuzu üretimi gerçekten sınırlar', () => {
  const question = engine.generateArithmeticQuestion(settings({ operationMode: 'addition', additionDigits: [2,4], minDigits: 1, maxDigits: 1, maxValue: 30 }), engine.seededRandom(7));
  assert.ok(question.initialValue >= 1 && question.initialValue <= 9);
  assert.ok(question.steps.every(step => /^[24]+$/.test(String(step.operand))));
  assert.ok(question.steps.every(step => step.resultAfterStep <= 30));
});

test('negatif sonuç kapalıyken hiçbir ara sonuç negatif olmaz', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const question = engine.generateArithmeticQuestion(settings({ operationMode: 'subtraction', operationsPerQuestion: 2, allowNegativeResults: false, maxValue: 99 }), engine.seededRandom(seed));
    assert.ok(question.steps.every(step => step.resultAfterStep >= 0));
  }
});

test('aynı seed aynı soru içeriğini üretir', () => {
  const one = engine.generateArithmeticQuestion(settings({ operationMode: 'mixed', operationsPerQuestion: 3 }), engine.seededRandom(99));
  const two = engine.generateArithmeticQuestion(settings({ operationMode: 'mixed', operationsPerQuestion: 3 }), engine.seededRandom(99));
  assert.deepEqual({ initial: one.initialValue, steps: one.steps, answer: one.finalAnswer }, { initial: two.initialValue, steps: two.steps, answer: two.finalAnswer });
});

test('geçersiz ayarlar açık hata kodları üretir', () => {
  assert.equal(engine.validateArithmeticSettings(settings({ minDigits: 3, maxDigits: 2 })).errors[0].code, 'DIG001');
  assert.ok(engine.validateArithmeticSettings(settings({ operationMode: 'addition', additionDigits: [] })).errors.some(issue => issue.code === 'ADD001'));
  assert.ok(engine.validateArithmeticSettings(settings({ operationMode: 'mixed', subtractionDigits: [] })).errors.some(issue => issue.code === 'MIX001'));
});
