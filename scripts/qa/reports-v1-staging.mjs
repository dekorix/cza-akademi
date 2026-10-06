import crypto from 'node:crypto';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';

const databaseUrl = process.env.CZA_STAGING_DATABASE_URL || '';
const baseUrl = process.env.CZA_REPORTS_BASE_URL || 'http://127.0.0.1:8787';
const educatorAuthUserId = '47c90485-e057-4ebe-a25c-9d7f236c5bd6';

if (!databaseUrl) {
  console.error('REPORTS_V1_STAGING=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try { parsed = new URL(databaseUrl); }
catch {
  console.error('REPORTS_V1_STAGING=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('REPORTS_V1_STAGING=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

const sql = neon(databaseUrl);
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
const marker = 'CZA_REPORTS_V1_STAGING_' + Date.now();
let educatorSessionId = '';
let crossAcademyStudentId = '';
let crossAcademyLinkCreated = false;

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function dateMs(value) {
  const ms = value ? Date.parse(String(value)) : NaN;
  return Number.isFinite(ms) ? ms : 0;
}

function learningDuration(row) {
  const performance = row.performance && typeof row.performance === 'object' ? row.performance : {};
  if (typeof performance.durationMs === 'number' && Number.isFinite(performance.durationMs)) {
    return Math.max(0, performance.durationMs);
  }
  return Math.max(0, dateMs(row.completed_at) - dateMs(row.started_at));
}

function normalizeModules(rows) {
  return [...rows].map(item => ({
    moduleCode: String(item.moduleCode),
    sessions: Number(item.sessions),
    totalQuestions: Number(item.totalQuestions),
    correct: Number(item.correct),
    wrong: Number(item.wrong),
    accuracy: Number(item.accuracy),
    totalDurationMs: Number(item.totalDurationMs),
  })).sort((a, b) => a.moduleCode.localeCompare(b.moduleCode));
}

function normalizeErrors(rows) {
  return [...rows].map(item => ({
    error_type: String(item.error_type),
    count: Number(item.count),
  })).sort((a, b) => a.error_type.localeCompare(b.error_type));
}

function assertEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(label + '_mismatch:' + JSON.stringify({ actual, expected }));
  }
}

async function rawOracle(academyId, studentId) {
  const [learningRows, recipeRows, sessionRows, attemptRows] = await Promise.all([
    sql`
      SELECT module_code, started_at, completed_at, performance, metadata
      FROM public.learning_records
      WHERE academy_id = ${academyId}::uuid
        AND student_id = ${studentId}::uuid
      ORDER BY completed_at DESC, created_at DESC
    `,
    sql`
      SELECT id, module_code
      FROM public.training_recipes
      WHERE academy_id = ${academyId}::uuid
        AND student_id = ${studentId}::uuid
        AND source = 'teacher_assignment'
    `,
    sql`
      SELECT recipe_id, status::text AS status
      FROM public.training_sessions
      WHERE academy_id = ${academyId}::uuid
        AND student_id = ${studentId}::uuid
    `,
    sql`
      SELECT is_correct, error_type
      FROM public.question_attempts
      WHERE student_id = ${studentId}
    `,
  ]);

  let totalQuestions = 0;
  let correct = 0;
  let wrong = 0;
  let totalDurationMs = 0;
  let timeoutCount = 0;
  let retryCount = 0;
  let assignmentSessions = 0;
  const moduleMap = new Map();

  for (const row of learningRows) {
    const performance = row.performance && typeof row.performance === 'object' ? row.performance : {};
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const total = Math.max(0, numeric(performance.total));
    const rowCorrect = Math.max(0, numeric(performance.correct));
    const rowWrong = Math.max(0, numeric(performance.wrong));
    const duration = learningDuration(row);
    const timeouts = Math.max(0, numeric(performance.timeoutCount));
    const retries = Math.max(0, numeric(performance.retryCount));

    totalQuestions += total;
    correct += rowCorrect;
    wrong += rowWrong;
    totalDurationMs += duration;
    timeoutCount += timeouts;
    retryCount += retries;
    if (metadata.source === 'teacher_assignment') assignmentSessions += 1;

    const moduleCode = String(row.module_code);
    const current = moduleMap.get(moduleCode) || {
      moduleCode,
      sessions: 0,
      totalQuestions: 0,
      correct: 0,
      wrong: 0,
      totalDurationMs: 0,
    };
    current.sessions += 1;
    current.totalQuestions += total;
    current.correct += rowCorrect;
    current.wrong += rowWrong;
    current.totalDurationMs += duration;
    moduleMap.set(moduleCode, current);
  }

  const moduleProgress = [...moduleMap.values()].map(item => ({
    ...item,
    accuracy: item.totalQuestions ? Math.round((item.correct / item.totalQuestions) * 100) : 0,
  }));

  const sessionsByRecipe = new Map();
  for (const row of sessionRows) {
    if (!row.recipe_id) continue;
    const key = String(row.recipe_id);
    const list = sessionsByRecipe.get(key) || [];
    list.push(String(row.status));
    sessionsByRecipe.set(key, list);
  }

  let assigned = 0;
  let started = 0;
  let completed = 0;
  for (const recipe of recipeRows) {
    const statuses = sessionsByRecipe.get(String(recipe.id)) || [];
    if (!statuses.length) assigned += 1;
    else if (statuses.includes('completed')) completed += 1;
    else started += 1;
  }

  const errorMap = new Map();
  for (const row of attemptRows) {
    if (row.is_correct) continue;
    const key = row.error_type ? String(row.error_type) : 'RESPONSE_ERROR';
    errorMap.set(key, (errorMap.get(key) || 0) + 1);
  }

  return {
    reportInsights: {
      sessions: learningRows.length,
      assignmentSessions,
      independentSessions: learningRows.length - assignmentSessions,
      totalQuestions,
      correct,
      wrong,
      accuracy: totalQuestions ? Math.round((correct / totalQuestions) * 100) : 0,
      totalDurationMs,
      timeoutCount,
      retryCount,
    },
    moduleProgress,
    assignmentProgress: {
      total: recipeRows.length,
      assigned,
      started,
      completed,
    },
    errorSummary: [...errorMap.entries()].map(([error_type, count]) => ({ error_type, count })),
  };
}

async function fetchReport(reference) {
  const response = await fetch(baseUrl + '/api/educator-report', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cookie': 'cza_educator_session=local.' + token,
    },
    body: JSON.stringify(reference),
  });
  const body = await response.json();
  return { response, body };
}

function assertReportMatchesOracle(body, expected, label) {
  if (body?.ok !== true || body.reportInsightsAvailable !== true) {
    throw new Error(label + '_report_unavailable');
  }

  const actualInsights = {
    sessions: Number(body.reportInsights.sessions),
    assignmentSessions: Number(body.reportInsights.assignmentSessions),
    independentSessions: Number(body.reportInsights.independentSessions),
    totalQuestions: Number(body.reportInsights.totalQuestions),
    correct: Number(body.reportInsights.correct),
    wrong: Number(body.reportInsights.wrong),
    accuracy: Number(body.reportInsights.accuracy),
    totalDurationMs: Number(body.reportInsights.totalDurationMs),
    timeoutCount: Number(body.reportInsights.timeoutCount),
    retryCount: Number(body.reportInsights.retryCount),
  };

  assertEqual(actualInsights, expected.reportInsights, label + '_report_insights');
  assertEqual(normalizeModules(body.moduleProgress || []), normalizeModules(expected.moduleProgress), label + '_module_progress');
  assertEqual({
    total: Number(body.assignmentProgress?.total || 0),
    assigned: Number(body.assignmentProgress?.assigned || 0),
    started: Number(body.assignmentProgress?.started || 0),
    completed: Number(body.assignmentProgress?.completed || 0),
  }, expected.assignmentProgress, label + '_assignment_progress');
  assertEqual(normalizeErrors(body.errorSummary || []), normalizeErrors(expected.errorSummary), label + '_error_summary');
}

try {
  const fixtures = await sql`
    SELECT
      t.id AS educator_user_id,
      t.academy_id,
      s.id AS student_id
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id
     AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id
     AND s.academy_id = t.academy_id
     AND s.status = 'active'
    WHERE t.auth_user_id = ${educatorAuthUserId}
      AND t.is_active = true
      AND EXISTS (
        SELECT 1
        FROM public.learning_records lr
        WHERE lr.academy_id = s.academy_id
          AND lr.student_id = s.id
      )
    ORDER BY (
      SELECT count(*)
      FROM public.learning_records lr
      WHERE lr.academy_id = s.academy_id
        AND lr.student_id = s.id
    ) DESC
    LIMIT 1
  `;

  if (!fixtures.length) {
    console.error('REPORTS_V1_STAGING=BLOCKED');
    console.error('REASON=NO_LINKED_STUDENT_WITH_CANONICAL_HISTORY');
    process.exit(2);
  }

  const fixture = fixtures[0];

  const before = await sql`
    SELECT
      (SELECT count(*)::int FROM public.learning_records WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS learning_records,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS recipes,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS sessions
  `;

  const educatorSessionRows = await sql`
    INSERT INTO public.educator_sessions (
      academy_id, educator_user_id, token_hash, expires_at, user_agent
    ) VALUES (
      ${fixture.academy_id}::uuid,
      ${fixture.educator_user_id}::uuid,
      ${tokenHash},
      now() + interval '15 minutes',
      ${marker}
    )
    RETURNING id
  `;
  educatorSessionId = String(educatorSessionRows[0]?.id || '');
  if (!educatorSessionId) throw new Error('educator_session_not_created');

  const expected = await rawOracle(fixture.academy_id, fixture.student_id);
  const primary = await fetchReport({ studentId: String(fixture.student_id) });
  if (!primary.response.ok) {
    throw new Error('primary_report_api_failed:' + primary.response.status + ':' + String(primary.body?.error || 'unknown'));
  }
  assertReportMatchesOracle(primary.body, expected, 'primary');
  if (expected.reportInsights.sessions < 1) throw new Error('primary_canonical_session_expected');

  const after = await sql`
    SELECT
      (SELECT count(*)::int FROM public.learning_records WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS learning_records,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS recipes,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS sessions
  `;

  if (
    Number(before[0].learning_records) !== Number(after[0].learning_records) ||
    Number(before[0].recipes) !== Number(after[0].recipes) ||
    Number(before[0].sessions) !== Number(after[0].sessions)
  ) {
    throw new Error('report_readback_mutated_student_data');
  }

  const unlinked = await sql`
    SELECT s.id
    FROM public.students s
    WHERE s.status = 'active'
      AND NOT EXISTS (
        SELECT 1
        FROM public.teacher_student_links l
        WHERE l.teacher_id = ${fixture.educator_user_id}::uuid
          AND l.student_id = s.id
          AND l.can_view = true
      )
    LIMIT 1
  `;

  if (unlinked.length) {
    const denied = await fetchReport({ studentId: String(unlinked[0].id) });
    if (denied.response.status !== 404 || denied.body?.error !== 'student_not_found') {
      throw new Error('cross_student_access_not_denied');
    }
    console.log('CROSS_STUDENT_DENY=PASS');
  } else {
    console.log('CROSS_STUDENT_DENY=NO_FIXTURE');
  }

  const crossAcademy = await sql`
    SELECT
      s.id,
      s.academy_id,
      i.identifier_value AS campus_code
    FROM public.students s
    LEFT JOIN public.student_external_identifiers i
      ON i.student_id = s.id
     AND i.identifier_type = 'campus_student_code'
    WHERE s.status = 'active'
      AND s.academy_id <> ${fixture.academy_id}::uuid
      AND NOT EXISTS (
        SELECT 1
        FROM public.teacher_student_links l
        WHERE l.teacher_id = ${fixture.educator_user_id}::uuid
          AND l.student_id = s.id
      )
    ORDER BY s.id
    LIMIT 1
  `;

  if (!crossAcademy.length) {
    throw new Error('cross_academy_runtime_fixture_missing');
  }

  crossAcademyStudentId = String(crossAcademy[0].id);
  await sql`
    INSERT INTO public.teacher_student_links (teacher_id, student_id, can_view)
    VALUES (
      ${fixture.educator_user_id}::uuid,
      ${crossAcademyStudentId}::uuid,
      true
    )
  `;
  crossAcademyLinkCreated = true;

  const crossIdDenied = await fetchReport({ studentId: crossAcademyStudentId });
  if (crossIdDenied.response.status !== 404 || crossIdDenied.body?.error !== 'student_not_found') {
    throw new Error('cross_academy_id_access_not_denied');
  }

  if (crossAcademy[0].campus_code) {
    const crossCodeDenied = await fetchReport({ studentCode: String(crossAcademy[0].campus_code) });
    if (crossCodeDenied.response.status !== 404 || crossCodeDenied.body?.error !== 'student_not_found') {
      throw new Error('cross_academy_code_access_not_denied');
    }
    console.log('CROSS_ACADEMY_CODE_DENY=PASS');
  } else {
    console.log('CROSS_ACADEMY_CODE_DENY=NO_FIXTURE');
  }
  console.log('CROSS_ACADEMY_ID_DENY=PASS');

  const emptyFixture = await sql`
    SELECT s.id, s.academy_id
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id
     AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id
     AND s.academy_id = t.academy_id
     AND s.status = 'active'
    WHERE t.id = ${fixture.educator_user_id}::uuid
      AND NOT EXISTS (
        SELECT 1 FROM public.learning_records lr
        WHERE lr.academy_id = s.academy_id
          AND lr.student_id = s.id
      )
    LIMIT 1
  `;

  if (emptyFixture.length) {
    const emptyExpected = await rawOracle(emptyFixture[0].academy_id, emptyFixture[0].id);
    const emptyReport = await fetchReport({ studentId: String(emptyFixture[0].id) });
    if (!emptyReport.response.ok) throw new Error('empty_runtime_report_failed');
    assertReportMatchesOracle(emptyReport.body, emptyExpected, 'empty');
    if (emptyReport.body.reportInsights.sessions !== 0 || emptyReport.body.reportInsights.totalQuestions !== 0 || emptyReport.body.reportInsights.accuracy !== 0) {
      throw new Error('empty_runtime_not_zero');
    }
    console.log('EMPTY_ZERO_RUNTIME=PASS');
  } else {
    console.log('EMPTY_ZERO_RUNTIME=NO_FIXTURE');
  }

  const legacyFixture = await sql`
    SELECT DISTINCT s.id, s.academy_id
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id = t.id
     AND l.can_view = true
    JOIN public.students s
      ON s.id = l.student_id
     AND s.academy_id = t.academy_id
     AND s.status = 'active'
    JOIN public.learning_records lr
      ON lr.student_id = s.id
     AND lr.academy_id = s.academy_id
    WHERE t.id = ${fixture.educator_user_id}::uuid
      AND (
        jsonb_typeof(lr.performance->'total') IS DISTINCT FROM 'number'
        OR jsonb_typeof(lr.performance->'correct') IS DISTINCT FROM 'number'
        OR jsonb_typeof(lr.performance->'wrong') IS DISTINCT FROM 'number'
        OR jsonb_typeof(lr.performance->'durationMs') IS DISTINCT FROM 'number'
      )
    LIMIT 1
  `;

  if (legacyFixture.length) {
    const legacyExpected = await rawOracle(legacyFixture[0].academy_id, legacyFixture[0].id);
    const legacyReport = await fetchReport({ studentId: String(legacyFixture[0].id) });
    if (!legacyReport.response.ok) throw new Error('legacy_runtime_report_failed');
    assertReportMatchesOracle(legacyReport.body, legacyExpected, 'legacy');
    console.log('LEGACY_MISSING_PERFORMANCE_RUNTIME=PASS');
  } else {
    console.log('LEGACY_MISSING_PERFORMANCE_RUNTIME=NO_FIXTURE');
  }

  console.log('REPORTS_V1_STAGING=PASS');
  console.log('EDUCATOR_AUTH=PASS');
  console.log('INDEPENDENT_ORACLE=PASS');
  console.log('CANONICAL_SUMMARY=PASS');
  console.log('MODULE_PROGRESS=PASS');
  console.log('ASSIGNMENT_PROGRESS=PASS');
  console.log('ERROR_SUMMARY=PASS');
  console.log('READ_ONLY_INVARIANT=PASS');
  console.log('STUDENT_ID_SHA256=' + crypto.createHash('sha256').update(String(fixture.student_id)).digest('hex'));
} catch (error) {
  console.error('REPORTS_V1_STAGING=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
} finally {
  if (crossAcademyLinkCreated && crossAcademyStudentId) {
    await sql`
      DELETE FROM public.teacher_student_links
      WHERE teacher_id = (
        SELECT id FROM public.users WHERE auth_user_id = ${educatorAuthUserId} LIMIT 1
      )
        AND student_id = ${crossAcademyStudentId}::uuid
    `.catch(() => undefined);
  }
  if (educatorSessionId) {
    await sql`
      DELETE FROM public.educator_sessions
      WHERE id = ${educatorSessionId}::uuid
        AND user_agent = ${marker}
    `.catch(() => undefined);
  }
}
