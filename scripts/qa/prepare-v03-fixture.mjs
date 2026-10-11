// Requires the architect's explicit approval. QA bootstrap, never a student INSERT.
import fs from 'node:fs';
import path from 'node:path';
import { randomInt, randomUUID, createHash } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import ts from 'typescript';
import vm from 'node:vm';

if(process.env.CZA_V03_QA_PREP_APPROVED!=='1')throw Error('architect_approval_required');
const url=process.env.CZA_QA_DATABASE_OWNER_URL;
const output=process.env.CZA_QA_STUDENT_FIXTURE_FILE;
if(!url||!output||!path.isAbsolute(output))throw Error('explicit_qa_owner_and_private_fixture_required');
if(!path.relative(process.cwd(),output).startsWith('..'))throw Error('credential_file_must_be_outside_repository');
if(fs.existsSync(output))throw Error('existing_credential_file_preserved');
const connection=new URL(url);
if(connection.username!=='cza_t5_test_owner'||connection.pathname!=='/cza_t5_synthetic')throw Error('qa_connection_rejected');
const sql=neon(url);
const student='20000000-0000-4000-8000-000000000001';
const academy='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const educator='10000000-0000-4000-8000-000000000002';
const requestId='90000000-0000-4000-8000-000000000088';
const pin=String(randomInt(100000,1000000));
const recipeId=randomUUID();
// Reuse the existing settings generator; no new exercise settings contract.
const source=fs.readFileSync('lib/training-recipes.ts','utf8');
const engine=fs.readFileSync('lib/exercise-engine.ts','utf8');
function load(text,dependencies){const module={exports:{}};vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:module.exports,module,require:id=>{if(id in dependencies)return dependencies[id];throw Error('unknown settings dependency '+id);}});return module.exports;}
const engineModule=load(engine,{'./practice-mode':{feedbackModeFor:()=> 'immediate'}});
const settings=load(source,{'./exercise-engine':engineModule,'./practice-mode':{feedbackModeFor:()=> 'immediate'}}).defaultRecipeSettings('finger_read');
const title='V03 QA · Parmak Okuma';
const instructions='Sentetik QA ataması: kendi öğrenme rotandaki çalışmayı görüntüle.';
const requestHash=createHash('sha256').update(JSON.stringify({studentId:student,moduleCode:'finger_read',title,instructions,settings,startsAt:null,expiresAt:null})).digest('hex');
fs.mkdirSync(path.dirname(output),{recursive:true});
const descriptor=fs.openSync(output,'wx',0o600);
// Persist private credentials before the DB commit so a later file I/O failure
// cannot leave an initialized PIN without its private recovery material.
fs.writeFileSync(descriptor,JSON.stringify({username:'t5-synthetic-student',pin,studentId:student,academyId:academy,recipeId,moduleCode:'finger_read'}));
try{
 const rows=await sql.transaction([
  sql.query(`DO $guard$ BEGIN
   IF current_user<>'cza_t5_test_owner' OR current_database()<>'cza_t5_synthetic'
    OR current_setting('neon.project_id',true) IS DISTINCT FROM 'patient-firefly-51111834'
    OR current_setting('neon.branch_id',true) IS DISTINCT FROM 'br-withered-queen-b15ltb40'
    OR (SELECT count(*) FROM public.students)<>2 THEN RAISE EXCEPTION 'qa_target_rejected'; END IF;
   IF NOT EXISTS (SELECT 1 FROM public.students s JOIN public.users u ON u.id=s.user_id AND u.academy_id=s.academy_id
     JOIN public.teacher_student_links l ON l.student_id=s.id AND l.academy_id=s.academy_id AND l.can_view
     JOIN public.users t ON t.id=l.teacher_id AND t.academy_id=l.academy_id
     WHERE s.id='${student}'::uuid AND s.academy_id='${academy}'::uuid AND s.is_demo AND s.status='active'
      AND u.id='10000000-0000-4000-8000-000000000001'::uuid AND u.username='t5-synthetic-student' AND u.is_active AND u.role::text='student' AND u.pin_hash IS NULL
      AND t.id='${educator}'::uuid AND t.is_active AND t.role::text IN ('teacher','educator','admin'))
     THEN RAISE EXCEPTION 'qa_bootstrap_preconditions_rejected'; END IF;
   IF EXISTS (SELECT 1 FROM public.modules WHERE code='finger_read') OR EXISTS (SELECT 1 FROM public.training_recipes WHERE student_id='${student}'::uuid)
     THEN RAISE EXCEPTION 'existing_module_or_assignment_preserved'; END IF;
  END $guard$`),
  sql.query("UPDATE public.users SET pin_hash=public.crypt($1,public.gen_salt('bf',10)),updated_at=now() WHERE id=$2::uuid AND pin_hash IS NULL RETURNING username",[pin,'10000000-0000-4000-8000-000000000001']),
  sql.query("INSERT INTO public.modules(code,name,category,is_active) VALUES('finger_read','Parmak Okuma','mental_arithmetic',true) RETURNING code"),
  sql.query(`INSERT INTO public.training_recipes(id,academy_id,student_id,module_code,assigned_by,source,name,instructions,settings,is_active,starts_at,expires_at,client_request_id,request_hash)
   VALUES($1::uuid,$2::uuid,$3::uuid,'finger_read',$4::uuid,'teacher_assignment',$5,$6,$7::jsonb,true,now(),NULL,$8::uuid,$9)
   RETURNING id,module_code,student_id,academy_id,assigned_by`,[recipeId,academy,student,educator,title,instructions,JSON.stringify(settings),requestId,requestHash]),
 ]);
 console.log(JSON.stringify({prepared:true,studentsCreated:0,usersUpdated:1,modulesInserted:1,assignmentsInserted:1,assignment:rows[3][0],credentials:'PRIVATE_FILE_ONLY',source:'AUTHORIZED_QA_BOOTSTRAP_NOT_EDUCATOR_UI'}));
}catch{
 fs.closeSync(descriptor);throw Error('qa_fixture_preparation_failed_private_recovery_file_preserved');
}
fs.closeSync(descriptor);
