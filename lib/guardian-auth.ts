import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { trustedEducatorProxy } from '@/lib/educator-auth';

export const GUARDIAN_COOKIE = 'cza_guardian_session';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type GuardianIdentity = {
  guardianUserId:string;
  authUserId:string;
  academyId:string;
  email:string;
  name:string;
};

function tokenHash(token:string){return createHash('sha256').update(token).digest('hex');}

export function readGuardianCookie(request:Request){
  const pair=(request.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(`${GUARDIAN_COOKIE}=`));
  if(!pair)return '';
  try{const value=decodeURIComponent(pair.slice(GUARDIAN_COOKIE.length+1));return value.length<=1024?value:'';}catch{return '';}
}

export function guardianCookie(value:string,maxAge:number,secure:boolean){
  return [`${GUARDIAN_COOKIE}=${encodeURIComponent(value)}`,'Path=/api','HttpOnly',...(secure?['Secure']:[]),'SameSite=Lax',`Max-Age=${maxAge}`].join('; ');
}

export async function authenticatedGuardian(request:Request):Promise<GuardianIdentity|null>{
  const token=readGuardianCookie(request);
  if(!token||!process.env.DATABASE_URL)return null;
  const hash=tokenHash(token);
  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`
    SELECT s.id session_id,u.id guardian_user_id,u.auth_user_id,u.academy_id,u.email,u.display_name
    FROM public.guardian_sessions s
    JOIN public.users u ON u.id=s.guardian_user_id AND u.academy_id=s.academy_id
    WHERE s.token_hash=${hash}
      AND s.revoked_at IS NULL
      AND s.expires_at>now()
      AND u.is_active=true
      AND u.role::text='guardian'
      AND u.auth_user_id IS NOT NULL
    LIMIT 1
  `;
  if(!rows.length)return null;
  await sql`UPDATE public.guardian_sessions SET last_seen_at=now() WHERE id=${rows[0].session_id}::uuid`;
  const row=rows[0] as Record<string,unknown>;
  return {
    guardianUserId:String(row.guardian_user_id),
    authUserId:String(row.auth_user_id),
    academyId:String(row.academy_id),
    email:typeof row.email==='string'?row.email:'',
    name:typeof row.display_name==='string'&&row.display_name.trim()?row.display_name:'Veli',
  };
}

export async function createGuardianSessionFromTrustedProxy(request:Request,knownBodySha256?:string){
  if(!process.env.DATABASE_URL)throw new Error('database_unavailable');
  const proxy=await trustedEducatorProxy(request,knownBodySha256);
  const email=(proxy?.educatorEmail||'').trim().toLowerCase();
  if(!email)throw new Error('trusted_proxy_required');
  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`
    SELECT id,auth_user_id,academy_id,email,display_name
    FROM public.users
    WHERE lower(email)=${email}
      AND role::text='guardian'
      AND is_active=true
      AND auth_user_id IS NOT NULL
    LIMIT 1
  `;
  if(!rows.length)throw new Error('guardian_mapping_missing');
  const row=rows[0] as Record<string,unknown>;
  const guardianUserId=String(row.id),academyId=String(row.academy_id),authUserId=String(row.auth_user_id);
  if(!UUID.test(guardianUserId)||!UUID.test(academyId)||!UUID.test(authUserId))throw new Error('guardian_mapping_invalid');
  const token=randomBytes(32).toString('hex');
  await sql`
    INSERT INTO public.guardian_sessions(academy_id,guardian_user_id,token_hash,expires_at,user_agent)
    VALUES(${academyId}::uuid,${guardianUserId}::uuid,${tokenHash(token)},now()+interval '8 hours',${request.headers.get('user-agent')||''})
  `;
  return {
    token,
    user:{id:authUserId,email:typeof row.email==='string'?row.email:'',name:typeof row.display_name==='string'&&row.display_name.trim()?row.display_name:'Veli'},
  };
}

export async function revokeGuardianSession(request:Request){
  const token=readGuardianCookie(request);
  if(!token)return;
  if(!process.env.DATABASE_URL)throw new Error('database_unavailable');
  const sql=neon(process.env.DATABASE_URL);
  await sql`
    UPDATE public.guardian_sessions SET revoked_at=COALESCE(revoked_at,now())
    WHERE token_hash=${tokenHash(token)}
  `;
}
