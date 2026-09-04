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
