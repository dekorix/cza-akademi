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

function numberField(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error('invalid_numeric_field:' + name);
  }
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

  const response = await fetch(baseUrl + '/api/educator-report', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cookie': 'cza_educator_session=local.' + token,
    },
    body: JSON.stringify({ studentId: String(fixture.student_id) }),
  });
  const body = await response.json();

  if (!response.ok || body?.ok !== true) {
    throw new Error('report_api_failed:' + response.status + ':' + String(body?.error || 'unknown'));
  }
  if (body.reportInsightsAvailable !== true) throw new Error('report_insights_unavailable');
  if (!body.reportInsights || typeof body.reportInsights !== 'object') throw new Error('report_insights_missing');
  if (!Array.isArray(body.moduleProgress)) throw new Error('module_progress_missing');
  if (!body.assignmentProgress || typeof body.assignmentProgress !== 'object') throw new Error('assignment_progress_missing');
  if (!Array.isArray(body.recentAssignments)) throw new Error('recent_assignments_missing');
  if (!Array.isArray(body.errorSummary)) throw new Error('error_summary_missing');

  for (const key of ['sessions','assignmentSessions','independentSessions','totalQuestions','correct','wrong','accuracy','totalDurationMs','timeoutCount','retryCount']) {
    numberField(body.reportInsights[key], 'reportInsights.' + key);
  }
  for (const key of ['total','assigned','started','completed']) {
    numberField(body.assignmentProgress[key], 'assignmentProgress.' + key);
  }
  if (body.reportInsights.sessions < 1) throw new Error('canonical_session_count_expected');
  if (body.moduleProgress.length < 1) throw new Error('module_progress_expected');

  const after = await sql`
    SELECT
      (SELECT count(*)::int FROM public.learning_records WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS learning_records,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS recipes,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id = ${fixture.academy_id}::uuid AND student_id = ${fixture.student_id}::uuid) AS sessions
  `;

  const beforeRow = before[0];
  const afterRow = after[0];
  if (
    Number(beforeRow.learning_records) !== Number(afterRow.learning_records) ||
    Number(beforeRow.recipes) !== Number(afterRow.recipes) ||
    Number(beforeRow.sessions) !== Number(afterRow.sessions)
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
    const denied = await fetch(baseUrl + '/api/educator-report', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'cookie': 'cza_educator_session=local.' + token,
      },
      body: JSON.stringify({ studentId: String(unlinked[0].id) }),
    });
    const deniedBody = await denied.json();
    if (denied.status !== 404 || deniedBody?.error !== 'student_not_found') {
      throw new Error('cross_student_access_not_denied');
    }
    console.log('CROSS_STUDENT_DENY=PASS');
  } else {
    console.log('CROSS_STUDENT_DENY=NO_FIXTURE');
  }

  console.log('REPORTS_V1_STAGING=PASS');
  console.log('EDUCATOR_AUTH=PASS');
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
  if (educatorSessionId) {
    await sql`
      DELETE FROM public.educator_sessions
      WHERE id = ${educatorSessionId}::uuid
        AND user_agent = ${marker}
    `.catch(() => undefined);
  }
}
