// Synthetic preview adapter v2. Does not replace or rescore PR109's contract.
export const TASKS = ['A', 'S', 'B', 'T'];
export const OPTIONS = {
 A: [{id:'canonical',t:4,u:7,label:'4 onluk · 7 birlik'}, {id:'reverse',t:7,u:4,label:'7 onluk · 4 birlik'}, {id:'digit',t:0,u:11,label:'11 birlik'}, {id:'value',t:4,u:4,label:'4 onluk · 4 birlik'}],
 S: [{id:'canonical',label:'47'}, {id:'reverse',label:'74'}, {id:'digit',label:'11'}, {id:'value',label:'407'}],
 B: [{id:'canonical',label:'Aynı sayı değiller'}, {id:'same',label:'Aynı sayılar'}, {id:'unknown',label:'Karar veremedim'}, {id:'digits',label:'İkisinde de 4 ve 7 var; değerlerini bilmiyorum'}],
 T: [{id:'canonical',t:5,u:2,label:'Bu grubu seç'}, {id:'reverse',t:2,u:5,label:'Bu grubu seç'}, {id:'digit',t:0,u:7,label:'Bu grubu seç'}, {id:'value',t:5,u:7,label:'Bu grubu seç'}]
};
// Each four-attempt block has one correct position per task. Teacher never sees an answer-position setting.
export function options(task, attempt, layout) {
 const position = layout ? layout[task][(attempt-1)%4] : ((attempt - 1) + {A:2,S:0,B:3,T:1}[task]) % 4;
 const list = OPTIONS[task].filter(o => o.id !== 'canonical');
 list.splice(position, 0, OPTIONS[task][0]); return list;
}
const freeze = value => { if (value && typeof value === 'object') {Object.values(value).forEach(freeze);Object.freeze(value);}return value; };
export function newSession(){ return freeze({studentRef:'SYNTHETIC_SINGLE_SLP',attempts:[]}); }
export function start(session, config) {
 const number = session.attempts.length + 1;
 const attempt = {id:`SYNTHETIC-ATTEMPT-${number}`,number,config:{...config},responses:[],observations:[]};
 return freeze({...session,attempts:[...session.attempts,attempt]});
}
export function record(session, id, task, data) {
 const a=session.attempts.find(x=>x.id===id);
 if(!a || !TASKS.includes(task)) throw Error('UNKNOWN_ATTEMPT');
 if(a!==session.attempts.at(-1)) throw Error('ARCHIVED_ATTEMPT_LOCKED');
 if(a.responses.some(r=>r.task===task)) throw Error('IMMUTABLE_RESPONSE');
 if(task!=='A'&&!a.responses.some(r=>r.task==='A')) throw Error('FIRST_RESPONSE_REQUIRED');
 const index=TASKS.indexOf(task);
 if(index>0&&!a.responses.some(r=>r.task===TASKS[index-1]))throw Error('PREVIOUS_STAGE_REQUIRED');
 if(!data.raw?.trim() && !data.unavailable) throw Error('EMPTY_RESPONSE');
 if(data.kind==='recognition'&&!options(task,a.number).some(o=>o.id===data.option))throw Error('INVALID_OPTION');
 const response={...data,task,ref:`${id}-${task}`,phase:{A:'firstIndependent',S:'supported',B:'probe',T:'newTransfer'}[task],version:'B08_UX_REV2_V2',source:{contract:'B08_MAT01_EVIDENCE_V1.0',task:'MAT01_SOURCE_30de9c8',stimulus:'B08_UX_REV2_VISUAL_V2',rubric:'B08_AI_REV1_OBSERVABLE_V1.0'},provenance:'synthetic_student_direct',score:null,mastery:'INSUFFICIENT',assignment:'BLOCKED'};
 return freeze({...session,attempts:session.attempts.map(x=>x.id===id?{...x,responses:[...x.responses,response]}:x)});
}
export function observe(session,id,task,observation){
 const a=session.attempts.find(x=>x.id===id);
 if(a!==session.attempts.at(-1))throw Error('ARCHIVED_ATTEMPT_LOCKED');
 if(!a.responses.some(r=>r.task===task))throw Error('RESPONSE_REQUIRED');
 if(a.observations.some(o=>o.task===task))throw Error('IMMUTABLE_OBSERVATION');
 if(!observation.note?.trim())throw Error('OBSERVATION_NOTE_REQUIRED');
 return freeze({...session,attempts:session.attempts.map(x=>x.id===id?{...x,observations:[...x.observations,{...observation,task,provenance:'synthetic_educator_declaration',authenticated:false}]}:x)});
}
export function assess(response, observation, classifier){
 if(!response || response.unavailable)return {status:'NOT_ASSESSED',reason:'Yanıt kanalı veya kanıt yok; sıfır puan değildir.'};
 if(response.task==='T' && (!observation || observation.novelty!=='UNSEEN' || observation.help!=='NONE' || !observation.history?.trim())) return {status:'NOT_ASSESSED',reason:'Eğitmen yenilik/geçmiş kaynağı ve yardımsızlık kanıtı gerekli.'};
 if(response.kind==='recognition')return {status:response.option==='canonical'?'RECOGNITION_CORRECT':'RECOGNITION_INCORRECT',reason:'Yalnız seçenek tanıma; bağımsız üretim, kavramsal ustalık veya transfer başarısı değildir.'};
 if(response.task==='A'){
  const m=response.raw.toLocaleLowerCase('tr-TR').trim().match(/^(\d{1,2}) onluk(?: ve)? (\d{1,2}) birlik$/);
  if(m && +m[1]*10+(+m[2])===47 && (+m[1]!==4 || +m[2]!==7))return {status:'EQUIVALENT_NONCANONICAL',reason:'47 ile matematiksel eşdeğer; kanonik basamak çözümlemesi gözlenmedi. PR109 sonucu değiştirilmedi.'};
  return {status:classifier(response.raw),reason:'Sınırlı PR109 metin sınıflayıcısı; ustalık kararı üretmez.'};
 }
 if(!observation)return {status:'NOT_ASSESSED',reason:'Öğrencinin yanıtı korundu; eğitmen gözlemi bekleniyor.'};
 if(response.task==='B'||response.task==='T'){
  const c=observation.criteria??{};
  if(!Object.values(c).some(v=>v!=='NOT_ASSESSED'))return {status:'NOT_ASSESSED',reason:'Gözlenebilir rubrik ölçütleri henüz işaretlenmedi; genel yargı tek başına yeterli değil.'};
  if(response.task==='T'&&c.T5!=='OBSERVED')return {status:'NOT_ASSESSED',reason:'T5 yeni uyaran kanıtı eksik.'};
  if(observation.judgment==='RELATION_OBSERVED'){
   const complete=response.task==='B'?c.B4==='OBSERVED'&&(c.B2==='OBSERVED'||c.B3==='OBSERVED'):['T1','T2','T3','T4','T5'].every(k=>c[k]==='OBSERVED');
   if(!complete||Object.values(c).includes('INCORRECT'))return {status:'PARTIAL_EVIDENCE',reason:'İlişki yargısı için ölçütler eksik/çelişkili; eğitmen kararı bekleniyor.'};
  }
 }
 return {status:observation.judgment,reason:'Sentetik eğitmen beyanı; otomatik metin puanlama veya doğrulanmış uzman kararı değildir.'};
}
