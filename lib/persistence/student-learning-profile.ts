import { resolveEvidenceProvenance, type ReportProvenance } from '@/lib/persistence/educator-analytics';

type QueryClient = { query: (text: string, params?: unknown[]) => Promise<Record<string, unknown>[]> };

export type LearningProfile = {
  student: { id: string; name: string; recordedFrom: string | null };
  calculatedAt: string;
  dataThrough: string | null;
  coverage: { assignments: number; sessions: number; attempts: number; records: number; evidence: number };
  studyPattern: {
    assignments: { active: number; completed: number; cancelled: number };
    sessions: { total: number; completed: number; activeDaysLast30: number; lastStudyAt: string | null };
    provenance: 'SERVER_AUTHORITATIVE';
  };
  modules: Array<{
    moduleCode: string; moduleName: string; assignments: number; sessions: number;
    records: number; attempts: number; clientReportedAccuracy: number | null;
    provenance: ReportProvenance; sourceReferences: string[];
  }>;
  skills: Array<{
    skillCode: string; moduleCode: string; recordCount: number;
    provenance: Exclude<ReportProvenance, 'MIXED'>; sourceReferences: string[];
  }>;
  errors: Array<{ errorType: string; count: number; provenance: 'CLIENT_REPORTED'; sourceReference: string }>;
  process: {
    supportLevels: Array<{ supportLevel: string; count: number; provenance: Exclude<ReportProvenance, 'MIXED'> }>;
    strategy: null; selfCorrection: null; repetition: null; transfer: null;
    insufficiencyReason: string | null;
  };
  periods: Array<{
    label: 'LAST_30_DAYS' | 'PREVIOUS_30_DAYS'; from: string; to: string;
    sessions: number; records: number; attempts: number; clientReportedAccuracy: number | null;
    provenance: ReportProvenance;
  }>;
  coaching?: { activePrograms:number;publishedPlans:number;studyLogs:number;examResults:number;meetings:number;latestGoal:Record<string,unknown>|null;latestPlan:Record<string,unknown>|null;latestExam:Record<string,unknown>|null;latestTask:Record<string,unknown>|null;performanceProvenance:'CLIENT_REPORTED';sourceReference:string };
};

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function timestamp(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function textArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').slice(0, 5) : [];
}

export async function readStudentLearningProfile({ sql, academyId, studentId, calculatedAt = new Date() }: {
  sql: QueryClient; academyId: string; studentId: string; calculatedAt?: Date;
}): Promise<LearningProfile | null> {
  const params = [academyId, studentId];
  const [identityRows, coverageRows, moduleRows, skillRows, errorRows, supportRows, periodRows] = await Promise.all([
    sql.query(`SELECT s.id,concat_ws(' ',s.first_name,s.last_name) name,
      LEAST(minimum.recipe_at,minimum.session_at,minimum.record_at) recorded_from
      FROM public.students s
      LEFT JOIN LATERAL (SELECT
        (SELECT min(created_at) FROM public.training_recipes WHERE academy_id=s.academy_id AND student_id=s.id) recipe_at,
        (SELECT min(started_at) FROM public.training_sessions WHERE academy_id=s.academy_id AND student_id=s.id) session_at,
        (SELECT min(completed_at) FROM public.learning_records WHERE academy_id=s.academy_id AND student_id=s.id) record_at
      ) minimum ON true
      WHERE s.academy_id=$1::uuid AND s.id=$2::uuid AND s.status='active' GROUP BY s.id,minimum.recipe_at,minimum.session_at,minimum.record_at`, params),
    sql.query(`SELECT
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid) assignments,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid) sessions,
      (SELECT count(*)::int FROM public.question_attempts WHERE academy_id=$1::uuid AND student_id=$2::uuid) attempts,
      (SELECT count(*)::int FROM public.learning_records WHERE academy_id=$1::uuid AND student_id=$2::uuid) records,
      (SELECT count(*)::int FROM public.learning_evidence WHERE academy_id=$1::uuid AND student_id=$2::uuid) evidence,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid AND is_active AND cancelled_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.recipe_id=training_recipes.id AND s.status='completed')) active_assignments,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid AND cancelled_at IS NULL AND EXISTS (SELECT 1 FROM public.training_sessions s WHERE s.recipe_id=training_recipes.id AND s.status='completed')) completed_assignments,
      (SELECT count(*)::int FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid AND cancelled_at IS NOT NULL) cancelled_assignments,
      (SELECT count(*)::int FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid AND status='completed') completed_sessions,
      (SELECT count(DISTINCT started_at::date)::int FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid AND started_at >= $3::timestamptz - interval '30 days') active_days_30,
      (SELECT max(COALESCE(completed_at,last_activity_at,started_at)) FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid) last_study_at,
      GREATEST(
        (SELECT max(created_at) FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid),
        (SELECT max(COALESCE(completed_at,last_activity_at,started_at)) FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid),
        (SELECT max(created_at) FROM public.question_attempts WHERE academy_id=$1::uuid AND student_id=$2::uuid),
        (SELECT max(completed_at) FROM public.learning_records WHERE academy_id=$1::uuid AND student_id=$2::uuid),
        (SELECT max(observed_at) FROM public.learning_evidence WHERE academy_id=$1::uuid AND student_id=$2::uuid)
      ) data_through`, [...params, calculatedAt.toISOString()]),
    sql.query(`WITH module_keys AS (
      SELECT module_code FROM public.training_recipes WHERE academy_id=$1::uuid AND student_id=$2::uuid
      UNION SELECT module_code FROM public.training_sessions WHERE academy_id=$1::uuid AND student_id=$2::uuid
      UNION SELECT module_code FROM public.question_attempts WHERE academy_id=$1::uuid AND student_id=$2::uuid
      UNION SELECT module_code FROM public.learning_records WHERE academy_id=$1::uuid AND student_id=$2::uuid
    ) SELECT k.module_code,COALESCE(m.name,k.module_code) module_name,
      (SELECT count(*)::int FROM public.training_recipes r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code) assignments,
      (SELECT count(*)::int FROM public.training_sessions s WHERE s.academy_id=$1::uuid AND s.student_id=$2::uuid AND s.module_code=k.module_code) sessions,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code) records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code AND (r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified')) client_records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code AND r.record_origin='server_authoritative' AND r.verification_status='server_verified') trusted_records,
      (SELECT count(*)::int FROM public.question_attempts a WHERE a.academy_id=$1::uuid AND a.student_id=$2::uuid AND a.module_code=k.module_code) attempts,
      (SELECT count(*) FILTER(WHERE a.is_correct)::int FROM public.question_attempts a WHERE a.academy_id=$1::uuid AND a.student_id=$2::uuid AND a.module_code=k.module_code) correct,
      ARRAY_REMOVE(ARRAY[
        CASE WHEN EXISTS(SELECT 1 FROM public.training_recipes r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code) THEN 'training_recipes' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.training_sessions s WHERE s.academy_id=$1::uuid AND s.student_id=$2::uuid AND s.module_code=k.module_code) THEN 'training_sessions' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.question_attempts a WHERE a.academy_id=$1::uuid AND a.student_id=$2::uuid AND a.module_code=k.module_code) THEN 'question_attempts' END,
        CASE WHEN EXISTS(SELECT 1 FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.module_code=k.module_code) THEN 'learning_records' END
      ],NULL) source_references
      FROM module_keys k LEFT JOIN public.modules m ON m.code=k.module_code ORDER BY k.module_code LIMIT 24`, params),
    sql.query(`WITH raw_skill_sources AS (
      SELECT e.skill_code,r.module_code,r.id::text source_key,'evidence:'||e.id::text source_reference,e.observed_at,
        e.verification_authority='work_center_completion:v1' OR r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified' is_client,
        e.verification_status='server_verified' AND e.verification_authority='canonical_server_evaluator:v1'
          AND r.record_origin='server_authoritative' AND r.verification_status='server_verified' is_trusted
      FROM public.learning_evidence e JOIN public.learning_records r
        ON r.id=e.learning_record_id AND r.academy_id=e.academy_id AND r.student_id=e.student_id
      WHERE e.academy_id=$1::uuid AND e.student_id=$2::uuid AND e.skill_code IS NOT NULL
      UNION ALL
      SELECT skill.value,r.module_code,r.id::text,'record:'||r.id::text,r.completed_at,true,false
      FROM public.learning_records r
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(r.skills)='array' THEN r.skills ELSE '[]'::jsonb END
      ) skill(value)
      WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid
    ), skill_sources AS (
      SELECT DISTINCT ON (skill_code,module_code,source_key)
        skill_code,module_code,source_key,source_reference,observed_at,is_client,is_trusted
      FROM raw_skill_sources
      ORDER BY skill_code,module_code,source_key,is_trusted DESC,source_reference
    ) SELECT skill_code,module_code,count(*)::int record_count,
      (array_agg(DISTINCT source_reference ORDER BY source_reference))[1:5] source_references,
      bool_or(is_client) has_client,bool_and(is_trusted) all_trusted,max(observed_at) last_observed_at
      FROM skill_sources GROUP BY skill_code,module_code
      ORDER BY last_observed_at DESC,skill_code LIMIT 24`, params),
    sql.query(`SELECT error_type,count(DISTINCT id)::int count FROM public.question_attempts
      WHERE academy_id=$1::uuid AND student_id=$2::uuid AND NOT is_correct
      GROUP BY error_type ORDER BY count DESC,error_type LIMIT 12`, params),
    sql.query(`SELECT support_level,record_origin,verification_status,count(*)::int count
      FROM public.learning_records WHERE academy_id=$1::uuid AND student_id=$2::uuid
      GROUP BY support_level,record_origin,verification_status ORDER BY support_level,record_origin,verification_status`, params),
    sql.query(`WITH periods(label,from_at,to_at) AS (VALUES
      ('LAST_30_DAYS'::text,$3::timestamptz-interval '30 days',$3::timestamptz),
      ('PREVIOUS_30_DAYS'::text,$3::timestamptz-interval '60 days',$3::timestamptz-interval '30 days')
    ) SELECT p.label,p.from_at,p.to_at,
      (SELECT count(*)::int FROM public.training_sessions s WHERE s.academy_id=$1::uuid AND s.student_id=$2::uuid AND s.started_at>=p.from_at AND s.started_at<p.to_at) sessions,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at) records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at AND (r.record_origin<>'server_authoritative' OR r.verification_status<>'server_verified')) client_records,
      (SELECT count(*)::int FROM public.learning_records r WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid AND r.completed_at>=p.from_at AND r.completed_at<p.to_at AND r.record_origin='server_authoritative' AND r.verification_status='server_verified') trusted_records,
      (SELECT count(*)::int FROM public.question_attempts a WHERE a.academy_id=$1::uuid AND a.student_id=$2::uuid AND a.created_at>=p.from_at AND a.created_at<p.to_at) attempts,
      (SELECT count(*) FILTER(WHERE a.is_correct)::int FROM public.question_attempts a WHERE a.academy_id=$1::uuid AND a.student_id=$2::uuid AND a.created_at>=p.from_at AND a.created_at<p.to_at) correct
      FROM periods p ORDER BY p.from_at DESC`, [...params, calculatedAt.toISOString()]),
  ]);

  if (!identityRows.length) return null;
  const identity = identityRows[0];
  const coverage = coverageRows[0] || {};
  const supportLevels = supportRows.map((row) => ({
    supportLevel: String(row.support_level), count: integer(row.count),
    provenance: row.record_origin === 'server_authoritative' && row.verification_status === 'server_verified'
      ? 'SERVER_AUTHORITATIVE' as const : 'CLIENT_REPORTED' as const,
  }));
  return {
    student: { id: String(identity.id), name: typeof identity.name === 'string' && identity.name.trim() ? identity.name : 'Öğrenci', recordedFrom: timestamp(identity.recorded_from) },
    calculatedAt: calculatedAt.toISOString(), dataThrough: timestamp(coverage.data_through),
    coverage: { assignments: integer(coverage.assignments), sessions: integer(coverage.sessions), attempts: integer(coverage.attempts), records: integer(coverage.records), evidence: integer(coverage.evidence) },
    studyPattern: {
      assignments: { active: integer(coverage.active_assignments), completed: integer(coverage.completed_assignments), cancelled: integer(coverage.cancelled_assignments) },
      sessions: { total: integer(coverage.sessions), completed: integer(coverage.completed_sessions), activeDaysLast30: integer(coverage.active_days_30), lastStudyAt: timestamp(coverage.last_study_at) },
      provenance: 'SERVER_AUTHORITATIVE',
    },
    modules: moduleRows.map((row) => {
      const attempts = integer(row.attempts); const sources = textArray(row.source_references);
      const hasServer = integer(row.assignments) > 0 || integer(row.sessions) > 0 || integer(row.trusted_records) > 0;
      const hasClient = attempts > 0 || integer(row.client_records) > 0;
      return { moduleCode: String(row.module_code), moduleName: String(row.module_name), assignments: integer(row.assignments), sessions: integer(row.sessions), records: integer(row.records), attempts,
        clientReportedAccuracy: attempts ? Math.round(integer(row.correct) * 1000 / attempts) / 10 : null,
        provenance: hasServer && hasClient ? 'MIXED' : hasClient ? 'CLIENT_REPORTED' : 'SERVER_AUTHORITATIVE', sourceReferences: sources };
    }),
    skills: skillRows.map((row) => ({ skillCode: String(row.skill_code), moduleCode: String(row.module_code), recordCount: integer(row.record_count),
      provenance: resolveEvidenceProvenance({ authority: row.has_client === true ? 'work_center_completion:v1' : row.all_trusted === true ? 'canonical_server_evaluator:v1' : null,
        evidenceVerificationStatus: row.all_trusted === true ? 'server_verified' : 'client_reported', parentRecordOrigin: row.all_trusted === true ? 'server_authoritative' : 'client_reported', parentVerificationStatus: row.all_trusted === true ? 'server_verified' : 'client_reported' }),
      sourceReferences: textArray(row.source_references) })),
    errors: errorRows.map(row => ({ errorType: String(row.error_type), count: integer(row.count), provenance: 'CLIENT_REPORTED', sourceReference: 'question_attempts' })),
    process: { supportLevels, strategy: null, selfCorrection: null, repetition: null, transfer: null,
      insufficiencyReason: supportLevels.length ? null : 'Yardım, strateji, öz-düzeltme, tekrar veya transfer için yeterli kayıt yok.' },
    periods: periodRows.map(row => { const attempts = integer(row.attempts);
      const hasServer = integer(row.sessions) > 0 || integer(row.trusted_records) > 0;
      const hasClient = attempts > 0 || integer(row.client_records) > 0;
      return {
      label: String(row.label) as 'LAST_30_DAYS' | 'PREVIOUS_30_DAYS', from: timestamp(row.from_at)!, to: timestamp(row.to_at)!,
      sessions: integer(row.sessions), records: integer(row.records), attempts,
      clientReportedAccuracy: attempts ? Math.round(integer(row.correct) * 1000 / attempts) / 10 : null,
      provenance: hasServer && hasClient ? 'MIXED' : hasClient ? 'CLIENT_REPORTED' : 'SERVER_AUTHORITATIVE',
    }; }),
  };
}
