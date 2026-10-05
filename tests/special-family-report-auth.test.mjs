import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync(new URL('../app/api/educator-special-family-report/route.ts',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/educator/family-report/page.tsx',import.meta.url),'utf8');

test('family report API requires educator auth and linked student',()=>{
  assert.match(route,/authenticatedEducator\(request\)/);
  assert.match(route,/teacher_student_links/);
  assert.match(route,/l\.can_view=true/);
  assert.match(route,/s\.id=\$\{studentId\}::uuid/);
});

test('family report omits raw technical evidence from response contract',()=>{
  assert.match(route,/rawAssessmentEvidenceIncluded:false/);
  assert.match(route,/technicalScoresIncluded:false/);
  assert.match(route,/educatorInternalNotesIncluded:false/);
  assert.match(route,/externalPublicLink:false/);
});

test('family report is educator-only print/PDF workflow',()=>{
  assert.match(page,/Yazdır \/ PDF kaydet/);
  assert.match(page,/window\.print\(\)/);
  assert.doesNotMatch(page,/share token|public link/i);
});
