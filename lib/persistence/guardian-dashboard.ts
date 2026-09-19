import { readStudentLearningProfile } from '@/lib/persistence/student-learning-profile';
import { readEducatorAnalytics,type ReportFilters } from '@/lib/persistence/educator-analytics';
import { readCoachingCenter } from '@/lib/persistence/coaching-center';

type QueryClient={query:(text:string,params?:unknown[])=>Promise<Record<string,unknown>[]>};

function number(value:unknown){const n=Number(value);return Number.isFinite(n)?n:0;}
function timestamp(value:unknown){if(value instanceof Date)return value.toISOString();if(typeof value==='string'&&!Number.isNaN(Date.parse(value)))return new Date(value).toISOString();return null;}
function assignmentStatus(row:Record<string,unknown>){
  if(row.cancelled_at)return 'cancelled';
  if(row.completed_session_id)return 'completed';
  if(row.active_session_id)return 'in_progress';
  const starts=timestamp(row.starts_at),expires=timestamp(row.expires_at);
  if(expires&&Date.parse(expires)<=Date.now())return 'expired';
  if(starts&&Date.parse(starts)>Date.now())return 'upcoming';
  return row.is_active===true?'available':'cancelled';
}

const EMPTY_FILTERS:ReportFilters={from:null,to:null,moduleCode:null,assignmentStatus:null,sessionStatus:null,provenance:null};

export async function readGuardianDashboard({sql,guardianUserId,academyId,studentId}:{sql:QueryClient;guardianUserId:string;academyId:string;studentId:string}){
  const params=[academyId,studentId];
  const [studentRows,assignmentRows,recentRows,profile,report,coaching]=await Promise.all([
    sql.query(`SELECT id,concat_ws(' ',first_name,last_name) name FROM public.students WHERE academy_id=$1::uuid AND id=$2::uuid AND status='active' LIMIT 1`,params),
    sql.query(`
      SELECT r.id,r.module_code,r.name,r.instructions,r.starts_at,r.expires_at,r.is_active,r.cancelled_at,
        r.task_kind,r.academic_subject,r.academic_topic,r.task_purpose,r.created_at,
        active_session.id active_session_id,completed_session.id completed_session_id
      FROM public.training_recipes r
      LEFT JOIN LATERAL (
        SELECT s.id FROM public.training_sessions s WHERE s.recipe_id=r.id AND s.status='active'
        ORDER BY s.last_activity_at DESC,s.id DESC LIMIT 1
      ) active_session ON true
      LEFT JOIN LATERAL (
        SELECT s.id FROM public.training_sessions s WHERE s.recipe_id=r.id AND s.status='completed'
        ORDER BY s.completed_at DESC,s.id DESC LIMIT 1
      ) completed_session ON true
      WHERE r.academy_id=$1::uuid AND r.student_id=$2::uuid
        AND r.source='teacher_assignment'
      ORDER BY r.created_at DESC,r.id DESC LIMIT 20
    `,params),
    sql.query(`
      SELECT s.id,s.module_code,s.status,s.started_at,s.completed_at,s.last_activity_at,
        COALESCE(r.name,m.name,s.module_code) title
      FROM public.training_sessions s
      LEFT JOIN public.training_recipes r ON r.id=s.recipe_id AND r.student_id=s.student_id AND r.academy_id=s.academy_id
      LEFT JOIN public.modules m ON m.code=s.module_code
      WHERE s.academy_id=$1::uuid AND s.student_id=$2::uuid
      ORDER BY COALESCE(s.completed_at,s.last_activity_at,s.started_at) DESC,s.id DESC LIMIT 8
    `,params),
    readStudentLearningProfile({sql,academyId,studentId}),
    readEducatorAnalytics({sql,educatorId:guardianUserId,academyId,studentId,filters:EMPTY_FILTERS,limit:5,cursor:null}),
    readCoachingCenter(sql,{userId:guardianUserId,academyId,studentId,canCoach:false},{studentView:true,includePrivate:false,limit:10}),
  ]);
  if(!studentRows.length)return null;
  const student=studentRows[0];
  const assignments=assignmentRows.map(row=>({
    id:String(row.id),moduleCode:typeof row.module_code==='string'?row.module_code:null,
    title:typeof row.name==='string'&&row.name.trim()?row.name:'Çalışma',
    instructions:typeof row.instructions==='string'?row.instructions:null,
    taskKind:typeof row.task_kind==='string'?row.task_kind:'cza_module',
    subject:typeof row.academic_subject==='string'?row.academic_subject:null,
    topic:typeof row.academic_topic==='string'?row.academic_topic:null,
    purpose:typeof row.task_purpose==='string'?row.task_purpose:'practice',
    status:assignmentStatus(row),startsAt:timestamp(row.starts_at),expiresAt:timestamp(row.expires_at),
  }));
  const recentActivity=recentRows.map(row=>({
    id:String(row.id),moduleCode:String(row.module_code),title:typeof row.title==='string'&&row.title.trim()?row.title:'Çalışma',status:String(row.status),
    startedAt:timestamp(row.started_at),completedAt:timestamp(row.completed_at),lastActivityAt:timestamp(row.last_activity_at),
  }));
  return {
    student:{id:String(student.id),name:typeof student.name==='string'&&student.name.trim()?student.name:'Öğrenci'},
    summary:{
      activeAssignments:assignments.filter(a=>['available','in_progress','upcoming'].includes(a.status)).length,
      completedAssignments:assignments.filter(a=>a.status==='completed').length,
      completedSessions:report.summary.sessions?.completed??0,
      lastStudyAt:report.summary.sessions?.lastActivityAt??null,
      evidenceStatus:report.summary.clientPerformance?.evidenceStatus??'INSUFFICIENT',
    },
    assignments,recentActivity,
    report:{
      summary:report.summary,
      modules:report.modules.slice(0,8),
      errors:report.errors.slice(0,5),
    },
    profile:profile?{
      calculatedAt:profile.calculatedAt,dataThrough:profile.dataThrough,coverage:profile.coverage,studyPattern:profile.studyPattern,
      modules:profile.modules.slice(0,8),skills:profile.skills.slice(0,8),process:profile.process,
    }:null,
    coaching:{
      programs:coaching.programs.map(row=>({id:row.id,programType:row.program_type,examYear:number(row.exam_year),fieldCode:row.field_code,status:row.status})),
      goals:coaching.goals.map(row=>({id:row.id,programId:row.program_id,revision:number(row.revision),target:row.target,provenance:row.provenance,createdAt:timestamp(row.created_at)})),
      plans:coaching.plans.map(row=>({id:row.id,programId:row.program_id,title:row.title,periodStart:row.period_start,periodEnd:row.period_end,status:row.status,items:row.items})),
      exams:coaching.exams.map(row=>({id:row.id,programId:row.program_id,stage:row.stage,examDate:row.exam_date,totalNet:row.total_net,provenance:row.provenance})),
      meetings:coaching.meetings.map(row=>({id:row.id,programId:row.program_id,meetingAt:timestamp(row.meeting_at),sharedSummary:row.shared_summary,nextWeekFocus:row.next_week_focus,studentFeedback:row.student_feedback})),
      performanceProvenance:'CLIENT_REPORTED' as const,
    },
  };
}
