import process from 'node:process';
import crypto from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { buildSpecialLearningProfile } from '../../lib/special-learning-profile.ts';
import { buildSpecialEducationProgramDraft } from '../../lib/special-education-program.ts';
import { buildSpecialDailyWork } from '../../lib/special-daily-work.ts';
import { buildSpecialReassessmentPlan, compareSpecialReassessment } from '../../lib/special-reassessment.ts';

const url = process.env.CZA_STAGING_DATABASE_URL || '';
if (!url) {
  console.error('SPECIAL_PROGRAM_STAGING=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}
const parsed = new URL(url);
if (!parsed.hostname.endsWith('.neon.tech') || parsed.pathname !== '/cza_learning') {
  console.error('SPECIAL_PROGRAM_STAGING=BLOCKED');
  console.error('REASON=TARGET_NOT_APPROVED_STAGING');
  process.exit(2);
}

const sql = neon(url);
const sessionId = crypto.randomUUID();
let programId = '';

async function cleanup() {
  try {
    if (programId) await sql`DELETE FROM public.special_education_programs WHERE id=${programId}::uuid`;
  } catch {}
  try {
    await sql`DELETE FROM public.assessment_sessions WHERE id=${sessionId}::uuid`;
  } catch {}
}

try {
  const synthetic = await sql`
    SELECT DISTINCT s.id AS student_id, s.academy_id, educator.id AS educator_user_id
    FROM public.students s
    JOIN public.users student_user ON student_user.id=s.user_id
    JOIN public.teacher_student_links link ON link.student_id=s.id AND link.can_view=true
    JOIN public.users educator ON educator.id=link.teacher_id AND educator.is_active=true
    LEFT JOIN public.student_external_identifiers ext
      ON ext.student_id=s.id AND ext.identifier_type='campus_student_code'
    WHERE s.status='active'
      AND (
        lower(student_user.username) LIKE '%synthetic%'
        OR lower(student_user.username) LIKE '%sentetik%'
        OR lower(student_user.username) LIKE 'qa-%'
        OR lower(student_user.username) LIKE 'test-%'
        OR lower(COALESCE(ext.identifier_value,'')) LIKE 'cza-qa-%'
        OR lower(COALESCE(ext.identifier_value,'')) LIKE 'qa-%'
      )
    ORDER BY s.id
    LIMIT 1
  `;
  if (!synthetic.length) throw new Error('synthetic_linked_student_missing');

  const studentId=String(synthetic[0].student_id);
  const academyId=String(synthetic[0].academy_id);
  const educatorUserId=String(synthetic[0].educator_user_id);

  await sql`
    INSERT INTO public.assessment_sessions(
      id,template_code,student_id,student_label,status,started_at,completed_at,metadata
    ) VALUES(
      ${sessionId}::uuid,'CZA_SPECIAL_V1_DYS',${studentId}::uuid,'CZA QA SENTETİK',
      'completed',now()-interval '10 minutes',now(),
      ${JSON.stringify({profileCode:'SP-DYS',source:'SYNTHETIC_QA',diagnosticUse:false})}::jsonb
    )
  `;

  for (const [taskCode, verdict, supportLevel, supportNumber, flag] of [
    ['DYS-LS01','DIFFERENT','MODELED',3,'Uzun arama / gecikme'],
    ['DYS-LS02','PARTIAL','VERBAL_PROMPT',1,'b–d karıştı'],
    ['DYS-BL01','PARTIAL','VERBAL_PROMPT',1,'Hece düzeyinde kaldı'],
    ['DYS-BL02','MATCH','INDEPENDENT',0,'Kendini düzeltti'],
  ]) {
    await sql`
      INSERT INTO public.assessment_attempts(
        session_id,task_code,shown_at,completed_at,answer_text,answer_payload,
        support_level,self_corrected,response_latency_ms,total_response_time_ms
      ) VALUES(
        ${sessionId}::uuid,${taskCode},now()-interval '2 minutes',now(),
        'synthetic',
        ${JSON.stringify({
          profileCode:'SP-DYS',verdict,supportLevel,flags:[flag],
          area:taskCode.startsWith('DYS-LS')?'Harf–Ses Otomatikliği':'Hece Birleştirme ve Köprüleme',
          source:'SYNTHETIC_QA',schemaVersion:1
        })}::jsonb,
        ${supportNumber},
        ${flag==='Kendini düzeltti'},
        1200,2200
      )
    `;
    await sql`
      INSERT INTO public.assessment_observations(
        session_id,task_code,observation_codes,educator_note,confidence
      ) VALUES(
        ${sessionId}::uuid,${taskCode},${JSON.stringify([flag])}::jsonb,
        'synthetic special program staging proof',5
      )
    `;
  }

  const [attempts,observations] = await Promise.all([
    sql`SELECT task_code,answer_payload,support_level FROM public.assessment_attempts WHERE session_id=${sessionId}::uuid ORDER BY created_at`,
    sql`SELECT task_code,observation_codes FROM public.assessment_observations WHERE session_id=${sessionId}::uuid ORDER BY created_at`,
  ]);

  const profile = buildSpecialLearningProfile({
    session:{id:sessionId,template_code:'CZA_SPECIAL_V1_DYS',completed_at:new Date().toISOString(),metadata:{profileCode:'SP-DYS'}},
    attempts,
    observations,
  });
  if (!profile || profile.evidenceCount !== 4) throw new Error('profile_build_failed');

  const draft=buildSpecialEducationProgramDraft(profile,{sessionsPerWeek:3,sessionMinutes:25});
  if (!draft.priorities.length || draft.weeks.length!==4) throw new Error('program_draft_failed');

  const inserted=await sql`
    INSERT INTO public.special_education_programs(
      academy_id,student_id,assessment_session_id,profile_code,version,status,
      duration_weeks,sessions_per_week,session_minutes,plan,approved_by,approved_at,starts_at,ends_at
    ) VALUES(
      ${academyId}::uuid,${studentId}::uuid,${sessionId}::uuid,'SP-DYS',1,'active',
      4,${draft.sessionsPerWeek},${draft.sessionMinutes},${JSON.stringify(draft)}::jsonb,
      ${educatorUserId}::uuid,now(),now(),now()+interval '28 days'
    )
    RETURNING id
  `;
  programId=String(inserted[0].id);

  const readback=await sql`
    SELECT p.id,p.student_id,p.assessment_session_id,p.profile_code,p.status,
           p.duration_weeks,p.sessions_per_week,p.session_minutes,
           p.plan->>'profileCode' AS plan_profile,
           jsonb_array_length(p.plan->'weeks') AS week_count
    FROM public.special_education_programs p
    WHERE p.id=${programId}::uuid
    LIMIT 1
  `;
  if (readback.length!==1) throw new Error('program_readback_missing');
  const row=readback[0];
  const checks={
    student:String(row.student_id)===studentId,
    assessment:String(row.assessment_session_id)===sessionId,
    profile:row.profile_code==='SP-DYS' && row.plan_profile==='SP-DYS',
    active:row.status==='active',
    duration:Number(row.duration_weeks)===4 && Number(row.week_count)===4,
    cadence:Number(row.sessions_per_week)===3 && Number(row.session_minutes)===25,
  };
  if (Object.values(checks).some(value=>value!==true)) throw new Error('program_readback_mismatch:'+JSON.stringify(checks));

  const daily=buildSpecialDailyWork(draft,0);
  if (!daily || daily.sessionIndex!==1 || daily.week!==1) throw new Error('daily_work_build_failed');

  const dailyRows=await sql`
    INSERT INTO public.special_education_program_sessions(
      program_id,academy_id,student_id,session_index,week_no,session_in_week,
      status,plan_snapshot,student_reflection,started_at
    ) VALUES(
      ${programId}::uuid,${academyId}::uuid,${studentId}::uuid,
      ${daily.sessionIndex},${daily.week},${daily.sessionInWeek},
      'in_progress',${JSON.stringify(daily)}::jsonb,'{}'::jsonb,now()
    )
    RETURNING id
  `;
  const dailySessionId=String(dailyRows[0].id);

  await sql`
    UPDATE public.special_education_program_sessions
    SET status='completed',
        completed_at=now(),
        updated_at=now(),
        student_reflection=${JSON.stringify({
          reflection:'OKAY',
          note:'synthetic daily staging proof',
          completedPriorityKeys:daily.priorityKeys,
          source:'SYNTHETIC_QA',
          schemaVersion:1
        })}::jsonb
    WHERE id=${dailySessionId}::uuid
  `;

  const dailyReadback=await sql`
    SELECT s.id,s.session_index,s.week_no,s.session_in_week,s.status,
           s.plan_snapshot->>'title' AS title,
           s.student_reflection->>'reflection' AS reflection,
           jsonb_array_length(s.student_reflection->'completedPriorityKeys') AS completed_goal_count,
           (
             SELECT count(*)::int
             FROM public.special_education_program_sessions x
             WHERE x.program_id=s.program_id AND x.status='completed'
           ) AS completed_sessions
    FROM public.special_education_program_sessions s
    WHERE s.id=${dailySessionId}::uuid
    LIMIT 1
  `;
  if (dailyReadback.length!==1) throw new Error('daily_session_readback_missing');
  const dailyRow=dailyReadback[0];
  const dailyChecks={
    index:Number(dailyRow.session_index)===1,
    week:Number(dailyRow.week_no)===1 && Number(dailyRow.session_in_week)===1,
    completed:dailyRow.status==='completed',
    reflection:dailyRow.reflection==='OKAY',
    goals:Number(dailyRow.completed_goal_count)===daily.priorityKeys.length,
    progress:Number(dailyRow.completed_sessions)===1,
  };
  if (Object.values(dailyChecks).some(value=>value!==true)) throw new Error('daily_session_readback_mismatch:'+JSON.stringify(dailyChecks));

  await sql`
    UPDATE public.special_education_programs
    SET status='completed', completed_at=now(), updated_at=now()
    WHERE id=${programId}::uuid
  `;

  const reassessmentPlan=buildSpecialReassessmentPlan(profile,{id:programId,plan:draft});
  const reassessmentInputs=reassessmentPlan.areas.map(area=>({
    key:area.key,
    label:area.label,
    probes:[
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'MATCH',support:'INDEPENDENT',flags:[]},
      {verdict:'PARTIAL',support:'VERBAL_PROMPT',flags:[]},
    ],
  }));
  const comparison=compareSpecialReassessment(profile,{id:programId,plan:draft},reassessmentInputs);
  if (!comparison.areas.length || comparison.overallOutcome==='INSUFFICIENT') throw new Error('reassessment_compare_failed');

  const reassessmentRows=await sql`
    INSERT INTO public.special_education_reassessments(
      program_id,academy_id,student_id,baseline_session_id,profile_code,status,
      plan,evidence,comparison,completed_by,completed_at
    ) VALUES(
      ${programId}::uuid,${academyId}::uuid,${studentId}::uuid,${sessionId}::uuid,
      'SP-DYS','completed',
      ${JSON.stringify(reassessmentPlan)}::jsonb,
      ${JSON.stringify(reassessmentInputs)}::jsonb,
      ${JSON.stringify(comparison)}::jsonb,
      ${educatorUserId}::uuid,now()
    )
    RETURNING id
  `;
  const reassessmentId=String(reassessmentRows[0].id);

  const reassessmentReadback=await sql`
    SELECT id,program_id,baseline_session_id,profile_code,status,
           comparison->>'overallOutcome' AS overall_outcome,
           comparison->>'nextDecision' AS next_decision,
           jsonb_array_length(comparison->'areas') AS area_count
    FROM public.special_education_reassessments
    WHERE id=${reassessmentId}::uuid
    LIMIT 1
  `;
  if (reassessmentReadback.length!==1) throw new Error('reassessment_readback_missing');
  const reassessmentRow=reassessmentReadback[0];
  const reassessmentChecks={
    program:String(reassessmentRow.program_id)===programId,
    baseline:String(reassessmentRow.baseline_session_id)===sessionId,
    profile:reassessmentRow.profile_code==='SP-DYS',
    completed:reassessmentRow.status==='completed',
    outcome:Boolean(reassessmentRow.overall_outcome),
    decision:Boolean(reassessmentRow.next_decision),
    areas:Number(reassessmentRow.area_count)===comparison.areas.length,
  };
  if (Object.values(reassessmentChecks).some(value=>value!==true)) throw new Error('reassessment_readback_mismatch:'+JSON.stringify(reassessmentChecks));

  await cleanup();

  const residue=await sql`
    SELECT
      (SELECT count(*)::int FROM public.special_education_programs WHERE id=${programId}::uuid) AS programs,
      (SELECT count(*)::int FROM public.assessment_sessions WHERE id=${sessionId}::uuid) AS sessions
  `;
  if (Number(residue[0]?.programs)!==0 || Number(residue[0]?.sessions)!==0) throw new Error('cleanup_failed');

  console.log('SPECIAL_PROGRAM_STAGING=PASS');
  console.log('SYNTHETIC_LINKED_STUDENT=FOUND');
  console.log('PROFILE_BUILD=PASS');
  console.log('PROGRAM_DRAFT=PASS');
  console.log('PROGRAM_WRITE=PASS');
  console.log('PROGRAM_READBACK=PASS');
  console.log('DAILY_WORK_BUILD=PASS');
  console.log('DAILY_SESSION_WRITE=PASS');
  console.log('DAILY_SESSION_READBACK=PASS');
  console.log('DAILY_PROGRESS=PASS');
  console.log('REASSESSMENT_PLAN=PASS');
  console.log('REASSESSMENT_COMPARE=PASS');
  console.log('REASSESSMENT_WRITE=PASS');
  console.log('REASSESSMENT_READBACK=PASS');
  console.log('PROGRAM_CLEANUP=PASS');
} catch (error) {
  await cleanup();
  console.error('SPECIAL_PROGRAM_STAGING=FAIL');
  console.error('ERROR='+(error instanceof Error?error.message:String(error)));
  process.exit(1);
}
