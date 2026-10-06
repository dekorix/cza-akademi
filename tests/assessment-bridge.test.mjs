import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assessmentBridgeCatalog,
  resolveAssessmentBridge,
  SPECIAL_BRIDGE_PROFILE_CODES,
} from '../lib/assessment-bridge.ts';
import { SPECIAL_PROFILE_CODES } from '../lib/special-assessment.ts';

test('P2 resolves to existing central linked assessment route',()=>{
  const target=resolveAssessmentBridge('P2','GENERAL');
  assert.equal(target?.status,'CENTRAL_READY');
  assert.equal(target?.centralRoute,'/api/assessment-linked');
  assert.equal(target?.templateFamily,'CZA_1_TO_2_V1');
});

test('E3 resolves to central age-linked route',()=>{
  const target=resolveAssessmentBridge('E3','LANGUAGE');
  assert.equal(target?.status,'CENTRAL_READY');
  assert.equal(target?.centralRoute,'/api/assessment-e3-linked');
  assert.equal(target?.requiresBirthDate,true);
});

test('AppDeploy E2 is preserved but cannot silently start wrong central assessment',()=>{
  const target=resolveAssessmentBridge('E2','GENERAL');
  assert.equal(target?.status,'SOURCE_REFERENCE_ONLY');
  assert.equal(target?.centralRoute,null);
  assert.match(target?.reason||'',/AppDeploy/);
});

test('special education profile resolves to central special route',()=>{
  const target=resolveAssessmentBridge('SP-DYS','GENERAL');
  assert.equal(target?.status,'CENTRAL_READY');
  assert.equal(target?.centralRoute,'/api/assessment-special-linked');
  assert.equal(target?.templateFamily,'CZA_SPECIAL_V1');
});

test('unsupported purpose cannot reuse a central route accidentally',()=>{
  const target=resolveAssessmentBridge('P2','ACADEMIC');
  assert.equal(target?.centralRoute,null);
  assert.equal(target?.status,'PLANNED');
});

test('bridge special profile codes stay aligned with canonical special assessment codes',()=>{
  assert.deepEqual([...SPECIAL_BRIDGE_PROFILE_CODES],[...SPECIAL_PROFILE_CODES]);
});

test('bridge catalog exposes school, early development and ten special profiles',()=>{
  const catalog=assessmentBridgeCatalog();
  assert.ok(catalog.some(item=>item.profileCode==='E2'));
  assert.ok(catalog.some(item=>item.profileCode==='P2'));
  assert.equal(catalog.filter(item=>item.profileCode.startsWith('SP-')).length,10);
});

test('context API requires educator auth and linked central student',()=>{
  const source=fs.readFileSync(new URL('../app/api/educator-assessment-context/route.ts',import.meta.url),'utf8');
  assert.match(source,/authenticatedEducator\(request\)/);
  assert.match(source,/teacher_student_links/);
  assert.match(source,/l\.can_view=true/);
  assert.match(source,/t\.auth_user_id=\$\{educator\.id\}/);
  assert.match(source,/student_not_linked_to_educator/);
  assert.match(source,/request_origin_rejected/);
});
