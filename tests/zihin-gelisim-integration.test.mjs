import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const expected = [
  ['memory','/memory'],
  ['attention_focus','/attention'],
  ['speed_reading','/speed-reading'],
  ['mind_maps','/mind-maps'],
  ['intelligence_games','/intelligence-games'],
  ['effective_notes','/effective-notes'],
  ['full_learning_37','/full-study'],
];

const { packageCatalog, packageReadiness, readyAccessCodes } = await import('../lib/package-catalog.ts');
const trainingRecipesSource=fs.readFileSync(new URL('../lib/training-recipes.ts',import.meta.url),'utf8');

test('Zihin Gelişim package is exactly 7/7 ready',()=>{
  assert.deepEqual(readyAccessCodes('ZIHIN_GELISIM'), expected.map(([code])=>code));
  assert.deepEqual(packageReadiness('ZIHIN_GELISIM'), {
    ready:7,total:7,fullyReady:true,pendingLabels:[],
  });
  assert.equal(packageReadiness('BUTUNLESIK').fullyReady,true);
});

test('all seven modules are educator-assignable with native routes',()=>{
  for(const [code,path] of expected){
    const escapedPath=path.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\test('all seven modules are educator-assignable with native routes',()=>{
  for(const [code,path] of expected){
    assert.ok(assignableModules[code], code+' missing from assignment catalog');
    assert.equal(assignableModules[code].launchPath,path);
    assert.equal(assignableModules[code].mode,null);
  }
});');
    const pattern=new RegExp(code+"\\s*:\\s*\\{[^}]*launchPath:\\s*['\"]"+escapedPath+"['\"][^}]*mode:\\s*null","s");
    assert.match(trainingRecipesSource,pattern,code+' missing or wrong launchPath in assignment catalog');
  }
});

test('all seven student routes are entitlement gated with their canonical code',()=>{
  for(const [code,path] of expected){
    const file='app'+path+'/page.tsx';
    assert.equal(fs.existsSync(new URL('../'+file,import.meta.url)),true,file+' missing');
    const source=fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
    assert.match(source,new RegExp('PackageAccessGate\\s+accessCode=["\\\']'+code+'["\\\']'));
    assert.match(source,/x-cza-contract-version['"]?:?['"]?1\.0\.0|x-cza-contract-version/);
    assert.match(source,/module_record/);
  }
});

test('staging package proof covers exactly seven Zihin entitlements and rollback',()=>{
  const sql=fs.readFileSync(new URL('../scripts/qa/package-activation-staging-proof.sql',import.meta.url),'utf8');
  assert.match(sql,/ACTIVE_ENTITLEMENTS_BEFORE_CANCEL=7/);
  assert.match(sql,/REVOKED_ENTITLEMENTS_AFTER_CANCEL=7/);
  assert.match(sql,/ROLLBACK/);
});

test('package catalog keeps pilot commercial snapshots stable',()=>{
  assert.equal(packageCatalog.ANZAN.priceTry,10_000);
  assert.equal(packageCatalog.ZIHIN_GELISIM.priceTry,15_000);
  assert.equal(packageCatalog.BUTUNLESIK.priceTry,20_000);
});
