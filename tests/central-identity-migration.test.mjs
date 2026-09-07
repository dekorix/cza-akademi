import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../db/migrations/20260907_central_identity.sql', import.meta.url),
  'utf8',
);

test('central identity migration keeps external identifiers unique and scoped to a student', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.student_external_identifiers/);
  assert.match(migration, /REFERENCES public\.students\(id\) ON DELETE CASCADE/);
  assert.match(migration, /UNIQUE \(identifier_type, identifier_value\)/);
  assert.match(migration, /UNIQUE \(student_id, identifier_type\)/);
  assert.match(migration, /'campus_student_code'/);
  assert.match(migration, /'legacy_reference'/);
});

test('educator sessions retain only a token hash and can be revoked', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.educator_sessions/);
  assert.match(migration, /token_hash text NOT NULL UNIQUE/);
  assert.match(migration, /revoked_at timestamptz NULL/);
  assert.match(migration, /idx_educator_sessions_active/);
});

