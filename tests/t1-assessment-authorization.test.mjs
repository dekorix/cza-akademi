import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function routeLoader({ db, studentState, educatorState }) {
  const source = read('app/api/assessment/route.ts');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const commonJsModule = { exports: {} };
  const assessmentTasks = [
    {
      id: 'MAT-01A',
      rubric: [{ id: 'accuracy', label: 'Accuracy', max: 4 }],
    },
  ];
  const neon =
    () =>
    async (strings, ...values) =>
      (
        await db.query(
          strings.reduce((sql, part, index) => sql + (index ? '$' + index : '') + part, ''),
          values,
        )
      ).rows;

  // oxlint-disable-next-line typescript/no-implied-eval -- isolated route harness
  new Function('require', 'module', 'exports', 'process', 'Request', 'Response', 'URL', js)(
    (id) => {
      if (id === '@neondatabase/serverless') return { neon };
      if (id.includes('assessment-routing')) return { assessmentTasks };
      if (id.includes('assessment-learning-response')) {
        return { calculateLearningResponse: () => ({ score: 0 }) };
      }
      if (id.includes('assessment-report')) {
        return { generateAssessmentReport: () => ({ evidenceCoverage: 0 }) };
      }
      if (id.includes('student-session')) {
        return { authenticatedStudent: async () => studentState.value };
      }
      if (id.includes('educator-auth')) {
        return {
          authenticatedEducator: async (request) =>
            educatorState.requireFreshBody && request.bodyUsed ? null : educatorState.value,
        };
      }
      throw new Error('unexpected import: ' + id);
    },
    commonJsModule,
    commonJsModule.exports,
    { env: { DATABASE_URL: 'synthetic' } },
    Request,
    Response,
    URL,
  );
  return commonJsModule.exports.POST;
}

async function setup() {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const migration of [
    '20260912_staging_core_prerequisites_v1.sql',
    '20260916_u1_student_panel_core_v1.sql',
    '20260917_u3_educator_student_access_v1.sql',
    '20260908_assessment_engine_v1.sql',
    '20260928_t1_assessment_observer_provenance_v1.sql',
  ]) {
    await db.exec(read('db/migrations/' + migration));
  }

  const ids = {
    academyA: randomUUID(),
    academyB: randomUUID(),
    educatorA: randomUUID(),
    educatorAuthA: randomUUID(),
    educatorUnlinked: randomUUID(),
    educatorAuthUnlinked: randomUUID(),
    educatorInactive: randomUUID(),
    educatorAuthInactive: randomUUID(),
    educatorCross: randomUUID(),
    educatorAuthCross: randomUUID(),
    studentUserA: randomUUID(),
    studentUserB: randomUUID(),
    studentA: randomUUID(),
    studentB: randomUUID(),
    sessionA: randomUUID(),
    sessionB: randomUUID(),
    pausedA: randomUUID(),
    completedA: randomUUID(),
    cancelledA: randomUUID(),
    attemptA: randomUUID(),
    pausedAttempt: randomUUID(),
    completedAttempt: randomUUID(),
    cancelledAttempt: randomUUID(),
  };

  await db.query(
    `INSERT INTO academies(id,name,environment) VALUES
      ($1,'Academy A','staging'),($2,'Academy B','staging')`,
    [ids.academyA, ids.academyB],
  );
  await db.query(
    `INSERT INTO users(id,username,role,is_active,academy_id,auth_user_id,display_name) VALUES
      ($1,'educator-a','educator',true,$2,$3,'Educator A'),
      ($4,'educator-unlinked','educator',true,$2,$5,'Educator Unlinked'),
      ($6,'educator-inactive','educator',false,$2,$7,'Educator Inactive'),
      ($8,'educator-cross','educator',true,$9,$10,'Educator Cross'),
      ($11,'student-a','student',true,NULL,NULL,'Student A'),
      ($12,'student-b','student',true,NULL,NULL,'Student B')`,
    [
      ids.educatorA, ids.academyA, ids.educatorAuthA,
      ids.educatorUnlinked, ids.educatorAuthUnlinked,
      ids.educatorInactive, ids.educatorAuthInactive,
      ids.educatorCross, ids.academyB, ids.educatorAuthCross,
      ids.studentUserA, ids.studentUserB,
    ],
  );
  await db.query(
    `INSERT INTO students(id,academy_id,user_id,status,first_name,last_name) VALUES
      ($1,$2,$3,'active','Student','A'),
      ($4,$5,$6,'active','Student','B')`,
    [
      ids.studentA, ids.academyA, ids.studentUserA,
      ids.studentB, ids.academyB, ids.studentUserB,
    ],
  );
  await db.query(
    `INSERT INTO teacher_student_links(academy_id,teacher_id,student_id,can_view)
     VALUES($1,$2,$3,true)`,
    [ids.academyA, ids.educatorA, ids.studentA],
  );

  for (const [session, student, status] of [
    [ids.sessionA, ids.studentA, 'active'],
    [ids.sessionB, ids.studentB, 'active'],
    [ids.pausedA, ids.studentA, 'paused'],
    [ids.completedA, ids.studentA, 'completed'],
    [ids.cancelledA, ids.studentA, 'cancelled'],
  ]) {
    await db.query(
      `INSERT INTO assessment_sessions(id,template_code,student_id,student_label,status,current_task_code)
       VALUES($1,'CZA_1_TO_2_V1',$2,'Synthetic',$3,'MAT-01A')`,
      [session, student, status],
    );
  }

  for (const [attempt, session] of [
    [ids.attemptA, ids.sessionA],
    [ids.pausedAttempt, ids.pausedA],
    [ids.completedAttempt, ids.completedA],
    [ids.cancelledAttempt, ids.cancelledA],
  ]) {
    await db.query(
      `INSERT INTO assessment_attempts(id,session_id,task_code,answer_payload)
       VALUES($1,$2,'MAT-01A','{}')`,
      [attempt, session],
    );
  }

  return { db, ids };
}

function request(post, action, extra = {}) {
  return post(
    new Request('https://cza.test/api/assessment', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...extra }),
    }),
  );
}

test('T1 P2 assessment authorization, provenance and lifecycle guards', async (t) => {
  const { db, ids } = await setup();
  const studentState = { value: null };
  const educatorState = { value: null };
  const post = routeLoader({ db, studentState, educatorState });

  const studentA = {
    session_id: randomUUID(),
    student_id: ids.studentA,
    academy_id: ids.academyA,
    student_user_id: ids.studentUserA,
  };
  const educatorA = { id: ids.educatorAuthA };
  const count = async (table, session) =>
    Number(
      (
        await db.query(
          `SELECT count(*)::int AS count FROM ${table} WHERE session_id=$1`,
          [session],
        )
      ).rows[0].count,
    );

  try {
    await t.test('unsigned caller is denied before session data is returned', async () => {
      const response = await request(post, 'get', { sessionId: ids.sessionA });
      assert.equal(response.status, 403);
    });

    await t.test('student A cannot read student B session', async () => {
      studentState.value = studentA;
      const response = await request(post, 'get', { sessionId: ids.sessionB });
      assert.equal(response.status, 403);
    });

    await t.test('student A cannot write attempt to student B session', async () => {
      const before = await count('assessment_attempts', ids.sessionB);
      const response = await request(post, 'attempt', {
        sessionId: ids.sessionB,
        taskCode: 'MAT-01A',
        shownAt: Date.now() - 1000,
        completedAt: Date.now(),
        answerText: '42',
      });
      assert.notEqual(response.status, 200);
      assert.equal(await count('assessment_attempts', ids.sessionB), before);
    });

    await t.test('student A cannot finish student B session', async () => {
      const response = await request(post, 'finish', { sessionId: ids.sessionB });
      assert.equal(response.status, 403);
      assert.equal(
        (await db.query('SELECT status FROM assessment_sessions WHERE id=$1', [ids.sessionB])).rows[0].status,
        'active',
      );
    });

    await t.test('student role cannot score or observe', async () => {
      educatorState.value = null;
      assert.equal(
        (
          await request(post, 'score', {
            sessionId: ids.sessionA,
            attemptId: ids.attemptA,
            taskCode: 'MAT-01A',
            rubricScores: { accuracy: 4 },
          })
        ).status,
        403,
      );
      assert.equal(
        (
          await request(post, 'observe', {
            sessionId: ids.sessionA,
            taskCode: 'MAT-01A',
            observationCodes: ['x'],
          })
        ).status,
        403,
      );
    });

    await t.test('forged actor fields are rejected rather than trusted', async () => {
      educatorState.value = educatorA;
      const before = await count('assessment_observations', ids.sessionA);
      const response = await request(post, 'observe', {
        sessionId: ids.sessionA,
        taskCode: 'MAT-01A',
        observerUserId: ids.educatorUnlinked,
        observerAcademyId: ids.academyB,
      });
      assert.equal(response.status, 400);
      assert.equal(await count('assessment_observations', ids.sessionA), before);

      const forgedStudent = await request(post, 'get', {
        sessionId: ids.sessionA,
        studentId: ids.studentB,
      });
      assert.equal(forgedStudent.status, 400);
    });

    await t.test('unlinked, cross-academy and inactive educators create zero observation', async () => {
      studentState.value = null;
      const before = await count('assessment_observations', ids.sessionA);
      for (const id of [
        ids.educatorAuthUnlinked,
        ids.educatorAuthCross,
        ids.educatorAuthInactive,
      ]) {
        educatorState.value = { id };
        const response = await request(post, 'observe', {
          sessionId: ids.sessionA,
          taskCode: 'MAT-01A',
          observationCodes: ['x'],
        });
        assert.equal(response.status, 403);
      }
      assert.equal(await count('assessment_observations', ids.sessionA), before);
    });

    await t.test('normal educator session can read linked assessment before body ownership transfers', async () => {
      studentState.value = null;
      educatorState.value = educatorA;
      educatorState.requireFreshBody = true;
      try {
        const response = await request(post, 'get', { sessionId: ids.cancelledA });
        assert.equal(response.status, 200);
        assert.equal((await response.json()).session.id, ids.cancelledA);
      } finally {
        educatorState.requireFreshBody = false;
      }
    });

    await t.test('can_view=false creates zero observation', async () => {
      educatorState.value = educatorA;
      await db.query(
        'UPDATE teacher_student_links SET can_view=false WHERE teacher_id=$1 AND student_id=$2',
        [ids.educatorA, ids.studentA],
      );
      const before = await count('assessment_observations', ids.sessionA);
      const response = await request(post, 'observe', {
        sessionId: ids.sessionA,
        taskCode: 'MAT-01A',
        observationCodes: ['x'],
      });
      assert.equal(response.status, 403);
      assert.equal(await count('assessment_observations', ids.sessionA), before);
      await db.query(
        'UPDATE teacher_student_links SET can_view=true WHERE teacher_id=$1 AND student_id=$2',
        [ids.educatorA, ids.studentA],
      );
    });

    await t.test('authorized student own attempt is allowed and client rubric is not trusted', async () => {
      studentState.value = studentA;
      educatorState.value = null;
      const response = await request(post, 'attempt', {
        sessionId: ids.sessionA,
        taskCode: 'MAT-01A',
        shownAt: Date.now() - 1000,
        firstActionAt: Date.now() - 800,
        completedAt: Date.now(),
        answerText: '42',
        answerPayload: { routeCorrectness: 'CORRECT' },
        rubricScores: { accuracy: 4 },
        studentId: undefined,
      });
      assert.equal(response.status, 200);
      const row = (
        await db.query(
          'SELECT rubric_scores,answer_payload FROM assessment_attempts WHERE id=$1',
          [(await response.json()).attemptId],
        )
      ).rows[0];
      assert.deepEqual(row.rubric_scores, {});
      assert.equal(row.answer_payload.routeCorrectness, 'CORRECT');
    });

    await t.test('authorized educator can report and observation stores canonical actor provenance', async () => {
      studentState.value = null;
      educatorState.value = educatorA;
      const report = await request(post, 'report', { sessionId: ids.sessionA });
      assert.equal(report.status, 200);

      const response = await request(post, 'observe', {
        sessionId: ids.sessionA,
        taskCode: 'MAT-01A',
        observationCodes: ['strategy_observed'],
        educatorNote: 'Synthetic observation',
        confidence: 4,
      });
      assert.equal(response.status, 200);
      const observationId = (await response.json()).observationId;
      const row = (
        await db.query(
          `SELECT observer_user_id,observer_academy_id,observation_origin
           FROM assessment_observations WHERE id=$1`,
          [observationId],
        )
      ).rows[0];
      assert.equal(row.observer_user_id, ids.educatorA);
      assert.equal(row.observer_academy_id, ids.academyA);
      assert.equal(row.observation_origin, 'educator_observed');
    });

    await t.test('paused completed and cancelled sessions reject mutation', async () => {
      studentState.value = studentA;
      educatorState.value = educatorA;
      for (const [sessionId, attemptId] of [
        [ids.pausedA, ids.pausedAttempt],
        [ids.completedA, ids.completedAttempt],
        [ids.cancelledA, ids.cancelledAttempt],
      ]) {
        const attemptsBefore = await count('assessment_attempts', sessionId);
        const observationsBefore = await count('assessment_observations', sessionId);

        assert.equal(
          (
            await request(post, 'attempt', {
              sessionId,
              taskCode: 'MAT-01A',
              shownAt: Date.now() - 1000,
              completedAt: Date.now(),
              answerText: 'x',
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(post, 'score', {
              sessionId,
              attemptId,
              taskCode: 'MAT-01A',
              rubricScores: { accuracy: 4 },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await request(post, 'observe', {
              sessionId,
              taskCode: 'MAT-01A',
              observationCodes: ['x'],
            })
          ).status,
          409,
        );

        assert.equal(await count('assessment_attempts', sessionId), attemptsBefore);
        assert.equal(await count('assessment_observations', sessionId), observationsBefore);
      }
    });

    await t.test('finish is active-only with completed replay idempotent', async () => {
      studentState.value = studentA;
      educatorState.value = null;

      assert.equal(
        (await request(post, 'finish', { sessionId: ids.pausedA })).status,
        409,
      );
      assert.equal(
        (await request(post, 'finish', { sessionId: ids.cancelledA })).status,
        409,
      );

      const first = await request(post, 'finish', { sessionId: ids.sessionA });
      assert.equal(first.status, 200);
      assert.equal((await first.json()).replayed, false);

      const replay = await request(post, 'finish', { sessionId: ids.sessionA });
      assert.equal(replay.status, 200);
      assert.equal((await replay.json()).replayed, true);
    });
  } finally {
    await db.close();
  }
});

test('student session cookie is delivered to canonical assessment API', () => {
  const source = read('app/api/core/route.ts');
  assert.ok(source.includes("return cookie(COOKIE_NAME, value, maxAge, secure, '/api/assessment')"));
  assert.ok(source.includes('assessmentSessionCookie(token, 60 * 60 * 8, secureCookie)'));
  assert.ok(source.includes("assessmentSessionCookie('', 0, secureCookie)"));
});

test('staging text auth_user_id permits linked educator assessment read', async () => {
  const { db, ids } = await setup();
  try {
    await db.exec('ALTER TABLE public.users ALTER COLUMN auth_user_id TYPE text USING auth_user_id::text');
    const post = routeLoader({
      db,
      studentState: { value: null },
      educatorState: { value: { id: ids.educatorAuthA } },
    });
    const response = await request(post, 'get', { sessionId: ids.cancelledA });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).session.id, ids.cancelledA);
  } finally {
    await db.close();
  }
});
