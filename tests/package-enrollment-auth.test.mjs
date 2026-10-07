import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const route=fs.readFileSync(new URL('../app/api/educator-enrollment/route.ts',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../db/migrations/20261005_student_package_entitlements_v1.sql',import.meta.url),'utf8');
const core=fs.readFileSync(new URL('../app/api/core/route.ts',import.meta.url),'utf8');
const access=fs.readFileSync(new URL('../app/api/core/access/route.ts',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../app/educator/enrollment/page.tsx',import.meta.url),'utf8');

test('package enrollment requires educator auth and linked central student',()=>{
  assert.match(route,/authenticatedEducator\(request\)/);
  assert.match(route,/teacher_student_links/);
  assert.match(route,/l\.can_view=true/);
  assert.match(route,/s\.id=\$\{studentId\}::uuid/);
});

test('parent decision is stored separately from activation',()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.student_package_decisions/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS public\.student_package_enrollments/);
  assert.match(migration,/decision_id uuid NOT NULL UNIQUE REFERENCES public\.student_package_decisions/);
  assert.match(migration,/CZA_APPROVED_PARENT_DECISION_REQUIRED/);
  assert.match(route,/action==='record_decision'/);
  assert.match(route,/action==='activate'/);
});

test('activation requires explicit basis, confirmation and fully ready package',()=>{
  assert.match(route,/PAYMENT_CONFIRMED/);
  assert.match(route,/PILOT_COMPLIMENTARY/);
  assert.match(route,/package_activation_confirmation_required/);
  assert.match(route,/isPackageFullyReady\(packageCode\)/);
  assert.match(route,/package_not_ready_for_activation/);
  assert.match(page,/Bu ekran ödeme tahsil etmez/);
});

test('free-practice start requires active entitlement while assignment cookie remains controlled bypass',()=>{
  assert.match(core,/action === 'start' && !workRecipeId/);
  assert.match(core,/student_access_entitlements/);
  assert.match(core,/module_access_required/);
  assert.match(core,/workRecipeId = recipe\.id/);
});

test('student access endpoint exposes only active package entitlements',()=>{
  assert.match(access,/authenticatedStudent\(request\)/);
  assert.match(access,/p\.status = 'active'/);
  assert.match(access,/e\.status = 'active'/);
  assert.match(access,/accessCodes/);
});

test('cancelling package revokes enrollment entitlements',()=>{
  assert.match(migration,/cza_cancel_student_package/);
  assert.match(migration,/SET status = 'revoked', revoked_at = now\(\)/);
  assert.match(migration,/cancelled_by = p_cancelled_by/);
});
