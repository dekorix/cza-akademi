import { type NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;
export const assessmentLearningBridgeEnabled = () => process.env.CZA_ASSESSMENT_LEARNING_BRIDGE === '1';

/** One canonical training session, with the assessment UUID and existing student.
 * Assessment attempts remain the authoritative typed response extension: an
 * unassessable answer must never become a false question_attempts.is_correct.
 */
export function assessmentTrainingSession(sql: Sql, sessionId: string) {
  return sql`
    INSERT INTO public.training_sessions (
      id, academy_id, student_id, module_code, source, status, started_at,
      client_session_id, completion_client_record_id, settings_snapshot, engine_id, engine_version
    )
    SELECT a.id, s.academy_id, a.student_id, 'development_assessment', 'free_practice',
      'in_progress', a.started_at, a.id, a.id,
      jsonb_build_object('assessmentSessionId', a.id, 'definitionContract', a.definition_contract),
      'CZA_INITIAL_ASSESSMENT', 'T4_P2_V1'
    FROM public.assessment_sessions a JOIN public.students s ON s.id=a.student_id
    WHERE a.id=${sessionId}::uuid AND a.status IN ('active','completed')
    ON CONFLICT (id) DO UPDATE SET id=CASE
      WHEN training_sessions.student_id=EXCLUDED.student_id
       AND training_sessions.academy_id=EXCLUDED.academy_id
       AND training_sessions.module_code=EXCLUDED.module_code
       AND training_sessions.settings_snapshot->>'assessmentSessionId'=EXCLUDED.id::text
      THEN training_sessions.id ELSE NULL END
  `;
}

/** Called inside the same transaction as completion. Immutable inserts and
 * deterministic IDs make finish retries/concurrent submissions idempotent.
 * The existing record schema only permits a client-reported envelope; its
 * server-derived evidence is labelled separately, without widening DB rights.
 */
export function assessmentLearningCompletion(sql: Sql, sessionId: string, studentSessionId: string, moduleVersion='T4_P2_V1', verificationAuthority='CZA_T4_P2_SERVER_EVALUATOR') {
  return [
    sql`
      SELECT 1 / CASE WHEN NOT EXISTS (
        SELECT 1 FROM public.learning_records r JOIN public.assessment_sessions a ON a.id=${sessionId}::uuid
        JOIN public.students s ON s.id=a.student_id
        WHERE r.id=a.id AND (r.student_id<>a.student_id OR r.academy_id<>s.academy_id
          OR r.training_session_id<>a.id OR r.module_code<>'development_assessment'
          OR r.metadata->>'assessmentSessionId' IS DISTINCT FROM a.id::text)
      ) AND NOT EXISTS (
        SELECT 1 FROM public.learning_evidence e JOIN public.assessment_sessions a ON a.id=${sessionId}::uuid
        JOIN public.students s ON s.id=a.student_id
        WHERE e.id=a.id AND (e.student_id<>a.student_id OR e.academy_id<>s.academy_id
          OR e.learning_record_id<>a.id OR e.payload->>'assessmentSessionId' IS DISTINCT FROM a.id::text)
      ) THEN 1 ELSE 0 END AS identity_guard
    `,
    sql`
      UPDATE public.training_sessions t SET status='completed', completed_at=a.completed_at,
        answered_count=(SELECT count(*) FROM public.assessment_attempts WHERE session_id=a.id),
        correct_count=(SELECT count(*) FROM public.assessment_attempts WHERE session_id=a.id AND server_evaluation->>'verdict'='correct'),
        wrong_count=(SELECT count(*) FROM public.assessment_attempts WHERE session_id=a.id AND server_evaluation->>'verdict'='incorrect'),
        question_count=(SELECT count(DISTINCT task_code) FROM public.assessment_attempts WHERE session_id=a.id),
        last_activity_at=a.completed_at
      FROM public.assessment_sessions a
      WHERE a.id=${sessionId}::uuid AND a.status='completed' AND t.id=a.id AND t.student_id=a.student_id
    `,
    sql`
      WITH result AS (
        SELECT a.id, a.student_id, s.academy_id, a.started_at, a.completed_at,
          jsonb_build_object('assessmentSessionId',a.id,'attemptCount',count(at.id),
            'correctCount',count(at.id) FILTER (WHERE at.server_evaluation->>'verdict'='correct'),
            'incorrectCount',count(at.id) FILTER (WHERE at.server_evaluation->>'verdict'='incorrect'),
            'unassessable',count(at.id) FILTER (WHERE at.server_evaluation->>'verdict'='unassessable'),
            'source','assessment_attempts') AS performance,
          jsonb_build_object('assessmentSessionId',a.id,'definitionContract',a.definition_contract,
            'attemptIds',COALESCE(jsonb_agg(at.id ORDER BY at.created_at,at.id) FILTER (WHERE at.id IS NOT NULL),'[]'::jsonb)) AS metadata
        FROM public.assessment_sessions a JOIN public.students s ON s.id=a.student_id
        LEFT JOIN public.assessment_attempts at ON at.session_id=a.id
        WHERE a.id=${sessionId}::uuid AND a.status='completed'
        GROUP BY a.id,s.academy_id
      )
      INSERT INTO public.learning_records (
        id,academy_id,student_id,module_code,training_session_id,client_record_id,payload_hash,
        contract_version,schema_version,module_version,activity_type,started_at,completed_at,
        support_level,performance,skills,metadata,student_session_id,record_origin,verification_status
      )
      SELECT id,academy_id,student_id,'development_assessment',id,id,
        encode(sha256(convert_to((performance || metadata)::text,'UTF8')),'hex'),
        '1.1.0','CZA_MODULE_RECORD_V1',${moduleVersion},'initial_assessment',started_at,completed_at,
        'unknown',performance,'[]'::jsonb,metadata,${studentSessionId}::uuid,'client_reported','client_reported'
      FROM result ON CONFLICT (id) DO NOTHING
    `,
    sql`
      INSERT INTO public.learning_evidence (
        id,learning_record_id,academy_id,student_id,evidence_type,support_level,observed_at,
        payload,verification_status,verification_authority
      ) SELECT r.id,r.id,r.academy_id,r.student_id,'activity_result','unknown',r.completed_at,
        r.performance || jsonb_build_object('attemptIds',r.metadata->'attemptIds',
          'verificationScope','Persisted attempt identities and server-derived counts; unassessable responses are not scored'),
        'server_verified',${verificationAuthority}
      FROM public.learning_records r JOIN public.assessment_sessions a ON a.id=r.id AND a.student_id=r.student_id
      WHERE r.id=${sessionId}::uuid AND a.status='completed'
      ON CONFLICT (id) DO NOTHING
    `,
  ];
}
