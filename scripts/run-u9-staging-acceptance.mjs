#!/usr/bin/env node
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import process from 'node:process';
import readline from 'node:readline';
import postgres from 'postgres';

const ALLOWED_STAGING_HOSTS=new Set([
  'ep-winter-mode-b2djq0wx.c-6.eu-central-1.aws.neon.tech',
  'ep-winter-mode-b2djq0wx-pooler.c-6.eu-central-1.aws.neon.tech',
]);
const BASE_URL='http://127.0.0.1:4209';
const ACADEMY='c2000000-0000-4000-8000-000000000001';
const STUDENT_A='c2000000-0000-4000-8000-000000000003';
const STUDENT_B='c2000000-0000-4000-8000-000000000011';
const OTHER_STUDENT='81000000-0000-4000-8000-000000000021';
const GUARDIAN_USER='c9000000-0000-4000-8000-000000000001';
const GUARDIAN_AUTH='c9000000-0000-4000-8000-000000000002';
const GUARDIAN_EMAIL='u9-guardian@example.invalid';

function fail(code){const error=new Error(code);error.code=code;throw error;}
async function readSecretLine(){const input=readline.createInterface({input:process.stdin,terminal:false});for await(const line of input){input.close();return line.trim();}return '';}
function waitForReady(child){return new Promise((resolve,reject)=>{let stdout='',stderr='';const timeout=setTimeout(()=>finish(new Error('U9_STAGING_SERVER_TIMEOUT')),30_000);const finish=error=>{clearTimeout(timeout);child.stdout.off('data',onOut);child.stderr.off('data',onErr);child.off('exit',onExit);child.off('error',onError);if(error)reject(error);else resolve();};const onOut=chunk=>{stdout+=chunk.toString();if(stdout.includes('CZA_U9_E2E_READY'))finish();};const onErr=chunk=>{stderr=(stderr+chunk.toString()).slice(-4000);};const onExit=code=>finish(new Error(`U9_STAGING_SERVER_EXIT_${code}:${stderr}`));const onError=error=>finish(error);child.stdout.on('data',onOut);child.stderr.on('data',onErr);child.once('exit',onExit);child.once('error',onError);});}
function runAcceptance(env){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,['tests/u9-staging-e2e.mjs'],{cwd:process.cwd(),env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='',settled=false;const timeout=setTimeout(()=>{if(settled)return;settled=true;child.kill('SIGTERM');reject(new Error('U9_STAGING_ACCEPTANCE_TIMEOUT'));},120_000);const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timeout);if(error)reject(error);else resolve(value);};child.stdout.on('data',chunk=>stdout+=chunk.toString());child.stderr.on('data',chunk=>stderr+=chunk.toString());child.once('error',error=>finish(error));child.once('exit',code=>{if(code!==0)return finish(new Error(`U9_STAGING_ACCEPTANCE_EXIT_${code}:${stderr.slice(-4000)}`));try{finish(null,JSON.parse(stdout.trim()));}catch{finish(new Error('U9_STAGING_ACCEPTANCE_OUTPUT_INVALID'));}});});}
async function stopChild(child){if(!child||child.exitCode!==null)return;child.kill('SIGTERM');await new Promise(resolve=>{const timeout=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');resolve();},5000);child.once('exit',()=>{clearTimeout(timeout);resolve();});});}

async function main(){
  const connectionString=await readSecretLine();
  if(!connectionString)fail('U9_DATABASE_URL_REQUIRED');
  let databaseUrl;try{databaseUrl=new URL(connectionString);}catch{fail('U9_DATABASE_URL_INVALID');}
  if(!ALLOWED_STAGING_HOSTS.has(databaseUrl.hostname))fail('U9_DATABASE_HOST_NOT_APPROVED_STAGING');
  if(databaseUrl.pathname!=='/neondb')fail('U9_DATABASE_NOT_APPROVED_STAGING');

  const proxySecret=randomBytes(48).toString('base64url');
  const studentToken=randomBytes(32).toString('base64url');
  const educatorGuardianToken=randomBytes(32).toString('base64url');
  const studentSessionId=randomUUID();
  const educatorSessionId=randomUUID();
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const sql=postgres(connectionString,{max:4,connect_timeout:10,idle_timeout:5,prepare:false});
  let server,report,operationError;let educatorId=GUARDIAN_USER;
  try{
    const target=await sql`SELECT current_database() database,current_setting('server_version') server_version,pg_is_in_recovery() replica`;
    if(target[0]?.database!=='neondb'||target[0]?.replica!==false)fail('U9_STAGING_TARGET_NOT_PRIMARY');

    const migration=await readFile(new URL('../db/migrations/20260918_u9_guardian_panel_v1.sql',import.meta.url),'utf8');
    const migrationBody=migration.replace(/(^|\r?\n)\s*BEGIN\s*;\s*(?=\r?\n)/i,'$1').replace(/(^|\r?\n)\s*COMMIT\s*;\s*$/i,'$1');
    await sql.begin(async tx=>{await tx.unsafe(migrationBody);});

    const demos=await sql`
      SELECT id,academy_id,user_id,is_demo,status FROM public.students
      WHERE id=ANY(${[STUDENT_A,STUDENT_B]}::uuid[]) ORDER BY id
    `;
    if(demos.length!==2||demos.some(row=>row.academy_id!==ACADEMY||row.is_demo!==true||row.status!=='active'))fail('U9_APPROVED_DEMO_STUDENTS_MISSING');
    const other=await sql`SELECT id,is_demo,status FROM public.students WHERE id=${OTHER_STUDENT}::uuid LIMIT 1`;
    if(other.length!==1||other[0].is_demo!==true||other[0].status!=='active')fail('U9_CROSS_ACADEMY_DEMO_MISSING');

    await sql`
      INSERT INTO public.users(id,username,role,is_active,academy_id,auth_user_id,email,display_name)
      VALUES(${GUARDIAN_USER}::uuid,'u9-demo-guardian','guardian',true,${ACADEMY}::uuid,${GUARDIAN_AUTH}::uuid,${GUARDIAN_EMAIL},'U9 Demo Veli')
      ON CONFLICT(id) DO UPDATE SET role='guardian',is_active=true,academy_id=EXCLUDED.academy_id,
        auth_user_id=EXCLUDED.auth_user_id,email=EXCLUDED.email,display_name=EXCLUDED.display_name
    `;
    for(const studentId of [STUDENT_A,STUDENT_B]){
      await sql`
        INSERT INTO public.guardian_student_links(academy_id,guardian_user_id,student_id,can_view)
        VALUES(${ACADEMY}::uuid,${GUARDIAN_USER}::uuid,${studentId}::uuid,true)
        ON CONFLICT(academy_id,guardian_user_id,student_id) DO UPDATE SET can_view=true,updated_at=now()
      `;
    }

    const programCheck=await sql`
      SELECT student_id,array_agg(DISTINCT program_type ORDER BY program_type) types
      FROM public.coaching_programs
      WHERE student_id=ANY(${[STUDENT_A,STUDENT_B]}::uuid[]) AND status='active'
      GROUP BY student_id
    `;
    const programs=new Map(programCheck.map(row=>[row.student_id,row.types]));
    if(!programs.get(STUDENT_A)?.includes('LGS')||!programs.get(STUDENT_B)?.includes('YKS'))fail('U9_LGS_YKS_DEMO_PROGRAMS_MISSING');
    const privateMeeting=await sql`SELECT id FROM public.coaching_meetings WHERE student_id=${STUDENT_A}::uuid AND private_note IS NOT NULL LIMIT 1`;
    if(!privateMeeting.length)fail('U9_PRIVATE_NOTE_NEGATIVE_FIXTURE_MISSING');

    const studentA=demos.find(row=>row.id===STUDENT_A);
    await sql`
      INSERT INTO public.student_sessions(id,academy_id,student_id,student_user_id,token_hash,expires_at)
      VALUES(${studentSessionId}::uuid,${ACADEMY}::uuid,${STUDENT_A}::uuid,${studentA.user_id}::uuid,${hash(studentToken)},clock_timestamp()+interval '1 hour')
    `;

    const educator=await sql`SELECT id FROM public.users WHERE academy_id=${ACADEMY}::uuid AND role='educator' AND is_active=true ORDER BY id LIMIT 1`;
    if(!educator.length)fail('U9_EDUCATOR_NEGATIVE_FIXTURE_MISSING');
    educatorId=String(educator[0].id);
    await sql`
      INSERT INTO public.guardian_sessions(id,academy_id,guardian_user_id,token_hash,expires_at,user_agent)
      VALUES(${educatorSessionId}::uuid,${ACADEMY}::uuid,${educatorId}::uuid,${hash(educatorGuardianToken)},clock_timestamp()+interval '1 hour','u9-role-negative')
    `;

    const sharedEnvironment={...process.env,NODE_ENV:'test',DATABASE_URL:connectionString,CZA_TRUSTED_PROXY_HMAC_SECRET:proxySecret,CZA_TIMELINE_CURSOR_SECRET:proxySecret};
    server=spawn(process.execPath,['tests/u9-staging-e2e-server.mjs'],{cwd:process.cwd(),env:sharedEnvironment,stdio:['ignore','pipe','pipe']});
    await waitForReady(server);
    const acceptance=await runAcceptance({...sharedEnvironment,U9_BASE_URL:BASE_URL,U9_GUARDIAN_EMAIL:GUARDIAN_EMAIL,U9_GUARDIAN_USER_ID:GUARDIAN_USER,U9_STUDENT_TOKEN:studentToken,U9_EDUCATOR_GUARDIAN_TOKEN:educatorGuardianToken});

    const links=await sql`
      SELECT count(*)::int count FROM public.guardian_student_links link
      JOIN public.students student ON student.id=link.student_id AND student.academy_id=link.academy_id
      WHERE link.guardian_user_id=${GUARDIAN_USER}::uuid AND student.is_demo IS NOT TRUE
    `;
    if(links[0]?.count!==0)fail('U9_NON_DEMO_GUARDIAN_LINK_CREATED');
    report={result:'PASS',target:{environment:'staging',projectId:'orange-resonance-01270480',branchId:'br-lucky-rain-b2po93vx',database:'neondb',primary:true},acceptance,dataClassification:'synthetic_demo_only',productionAccessed:false,productionMutation:false};
  }catch(error){operationError=error;}

  let cleanupError;
  try{
    await stopChild(server);
    await sql`UPDATE public.users SET is_active=true WHERE id=${GUARDIAN_USER}::uuid`;
    await sql`UPDATE public.guardian_student_links SET can_view=true WHERE guardian_user_id=${GUARDIAN_USER}::uuid AND student_id=ANY(${[STUDENT_A,STUDENT_B]}::uuid[])`;
    await sql`UPDATE public.student_sessions SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE id=${studentSessionId}::uuid`;
    await sql`UPDATE public.guardian_sessions SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE guardian_user_id IN (${GUARDIAN_USER}::uuid,${educatorId}::uuid) AND revoked_at IS NULL`;
  }catch(error){cleanupError=error;}
  try{await sql.end({timeout:5});}catch(error){cleanupError||=error;}
  if(cleanupError)throw cleanupError;
  if(operationError)throw operationError;
  if(!report)fail('U9_STAGING_ACCEPTANCE_REPORT_MISSING');
  process.stdout.write(JSON.stringify({...report,sessionCleanup:'revoked'})+'\n');
}

try{await main();}catch(error){const message=String(error?.message||'U9_STAGING_ACCEPTANCE_FAILED');process.stderr.write(JSON.stringify({result:'FAIL',error:error?.code||message.split(':')[0],detail:message.slice(0,3000)})+'\n');process.exitCode=1;}
