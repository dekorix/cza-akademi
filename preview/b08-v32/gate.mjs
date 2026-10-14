import {assess as assessV2, record as recordV2} from '../b08-ux-rev2/model.mjs';
export const SOURCE_STATUS='SOURCE_NOT_AVAILABLE';
export const SYNTHETIC_HISTORY=Object.freeze({SYNTHETIC_HISTORY_REVIEW_01:Object.freeze({studentRef:'SYNTHETIC_SINGLE_SLP',reviewedPriorNumbers:Object.freeze([47,74]),kind:'REVIEWED_SYNTHETIC_FIXTURE'})});
const closed=(reason)=>({status:'NOT_ASSESSED',effective:'NOT_ASSESSED',reason,mastery:'INSUFFICIENT',assignment:'BLOCKED',realTransfer:'NOT_VERIFIED'});
export function representations(raw){
 const parts=raw.toLocaleLowerCase('tr-TR').split(/[;\n]/).map(s=>s.trim()).filter(Boolean);
 if(parts.length!==2)return null;
 const models=parts.map(p=>{let m=p.match(/^(\d{1,3})\s*onluk\s*(?:ve\s*)?(\d{1,3})\s*birlik[.!]?$/);if(m)return {value:+m[1]*10+(+m[2]),key:`groups:${+m[1]}:${+m[2]}`};m=p.match(/^(\d{1,3})\s*\+\s*(\d{1,3})[.!]?$/);return m?{value:+m[1]+(+m[2]),key:`sum:${Math.min(+m[1],+m[2])}:${Math.max(+m[1],+m[2])}`}:null;});
 return models.every(Boolean)?models:null;
}
export function transferGate(response, observation){
 if(!response||response.unavailable||!observation)return closed('Öğrenci kanıtı ve ayrı eğitmen gözlemi gerekli.');
 if(observation.judgment!=='RELATION_OBSERVED')return closed('Olumlu olmayan ham öğretmen hükmü olumlu kanıta yükseltilemez.');
 if(response.kind!=='production'||response.channel==='objects')return closed('Tanıma veya menüyle kurma bağımsız farklı temsil üretimine eşitlenmez.');
 const c=observation.criteria??{};
 if(!['T1','T2','T3','T4','T5'].every(k=>c[k]==='OBSERVED'))return closed('T1–T5 (iki gösterim, onluk/birlik, gerekçe, bağımsızlık, yeni uyaran) birlikte gerekli.');
 if(response.priorTransferSeen)return closed('52 bu oturumun önceki denemesinde kullanıldı; yeniden yeni transfer değildir.');
 if(!SYNTHETIC_HISTORY[observation.history]?.reviewedPriorNumbers||SYNTHETIC_HISTORY[observation.history].reviewedPriorNumbers.includes(52))return closed('Geçmiş kaynak referansı incelenmiş sentetik günlükle eşleşmiyor.');
 if(observation.novelty!=='UNSEEN'||observation.help!=='NONE'||!observation.history?.trim()||observation.historyKind!=='SYNTHETIC_REVIEWED_LOG')return closed('Yalnız UNSEEN seçimi yeterli değildir; incelenmiş sentetik geçmiş kaynağı ve yardım NONE gerekir.');
 const models=representations(response.raw);
 if(!models||models.some(m=>m.value!==52)||!models.some(m=>m.key.startsWith('groups:'))||models[0].key===models[1].key)return closed('İki matematiksel doğru ve farklı gösterim doğrulanamadı; sınırlı parser bilinmeyeni yanlış puanlamaz.');
 return {status:'PROVISIONAL_EVIDENCE',effective:'PROVISIONAL_EVIDENCE',reason:'Yalnız sentetik, geçici kanıt. Gerçek geçmiş/eğitmen kimliği doğrulanmadı; ustalık veya gerçek transfer kabulü değildir.',mastery:'INSUFFICIENT',assignment:'BLOCKED',realTransfer:'NOT_VERIFIED'};
}
export function record(session,id,task,data){
 const priorExposure=session.attempts.filter(a=>a.id!==id).some(a=>a.responses.some(r=>['A','S','B'].includes(r.task)));
 return recordV2(session,id,task,{...data,priorTransferSeen:task==='T'&&session.attempts.filter(a=>a.id!==id).some(a=>a.responses.some(r=>r.task==='T')),checkpointVersion:'B08_V32_CHECKPOINT_FALLBACK_V1',sourceStatus:SOURCE_STATUS,baseline:task==='A'?(priorExposure?'PREVIOUS_EXPOSURE_NOT_NEW_BASELINE':'FIRST_RECORDED_EXPOSURE'):'NOT_BASELINE',evidenceChannel:data.channel==='objects'?'MENU_CONSTRUCTION':data.channel==='physical'?'PHYSICAL_OBJECT_EDUCATOR_TRANSCRIPT':data.channel==='communication'?'STUDENT_COMMUNICATION':data.kind==='recognition'?'RECOGNITION':task==='S'?'SUPPORTED_TEXT':task==='B'?'STUDENT_REASONING_TEXT':task==='T'?'INDEPENDENT_REPRESENTATION_TEXT':'INDEPENDENT_TEXT'});
}
export function assess(response,observation,classifier){
 if(response?.task==='T')return transferGate(response,observation);
 const r=assessV2(response,observation,classifier);
 if(response?.task==='A'&&response.channel==='objects')return {...closed('Menüyle kurma ayrı kanıttır; bağımsız kavramsal üretim sayılmaz.'),status:'MENU_CONSTRUCTION_EVIDENCE'};
 return {...r,mastery:'INSUFFICIENT',assignment:'BLOCKED',realTransfer:'NOT_VERIFIED'};
}
