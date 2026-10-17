// TEST ONLY: ephemeral synthetic database. Never accepts a live DATABASE_URL.
import fs from 'node:fs';
export const uuid = n => `60000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const academy = uuid(1),student = uuid(2),recipe = uuid(3);
export const subject = token => uuid(({valid:200,unlinked:201,foreign:202,inactive:203})[token] || 299);
export async function setup(admin) {
 await admin.unsafe(`CREATE ROLE mock_owner NOLOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE ROLE mock_broker LOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE ROLE mock_runtime LOGIN NOSUPERUSER NOBYPASSRLS;
 CREATE ROLE mock_public LOGIN NOSUPERUSER NOBYPASSRLS;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;GRANT USAGE,CREATE ON SCHEMA public TO mock_owner;SET ROLE mock_owner;
 CREATE TABLE modules(code text PRIMARY KEY,name text);
 CREATE TABLE users(id uuid PRIMARY KEY,auth_user_id uuid,academy_id uuid,role text,is_active bool);
 CREATE TABLE students(id uuid PRIMARY KEY,academy_id uuid,status text);
 CREATE TABLE teacher_student_links(teacher_id uuid,student_id uuid,can_view bool);
 CREATE TABLE training_recipes(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,name text,created_at timestamptz,cancelled_at timestamptz,is_active bool);
 CREATE TABLE training_sessions(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,recipe_id uuid,status text,completed_at timestamptz,last_activity_at timestamptz,started_at timestamptz);
 CREATE TABLE learning_records(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,training_session_id uuid,completed_at timestamptz,performance jsonb,skills jsonb,support_level text,record_origin text,verification_status text);
 CREATE TABLE question_attempts(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,module_code text,training_session_id uuid,created_at timestamptz,is_correct bool,total_response_time_ms int,error_type text,error_detail text,metadata jsonb);
 CREATE TABLE learning_evidence(id uuid PRIMARY KEY,student_id uuid,academy_id uuid,learning_record_id uuid,observed_at timestamptz,payload jsonb,skill_code text,evidence_type text,support_level text,verification_status text);
 ALTER TABLE students ENABLE ROW LEVEL SECURITY;ALTER TABLE teacher_student_links ENABLE ROW LEVEL SECURITY;
 ALTER TABLE training_recipes ENABLE ROW LEVEL SECURITY;ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;ALTER TABLE question_attempts ENABLE ROW LEVEL SECURITY;
 INSERT INTO modules VALUES('finger_read','Synthetic');
 INSERT INTO students VALUES('${student}','${academy}','active'),('${uuid(99)}','${uuid(98)}','active');
 INSERT INTO users VALUES('${uuid(4)}','${subject('valid')}','${academy}','teacher',true),('${uuid(5)}','${subject('unlinked')}','${academy}','teacher',true),('${uuid(6)}','${subject('foreign')}','${uuid(98)}','teacher',true),('${uuid(7)}','${subject('inactive')}','${academy}','teacher',false);
 INSERT INTO teacher_student_links VALUES('${uuid(4)}','${student}',true),('${uuid(6)}','${student}',true),('${uuid(7)}','${student}',true);
 INSERT INTO training_recipes VALUES('${recipe}','${student}','${academy}','finger_read','Synthetic assigned','2026-10-06Z',NULL,true);RESET ROLE;`);
 for(let i=0;i<10;i++) {
  const time=i===0?'2026-10-05T14:22:49.616239Z':i<3?'2026-10-04T00:00:00.000001Z':'2026-10-06T00:00:00.999999Z';
  await admin.unsafe("INSERT INTO training_sessions VALUES($1,$2,$3,'finger_read',$4,'completed',$5::text::timestamptz,$5::text::timestamptz,$5::text::timestamptz)",[uuid(10+i),student,academy,recipe,time]);
  if(i<7) {
   await admin.unsafe("INSERT INTO learning_records VALUES($1,$2,$3,'finger_read',$4,$5::text::timestamptz,$6::text::jsonb,'[]','guided','server_authoritative','server_verified')",[uuid(30+i),student,academy,uuid(10+i),time,JSON.stringify({questionCount:10,correctCount:8,wrongCount:2})]);
   await admin.unsafe("INSERT INTO learning_evidence VALUES($1,$2,$3,$4,$5::text::timestamptz,'{}','skill','observation','guided','server_verified')",[uuid(50+i),student,academy,uuid(30+i),time]);
  }
 }
 for(let i=0;i<20;i++)await admin.unsafe("INSERT INTO question_attempts VALUES($1,$2,$3,'finger_read',$4,$5::text::timestamptz,$6,100,NULL,NULL,'{\"attemptType\":\"PRIMARY\"}')",[uuid(70+i),student,academy,uuid(10+Math.floor(i/10)),i===8?'2026-10-04Z':'2026-10-06Z',i%10<8]);
 const sql=fs.readFileSync('db/qa/educator-broker-read.template.sql','utf8').replaceAll('__OWNER_ROLE__','mock_owner').replaceAll('__BROKER_ROLE__','mock_broker');
 await admin.unsafe(sql);
 await admin.unsafe("INSERT INTO qa_broker_private.scope VALUES(true,'mock-project','mock-branch','broker_test','mock_broker',$1,$2)",[student,academy]);
}
export async function fingerprint(admin) {
 return admin.unsafe(['students','training_recipes','training_sessions','question_attempts','learning_records','learning_evidence'].map(t=>`SELECT '${t}' AS name,count(*)::int n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY t::text),'')) hash FROM ${t} t`).join(' UNION ALL '));
}
