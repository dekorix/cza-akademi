import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/finger-engine.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(js).toString('base64')}`;
const engine = await import(moduleUrl);

test('0–9 için standart parmak desenleri geçerlidir', () => {
  for (let value = 0; value <= 9; value += 1) {
    const result = engine.readHand(engine.digitPattern(value));
    assert.equal(result.valid, true);
    assert.equal(result.value, value);
  }
});

test('iki el 00–99 sayılarını doğru çözer', () => {
  for (const value of [0, 2, 20, 28, 67, 99]) {
    const pattern = engine.numberPattern(value);
    const result = engine.readHands(pattern.left, pattern.right);
    assert.equal(result.valid, true);
    assert.equal(result.value, value);
  }
});

test('işaret parmağını atlayan desen F01 üretir', () => {
  const invalid = engine.emptyHand();
  invalid.middle = true;
  const result = engine.readHand(invalid);
  assert.equal(result.valid, false);
  assert.equal(result.code, 'F01');
});

test('yarı kurallı yanlış dokunuşu reddeder ve eli değiştirmez', () => {
  const hand = engine.emptyHand();
  const result = engine.transitionFinger(hand, 'middle', 'semi');
  assert.equal(result.rejected, true);
  assert.equal(result.evaluation.code, 'F01');
  assert.deepEqual(result.state, hand);
});

test('kurallı mod seçilen parmağa kadar otomatik tamamlar', () => {
  const result = engine.transitionFinger(engine.emptyHand(), 'ring', 'guided');
  assert.equal(result.rejected, false);
  assert.deepEqual(result.state, { thumb: false, index: true, middle: true, ring: true, little: false });
});

test('serbest mod geçersiz deseni kurmaya izin verir', () => {
  const result = engine.transitionFinger(engine.emptyHand(), 'middle', 'free');
  assert.equal(result.rejected, false);
  assert.equal(result.evaluation.valid, false);
  assert.equal(result.state.middle, true);
});
