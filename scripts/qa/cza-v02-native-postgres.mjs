import fs from 'node:fs';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import postgres from 'postgres';
import {pathToFileURL} from 'node:url';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
let pg;
if(process.env.CZA_V02_NATIVE_DATABASE_URL){
 const url=new URL(process.env.CZA_V02_NATIVE_DATABASE_URL);
 if(!['127.0.0.1','localhost'].includes(url.hostname)||url.pathname!=='/cza_t5_synthetic')throw Error('local synthetic PostgreSQL required');
 pg={initialise:async()=>{},start:async()=>{},createDatabase:async()=>{},stop:async()=>{},getPgClient:()=>{
  const sql=postgres(url.toString(),{max:1});return{connect:async()=>{},query:async(q,p=[])=>({rows:await sql.unsafe(q,p)}),end:()=>sql.end()};
 }};
}else{
 const {default:EmbeddedPostgres}=await import(pathToFileURL(process.env.CZA_EMBEDDED_POSTGRES_MODULE).href);
 pg=new EmbeddedPostgres({databaseDir:process.cwd()+'/work/v02-native-'+crypto.randomUUID(),user:'postgres',password:crypto.randomUUID(),port:55482,persistent:true,onLog:()=>{},onError:()=>{}});
}
const proof={engine:'native PostgreSQL',connections:2,tests:[],passed:false};let a,b;
try{
 await pg.initialise();await pg.start();await pg.createDatabase('cza_t5_synthetic');
 a=pg.getPgClient('cza_t5_synthetic','127.0.0.1');b=pg.getPgClient('cza_t5_synthetic','127.0.0.1');await a.connect();await b.connect();
 const testSource=fs.readFileSync('tests/v02-assessment-student-link.test.mjs','utf8');
 const ddl=testSource.match(/await db.exec\(`([\s\S]*?)`\);/)[1];
 await a.query(Function('id','return `'+ddl+'`;')(id));
 await a.query(fs.readFileSync('db/migrations/20261011_v02_assessment_link_permission.sql','utf8'));
 await a.query(fs.readFileSync('db/migrations/20261011_v02_assessment_link_audit.sql','utf8'));
 for(const c of [a,b]){await c.query("SELECT set_config('neon.project_id','patient-firefly-51111834',false),set_config('neon.branch_id','br-withered-queen-b15ltb40',false)");}
 await a.query(`UPDATE teacher_student_links SET can_link_assessment=true WHERE id IN ('${id(20)}','${id(21)}')`);
 const create=async n=>a.query(`INSERT INTO assessment_sessions(id,student_id,template_code,status,metadata) VALUES($1,NULL,'CZA_SPECIAL_V1_DYS','active',$2::jsonb)`,[id(n),JSON.stringify({academyId:id(1),createdByEducatorId:'auth',source:'EDUCATOR_PRE_ENROLLMENT',candidateId:id(n+100),cycleId:id(200)})]);
 const bind=(c,n,t)=>c.query('SELECT * FROM public.cza_v02_bind_assessment($1,$2::uuid,$3::uuid,true)',['auth',id(n),id(t)]);
 await create(60);
 // Hold the winning transaction open so the independent loser must wait.
 await a.query('BEGIN');const first=await bind(a,60,10);assert.equal(first.rows[0].outcome,'linked');
 let complete=false;const loser=bind(b,60,11).then(r=>{complete=true;return r;});
 await new Promise(r=>setTimeout(r,150));assert.equal(complete,false);await a.query('COMMIT');
 const second=await loser;assert.equal(second.rows[0].outcome,'conflict');
 assert.equal((await a.query('SELECT count(*)::int n FROM assessment_student_link_audit WHERE session_id=$1',[id(60)])).rows[0].n,1);
 proof.tests.push({name:'two independent connections and different authorized students',first:first.rows[0].outcome,second:second.rows[0].outcome,loserWaited:true,audits:1});
 await create(61);await a.query('BEGIN');await bind(a,61,10);
 const repeat=bind(b,61,10);await a.query('COMMIT');assert.equal((await repeat).rows[0].outcome,'already_linked');proof.tests.push({name:'concurrent same target idempotency',passed:true});
 // A permission revocation locks the same authority row; waiting bind must
 // recheck the now-false permission before touching the assessment.
 await create(62);await a.query('BEGIN');await a.query('UPDATE teacher_student_links SET can_link_assessment=false WHERE student_id=$1',[id(10)]);
 const denied=bind(b,62,10);await a.query('COMMIT');assert.equal((await denied).rows.length,0);assert.equal((await a.query('SELECT student_id FROM assessment_sessions WHERE id=$1',[id(62)])).rows[0].student_id,null);proof.tests.push({name:'concurrent permission revocation leaves no half-link',passed:true});
 await a.query(`CREATE FUNCTION test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic audit failure'; END $$;CREATE TRIGGER test_audit_failure BEFORE INSERT ON assessment_student_link_audit FOR EACH ROW EXECUTE FUNCTION test_audit_failure();UPDATE teacher_student_links SET can_link_assessment=true WHERE student_id='${id(10)}'`);
 await create(63);await assert.rejects(bind(a,63,10));assert.equal((await a.query('SELECT student_id FROM assessment_sessions WHERE id=$1',[id(63)])).rows[0].student_id,null);proof.tests.push({name:'native PostgreSQL audit failure rollback',passed:true});
 await a.query('DROP TRIGGER test_audit_failure ON assessment_student_link_audit');
 await create(64);await a.query('SET ROLE cza_v01_app_runtime_min');
 const eligible=await a.query('SELECT * FROM public.cza_v02_eligible_students($1,true)',['auth']);assert.equal(eligible.rows.length,2);
 assert.equal((await bind(a,64,10)).rows[0].outcome,'linked');
 const history=await a.query('SELECT * FROM public.cza_v02_student_history($1,$2::uuid)',['auth',id(10)]);assert.ok(history.rows.some(r=>r.id===id(64)));
 await assert.rejects(a.query('UPDATE public.users SET is_active=false'),/permission denied/);
 await assert.rejects(a.query('INSERT INTO public.assessment_student_link_audit(session_id) VALUES($1)',[id(999)]),/permission denied/);
 await a.query('RESET ROLE');proof.tests.push({name:'runtime can call scoped functions but cannot update users or insert audit',passed:true});
 proof.version=(await a.query('SELECT version()')).rows[0].version;proof.passed=true;
}catch(e){proof.failure=e.message;process.exitCode=1;}
finally{await a?.end().catch(()=>{});await b?.end().catch(()=>{});await pg.stop().catch(()=>{});fs.writeFileSync('docs/evidence/v02/native-postgres-concurrency.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));}
