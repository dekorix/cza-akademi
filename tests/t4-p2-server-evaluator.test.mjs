import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const root=path.resolve(import.meta.dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const migration=(name)=>read('db/migrations/'+name);
const student='c8612ac1-6d04-4990-8385-e7c60234efbc';
const academy='25b9fbf5-e819-4b71-882a-aba91e1524ba';
const other='e3911386-e62c-4439-91ad-e08a190f7c98';
const educatorId='a1111111-1111-4111-8111-111111111111';
const educatorAuth='auth-linked-educator';
const unlinkedId='a2222222-2222-4222-8222-222222222222';
const crossId='a3333333-3333-4333-8333-333333333333';
const contract=(version=2)=>({
  definitionId:'CZA_1_TO_2',assessmentVersion:version,blueprintId:'P2_1_TO_2',
  blueprintVersion:1,itemBankSha256:'a'.repeat(64),routingSha256:'b'.repeat(64),
  taskMappingVersion:'LEGACY_ROUTING_V1',
  serverEvaluatorId:version===2?'P2_DETERMINISTIC_TEXT':'NONE_CLIENT_REPORTED',
  serverEvaluatorVersion:version===2?'1':'0',
  rubricVersion:'LEGACY_P2_RUBRIC_V1',answerKeyVersion:'LEGACY_P2_ANSWER_KEY_V1',
});
function load(file, resolve) {
  const js=ts.transpileModule(read(file),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  }}).outputText;
  const mod={exports:{}};
  // oxlint-disable-next-line typescript/no-implied-eval -- isolated source module
  new Function('require','module','exports',js)(resolve,mod,mod.exports);
  return mod.exports;
}
const task={id:'MAT-02A'};
const routing=load('lib/assessment-routing.ts',(id)=>{
  if(id.includes('assessment-math')) return {mathTasks:[task],extendedMathTasks:[]};
  if(id.includes('assessment-engine')) return {warmupTasks:[]};
  if(id.includes('assessment-language')) return {languageTasks:[]};
  if(id.includes('assessment-cognitive')) return {cognitiveTasks:[]};
  throw Error(id);
});
const evaluator=load('lib/assessment-server-evaluator.ts',(id)=>{
  if(id.includes('assessment-routing')) return routing;
  throw Error(id);
});

async function setup() {
  const db=new PGlite();
  await db.exec(`
    CREATE TABLE public.students(id uuid PRIMARY KEY,academy_id uuid NOT NULL);
    CREATE TABLE public.assessment_sessions(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id uuid REFERENCES public.students(id),template_code text NOT NULL,
      student_label text,status text NOT NULL DEFAULT 'active',
      current_task_code text,started_at timestamptz NOT NULL DEFAULT now(),
      completed_at timestamptz,metadata jsonb NOT NULL DEFAULT '{}'::jsonb);
    CREATE TABLE public.assessment_attempts(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id uuid NOT NULL REFERENCES public.assessment_sessions(id),
      task_code text NOT NULL,shown_at timestamptz NOT NULL DEFAULT now(),
      first_action_at timestamptz,completed_at timestamptz,answer_text text,
      answer_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      answer_changes integer NOT NULL DEFAULT 0,support_level integer NOT NULL DEFAULT 0,
      self_corrected boolean NOT NULL DEFAULT false,rubric_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
      response_latency_ms integer,total_response_time_ms integer,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.users(
      id uuid PRIMARY KEY,auth_user_id text,academy_id uuid,role text,is_active boolean);
    CREATE TABLE public.teacher_student_links(
      teacher_id uuid,student_id uuid,academy_id uuid,can_view boolean);
    INSERT INTO public.users VALUES
      ('${educatorId}','${educatorAuth}','${academy}','educator',true),
      ('${unlinkedId}','auth-unlinked','${academy}','educator',true),
      ('${crossId}','auth-cross','11111111-1111-4111-8111-111111111111','educator',true);
    INSERT INTO public.teacher_student_links VALUES
      ('${educatorId}','${student}','${academy}',true),
      ('${crossId}','${student}','11111111-1111-4111-8111-111111111111',true);
    CREATE TABLE public.assessment_observations(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),session_id uuid,task_code text,
      observation_codes jsonb,educator_note text,confidence integer,
      observation_origin text,created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO public.students VALUES ('${student}','${academy}'),('${other}','${academy}');
  `);
  await db.exec(migration('20260929_t2_p2_assessment_definition_contract_v1.sql'));
  await db.exec(migration('20260929_t3_p2_assessment_session_outbox_v1.sql'));
  await db.exec(migration('20260929_t4_p2_server_evaluator_v1.sql'));
  return db;
}
async function seed(db, id=randomUUID(), version=2, owner=student) {
  await db.query(`INSERT INTO assessment_sessions
    (id,student_id,template_code,current_task_code,definition_contract)
    VALUES ($1,$2,'CZA_1_TO_2_V1','MAT-02A',$3::jsonb)`,
    [id,owner,JSON.stringify(contract(version))]);
  return id;
}

test('old and new pinned definitions stay distinct; unknown definitions fail closed',()=>{
  const definitions=load('lib/assessment-definition.ts',(id)=>{
    if(id==='node:crypto') return {createHash};
    if(id.includes('assessment-routing')) return routing;
    throw Error(id);
  });
  const old=definitions.currentP2Definition();
  const fresh=definitions.t4P2Definition();
  assert.equal(definitions.p2DefinitionStatus(old),'current');
  assert.equal(definitions.p2DefinitionStatus(fresh),'current_t4');
  assert.equal(old.serverEvaluatorId,'NONE_CLIENT_REPORTED');
  assert.equal(fresh.serverEvaluatorId,'P2_DETERMINISTIC_TEXT');
  assert.equal(definitions.p2DefinitionStatus(null),'legacy_unversioned');
  assert.equal(definitions.p2DefinitionStatus({...fresh,itemBankSha256:'0'.repeat(64)}),'mismatch');
});
test('server evaluates keyed text and pauses unassessable adaptive response',()=>{
  const correct=evaluator.evaluateP2TextAttempt('MAT-02A','15','TEXT');
  assert.equal(correct.verdict,'correct');
  assert.equal(correct.nextTaskCode,'MAT-02B');
  assert.equal(correct.responseOrigin,'server_evaluated');
  const wrong=evaluator.evaluateP2TextAttempt('MAT-02A','14','TEXT');
  assert.equal(wrong.verdict,'incorrect');
  assert.equal(wrong.nextTaskCode,'MAT-02S');
  for(const [answer,mode] of [['15','SPEAK'],['','TEXT'],['[Sözlü cevap — eğitmen değerlendirecek]','TEXT']]) {
    const unknown=evaluator.evaluateP2TextAttempt('MAT-02A',answer,mode);
    assert.equal(unknown.verdict,'unassessable');
    assert.equal(unknown.nextTaskCode,null);
    assert.equal(unknown.needsEducatorReview,true);
    assert.equal(unknown.responseOrigin,'client_reported');
  }
});

async function record(db, sessionId, answer='15', actor=student, key=randomUUID()) {
  const evaluation=evaluator.evaluateP2TextAttempt('MAT-02A',answer,'TEXT');
  const hash=createHash('sha256').update(JSON.stringify({
    taskCode:'MAT-02A',answerText:answer,responseMode:'TEXT',
  })).digest('hex');
  return db.query(`SELECT * FROM public.cza_t4_record_assessment_attempt(
    $1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8::jsonb,$9::jsonb,$10)`,
    [sessionId,actor,academy,'MAT-02A',key,hash,answer,
      JSON.stringify({responseMode:'TEXT',clientTelemetry:'client_reported'}),
      JSON.stringify(evaluation),evaluation.nextTaskCode]);
}
test('attempt and route commit once; retries and two tabs preserve the first answer',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const key=randomUUID();
    const first=await record(db,sessionId,'15',student,key);
    assert.equal(first.rows.length,1);
    assert.equal(first.rows[0].replayed,false);
    assert.equal(first.rows[0].next_task_code,'MAT-02B');
    const replay=await record(db,sessionId,'15',student,key);
    assert.equal(replay.rows[0].attempt_id,first.rows[0].attempt_id);
    assert.equal(replay.rows[0].replayed,true);
    const twoTabs=await Promise.all([
      record(db,sessionId,'15'),record(db,sessionId,'15'),
    ]);
    assert.ok(twoTabs.every(x=>x.rows[0].attempt_id===first.rows[0].attempt_id));
    await assert.rejects(record(db,sessionId,'14'),/T4_ATTEMPT_IDENTITY_CONFLICT/);
    await assert.rejects(db.query(
      "UPDATE assessment_attempts SET server_next_task_code='MAT-02S' WHERE id=$1",
      [first.rows[0].attempt_id],
    ),/T4_EVALUATION_IMMUTABLE/);
    const count=await db.query('SELECT count(*)::int n FROM assessment_attempts WHERE session_id=$1',[sessionId]);
    assert.equal(count.rows[0].n,1);
    const state=await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',[sessionId]);
    assert.equal(state.rows[0].current_task_code,'MAT-02B');
    await db.exec(migration('20260929_t4_p2_server_evaluator_v1.sql'));
  } finally { await db.close(); }
});

test('foreign actor and terminal session leave zero attempt/route mutations',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    assert.equal((await record(db,sessionId,'15',other)).rows.length,0);
    await db.query("UPDATE assessment_sessions SET status='completed' WHERE id=$1",[sessionId]);
    assert.equal((await record(db,sessionId)).rows.length,0);
    await db.query("UPDATE assessment_sessions SET status='cancelled' WHERE id=$1",[sessionId]);
    assert.equal((await record(db,sessionId)).rows.length,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_attempts')).rows[0].n,0);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',[sessionId])).rows[0].current_task_code,'MAT-02A');
  } finally { await db.close(); }
});
test('route update failure rolls back inserted attempt',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    await db.exec(`CREATE FUNCTION public.reject_t4_transition() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'transition unavailable'; END $$;
      CREATE TRIGGER reject_t4_transition BEFORE UPDATE OF current_task_code
      ON public.assessment_sessions FOR EACH ROW EXECUTE FUNCTION public.reject_t4_transition();`);
    await assert.rejects(record(db,sessionId),/transition unavailable/);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_attempts')).rows[0].n,0);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',[sessionId])).rows[0].current_task_code,'MAT-02A');
  } finally { await db.close(); }
});

function loadAssessmentRoute(db, actor=student, educator=null) {
  process.env.DATABASE_URL='postgresql://test.invalid/isolated';
  const sql=(strings,...values)=>{
    const query=strings.reduce((s,x,i)=>s+x+(i<values.length?'$'+(i+1):''),'');
    return db.query(query,values).then(result=>result.rows);
  };
  return load('app/api/assessment/route.ts',(id)=>{
    if(id==='@neondatabase/serverless') return {neon:()=>sql};
    if(id==='node:crypto') return {createHash};
    if(id.includes('assessment-server-evaluator')) return evaluator;
    if(id.includes('assessment-routing')) return routing;
    if(id.includes('assessment-definition')) return {
      p2DefinitionStatus:(value)=>value?.serverEvaluatorId==='P2_DETERMINISTIC_TEXT'
        ? 'current_t4' : value?.serverEvaluatorId==='NONE_CLIENT_REPORTED'
          ? 'current' : 'mismatch',
    };
    if(id.includes('student-session')) return {
      authenticatedStudent:async()=>actor?{student_id:actor,academy_id:academy}:null,
    };
    if(id.includes('educator-auth')) return {authenticatedEducator:async()=>educator?{id:educator}:null};
    if(id.includes('assessment-learning-response')) return {calculateLearningResponse:()=>({})};
    if(id.includes('assessment-report')) return {generateAssessmentReport:()=>({})};
    throw Error(id);
  }).POST;
}
async function postAttempt(route,sessionId,answerText='15',id=randomUUID()) {
  const response=await route(new Request('https://staging.example/api/assessment',{
    method:'POST',body:JSON.stringify({action:'attempt',sessionId,taskCode:'MAT-02A',
      clientAttemptId:id,answerText,answerPayload:{responseMode:'TEXT',
        routeCorrectness:'incorrect',supportTriggered:true},
      nextTaskCode:'MAT-02S',shownAt:1,completedAt:2}),
  }));
  return {http:response.status,body:await response.json()};
}

test('actual route ignores forged client correctness, route and timing',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const route=loadAssessmentRoute(db);
    const key=randomUUID();
    const first=await postAttempt(route,sessionId,'15',key);
    assert.equal(first.http,200,JSON.stringify(first.body));
    assert.equal(first.body.nextTaskCode,'MAT-02B');
    assert.equal(first.body.verdict,'correct');
    const replay=await postAttempt(route,sessionId,'15',key);
    assert.equal(replay.http,200);
    assert.equal(replay.body.replayed,true);
    assert.equal(replay.body.attemptId,first.body.attemptId);
    const stored=(await db.query(
      'SELECT answer_payload,server_evaluation,response_latency_ms,total_response_time_ms FROM assessment_attempts',
    )).rows;
    assert.equal(stored.length,1);
    assert.equal(stored[0].answer_payload.routeCorrectness,undefined);
    assert.equal(stored[0].server_evaluation.responseOrigin,'server_evaluated');
    assert.equal(stored[0].response_latency_ms,null);
    assert.equal(stored[0].total_response_time_ms,null);
    const denied=await postAttempt(loadAssessmentRoute(db,other),sessionId);
    assert.notEqual(denied.http,200);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_attempts')).rows[0].n,1);
  } finally { await db.close(); }
});


test('actual read keeps old pinned contract and rejects unknown contract',async()=>{
  const db=await setup();
  try {
    const oldId=await seed(db,randomUUID(),1);
    const read=async(id)=>{
      const response=await loadAssessmentRoute(db)(new Request('https://staging.example/api/assessment',{
        method:'POST',body:JSON.stringify({action:'get',sessionId:id}),
      }));
      return {http:response.status,body:await response.json()};
    };
    const old=await read(oldId);
    assert.equal(old.http,200,JSON.stringify(old.body));
    assert.equal(old.body.definitionStatus,'current');
    assert.equal(old.body.session.definition_contract.serverEvaluatorId,'NONE_CLIENT_REPORTED');
    const changedId=randomUUID();
    await db.query(`INSERT INTO assessment_sessions
      (id,student_id,template_code,current_task_code,definition_contract)
      VALUES ($1,$2,'CZA_1_TO_2_V1','MAT-02A',$3::jsonb)`,
      [changedId,student,JSON.stringify({...contract(1),routingSha256:'0'.repeat(64),serverEvaluatorId:'UNKNOWN'})]);
    const changed=await read(changedId);
    assert.equal(changed.http,409);
    assert.equal(changed.body.error,'assessment_definition_mismatch');
  } finally { await db.close(); }
});

test('T4 attempt rejects old pinned session without mutation',async()=>{
  const db=await setup();
  try {
    const oldId=await seed(db,randomUUID(),1);
    assert.equal((await record(db,oldId)).rows.length,0);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_attempts')).rows[0].n,0);
  } finally { await db.close(); }
});

async function postReview(route,sessionId,attemptId,decision='correct',taskCode='MAT-02A') {
  const response=await route(new Request('https://staging.example/api/assessment',{
    method:'POST',body:JSON.stringify({action:'review_attempt',sessionId,attemptId,
      taskCode,decision}),
  }));
  return {http:response.status,body:await response.json()};
}
async function postFinish(route,sessionId) {
  const response=await route(new Request('https://staging.example/api/assessment',{
    method:'POST',body:JSON.stringify({action:'finish',sessionId}),
  }));
  return {http:response.status,body:await response.json()};
}

test('educator reviews one unassessable attempt; replay never adds a route',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const studentRoute=loadAssessmentRoute(db);
    const attemptKey=randomUUID();
    const attempt=await postAttempt(studentRoute,sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]',attemptKey);
    assert.equal(attempt.http,200,JSON.stringify(attempt.body));
    assert.equal(attempt.body.needsEducatorReview,true);
    assert.equal((await postFinish(studentRoute,sessionId)).http,409);
    const reviewRoute=loadAssessmentRoute(db,null,educatorAuth);
    const reviewed=await postReview(reviewRoute,sessionId,attempt.body.attemptId);
    assert.equal(reviewed.http,200,JSON.stringify(reviewed.body));
    assert.equal(reviewed.body.nextTaskCode,'MAT-02B');
    assert.equal(reviewed.body.observationOrigin,'educator_observed');
    const replay=await postReview(reviewRoute,sessionId,attempt.body.attemptId);
    assert.equal(replay.http,200);
    assert.equal(replay.body.replayed,true);
    const studentReplay=await postAttempt(studentRoute,sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]',attemptKey);
    assert.equal(studentReplay.http,200);
    assert.equal(studentReplay.body.replayed,true);
    assert.equal(studentReplay.body.needsEducatorReview,false);
    assert.equal(studentReplay.body.nextTaskCode,'MAT-02B');
    assert.equal((await postReview(reviewRoute,sessionId,attempt.body.attemptId,'incorrect')).http,409);
    const rows=(await db.query(`SELECT server_evaluation,educator_review,
      educator_reviewed_by,server_next_task_code FROM assessment_attempts
      WHERE session_id=$1`,[sessionId])).rows;
    assert.equal(rows.length,1);
    assert.equal(rows[0].server_evaluation.verdict,'unassessable');
    assert.equal(rows[0].server_evaluation.responseOrigin,'client_reported');
    assert.deepEqual(rows[0].educator_review,{
      origin:'educator_observed',decision:'correct',nextTaskCode:'MAT-02B',
    });
    assert.equal(rows[0].educator_reviewed_by,educatorId);
    assert.equal(rows[0].server_next_task_code,null);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',
      [sessionId])).rows[0].current_task_code,'MAT-02B');
    await assert.rejects(db.query(`UPDATE assessment_attempts SET educator_review =
      '{"origin":"server_evaluated"}'::jsonb WHERE session_id=$1`,[sessionId]),
      /T4_EVALUATION_IMMUTABLE/);
  } finally { await db.close(); }
});

test('forged review task code is rejected before first decision and on replay',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const attempt=await postAttempt(loadAssessmentRoute(db),sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]',randomUUID());
    assert.equal(attempt.http,200);
    const route=loadAssessmentRoute(db,null,educatorAuth);
    const forged=await postReview(route,sessionId,attempt.body.attemptId,'correct','MAT-03A');
    assert.equal(forged.http,409,JSON.stringify(forged.body));
    let state=(await db.query(`SELECT current_task_code FROM assessment_sessions WHERE id=$1`,
      [sessionId])).rows[0];
    let rows=(await db.query(`SELECT task_code,educator_review FROM assessment_attempts
      WHERE session_id=$1`,[sessionId])).rows;
    assert.equal(state.current_task_code,'MAT-02A');
    assert.equal(rows.length,1);
    assert.equal(rows[0].task_code,'MAT-02A');
    assert.equal(rows[0].educator_review,null);

    const valid=await postReview(route,sessionId,attempt.body.attemptId);
    assert.equal(valid.http,200,JSON.stringify(valid.body));
    assert.equal(valid.body.nextTaskCode,'MAT-02B');
    const forgedReplay=await postReview(route,sessionId,attempt.body.attemptId,
      'correct','MAT-03A');
    assert.equal(forgedReplay.http,409,JSON.stringify(forgedReplay.body));
    state=(await db.query(`SELECT current_task_code FROM assessment_sessions WHERE id=$1`,
      [sessionId])).rows[0];
    rows=(await db.query(`SELECT task_code,educator_review FROM assessment_attempts
      WHERE session_id=$1`,[sessionId])).rows;
    assert.equal(state.current_task_code,'MAT-02B');
    assert.equal(rows.length,1);
    assert.equal(rows[0].task_code,'MAT-02A');
    assert.deepEqual(rows[0].educator_review,{
      origin:'educator_observed',decision:'correct',nextTaskCode:'MAT-02B',
    });
  } finally { await db.close(); }
});

test('unlinked, cross-academy, student and closed-session reviews mutate nothing',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const attempt=await postAttempt(loadAssessmentRoute(db),sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]');
    const id=attempt.body.attemptId;
    for(const educator of ['auth-unlinked','auth-cross',null]) {
      const response=await postReview(loadAssessmentRoute(db,student,educator),sessionId,id);
      assert.equal(response.http,403,JSON.stringify(response.body));
    }
    await db.query('UPDATE teacher_student_links SET can_view=false WHERE teacher_id=$1',
      [educatorId]);
    assert.equal((await postReview(loadAssessmentRoute(db,null,educatorAuth),sessionId,id)).http,403);
    await db.query('UPDATE teacher_student_links SET can_view=true WHERE teacher_id=$1',
      [educatorId]);
    await db.query('UPDATE users SET is_active=false WHERE id=$1',[educatorId]);
    assert.equal((await postReview(loadAssessmentRoute(db,null,educatorAuth),sessionId,id)).http,403);
    await db.query('UPDATE users SET is_active=true WHERE id=$1',[educatorId]);
    await db.query("UPDATE assessment_sessions SET status='completed' WHERE id=$1",[sessionId]);
    const closed=await postReview(loadAssessmentRoute(db,null,educatorAuth),sessionId,id);
    assert.equal(closed.http,409,JSON.stringify(closed.body));
    assert.equal((await db.query('SELECT educator_review FROM assessment_attempts WHERE id=$1',
      [id])).rows[0].educator_review,null);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',
      [sessionId])).rows[0].current_task_code,'MAT-02A');
  } finally { await db.close(); }
});

test('concurrent educator reviews produce one durable decision and route',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const attempt=await postAttempt(loadAssessmentRoute(db),sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]');
    const route=loadAssessmentRoute(db,null,educatorAuth);
    const [first,second]=await Promise.all([
      postReview(route,sessionId,attempt.body.attemptId),
      postReview(route,sessionId,attempt.body.attemptId),
    ]);
    assert.equal(first.http,200,JSON.stringify(first.body));
    assert.equal(second.http,200,JSON.stringify(second.body));
    assert.equal([first.body.replayed,second.body.replayed].filter(x=>x===false).length,1);
    assert.equal((await db.query('SELECT count(*)::int n FROM assessment_attempts')).rows[0].n,1);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',
      [sessionId])).rows[0].current_task_code,'MAT-02B');
  } finally { await db.close(); }
});

test('review transition failure rolls back educator observation',async()=>{
  const db=await setup();
  try {
    const sessionId=await seed(db);
    const attempt=await postAttempt(loadAssessmentRoute(db),sessionId,
      '[Sözlü cevap — eğitmen değerlendirecek]');
    await db.exec(`CREATE FUNCTION public.reject_review_route() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'review route unavailable'; END $$;
      CREATE TRIGGER reject_review_route BEFORE UPDATE OF current_task_code
      ON public.assessment_sessions FOR EACH ROW EXECUTE FUNCTION public.reject_review_route();`);
    const response=await postReview(loadAssessmentRoute(db,null,educatorAuth),
      sessionId,attempt.body.attemptId);
    assert.equal(response.http,503);
    const stored=(await db.query(`SELECT educator_review,educator_reviewed_by
      FROM assessment_attempts WHERE id=$1`,[attempt.body.attemptId])).rows[0];
    assert.equal(stored.educator_review,null);
    assert.equal(stored.educator_reviewed_by,null);
    assert.equal((await db.query('SELECT current_task_code FROM assessment_sessions WHERE id=$1',
      [sessionId])).rows[0].current_task_code,'MAT-02A');
  } finally { await db.close(); }
});
