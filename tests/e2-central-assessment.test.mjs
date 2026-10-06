import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  V7_BANK_SIZE,
  V7_SECTIONS,
  V7_TASKS,
} from '../lib/e2-question-bank.ts';
import {
  normalizeV7AdaptiveProfile,
  v7AgeBandLabel,
  v7EligiblePoolIds,
  v7TargetTotal,
} from '../lib/e2-adaptive.ts';

const profile=normalizeV7AdaptiveProfile({
  languageLevel:'two_word',
  interests:['animals','vehicles'],
  attentionSpan:'medium',
  developmentalNote:'',
});

test('E2 V7 central task bank preserves the complete AppDeploy bank',()=>{
  assert.equal(V7_SECTIONS.length,8);
  assert.equal(V7_BANK_SIZE,130);
  assert.equal(V7_TASKS.length,138);
  assert.deepEqual(V7_SECTIONS.map(section=>section.id),['VIS','CON','REL','PRO','AUD','MEM','ATT','NAT']);

  const source=fs.readFileSync(new URL('../apps/assessment-appdeploy/src/earlyQuestionBankV7.ts',import.meta.url),'utf8');
  const central=fs.readFileSync(new URL('../lib/e2-question-bank.ts',import.meta.url),'utf8');
  assert.equal(central,source);
});

test('E2 adaptive targets remain age-sensitive',()=>{
  assert.ok(profile);
  assert.equal(v7AgeBandLabel(24),'24–27 ay · temel tanıma ve eşleme rotası');
  assert.equal(v7AgeBandLabel(35),'34–35 ay · ileri ilişki + nötr keşif rotası');
  assert.equal(v7TargetTotal(24,profile),35);
  assert.equal(v7TargetTotal(35,profile),64);
  assert.ok(v7EligiblePoolIds(24).length<v7EligiblePoolIds(35).length);
});

test('linked E2 creation requires educator auth and linked central student',()=>{
  const source=fs.readFileSync(new URL('../app/api/assessment-e2-linked/route.ts',import.meta.url),'utf8');
  assert.match(source,/authenticatedEducator\(request\)/);
  assert.match(source,/teacher_student_links/);
  assert.match(source,/l\.can_view=true/);
  assert.match(source,/t\.auth_user_id=\$\{educator\.id\}/);
  assert.match(source,/student_not_linked_to_educator/);
  assert.match(source,/e2AgeBandForAge/);
  assert.match(source,/CZA_E2_V7|E2_TEMPLATE_CODE/);
});

test('E2 evidence API persists adaptive child evidence without falsely completing the whole session',()=>{
  const source=fs.readFileSync(new URL('../app/api/assessment-e2/route.ts',import.meta.url),'utf8');
  assert.match(source,/action==='configure'/);
  assert.match(source,/action==='attempt'/);
  assert.match(source,/action==='finish_child'/);
  assert.match(source,/assessment_attempts/);
  assert.match(source,/adaptiveSectionsCompleted/);
  assert.match(source,/caregiverRequired/);
  assert.match(source,/sessionCompleted:false/);
  assert.doesNotMatch(source,/SET status='completed'.*finish_child/s);
});

test('ProfileIntake does not expose E2 as central-ready before its UI and caregiver bridge are accepted',()=>{
  const source=fs.readFileSync(new URL('../lib/assessment-bridge.ts',import.meta.url),'utf8');
  const e2Line=source.split('\n').find(line=>line.includes("E2:{profileCode:'E2'"))||'';
  assert.match(e2Line,/SOURCE_REFERENCE_ONLY/);
  assert.match(e2Line,/centralRoute:null/);
});
