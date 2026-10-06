import test from 'node:test';
import assert from 'node:assert/strict';
import { packageCatalog, readyAccessCodes, allAccessCodes } from '../lib/package-catalog.ts';

test('pilot package prices remain explicit snapshots',()=>{
  assert.equal(packageCatalog.ANZAN.priceTry,10_000);
  assert.equal(packageCatalog.ZIHIN_GELISIM.priceTry,15_000);
  assert.equal(packageCatalog.BUTUNLESIK.priceTry,20_000);
});

test('Anzan package opens only implemented exercise access',()=>{
  const ready=readyAccessCodes('ANZAN');
  assert.ok(ready.includes('flash_anzan'));
  assert.ok(ready.includes('audio_anzan'));
  assert.ok(ready.includes('soroban_course'));
  assert.equal(ready.length,8);
});

test('planned mind-development capabilities are recorded but not falsely marked ready',()=>{
  assert.ok(allAccessCodes('ZIHIN_GELISIM').includes('memory'));
  assert.deepEqual(readyAccessCodes('ZIHIN_GELISIM'),['memory']);
});

test('combined package is a union without claiming unfinished modules are live',()=>{
  assert.ok(readyAccessCodes('BUTUNLESIK').includes('flash_anzan'));
  assert.ok(allAccessCodes('BUTUNLESIK').includes('memory'));
  assert.ok(readyAccessCodes('BUTUNLESIK').includes('memory'));
});
