/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const nativeRequire=createRequire(import.meta.url);
const read=(path)=>fs.readFileSync(new URL(path,import.meta.url),'utf8');
const transpile=(value)=>ts.transpileModule(value,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;

function loadModules(){
  const analytics={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated execution of the production module.
  new Function('require','module','exports','process',transpile(read('../lib/persistence/educator-analytics.ts')))(nativeRequire,analytics,analytics.exports,process);
  const profile={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated execution of the production module.
  new Function('require','module','exports',transpile(read('../lib/persistence/student-learning-profile.ts')))(
    (id)=>id.includes('educator-analytics')?analytics.exports:nativeRequire(id),profile,profile.exports,
  );
  return profile.exports;
}

test('readStudentLearningProfile executes all eight production PostgreSQL queries with lifecycle and provenance fixes',async()=>{
  const db=new PGlite();
  const academy='10000000-0000-4000-8000-000000000001';
  const student='10000000-0000-4000-8000-000000000002';
  try{
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS public;
      CREATE TABLE public.students(id uuid PRIMARY KEY,academy_id uuid NOT NULL,first_name text,last_name text,status text);
      CREATE TABLE public.modules(code text PRIMARY KEY,name text);
      CREATE TABLE public.training_recipes(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,is_active boolean DEFAULT true,cancelled_at timestamptz,created_at timestamptz,starts_at timestamptz);
      CREATE TABLE public.training_sessions(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,recipe_id uuid,status text,started_at timestamptz,last_activity_at timestamptz,completed_at timestamptz);
      CREATE TABLE public.question_attempts(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,training_session_id uuid,is_correct boolean,error_type text,created_at timestamptz);
      CREATE TABLE public.learning_records(id uuid PRIMARY KEY,academy_id uuid,student_id uuid,module_code text,training_session_id uuid,record_origin text,verification_status text,support_level text,skills jsonb,completed_at timestamptz,created_at timestamptz);
      CREATE TABLE public.learning_evidence(id uuid PRIMARY KEY,learning_record_id uuid,academy_id uuid,student_id uuid,skill_code text,verification_status text,verification_authority text,observed_at timestamptz);
      INSERT INTO public.students VALUES ('${student}','${academy}','Demo','Öğrenci','active');
      INSERT INTO public.modules VALUES ('finger_read','Parmak Okuma');
      INSERT INTO public.training_recipes VALUES
        ('20000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read',true,NULL,'2026-09-16T10:00:00Z',NULL),
        ('20000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read',true,NULL,'2026-09-15T10:00:00Z',NULL),
        ('20000000-0000-4000-8000-000000000003','${academy}','${student}','finger_read',false,'2026-09-17T11:00:00Z','2026-09-14T10:00:00Z',NULL);
      INSERT INTO public.training_sessions VALUES
        ('30000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','20000000-0000-4000-8000-000000000002','completed','2026-09-16T10:00:00Z','2026-09-16T10:05:00Z','2026-09-16T10:05:00Z'),
        ('30000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read','20000000-0000-4000-8000-000000000003','completed','2026-09-15T10:00:00Z','2026-09-15T10:05:00Z','2026-09-15T10:05:00Z');
      INSERT INTO public.question_attempts VALUES
        ('40000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','30000000-0000-4000-8000-000000000001',true,'NONE','2026-09-16T10:02:00Z');
      INSERT INTO public.learning_records VALUES
        ('50000000-0000-4000-8000-000000000001','${academy}','${student}','finger_read','30000000-0000-4000-8000-000000000001','client_reported','client_reported','guided','["record-only"]','2026-09-16T10:05:00Z','2026-09-16T10:05:00Z'),
        ('50000000-0000-4000-8000-000000000002','${academy}','${student}','finger_read','30000000-0000-4000-8000-000000000002','client_reported','client_reported','independent','["legacy-skill"]','2026-09-15T10:05:00Z','2026-09-15T10:05:00Z'),
        ('50000000-0000-4000-8000-000000000003','${academy}','${student}','finger_read','30000000-0000-4000-8000-000000000002','server_authoritative','server_verified','independent','["trusted-skill"]','2026-09-14T10:05:00Z','2026-09-14T10:05:00Z');
      INSERT INTO public.learning_evidence VALUES
        ('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002','${academy}','${student}',NULL,'server_verified','work_center_completion:v1','2026-09-15T10:05:00Z'),
        ('60000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000003','${academy}','${student}','trusted-skill','server_verified','canonical_server_evaluator:v1','2026-09-14T10:05:00Z');
    `);
    let queryCount=0;
    const sql={query:async(text,params)=>{queryCount+=1;return(await db.query(text,params)).rows;}};
    const {readStudentLearningProfile}=loadModules();
    const result=await readStudentLearningProfile({sql,academyId:academy,studentId:student,calculatedAt:new Date('2026-09-18T00:00:00Z')});
    assert.ok(Array.isArray(result.recentRecords),'record and evidence identities are present in canonical profile');
    assert.equal(queryCount,8);
    assert.deepEqual(result.studyPattern.assignments,{active:1,completed:1,cancelled:1});
    assert.equal(result.studyPattern.sessions.completed,2,'cancelled assignment history remains visible');
    const recordOnly=result.skills.find((skill)=>skill.skillCode==='record-only');
    assert.equal(recordOnly.provenance,'CLIENT_REPORTED');
    assert.deepEqual(recordOnly.sourceReferences,['record:50000000-0000-4000-8000-000000000001']);
    const legacy=result.skills.find((skill)=>skill.skillCode==='legacy-skill');
    assert.equal(legacy.provenance,'CLIENT_REPORTED');
    assert.equal(legacy.recordCount,1,'record skill and matching evidence are not double counted');
    assert.equal(result.skills.find((skill)=>skill.skillCode==='trusted-skill').provenance,'SERVER_AUTHORITATIVE');
    const completion=result.recentRecords.find(row=>row.recordId==='50000000-0000-4000-8000-000000000002');
    assert.equal(completion.sessionId,'30000000-0000-4000-8000-000000000002');
    assert.equal(completion.evidenceId,'60000000-0000-4000-8000-000000000001');
    assert.equal(completion.recordVerification,'client_reported');
    assert.equal(completion.evidenceVerification,'server_verified');
    assert.equal(completion.provenance,'CLIENT_REPORTED','server-verified completion does not verify client skill');
    assert.equal(result.recentRecords.find(row=>row.recordId==='50000000-0000-4000-8000-000000000003').provenance,'SERVER_AUTHORITATIVE');
  }finally{await db.close();}
});
