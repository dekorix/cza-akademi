import { createHash } from 'node:crypto';
import { allowRequest, rateLimited } from '@/lib/request-guard';

type VoiceRequest = { term?: unknown; index?: unknown; language?: unknown; voiceProfile?: unknown; speechRate?: unknown };
type CachedClip = { bytes: ArrayBuffer; contentType: string };

const globalCache = globalThis as typeof globalThis & { __czaVoiceCache?: Map<string,CachedClip> };
const cache = globalCache.__czaVoiceCache ??= new Map<string,CachedClip>();

function json(body: unknown, status: number) { return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8'}}); }

function voiceStatus() {
  const provider=process.env.CZA_TTS_PROVIDER;
  const voiceId=process.env.CZA_TTS_VOICE_ID;
  return { configured:provider==='openai'&&Boolean(process.env.OPENAI_API_KEY)&&Boolean(voiceId), provider:provider||null, voiceProfile:process.env.CZA_TTS_PROFILE_NAME||null, voiceIdConfigured:Boolean(voiceId), cacheEntries:cache.size, language:'tr-TR' };
}

export async function GET() { return json(voiceStatus(),200); }

export async function POST(request: Request) {
  const gate=allowRequest(request,'voice',60,60*1000);
  if(!gate.allowed) return rateLimited(gate.retryAfterSeconds);
  const origin=request.headers.get('origin');
  if(origin&&origin!==new URL(request.url).origin) return json({error:'request_origin_rejected'},403);
  let input: VoiceRequest;
  try { input=await request.json() as VoiceRequest; } catch { return json({error:'invalid_request'},400); }
  const term=Number(input.term), index=Number(input.index), speed=Number(input.speechRate??1);
  const language=typeof input.language==='string'?input.language:'tr-TR', profile=typeof input.voiceProfile==='string'?input.voiceProfile:'CZA_STANDARD';
  if(!Number.isInteger(term)||term < -9999999||term > 9999999||!Number.isInteger(index)||index<0||language!=='tr-TR'||!Number.isFinite(speed)||speed<.75||speed>1.3) return json({error:'invalid_voice_request'},400);
  const status=voiceStatus();
  if(!status.configured) {
    console.warn('[voice] premium configuration missing',{provider:status.provider,voiceIdConfigured:status.voiceIdConfigured});
    return json({error:'premium_voice_configuration_required',required:['CZA_TTS_PROVIDER=openai','OPENAI_API_KEY','CZA_TTS_VOICE_ID'],status},503);
  }
  const voiceId=process.env.CZA_TTS_VOICE_ID as string;
  const model=process.env.CZA_TTS_MODEL||'gpt-4o-mini-tts';
  const version=process.env.CZA_TTS_VOICE_VERSION||'1';
  const cacheKey=createHash('sha256').update(`${profile}|${voiceId}|${version}|${language}|${term}|${index===0?'first':'next'}|${speed}`).digest('hex');
  const hit=cache.get(cacheKey);
  if(hit) return new Response(hit.bytes.slice(0),{headers:{'content-type':hit.contentType,'x-cza-voice-cache':'HIT','cache-control':'public, max-age=31536000, immutable'}});
  const spoken=index===0?String(term):term<0?`eksi ${Math.abs(term)}`:String(term);
  const upstream=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({model,voice:voiceId,input:spoken,instructions:'Türkçe sayıyı kısa, net, sakin, enerjik ve yüksek artikülasyonla söyle. Başında ve sonunda sessizlik bırakma.',response_format:'mp3',speed})});
  if(!upstream.ok) { console.error('[voice] provider request failed',{status:upstream.status}); return json({error:'premium_voice_provider_failed',status:upstream.status},502); }
  const bytes=await upstream.arrayBuffer(); const contentType=upstream.headers.get('content-type')||'audio/mpeg';
  cache.set(cacheKey,{bytes,contentType});
  return new Response(bytes.slice(0),{headers:{'content-type':contentType,'x-cza-voice-cache':'MISS','cache-control':'public, max-age=31536000, immutable'}});
}

