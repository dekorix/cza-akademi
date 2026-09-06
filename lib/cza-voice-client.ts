export type VoiceClip = { key: string; url: string };

export function voiceClipKey(term: number, index: number, language: string, voiceProfile: string, speechRate: number) {
  return `${voiceProfile}:${language}:${index === 0 ? term : term < 0 ? `minus-${Math.abs(term)}` : term}:${speechRate}`;
}

export async function preloadVoiceClips(terms: { term: number; index: number }[], options: { language: string; voiceProfile: string; speechRate: number }) {
  const unique = new Map<string,{term:number;index:number}>();
  for (const item of terms) unique.set(voiceClipKey(item.term,item.index,options.language,options.voiceProfile,options.speechRate),item);
  const clips = new Map<string,string>();
  await Promise.all([...unique].map(async ([key,item]) => {
    const response = await fetch('/api/voice', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({...item,...options}) });
    if (!response.ok) { const detail=await response.json().catch(()=>({})) as {error?:unknown}; throw new Error(typeof detail.error==='string'?detail.error:'premium_voice_unavailable'); }
    clips.set(key,URL.createObjectURL(await response.blob()));
  }));
  return clips;
}

export class AudioStimulusScheduler {
  private audio: HTMLAudioElement | null = null;
  private cancelled = false;
  async play(url: string) {
    this.cancelled = false;
    await new Promise<void>((resolve,reject) => {
      const audio = new Audio(url); this.audio=audio; audio.preload='auto';
      audio.onended=()=>resolve(); audio.onerror=()=>reject(new Error('audio_playback_failed'));
      audio.play().catch(reject);
    });
    if (this.cancelled) throw new Error('audio_cancelled');
  }
  cancel() { this.cancelled=true; this.audio?.pause(); this.audio=null; }
}
