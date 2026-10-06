export type IntelligenceGameMode='pattern_completion'|'classification'|'logic_inference'|'planning_sequence';

export type IntelligencePuzzle={
  prompt:string;
  options:string[];
  correctIndex:number;
};

export type IntelligenceGameActivity={
  code:IntelligenceGameMode;
  title:string;
  instruction:string;
  first:IntelligencePuzzle[];
  transfer:IntelligencePuzzle[];
};

export const intelligenceGameActivities:IntelligenceGameActivity[]=[
  {
    code:'pattern_completion',
    title:'Örüntü Avcısı',
    instruction:'Dizide değişen kuralı bul ve sıradaki öğeyi seç.',
    first:[
      {prompt:'2, 4, 6, 8, ?',options:['9','10','12'],correctIndex:1},
      {prompt:'▲ ● ▲ ● ▲ ?',options:['▲','●','■'],correctIndex:1},
      {prompt:'1, 2, 4, 8, ?',options:['10','12','16'],correctIndex:2},
    ],
    transfer:[
      {prompt:'5, 10, 15, 20, ?',options:['22','25','30'],correctIndex:1},
      {prompt:'■ ■ ● ■ ■ ● ?',options:['●','■','▲'],correctIndex:1},
      {prompt:'3, 6, 12, 24, ?',options:['36','48','54'],correctIndex:1},
    ],
  },
  {
    code:'classification',
    title:'Sınıflama Ustası',
    instruction:'Aynı kurala uyanları ayır; gruba uymayanı bul.',
    first:[
      {prompt:'Hangisi diğerlerinden farklıdır?',options:['elma','armut','kalem'],correctIndex:2},
      {prompt:'Hangisi taşıttır?',options:['otobüs','masa','çiçek'],correctIndex:0},
      {prompt:'Hangisi geometrik şekildir?',options:['üçgen','kitap','bardak'],correctIndex:0},
    ],
    transfer:[
      {prompt:'Hangisi diğerlerinden farklıdır?',options:['kedi','köpek','sandalye'],correctIndex:2},
      {prompt:'Hangisi ölçme aracıdır?',options:['cetvel','yastık','tabak'],correctIndex:0},
      {prompt:'Hangisi gökyüzünde görülür?',options:['bulut','kapı','defter'],correctIndex:0},
    ],
  },
  {
    code:'logic_inference',
    title:'Mantık Dedektifi',
    instruction:'Verilen bilgilerden zorunlu sonucu çıkar.',
    first:[
      {prompt:'Ali, Ece’den uzundur. Ece, Mert’ten uzundur. En uzun kim?',options:['Ali','Ece','Mert'],correctIndex:0},
      {prompt:'Kırmızı kutu masada değil. Mavi kutu rafta. Masada hangi kutu olabilir?',options:['Mavi','Kırmızı','Başka kutu'],correctIndex:2},
      {prompt:'Tüm kuşların kanadı vardır. Serçe bir kuştur. Serçenin neyi vardır?',options:['Kanadı','Tekerleği','Boynuzu'],correctIndex:0},
    ],
    transfer:[
      {prompt:'Zeynep, Bora’dan önce geldi. Bora, Deniz’den önce geldi. En son kim geldi?',options:['Zeynep','Bora','Deniz'],correctIndex:2},
      {prompt:'Sarı kalem çantada değil. Mavi kalem masada. Çantada hangisi kesin değildir?',options:['Sarı kalem','Mavi kalem','Başka kalem'],correctIndex:0},
      {prompt:'Tüm balıklar suda yaşar. Hamsi bir balıktır. Hamsi nerede yaşar?',options:['Suda','Ağaçta','Çölde'],correctIndex:0},
    ],
  },
  {
    code:'planning_sequence',
    title:'Planlama Rotası',
    instruction:'Hedefe ulaşmak için adımları doğru sıraya koy.',
    first:[
      {prompt:'Diş fırçalamada ilk adım hangisi?',options:['Macunu fırçaya sürmek','Ağzı durulamak','Fırçayı kaldırmak'],correctIndex:0},
      {prompt:'Bir kitabı ödünç almadan önce ne yapılır?',options:['Kitabı seçmek','Eve dönmek','Kitabı iade etmek'],correctIndex:0},
      {prompt:'Bitkiyi sularken önce ne kontrol edilir?',options:['Toprağın durumu','Televizyon','Ayakkabı'],correctIndex:0},
    ],
    transfer:[
      {prompt:'Sandviç hazırlarken ilk iş hangisi?',options:['Malzemeleri hazırlamak','Tabağı yıkamak','Masadan kalkmak'],correctIndex:0},
      {prompt:'Ödev yapmadan önce ne yapılır?',options:['Gerekli araçları hazırlamak','Defteri kapatmak','Uyumak'],correctIndex:0},
      {prompt:'Bir geziye çıkmadan önce ne yapılır?',options:['Gerekli eşyaları hazırlamak','Eve dönmek','Fotoğrafları silmek'],correctIndex:0},
    ],
  },
];

export type IntelligenceTrialScore={
  correct:number;
  questionCount:number;
  accuracy:number;
  revisions:number;
  durationMs:number;
};

export function scoreIntelligenceTrial(input:{
  puzzles:IntelligencePuzzle[];
  answers:number[];
  revisions:number[];
  startedAt:number;
  completedAt:number;
}):IntelligenceTrialScore{
  const correct=input.puzzles.reduce((sum,puzzle,index)=>sum+(input.answers[index]===puzzle.correctIndex?1:0),0);
  return {
    correct,
    questionCount:input.puzzles.length,
    accuracy:input.puzzles.length?correct/input.puzzles.length:0,
    revisions:input.revisions.reduce((sum,value)=>sum+Math.max(0,value||0),0),
    durationMs:Math.max(0,Math.round(input.completedAt-input.startedAt)),
  };
}

export function intelligenceSessionSummary(input:{first:IntelligenceTrialScore;transfer:IntelligenceTrialScore}){
  const transferDelta=input.transfer.accuracy-input.first.accuracy;
  return {
    firstAccuracy:Number(input.first.accuracy.toFixed(2)),
    transferAccuracy:Number(input.transfer.accuracy.toFixed(2)),
    transferDelta:Number(transferDelta.toFixed(2)),
    totalRevisions:input.first.revisions+input.transfer.revisions,
    band:input.transfer.accuracy===1
      ?'STRONG_TRANSFER'
      :input.transfer.accuracy>=2/3
        ?'DEVELOPING'
        :'NEEDS_GUIDED_PRACTICE',
  } as const;
}

export function buildIntelligenceLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  mode:IntelligenceGameMode;
  startedAt:string;
  completedAt:string;
  first:IntelligenceTrialScore;
  transfer:IntelligenceTrialScore;
}){
  const summary=intelligenceSessionSummary({first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'intelligence_games',
    moduleVersion:'1.0.0',
    activityType:'intelligence_'+input.mode,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:'independent' as const,
    performance:{
      firstAccuracy:summary.firstAccuracy,
      transferAccuracy:summary.transferAccuracy,
      transferDelta:summary.transferDelta,
      revisions:summary.totalRevisions,
      firstDurationMs:input.first.durationMs,
      transferDurationMs:input.transfer.durationMs,
      band:summary.band,
    },
    skills:[input.mode,'problem_solving','strategy_revision','problem_solving_transfer'],
    metadata:{mode:input.mode,educationalOnly:true,iqEquivalent:false},
  };
}
