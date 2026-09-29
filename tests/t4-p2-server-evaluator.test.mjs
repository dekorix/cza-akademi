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

function loadAssessmentRoute(db, actor=student) {
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
    if(id.includes('educator-auth')) return {authenticatedEducator:async()=>null};
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
