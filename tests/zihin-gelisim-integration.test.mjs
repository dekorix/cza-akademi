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
  assert.deepEqual([...readyAccessCodes('ZIHIN_GELISIM')].sort(), expected.map(([code])=>code).sort());
  assert.deepEqual(packageReadiness('ZIHIN_GELISIM'), {
    ready:7,total:7,fullyReady:true,pendingLabels:[],
  });
  assert.equal(packageReadiness('BUTUNLESIK').fullyReady,true);
});

test('all seven modules are educator-assignable with native routes',()=>{
  for(const [code,path] of expected){
    assert.ok(trainingRecipesSource.includes(code+': {'),code+' missing from assignment catalog');
    assert.ok(trainingRecipesSource.includes("launchPath: '"+path+"'"),path+' missing from assignment catalog');
    const line=trainingRecipesSource.split('\n').find(item=>item.includes(code+': {'))||'';
    assert.ok(line.includes("mode: null"),code+' must use native workshop route');
    assert.ok(line.includes("launchPath: '"+path+"'"),code+' launchPath mismatch');
  }
});

test('all seven student routes are entitlement gated with their canonical code',()=>{
  for(const [code,path] of expected){
    const file='app'+path+'/page.tsx';
    const url=new URL('../'+file,import.meta.url);
    assert.equal(fs.existsSync(url),true,file+' missing');
    const source=fs.readFileSync(url,'utf8');
    assert.ok(source.includes('PackageAccessGate accessCode="'+code+'"'),file+' entitlement code mismatch');
    assert.ok(source.includes('x-cza-contract-version'),file+' missing canonical contract header');
    assert.ok(source.includes('module_record'),file+' missing canonical record publish');
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
