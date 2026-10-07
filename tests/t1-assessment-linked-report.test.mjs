import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = path.resolve(import.meta.dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

function loadRoute(relativePath, { db, educatorState, extra = {} }) {
  const source = process.env.T2_REPORT_PARENT && relativePath === 'app/api/educator-report/route.ts'
    ? execFileSync('git', ['show', '915881872aa4625bac6b13c0f811564854890ecf:app/api/educator-report/route.ts'], { cwd: root, encoding: 'utf8' })
    : read(relativePath);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const commonJsModule = { exports: {} };
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
  new Function('require', 'module', 'exports', 'process', 'Request', 'Response', 'URL', 'URLSearchParams', js)(
    (id) => {
      if (id in extra) return extra[id];
      if (id === '@neondatabase/serverless') return { neon };
      if (id.includes('educator-auth')) {
        return { authenticatedEducator: async () => educatorState.value };
      }
      if (id.includes('request-guard')) {
        return {
          allowRequest: async () => ({ allowed: true }),
          rateLimited: () => new Response('{}', { status: 429 }),
        };
      }
      if (id.includes('assessment-routing')) {
        return { assessmentTasks: [{ id: 'MAT-01A', rubric: [] }] };
      }
      if (id.includes('assessment-definition')) {
        return { t4P2Definition: () => ({definitionId:"CZA_1_TO_2",assessmentVersion:2,itemBankSha256:"a".repeat(64)}), currentP2Definition: () => ({ definitionId: 'CZA_1_TO_2', assessmentVersion: 1, blueprintId: 'P2_1_TO_2', blueprintVersion: 1, itemBankSha256: 'a'.repeat(64), routingSha256: 'b'.repeat(64), taskMappingVersion: 'LEGACY_ROUTING_V1', serverEvaluatorId: 'NONE_CLIENT_REPORTED', serverEvaluatorVersion: '0', rubricVersion: 'LEGACY_P2_RUBRIC_V1', answerKeyVersion: 'LEGACY_P2_ANSWER_KEY_V1' }), p2DefinitionStatus: (value) => value == null ? 'legacy_unversioned' : value.definitionId === 'CZA_1_TO_2' && value.itemBankSha256 === 'a'.repeat(64) ? 'current' : 'mismatch' };
      }
      if (id.includes('assessment-learning-response')) {
        return { calculateLearningResponse: () => ({ score: 0 }) };
      }
      if (id.includes('assessment-report')) {
        return { generateAssessmentReport: () => ({ evidenceCoverage: 0, skills: [] }) };
      }
      if (id.includes('cza-work-recommendations')) {
        return { buildCzaWorkRecommendations: () => [] };
      }
      if (id === '@/lib/special-learning-profile' || id === '@/lib/special-education-program') {
        const module = {exports:{}};
        const js = ts.transpileModule(read(id.replace('@/', '') + '.ts'), {
          compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
        }).outputText;
        new Function('module','exports',js)(module,module.exports);
        return module.exports;
      }
      throw new Error('unexpected import: ' + id);
    },
    commonJsModule,
    commonJsModule.exports,
    { env: { DATABASE_URL: 'synthetic' } },
    Request,
    Response,
    URL,
    URLSearchParams,
  );
  return commonJsModule.exports.POST;
}

async function setup() {
  const db = new PGlite({ extensions: { pgcrypto } });
  for (const migration of [
    '20260912_staging_core_prerequisites_v1.sql',
    '20260916_u1_student_panel_core_v1.sql',
    '20260917_u3_educator_student_access_v1.sql',
    '20260907_central_identity.sql',
    '20260908_assessment_engine_v1.sql',
    '20260928_t1_assessment_observer_provenance_v1.sql',
    '20260929_t2_p2_assessment_definition_contract_v1.sql',
    '20260929_t3_p2_assessment_session_outbox_v1.sql',
  ]) {
    await db.exec(read('db/migrations/' + migration));
  }

  const ids = {
    academyA: randomUUID(),
    academyB: randomUUID(),
    educatorA: randomUUID(),
    educatorAuthA: randomUUID(),
    educatorB: randomUUID(),
    educatorAuthB: randomUUID(),
    educatorCross: randomUUID(),
    educatorAuthCross: randomUUID(),
    studentUserA: randomUUID(),
    studentUserB: randomUUID(),
    studentA: randomUUID(),
    studentB: randomUUID(),
  };

  await db.query(
    `INSERT INTO academies(id,name,environment) VALUES
      ($1,'Academy A','staging'),($2,'Academy B','staging')`,
    [ids.academyA, ids.academyB],
  );
  await db.query(
    `INSERT INTO users(id,username,role,is_active,academy_id,auth_user_id,display_name) VALUES
      ($1,'educator-a','educator',true,$2,$3,'Educator A'),
      ($4,'educator-b','educator',true,$2,$5,'Educator B'),
      ($6,'educator-cross','educator',true,$7,$8,'Educator Cross'),
      ($9,'student-a','student',true,NULL,NULL,'Student A'),
      ($10,'student-b','student',true,NULL,NULL,'Student B')`,
    [
      ids.educatorA, ids.academyA, ids.educatorAuthA,
      ids.educatorB, ids.educatorAuthB,
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
  return { db, ids };
}

test('T1 linked assessment creation uses canonical educator + same-academy can_view scope', async () => {
  const { db, ids } = await setup();
  await db.exec('ALTER TABLE public.users ALTER COLUMN auth_user_id TYPE text USING auth_user_id::text');
  const educatorState = { value: { id: ids.educatorAuthA } };
  const post = loadRoute('app/api/assessment-linked/route.ts', { db, educatorState });
  const assessmentCycleKey = randomUUID();
  try {
    const valid = await post(
      new Request('https://cza.test/api/assessment-linked', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: ids.studentA, teacherId: ids.educatorB, assessmentCycleKey }),
      }),
    );
    assert.equal(valid.status, 200);
    const validBody = await valid.json();
    assert.equal(validBody.student.id, ids.studentA);

    const session = (
      await db.query(
        'SELECT student_id,status,definition_contract FROM assessment_sessions WHERE id=$1',
        [validBody.session.id],
      )
    ).rows[0];
    assert.equal(session.student_id, ids.studentA);
    assert.equal(session.status, 'active');
    assert.equal(session.definition_contract.definitionId, 'CZA_1_TO_2');
    assert.equal(session.definition_contract.assessmentVersion, 1);
    assert.equal(session.definition_contract.serverEvaluatorId, 'NONE_CLIENT_REPORTED');
    await assert.rejects(
      db.query('UPDATE assessment_sessions SET definition_contract=NULL WHERE id=$1', [validBody.session.id]),
      /ASSESSMENT_DEFINITION_IMMUTABLE/,
    );
    await db.exec(read('db/migrations/20260929_t2_p2_assessment_definition_contract_v1.sql'));
    const pinned = (await db.query('SELECT definition_contract FROM assessment_sessions WHERE id=$1', [validBody.session.id])).rows[0];
    assert.deepEqual(pinned.definition_contract, session.definition_contract);

    const before = Number(
      (await db.query('SELECT count(*)::int count FROM assessment_sessions')).rows[0].count,
    );

    educatorState.value = { id: ids.educatorAuthB };
    assert.equal(
      (
        await post(
          new Request('https://cza.test/api/assessment-linked', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ studentId: ids.studentA, assessmentCycleKey }),
          }),
        )
      ).status,
      403,
    );

    educatorState.value = { id: ids.educatorAuthCross };
    assert.equal(
      (
        await post(
          new Request('https://cza.test/api/assessment-linked', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ studentId: ids.studentA, assessmentCycleKey }),
          }),
        )
      ).status,
      403,
    );

    educatorState.value = { id: ids.educatorAuthA };
    assert.equal(
      (
        await post(
          new Request('https://cza.test/api/assessment-linked', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ studentId: ids.studentB, assessmentCycleKey }),
          }),
        )
      ).status,
      403,
    );

    await db.query(
      'UPDATE teacher_student_links SET can_view=false WHERE teacher_id=$1 AND student_id=$2',
      [ids.educatorA, ids.studentA],
    );
    assert.equal(
      (
        await post(
          new Request('https://cza.test/api/assessment-linked', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ studentId: ids.studentA, assessmentCycleKey }),
          }),
        )
      ).status,
      403,
    );

    const after = Number(
      (await db.query('SELECT count(*)::int count FROM assessment_sessions')).rows[0].count,
    );
    assert.equal(after, before);
  } finally {
    await db.close();
  }
});

test('T1 educator report enforces canonical role, link and same academy', async () => {
  const { db, ids } = await setup();
  const educatorState = { value: { id: ids.educatorAuthA } };
  const post = loadRoute('app/api/educator-report/route.ts', { db, educatorState });
  try {
    const valid = await post(
      new Request('https://cza.test/api/educator-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: ids.studentA, teacherId: ids.educatorB }),
      }),
    );
    assert.equal(valid.status, 200);
    assert.equal((await valid.json()).student.id, ids.studentA);

    educatorState.value = { id: ids.educatorAuthB };
    const unlinked = await post(
      new Request('https://cza.test/api/educator-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: ids.studentA }),
      }),
    );
    assert.equal(unlinked.status, 404);

    educatorState.value = { id: ids.educatorAuthCross };
    const cross = await post(
      new Request('https://cza.test/api/educator-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ studentId: ids.studentA }),
      }),
    );
    assert.equal(cross.status, 404);
  } finally {
    await db.close();
  }
});

test('T1 P2 request handlers contain no runtime schema DDL', () => {
  for (const file of [
    'app/api/assessment/route.ts',
    'app/api/assessment-linked/route.ts',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /\bCREATE\s+TABLE\b/i);
    assert.doesNotMatch(source, /\bALTER\s+TABLE\b/i);
    assert.doesNotMatch(source, /\bCREATE\s+INDEX\b/i);
  }
});

test('T2 educator report rejects drift and labels legacy without weakening linked scope', async () => {
  const { db, ids } = await setup();
  await db.exec('ALTER TABLE public.users ALTER COLUMN auth_user_id TYPE text USING auth_user_id::text');
  await db.query(
    `INSERT INTO student_external_identifiers(student_id,identifier_type,identifier_value)
     VALUES($1,'campus_student_code','T2-REPORT-A'),($2,'campus_student_code','T2-REPORT-B')`,
    [ids.studentA, ids.studentB],
  );
  const educatorState = { value: { id: ids.educatorAuthA } };
  let evaluations = 0;
  const post = loadRoute('app/api/educator-report/route.ts', {
    db, educatorState,
    extra: {
      '@/lib/assessment-learning-response': {
        calculateLearningResponse: () => { evaluations++; return { score: 0 }; },
      },
      '@/lib/assessment-report': {
        generateAssessmentReport: () => ({ evidenceCoverage: 0, skills: [] }),
      },
    },
  });
  const legacyId = randomUUID();
  const mismatchedId = randomUUID();
  const requestReport = async (body) => post(new Request('https://cza.test/api/educator-report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
  const report = (studentId) => requestReport({ studentId });
  try {
    await db.query(
      `INSERT INTO assessment_sessions(id,template_code,student_id,status,completed_at)
       VALUES($1,'CZA_1_TO_2_V1',$2,'completed',now())`,
      [legacyId, ids.studentA],
    );
    await db.query(
      `INSERT INTO assessment_sessions(id,template_code,student_id,status,completed_at,definition_contract)
       VALUES($1,'CZA_1_TO_2_V1',$2,'completed',now()+interval '1 day',$3::jsonb)`,
      [mismatchedId, ids.studentA, JSON.stringify({
        definitionId: 'CZA_1_TO_2', assessmentVersion: 1, blueprintId: 'P2_1_TO_2',
        blueprintVersion: 1, itemBankSha256: 'c'.repeat(64), routingSha256: 'b'.repeat(64),
        taskMappingVersion: 'LEGACY_ROUTING_V1', serverEvaluatorId: 'NONE_CLIENT_REPORTED',
        serverEvaluatorVersion: '0', rubricVersion: 'LEGACY_P2_RUBRIC_V1',
        answerKeyVersion: 'LEGACY_P2_ANSWER_KEY_V1',
      })],
    );
    const mismatch = await report(ids.studentA);
    assert.equal(mismatch.status, 200);
    const mismatchBody = await mismatch.json();
    assert.equal(mismatchBody.assessmentDefinitionStatus, 'mismatch');
    assert.equal(mismatchBody.assessmentRouting, null);
    assert.equal(evaluations, 0);
    assert.equal(mismatchBody.student.id, ids.studentA);
    assert.ok(mismatchBody.summary);
    const byCode = await requestReport({ studentCode: 'T2-REPORT-A' });
    assert.equal(byCode.status, 200);
    assert.equal((await byCode.json()).assessmentDefinitionStatus, 'mismatch');
    educatorState.value = { id: ids.educatorAuthB };
    assert.equal((await report(ids.studentA)).status, 404);
    assert.equal((await requestReport({ studentCode: 'T2-REPORT-A' })).status, 404);
    educatorState.value = { id: ids.educatorAuthCross };
    assert.equal((await report(ids.studentA)).status, 404);
    assert.equal((await requestReport({ studentCode: 'T2-REPORT-A' })).status, 404);
    educatorState.value = { id: ids.educatorAuthA };
    assert.equal((await report(ids.studentB)).status, 404);
    assert.equal(evaluations, 0);

    await db.query('DELETE FROM assessment_sessions WHERE id=$1', [mismatchedId]);
    const legacy = await report(ids.studentA);
    assert.equal(legacy.status, 200);
    const legacyBody = await legacy.json();
    assert.equal(legacyBody.assessmentDefinitionStatus, 'legacy_unversioned');
    assert.equal(legacyBody.assessmentRouting.sessionId, legacyId);
    assert.equal(evaluations, 1);
  } finally {
    await db.close();
  }
});
