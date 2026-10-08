import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('educator assessment page uses the central ProfileIntake experience',()=>{
  const source=fs.readFileSync(new URL('../app/educator/assessment/page.tsx',import.meta.url),'utf8');
  assert.match(source,/CentralAssessmentIntake/);
  assert.match(source,/onP2Created=\{acceptP2Session\}/);
  assert.doesNotMatch(source,/Pilot için yalnız görünen öğrenci adı yeterli/);
});

test('central intake verifies educator-linked student before launch',()=>{
  const source=fs.readFileSync(new URL('../components/central-assessment-intake.tsx',import.meta.url),'utf8');
  assert.match(source,/\/api\/educator-students\?page=0/);
  assert.match(source,/\/api\/educator-assessment-context/);
  assert.match(source,/\/api\/assessment-linked/);
  assert.match(source,/\/api\/assessment-e3-linked/);
  assert.match(source,/\/cza-degerlendirme\/\?/);
  assert.match(source,/studentId/);
  assert.match(source,/profileCode/);
});

test('all ten special profiles are exposed from the same central intake',()=>{
  const source=fs.readFileSync(new URL('../components/central-assessment-intake.tsx',import.meta.url),'utf8');
  for(const code of ['SP-DYS','SP-SLD','SP-DYSC','SP-DYSG','SP-ASD','SP-LANG','SP-ATTN','SP-DELAY','SP-COG','SP-MIX']){
    assert.match(source,new RegExp(code));
  }
  assert.match(source,/ÖZEL EĞİTİM VE ÖĞRENME PROFİLİ/);
  assert.match(source,/TAM PROFİL AKTİF/);
});

test('special assessment runtime is published under the main CZA public tree',()=>{
  for(const name of ['index.html','app.js','dyslexia-letter-sound.js','dyslexia-advanced.js','special-profiles.js','central-special-sync.js','styles.css','mobile-premium.css']){
    assert.equal(fs.existsSync(new URL('../public/cza-degerlendirme/'+name,import.meta.url)),true,name+' missing');
  }
});

test('published special runtime stays byte-identical to source runtime',()=>{
  for(const name of ['index.html','app.js','dyslexia-letter-sound.js','dyslexia-advanced.js','special-profiles.js','central-special-sync.js','styles.css','mobile-premium.css']){
    const source=fs.readFileSync(new URL('../cza-degerlendirme/'+name,import.meta.url),'utf8');
    const published=fs.readFileSync(new URL('../public/cza-degerlendirme/'+name,import.meta.url),'utf8');
    assert.equal(published,source,name+' drifted from source');
  }
});

test('special runtime accepts central student and profile bootstrap parameters',()=>{
  const source=fs.readFileSync(new URL('../cza-degerlendirme/central-special-sync.js',import.meta.url),'utf8');
  assert.match(source,/bootstrapStudentId/);
  assert.match(source,/bootstrapProfile/);
  assert.match(source,/applyBootstrapProfile/);
  assert.match(source,/state\.centralStudentId = bootstrapStudentId/);
});

test('special pre-enrollment intake requires educator login and candidate name without registered student selection',()=>{
  const client=fs.readFileSync(new URL('../cza-degerlendirme/central-special-sync.js',import.meta.url),'utf8');
  const api=fs.readFileSync(new URL('../app/api/assessment-special-linked/route.ts',import.meta.url),'utf8');
  assert.match(client,/action: 'me'/);
  assert.match(client,/studentLabel,/);
  assert.doesNotMatch(client,/centralStudentDys|centralStudentGeneric|studentOptions\(/);
  assert.match(api,/student_id IS NULL/);
  assert.match(api,/createdByEducatorId/);
  assert.match(api,/academyId.*t\.academy_id::text/);
  assert.match(api,/student_name_required/);
});
