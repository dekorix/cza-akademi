import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('CZA core repo cannot embed a ChatGPT Sites deployment pointer', () => {
  assert.equal(
    existsSync('.openai/hosting.json'),
    false,
    'Core CZA repo must remain independent of ChatGPT Sites; use an explicitly approved separate marketing-site source',
  );
});

test('the boundary decision and historical Site IDs stay auditable', () => {
  const document = readFileSync('docs/CZA_SITES_KAYNAK_AYRIMI_20261009.md', 'utf8');
  for (const marker of [
    'appgprj_6a98e9bc27c481919d11f1b06147198b',
    'appgprj_6abf93124e7c819193147ac0c0a3e931',
    '37617dd2f4153f0066928094bc99a507a4042f75',
    'Student ID',
    'Save a version',
    'Deploy/Publish a version',
  ]) assert.ok(document.includes(marker), 'Missing audit detail: ' + marker);
});
