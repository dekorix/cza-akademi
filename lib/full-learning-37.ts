export type FullLearningPhase='prepare'|'learn'|'deepen'|'practice'|'mastery';

export type FullLearningStage={
  index:number;
  alias:string;
  title:string;
  phase:FullLearningPhase;
  prompt:string;
};

const phasePrompt:Record<FullLearningPhase,string>={
  prepare:'Bu aşamada hedefi ve başlangıç durumunu netleştir. Kısa, somut ve ölçülebilir bir çıktı üret.',
  learn:'Konuyu anlamlandır, kodla ve kendi zihinsel bağlantılarını kur. Ezber yerine açıklama ve ilişki kullan.',
  deepen:'Kavramı zorlaştıran noktaları ayır, hataları görünür yap ve yeni örnekle derinleştir.',
  practice:'Bilgiyi aktif geri çağır, farklı zorluklarda uygula ve hatalardan yeni çalışma üret.',
  mastery:'Kalıcılığı, transferi ve bağımsızlığı kontrol et; öğrenci ve öğretmen için kapanış kanıtı üret.',
};

const definitions:[string,string,FullLearningPhase][]=[
  ['/cover','Kapak','prepare'],
  ['/studentinfo','Öğrenci bilgileri','prepare'],
  ['/objectives','Kazanımlar','prepare'],
  ['/pretest','Ön değerlendirme','prepare'],
  ['/teachme','Mini konu anlatımı','learn'],
  ['/learncycle','Gör–Kur–Yap–Hızlan','learn'],
  ['/visualcode','Görsel kodlama','learn'],
  ['/mindmap','Zihin haritası','learn'],
  ['/cheatsheet','Hızlı tekrar sayfası','learn'],
  ['/flashcards','Aktif hatırlama kartları','learn'],
  ['/feynman','Öğretmen Sensin / Feynman','learn'],
  ['/memory','Hafıza teknikleri','learn'],
  ['/memorytricks','Hafıza kancaları','learn'],
  ['/conceptsurgery','Kavram cerrahisi','deepen'],
  ['/minimalpairs','Minimal çiftler','deepen'],
  ['/distractors','Çeldirici laboratuvarı','deepen'],
  ['/mistakes','Hata avı','deepen'],
  ['/attentionhunt','Dikkat avı','deepen'],
  ['/readthink','Oku–Anla–Düşün–Yorumla','deepen'],
  ['/reversetest','Ters test','deepen'],
  ['/produce','Üretme atölyesi','deepen'],
  ['/quizme','Quiz','practice'],
  ['/studymode','Study Mode','practice'],
  ['/levels','Kademeli zorluk','practice'],
  ['/speed','Hız ve refleks','practice'],
  ['/adaptive','Adaptif öğretim','practice'],
  ['/errorbank','Hata bankası','practice'],
  ['/spaced','Aralıklı tekrar','practice'],
  ['/mockexam','Deneme sınavı','practice'],
  ['/finalsurgery','Final kavram cerrahisi','mastery'],
  ['/mastery','Ustalık kontrolü','mastery'],
  ['/retention','Kalıcılık testi','mastery'],
  ['/selfcheck','Öğrenci öz değerlendirmesi','mastery'],
  ['/teachercheck','Öğretmen gözlem formu','mastery'],
  ['/profile','Gelişim profili','mastery'],
  ['/answers','Cevap anahtarı','mastery'],
  ['/teacherguide','Öğretmen ayrıntılı rehberi','mastery'],
];

export const fullStudyAlias='/fullstudy';

export const fullLearningStages:FullLearningStage[]=definitions.map(([alias,title,phase],position)=>({
  index:position+1,
  alias,
  title,
  phase,
  prompt:phasePrompt[phase],
}));

export function stageByAlias(alias:string){
  return fullLearningStages.find(stage=>stage.alias===alias)||null;
}

export function phaseLabel(phase:FullLearningPhase){
  return {
    prepare:'Hazırlık',
    learn:'Öğren ve Kodla',
    deepen:'Derinleştir',
    practice:'Aktif Uygulama',
    mastery:'Ustalık ve Kalıcılık',
  }[phase];
}

export function fullLearningProgress(completedAliases:string[]){
  const valid=new Set(completedAliases.filter(alias=>stageByAlias(alias)));
  const completed=valid.size;
  return {
    completed,
    total:fullLearningStages.length,
    ratio:completed/fullLearningStages.length,
    next:fullLearningStages.find(stage=>!valid.has(stage.alias))||null,
  };
}

export function buildFullLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  alias:string;
  topic:string;
  startedAt:string;
  completedAt:string;
  evidenceWordCount:number;
  confidence:number;
  independent:boolean;
  transferApplied:boolean;
}){
  const stage=stageByAlias(input.alias);
  if(!stage) throw new Error('full_learning_stage_invalid');
  const confidence=Math.max(1,Math.min(5,Math.round(input.confidence)));
  const evidenceWordCount=Math.max(0,Math.round(input.evidenceWordCount));
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'full_learning_37',
    moduleVersion:'1.0.0',
    activityType:'full_learning_'+stage.alias.slice(1),
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:(input.independent?'independent':'prompted') as 'independent'|'prompted',
    performance:{
      stageIndex:stage.index,
      completed:true,
      evidenceWordCount,
      confidence,
      independent:input.independent,
      transferApplied:input.transferApplied,
    },
    skills:['learning_strategy','active_recall','self_regulation',stage.phase,'full_learning_transfer'],
    metadata:{
      alias:stage.alias,
      title:stage.title,
      phase:stage.phase,
      topic:input.topic.trim().slice(0,120),
      rawEvidenceStored:false,
      superCommand:fullStudyAlias,
      educationalOnly:true,
    },
  };
}
