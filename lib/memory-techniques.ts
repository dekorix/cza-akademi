export type MemoryTechniqueCode='visual_link'|'story_chain'|'chunking'|'location';

export type MemoryTechnique={
  code:MemoryTechniqueCode;
  title:string;
  short:string;
  instruction:string;
  coachPrompt:string;
  firstItems:string[];
  transferItems:string[];
  distractors:string[];
};

export const memoryTechniques:MemoryTechnique[]=[
  {
    code:'visual_link',
    title:'Görsel Bağ',
    short:'İki şeyi tek, canlı bir görüntüye dönüştür.',
    instruction:'Kelimeleri tek tek ezberleme. Nesneleri zihninde abartılı, hareketli ve renkli bir görüntüde birbirine bağla.',
    coachPrompt:'Gözlerini kısa süre kapat ve bütün nesneleri aynı sahnenin içinde gör.',
    firstItems:['balon','kitap','limon','anahtar','şapka'],
    transferItems:['uçurtma','kaşık','çiçek','saat','tren'],
    distractors:['masa','bulut','bardak','kalem','kapı'],
  },
  {
    code:'story_chain',
    title:'Hikâye Zinciri',
    short:'Ögeleri sırayla tek bir hikâyeye bağla.',
    instruction:'Her kelime bir sonrakini harekete geçirsin. Hikâyen tuhaf olabilir; önemli olan sıranın kopmaması.',
    coachPrompt:'İlk nesneden başla. Sonraki nesnenin onunla ne yaptığını zihninde canlandır.',
    firstItems:['kedi','çanta','yıldız','muz','bisiklet'],
    transferItems:['köpek','şemsiye','top','gemi','peynir'],
    distractors:['sandalye','dağ','çorap','defter','ayna'],
  },
  {
    code:'chunking',
    title:'Gruplama',
    short:'Çok şeyi birkaç küçük kümeye ayır.',
    instruction:'Ögeleri ortak özelliklerine göre küçük gruplar hâline getir. Beynin beş ayrı parçayı değil, iki-üç anlamlı kümeyi taşır.',
    coachPrompt:'Hangileri birbirine benziyor? Önce iki küçük grup kur, sonra grupları hatırla.',
    firstItems:['elma','armut','kalem','silgi','muz','defter'],
    transferItems:['çilek','portakal','cetvel','kitap','kiraz','boya'],
    distractors:['tren','kedi','anahtar','şapka','güneş','top'],
  },
  {
    code:'location',
    title:'Konumlama',
    short:'Ögeleri bildiğin yerlere yerleştir.',
    instruction:'Bir oda veya yolu zihninde sırayla gez. Her durağa bir nesne bırak ve sonra aynı yolu yeniden yürü.',
    coachPrompt:'Kapıdan başla. Her nesneyi farklı bir durağa koy ve aynı sırayla geri dön.',
    firstItems:['güneş','top','bardak','çiçek','tren'],
    transferItems:['ay','kitap','balık','anahtar','balon'],
    distractors:['masa','limon','çanta','kalem','dağ'],
  },
];

export type MemoryTrial={
  technique:MemoryTechniqueCode;
  phase:'first'|'transfer';
  selected:string[];
  target:string[];
  startedAt:number;
  completedAt:number;
  cueUsed:boolean;
};

export type MemoryTrialScore={
  recalled:number;
  intrusions:number;
  targetCount:number;
  accuracy:number;
  latencyMs:number;
  supportLevel:'independent'|'prompted';
};

export function scoreMemoryTrial(trial:MemoryTrial):MemoryTrialScore{
  const target=new Set(trial.target);
  const chosen=[...new Set(trial.selected)];
  const recalled=chosen.filter(item=>target.has(item)).length;
  const intrusions=chosen.filter(item=>!target.has(item)).length;
  return {
    recalled,
    intrusions,
    targetCount:target.size,
    accuracy:target.size?Math.max(0,(recalled-intrusions)/target.size):0,
    latencyMs:Math.max(0,Math.round(trial.completedAt-trial.startedAt)),
    supportLevel:trial.cueUsed?'prompted':'independent',
  };
}

export function memorySessionSummary(input:{
  technique:MemoryTechniqueCode;
  first:MemoryTrialScore;
  transfer:MemoryTrialScore;
}){
  const best=Math.max(input.first.accuracy,input.transfer.accuracy);
  const transferGain=input.transfer.accuracy-input.first.accuracy;
  return {
    technique:input.technique,
    firstAccuracy:Number(input.first.accuracy.toFixed(2)),
    transferAccuracy:Number(input.transfer.accuracy.toFixed(2)),
    transferGain:Number(transferGain.toFixed(2)),
    independent:input.first.supportLevel==='independent'&&input.transfer.supportLevel==='independent',
    band:best>=.8&&input.transfer.accuracy>=.8
      ? 'STRONG_TRANSFER'
      : input.transfer.accuracy>=.6
        ? 'DEVELOPING'
        : 'NEEDS_GUIDED_PRACTICE',
  } as const;
}

export function buildMemoryLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  technique:MemoryTechniqueCode;
  startedAt:string;
  completedAt:string;
  first:MemoryTrialScore;
  transfer:MemoryTrialScore;
  cueUsed:boolean;
}){
  const summary=memorySessionSummary({technique:input.technique,first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'memory',
    moduleVersion:'1.0.0',
    activityType:`memory_${input.technique}`,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:(input.cueUsed?'prompted':'independent') as 'prompted'|'independent',
    performance:{
      firstRecall:input.first.recalled,
      firstIntrusions:input.first.intrusions,
      firstAccuracy:summary.firstAccuracy,
      transferRecall:input.transfer.recalled,
      transferIntrusions:input.transfer.intrusions,
      transferAccuracy:summary.transferAccuracy,
      transferGain:summary.transferGain,
      band:summary.band,
    },
    skills:[
      'memory_encoding',
      'strategy_use',
      input.technique==='visual_link'?'visual_association':
        input.technique==='story_chain'?'sequential_encoding':
          input.technique==='chunking'?'categorical_chunking':'spatial_encoding',
      'memory_transfer',
    ],
    metadata:{
      technique:input.technique,
      firstLatencyMs:input.first.latencyMs,
      transferLatencyMs:input.transfer.latencyMs,
      cueUsed:input.cueUsed,
      educationalOnly:true,
    },
  };
}
