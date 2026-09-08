import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migration = fs.readFileSync(
  new URL('../db/migrations/20260908_legacy_assessment_imports.sql', import.meta.url),
  'utf8',
);

test('legacy assessments are tied to one central student and retain their source boundary', () => {
  assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.legacy_assessment_imports/);
  assert.match(migration, /student_id uuid NOT NULL REFERENCES public\.students\(id\) ON DELETE CASCADE/);
  assert.match(migration, /'google_student_form'/);
  assert.match(migration, /'google_educator_form'/);
  assert.match(migration, /raw_payload jsonb NOT NULL/);
});

test('the same Google Form response cannot be imported twice', () => {
  assert.match(migration, /UNIQUE \(source_system, source_record_id\)/);
  assert.match(migration, /assessment_status text NOT NULL CHECK/);
});
