import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../lib/preschool-e3.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const e3 = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

const linkedRoute = fs.readFileSync(new URL('../app/api/assessment-e3-linked/route.ts', import.meta.url), 'utf8');
const apiRoute = fs.readFileSync(new URL('../app/api/assessment-e3/route.ts', import.meta.url), 'utf8');
const educatorStudents = fs.readFileSync(new URL('../components/educator-students.tsx', import.meta.url), 'utf8');

test('E3 bank has 10 domains and exactly 8 original tasks per domain', () => {
  assert.equal(e3.e3Sections.length, 10);
  assert.equal(e3.e3Tasks.length, 80);
  for (const section of e3.e3Sections) {
    assert.equal(e3.e3Tasks.filter(task => task.sectionId === section.id).length, 8, section.id);
  }
});

test('E3 uses four completed-month bands and rejects children outside 36-47 months', () => {
  assert.equal(e3.e3BandForAge(36), '36-38');
  assert.equal(e3.e3BandForAge(38), '36-38');
  assert.equal(e3.e3BandForAge(39), '39-41');
  assert.equal(e3.e3BandForAge(42), '42-44');
  assert.equal(e3.e3BandForAge(45), '45-47');
  assert.equal(e3.e3BandForAge(47), '45-47');
  assert.throws(() => e3.e3BandForAge(35), /e3_age_out_of_range/);
  assert.throws(() => e3.e3BandForAge(48), /e3_age_out_of_range/);
});

test('base evidence target rises by age band and weak early evidence adds one discriminating task', () => {
  const sectionId = 'visual_concepts';
  assert.equal(e3.e3BaseTarget(37), 4);
  assert.equal(e3.e3BaseTarget(40), 5);
  assert.equal(e3.e3BaseTarget(43), 6);
  assert.equal(e3.e3BaseTarget(46), 7);
  const eligible = e3.e3EligibleTasks(sectionId, 40);
  const weak = eligible.slice(0, 3).map((task, index) => ({
    taskId: task.id,
    sectionId,
    supportLevel: index < 2 ? 'VISUAL_PROMPT' : 'INDEPENDENT',
    firstMatch: index < 2 ? false : true,
    latencyMs: 500,
    neutralProbe: false,
  }));
  assert.equal(e3.e3TargetForSection(40, sectionId, weak), 6);
});

test('neutral ceiling probes are excluded from weakness and independence interpretation', () => {
  const sectionId = 'visual_concepts';
  const tasks = e3.e3EligibleTasks(sectionId, 46);
  const evidence = tasks.map(task => ({
    taskId: task.id,
    sectionId,
    supportLevel: task.neutralProbe ? 'PHYSICAL_ASSIST' : 'INDEPENDENT',
    firstMatch: task.neutralProbe ? false : true,
    latencyMs: 400,
    neutralProbe: task.neutralProbe === true,
  }));
  const report = e3.buildE3SectionReport(evidence).find(item => item.sectionId === sectionId);
  assert.equal(report.assessed, 7);
  assert.equal(report.independenceRate, 1);
  assert.equal(report.status, 'RELATIVE_STRENGTH');
});

test('report language remains educational, non-normative and non-diagnostic', () => {
  const text = e3.e3ReportDisclaimer().toLocaleLowerCase('tr-TR');
  assert.match(text, /norm/);
  assert.match(text, /tanı/);
  assert.match(text, /gelişim yaşı/);
  assert.match(text, /standart gelişim taraması/);
});

test('linked E3 creation requires central educator-student authorization and completed-month validation', () => {
  assert.match(linkedRoute, /authenticatedEducator\(request\)/);
  assert.match(linkedRoute, /teacher_student_links/);
  assert.match(linkedRoute, /l\.can_view = true/);
  assert.match(linkedRoute, /e3BandForAge\(ageMonths\)/);
  assert.match(linkedRoute, /student_id, template_code/);
  assert.match(linkedRoute, /E3_TEMPLATE_CODE/);
  assert.doesNotMatch(linkedRoute, /INSERT INTO public\.students/);
});

test('E3 API guards the E3 template and separates caregiver source from child task evidence', () => {
  assert.match(apiRoute, /template_code = \$\{E3_TEMPLATE_CODE\}/);
  assert.match(apiRoute, /source: 'CAREGIVER'/);
  assert.match(apiRoute, /childPhaseComplete/);
  assert.match(apiRoute, /caregiverComplete/);
  assert.match(apiRoute, /e3_sources_incomplete/);
  assert.match(apiRoute, /buildE3SectionReport/);
});

test('educator launcher asks for birth date and opens the E3-specific route without replacing P2', () => {
  assert.match(educatorStudents, /assessment-e3-linked/);
  assert.match(educatorStudents, /type="date"/);
  assert.match(educatorStudents, /36–48 Ay E3 başlat/);
  assert.match(educatorStudents, /\/assessment\/e3\?session=/);
  assert.match(educatorStudents, /P2 değerlendirme/);
});
