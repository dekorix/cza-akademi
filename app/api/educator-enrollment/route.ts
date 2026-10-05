import { neon } from '@neondatabase/serverless';
import { authenticatedEducator } from '@/lib/educator-auth';
import { allowRequest, rateLimited } from '@/lib/request-guard';
import {
  packageCatalog,
  isPackageCode,
  packagePriceSnapshot,
  readyAccessCodes,
  allAccessCodes,
  isPackageFullyReady,
  packageReadiness,
  type ActivationBasis,
} from '@/lib/package-catalog';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DECISIONS=new Set(['APPROVED','DECLINED']);
const ACTIVATION_BASES=new Set<ActivationBasis>(['PAYMENT_CONFIRMED','PILOT_COMPLIMENTARY']);

function json(body:unknown,status=200){
  return Response.json(body,{status,headers:{'cache-control':'no-store'}});
}

export async function POST(request:Request){
  const gate=allowRequest(request,'educator-enrollment',30,10*60_000);
  if(!gate.allowed) return rateLimited(gate.retryAfterSeconds);

  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin){
    return json({ok:false,error:'request_origin_rejected'},403);
  }

  const educator=await authenticatedEducator(request);
  if(!educator?.id) return json({ok:false,error:'educator_session_required'},401);
  if(!process.env.DATABASE_URL) return json({ok:false,error:'database_unavailable'},503);

  let input:Record<string,unknown>;
  try{input=await request.json() as Record<string,unknown>;}
  catch{return json({ok:false,error:'invalid_request'},400);}

  const action=typeof input.action==='string'?input.action:'';
  const studentId=typeof input.studentId==='string'?input.studentId.trim():'';
  if(!UUID.test(studentId)) return json({ok:false,error:'invalid_student_id'},400);

  const sql=neon(process.env.DATABASE_URL);
  const linked=await sql`
    SELECT s.id AS student_id,s.academy_id,t.id AS educator_user_id,
           concat_ws(' ',s.first_name,s.last_name) AS student_name
    FROM public.users t
    JOIN public.teacher_student_links l
      ON l.teacher_id=t.id
      AND l.can_view=true
    JOIN public.students s
      ON s.id=l.student_id
      AND s.academy_id=t.academy_id
    WHERE t.auth_user_id=${educator.id}
      AND t.is_active=true
      AND s.status='active'
      AND s.id=${studentId}::uuid
    LIMIT 1
  `;
  if(!linked.length) return json({ok:false,error:'student_not_linked_to_educator'},403);
  const link=linked[0] as {
    student_id:string;academy_id:string;educator_user_id:string;student_name:string|null;
  };

  if(action==='list'){
    try{
      const [decisions,enrollments,entitlements]=await Promise.all([
        sql`
          SELECT id,package_code,package_label,price_snapshot_try,currency,
                 decision,decided_at,note,created_at
          FROM public.student_package_decisions
          WHERE academy_id=${link.academy_id}::uuid
            AND student_id=${studentId}::uuid
          ORDER BY created_at DESC
          LIMIT 30
        `,
        sql`
          SELECT id,decision_id,package_code,package_label,price_snapshot_try,currency,
                 activation_basis,status,starts_at,ends_at,cancelled_at,created_at
          FROM public.student_package_enrollments
          WHERE academy_id=${link.academy_id}::uuid
            AND student_id=${studentId}::uuid
          ORDER BY created_at DESC
          LIMIT 20
        `,
        sql`
          SELECT e.id,e.enrollment_id,e.access_code,e.status,e.granted_at,e.revoked_at
          FROM public.student_access_entitlements e
          WHERE e.academy_id=${link.academy_id}::uuid
            AND e.student_id=${studentId}::uuid
          ORDER BY e.created_at DESC
          LIMIT 100
        `,
      ]);
      return json({
        ok:true,
        student:{id:studentId,name:link.student_name||'Öğrenci'},
        catalog:Object.values(packageCatalog).map(pack=>({
          code:pack.code,
          label:pack.label,
          priceTry:pack.priceTry,
          description:pack.description,
          access:pack.access,
          readiness:packageReadiness(pack.code),
        })),
        decisions,
        enrollments,
        entitlements,
      });
    }catch{
      return json({ok:false,error:'package_schema_unavailable'},503);
    }
  }

  if(action==='record_decision'){
    const packageCode=typeof input.packageCode==='string'?input.packageCode.trim():'';
    const decision=typeof input.decision==='string'?input.decision.trim().toUpperCase():'';
    const note=typeof input.note==='string'?input.note.trim().slice(0,1000):'';
    if(!isPackageCode(packageCode)) return json({ok:false,error:'invalid_package'},400);
    if(!DECISIONS.has(decision)) return json({ok:false,error:'invalid_parent_decision'},400);

    try{
      const rows=await sql`
        SELECT public.cza_record_student_package_decision(
          ${link.academy_id}::uuid,
          ${studentId}::uuid,
          ${packageCode},
          ${packageCatalog[packageCode].label},
          ${packagePriceSnapshot(packageCode)},
          ${decision},
          now(),
          ${link.educator_user_id}::uuid,
          ${note}
        ) AS decision_id
      `;
      return json({
        ok:true,
        decision:{
          id:String(rows[0]?.decision_id||''),
          packageCode,
          packageLabel:packageCatalog[packageCode].label,
          priceTry:packagePriceSnapshot(packageCode),
          decision,
        },
        activationReady:decision==='APPROVED'&&isPackageFullyReady(packageCode),
        readiness:packageReadiness(packageCode),
      },201);
    }catch{
      return json({ok:false,error:'package_decision_create_failed'},500);
    }
  }

  if(action==='activate'){
    const decisionId=typeof input.decisionId==='string'?input.decisionId.trim():'';
    const activationBasis=typeof input.activationBasis==='string'?input.activationBasis.trim().toUpperCase() as ActivationBasis:'';
    const confirm=input.confirm===true;
    if(!UUID.test(decisionId)) return json({ok:false,error:'invalid_decision_id'},400);
    if(!ACTIVATION_BASES.has(activationBasis as ActivationBasis)) return json({ok:false,error:'invalid_activation_basis'},400);
    if(!confirm) return json({ok:false,error:'package_activation_confirmation_required'},409);

    const decisions=await sql`
      SELECT id,package_code,decision
      FROM public.student_package_decisions
      WHERE id=${decisionId}::uuid
        AND academy_id=${link.academy_id}::uuid
        AND student_id=${studentId}::uuid
      LIMIT 1
    `;
    if(!decisions.length) return json({ok:false,error:'package_decision_not_found'},404);
    const packageCode=String(decisions[0].package_code||'');
    if(!isPackageCode(packageCode)) return json({ok:false,error:'invalid_package'},409);
    if(String(decisions[0].decision)!=='APPROVED') return json({ok:false,error:'approved_parent_decision_required'},409);

    const readiness=packageReadiness(packageCode);
    if(!isPackageFullyReady(packageCode)){
      return json({
        ok:false,
        error:'package_not_ready_for_activation',
        readiness,
      },409);
    }

    try{
      const rows=await sql`
        SELECT public.cza_activate_student_package(
          ${decisionId}::uuid,
          ${link.academy_id}::uuid,
          ${studentId}::uuid,
          ${activationBasis},
          ${JSON.stringify(allAccessCodes(packageCode))}::jsonb,
          ${JSON.stringify(readyAccessCodes(packageCode))}::jsonb,
          ${link.educator_user_id}::uuid
        ) AS enrollment_id
      `;
      return json({
        ok:true,
        enrollment:{
          id:String(rows[0]?.enrollment_id||''),
          packageCode,
          packageLabel:packageCatalog[packageCode].label,
          priceTry:packagePriceSnapshot(packageCode),
          activationBasis,
          accessCodes:readyAccessCodes(packageCode),
        },
      },201);
    }catch(error){
      const message=error instanceof Error?error.message:'';
      if(message.includes('CZA_ACTIVE_PACKAGE_EXISTS')) return json({ok:false,error:'active_package_exists'},409);
      if(message.includes('CZA_APPROVED_PARENT_DECISION_REQUIRED')) return json({ok:false,error:'approved_parent_decision_required'},409);
      return json({ok:false,error:'package_activation_failed'},500);
    }
  }

  if(action==='cancel'){
    const enrollmentId=typeof input.enrollmentId==='string'?input.enrollmentId.trim():'';
    if(!UUID.test(enrollmentId)) return json({ok:false,error:'invalid_enrollment_id'},400);
    if(input.confirm!==true) return json({ok:false,error:'package_cancellation_confirmation_required'},409);

    try{
      const rows=await sql`
        SELECT public.cza_cancel_student_package(
          ${enrollmentId}::uuid,
          ${link.academy_id}::uuid,
          ${studentId}::uuid,
          ${link.educator_user_id}::uuid
        ) AS cancelled
      `;
      if(rows[0]?.cancelled!==true) return json({ok:false,error:'active_package_not_found'},404);
      return json({ok:true});
    }catch{
      return json({ok:false,error:'package_cancellation_failed'},500);
    }
  }

  return json({ok:false,error:'invalid_action'},400);
}
