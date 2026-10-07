/* oxlint-disable typescript/no-floating-promises -- node:test registrations are intentionally top-level. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');

const migration=read('../db/migrations/20260918_u9_guardian_panel_v1.sql');
const auth=read('../lib/guardian-auth.ts');
const access=read('../lib/guardian-access.ts');
const dashboard=read('../lib/persistence/guardian-dashboard.ts');
const panel=read('../components/guardian-panel.tsx');
const page=read('../app/parent/page.tsx');
const routes=[
  '../app/api/guardian/students/route.ts',
  '../app/api/guardian/dashboard/route.ts',
  '../app/api/guardian/history/route.ts',
  '../app/api/guardian/learning-profile/route.ts',
  '../app/api/guardian/report/route.ts',
  '../app/api/guardian/coaching/route.ts',
].map(read);
const reportRoute=read('../app/api/guardian/report/route.ts');
const historyRoute=read('../app/api/guardian/history/route.ts');
const profileRoute=read('../app/api/guardian/learning-profile/route.ts');
const coachingRoute=read('../app/api/guardian/coaching/route.ts');

test('U9 extends canonical identity without duplicate learning stores',()=>{
  assert.match(migration,/role IN \('student','educator','guardian'\)/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.guardian_student_links/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.guardian_sessions/);
  assert.doesNotMatch(migration,/CREATE TABLE IF NOT EXISTS public\.(?:parent_student_profile|guardian_student_profile|guardian_assignments|parent_assignments)/i);
  assert.match(access,/guardian_user\.role::text='guardian'/);
  assert.match(access,/link\.can_view=true/);
});

test('guardian educational routes are read-only and student scope uses guardianContext',()=>{
  for(const source of routes){
    assert.match(source,/guardianContext\(request/);
    assert.match(source,/export async function GET/);
    assert.doesNotMatch(source,/export async function (?:POST|PUT|PATCH|DELETE)/);
  }
});

test('U9 reuses U4 U6 U7 U8 canonical projections and provenance',()=>{
  assert.match(dashboard,/readStudentLearningProfile/);
  assert.match(dashboard,/readEducatorAnalytics/);
  assert.match(dashboard,/readCoachingCenter/);
  assert.match(read('../app/api/guardian/history/route.ts'),/readLearningTimeline/);
  assert.match(read('../app/api/guardian/learning-profile/route.ts'),/readStudentLearningProfile/);
  assert.match(reportRoute,/readEducatorAnalytics/);
  assert.match(coachingRoute,/readCoachingCenter/);
  assert.match(panel,/İstemci bildirimi/);
  assert.match(panel,/Doğrulanmış başarı puanı değildir/);
  assert.doesNotMatch(panel,/SERVER_VERIFIED/);
});

test('guardian response surfaces exclude private notes and internal trust metadata',()=>{
  assert.doesNotMatch(coachingRoute,/private_note/);
  assert.doesNotMatch(reportRoute,/verificationAuthority|request_hash|token_hash|sourceReferences|sourceReference/);
  assert.doesNotMatch(historyRoute,/verificationStatus|verificationAuthority|sourceReferences|sourceReference/);
  assert.doesNotMatch(profileRoute,/sourceReferences|sourceReference|verificationStatus|verificationAuthority/);
  assert.doesNotMatch(dashboard,/sourceReferences|sourceReference|verificationStatus|verificationAuthority/);
  for(const source of routes)assert.doesNotMatch(source,/token_hash|password|credential/i);
  assert.doesNotMatch(panel,/private_note|request_hash|token_hash/);
});

test('Veli Paneli exposes multi-child responsive readable sections',()=>{
  assert.match(page,/GuardianPanel/);
  for(const label of ['Veli Paneli','Öğrenci','Aktif görevler','Son çalışmalar','Öğrenme profili','Rapor özeti','Koçluk / LGS / YKS','Güvenli çıkış'])assert.match(panel,new RegExp(label));
  for(const breakpoint of ['sm:grid-cols-2','lg:grid-cols-3','xl:grid-cols-4','xl:grid-cols-2'])assert.ok(panel.includes(breakpoint));
  assert.match(panel,/students\.map/);
});

test('guardian auth uses hashed server sessions with durable revoke',()=>{
  assert.match(auth,/createHash\('sha256'\)/);
  assert.match(auth,/guardian_sessions/);
  assert.match(auth,/revoked_at IS NULL/);
  assert.match(auth,/expires_at>now\(\)/);
  assert.match(auth,/role::text='guardian'/);
  assert.match(auth,/UPDATE public\.guardian_sessions SET revoked_at=COALESCE\(revoked_at,now\(\)\)/);
});
