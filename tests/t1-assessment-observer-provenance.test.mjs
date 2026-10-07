import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const read = (name) =>
  fs.readFileSync(new URL('../' + name, import.meta.url), 'utf8');

const prerequisites = read('db/migrations/20260912_staging_core_prerequisites_v1.sql');
const educatorAccess = read('db/migrations/20260917_u3_educator_student_access_v1.sql');
const assessment = read('db/migrations/20260908_assessment_engine_v1.sql');
const migration = read('db/migrations/20260928_t1_assessment_observer_provenance_v1.sql');

test('T1 observation provenance migration is additive, idempotent and legacy-safe', async () => {
  const db = new PGlite({ extensions: { pgcrypto } });
  try {
    await db.exec(prerequisites);
    await db.exec(educatorAccess);
    await db.exec(assessment);

    const academy = randomUUID();
    const otherAcademy = randomUUID();
    const educator = randomUUID();
    const studentUser = randomUUID();
    const student = randomUUID();
    const session = randomUUID();
    const legacyObservation = randomUUID();

    await db.query(
      `INSERT INTO academies(id,name,environment) VALUES
        ($1,'T1 Academy','staging'),($2,'Other','staging')`,
      [academy, otherAcademy],
    );
    await db.query(
      `INSERT INTO users(id,username,role,academy_id,is_active) VALUES
        ($1,'t1-educator','educator',$2,true),
        ($3,'t1-student','student',$2,true)`,
      [educator, academy, studentUser],
    );
    await db.query(
      `INSERT INTO students(id,academy_id,user_id,status)
       VALUES($1,$2,$3,'active')`,
      [student, academy, studentUser],
    );
    await db.query(
      `INSERT INTO assessment_sessions(id,template_code,student_id,student_label)
       VALUES($1,'CZA_1_TO_2_V1',$2,'Legacy Student')`,
      [session, student],
    );
    await db.query(
      `INSERT INTO assessment_observations
        (id,session_id,task_code,observation_codes,educator_note,confidence)
       VALUES($1,$2,'MAT-01A','["legacy"]','legacy note',3)`,
      [legacyObservation, session],
    );

    const before = (
      await db.query(
        `SELECT id,session_id,task_code,observation_codes,educator_note,confidence
         FROM assessment_observations WHERE id=$1`,
        [legacyObservation],
      )
    ).rows[0];

    await db.exec(migration);
    await db.exec(migration);

    const legacy = (
      await db.query(
        `SELECT id,session_id,task_code,observation_codes,educator_note,confidence,
                observer_user_id,observer_academy_id,observation_origin
         FROM assessment_observations WHERE id=$1`,
        [legacyObservation],
      )
    ).rows[0];

    assert.deepEqual(
      {
        id: legacy.id,
        session_id: legacy.session_id,
        task_code: legacy.task_code,
        observation_codes: legacy.observation_codes,
        educator_note: legacy.educator_note,
        confidence: legacy.confidence,
      },
      before,
    );
    assert.equal(legacy.observer_user_id, null);
    assert.equal(legacy.observer_academy_id, null);
    assert.equal(legacy.observation_origin, 'legacy_unknown');

    const valid = randomUUID();
    await db.query(
      `INSERT INTO assessment_observations
        (id,session_id,task_code,observation_codes,observer_user_id,observer_academy_id,observation_origin)
       VALUES($1,$2,'MAT-01A','[]',$3,$4,'educator_observed')`,
      [valid, session, educator, academy],
    );

    await assert.rejects(
      db.query(
        `INSERT INTO assessment_observations
          (session_id,task_code,observation_codes,observer_academy_id,observation_origin)
         VALUES($1,'MAT-01A','[]',$2,'educator_observed')`,
        [session, academy],
      ),
    );
    await assert.rejects(
      db.query(
        `INSERT INTO assessment_observations
          (session_id,task_code,observation_codes,observer_user_id,observation_origin)
         VALUES($1,'MAT-01A','[]',$2,'educator_observed')`,
        [session, educator],
      ),
    );
    await assert.rejects(
      db.query(
        `INSERT INTO assessment_observations
          (session_id,task_code,observation_codes,observer_user_id,observer_academy_id,observation_origin)
         VALUES($1,'MAT-01A','[]',$2,$3,'legacy_unknown')`,
        [session, educator, academy],
      ),
    );
    await assert.rejects(
      db.query(
        `INSERT INTO assessment_observations
          (session_id,task_code,observation_codes,observer_user_id,observer_academy_id,observation_origin)
         VALUES($1,'MAT-01A','[]',$2,$3,'educator_observed')`,
        [session, educator, otherAcademy],
      ),
    );

    assert.doesNotMatch(migration, /^\s*(?:DROP|DELETE|TRUNCATE)\b/im);
  } finally {
    await db.close();
  }
});
