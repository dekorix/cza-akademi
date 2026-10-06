export type EffectiveNoteMode='main_idea_filter'|'keyword_notes'|'question_answer'|'summary_compression';

export type NotePrompt={
  label:string;
  options:string[];
  correctIndex:number;
};

export type EffectiveNoteTask={
  title:string;
  source:string;
  prompts:NotePrompt[];
};

export type EffectiveNoteActivity={
  code:EffectiveNoteMode;
  title:string;
  instruction:string;
  first:EffectiveNoteTask;
  transfer:EffectiveNoteTask;
};

export const effectiveNoteActivities:EffectiveNoteActivity[]=[
  {
    code:'main_idea_filter',
    title:'Ana Fikri Süz',
    instruction:'Metindeki ana düşünceyi ayrıntılardan ayır ve kısa nota dönüştür.',
    first:{
      title:'Su Döngüsü',
      source:'Güneşin ısıttığı sular buharlaşır ve havaya yükselir. Yükselen su buharı soğuyarak küçük damlacıklara dönüşür ve bulutları oluşturur. Damlacıklar ağırlaştığında yağmur veya kar olarak yeryüzüne düşer. Su yeniden göl, akarsu ve denizlerde toplanır.',
      prompts:[
        {label:'Ana fikir',options:['Su doğada sürekli dolaşır','Güneş çok sıcaktır','Bulutlar beyazdır'],correctIndex:0},
        {label:'Önemli süreç',options:['Buharlaşma ve yağış','Rüzgârın yönü','Gece-gündüz'],correctIndex:0},
        {label:'Sonuç',options:['Su yeniden yeryüzünde toplanır','Su tamamen kaybolur','Denizler kurur'],correctIndex:0},
      ],
    },
    transfer:{
      title:'Bitkilerin Büyümesi',
      source:'Bitkiler büyümek için ışık, su ve uygun sıcaklığa ihtiyaç duyar. Kökler topraktan su ve mineralleri alır. Yapraklar güneş ışığını kullanarak besin üretir. Uygun koşullar sürdüğünde bitki yeni yapraklar oluşturur ve gelişir.',
      prompts:[
        {label:'Ana fikir',options:['Bitkiler uygun koşullarda büyür','Toprak her zaman kurudur','Yapraklar düşer'],correctIndex:0},
        {label:'Önemli süreç',options:['Köklerin su alması ve yaprakların besin üretmesi','Saksının rengi','Bahçenin büyüklüğü'],correctIndex:0},
        {label:'Sonuç',options:['Bitki gelişir','Bitki taş olur','Işık kaybolur'],correctIndex:0},
      ],
    },
  },
  {
    code:'keyword_notes',
    title:'Anahtar Kelime Notu',
    instruction:'Uzun cümle yerine hatırlamayı tetikleyecek kısa anahtar kelimeleri seç.',
    first:{
      title:'Arıların Görevi',
      source:'Arılar çiçeklerden nektar toplarken polenleri bir çiçekten diğerine taşır. Bu taşıma bitkilerin çoğalmasına yardımcı olur. Arılar ayrıca kovanda bal üretir ve düzenli bir iş bölümüyle çalışır.',
      prompts:[
        {label:'Anahtar 1',options:['tozlaşma','koltuk','trafik'],correctIndex:0},
        {label:'Anahtar 2',options:['bal','masa','defter'],correctIndex:0},
        {label:'Anahtar 3',options:['iş bölümü','uyku','oyun'],correctIndex:0},
      ],
    },
    transfer:{
      title:'Karıncalar',
      source:'Karıncalar koloniler hâlinde yaşar. Yiyecek bulduklarında diğer karıncalara koku izleri bırakır. Yuvada farklı görevleri olan karıncalar birlikte çalışarak koloninin ihtiyaçlarını karşılar.',
      prompts:[
        {label:'Anahtar 1',options:['koloni','televizyon','bulut'],correctIndex:0},
        {label:'Anahtar 2',options:['koku izi','yastık','kalem'],correctIndex:0},
        {label:'Anahtar 3',options:['işbirliği','gürültü','renk'],correctIndex:0},
      ],
    },
  },
  {
    code:'question_answer',
    title:'Soru-Cevap Notu',
    instruction:'Notu pasif cümle olmaktan çıkar; kendine soracağın soruyla birlikte yaz.',
    first:{
      title:'Maddenin Hâlleri',
      source:'Maddeler katı, sıvı ve gaz hâlinde bulunabilir. Isı alan bazı katılar eriyerek sıvıya dönüşür. Sıvılar yeterince ısı aldığında buharlaşarak gaz hâline geçebilir.',
      prompts:[
        {label:'İyi soru',options:['Maddenin temel hâlleri nelerdir?','Bugün günlerden ne?','Kalem nerede?'],correctIndex:0},
        {label:'Kısa cevap',options:['Katı, sıvı, gaz','Mavi, kırmızı','Sabah, akşam'],correctIndex:0},
        {label:'Dönüşüm',options:['Isı hâl değişimini sağlayabilir','Isı her şeyi dondurur','Madde değişmez'],correctIndex:0},
      ],
    },
    transfer:{
      title:'Dünya ve Ay',
      source:'Ay, Dünya’nın doğal uydusudur ve Dünya’nın çevresinde dolanır. Ay kendi ışığını üretmez; Güneş’ten aldığı ışığı yansıtır. Ay’ın Dünya’dan farklı biçimlerde görünmesine evreler denir.',
      prompts:[
        {label:'İyi soru',options:['Ay neden parlak görünür?','Çanta ne renk?','Saat kaç?'],correctIndex:0},
        {label:'Kısa cevap',options:['Güneş ışığını yansıtır','Kendi ışığını üretir','Elektrikle parlar'],correctIndex:0},
        {label:'Kavram',options:['evre','sıcaklık','toprak'],correctIndex:0},
      ],
    },
  },
  {
    code:'summary_compression',
    title:'Kısa Özet',
    instruction:'Metni birkaç güçlü fikirle sıkıştır; ayrıntıyı değil anlam omurgasını koru.',
    first:{
      title:'Geri Dönüşüm',
      source:'Kâğıt, cam, metal ve bazı plastikler uygun şekilde ayrıldığında yeniden işlenebilir. Geri dönüşüm doğal kaynak kullanımını ve atık miktarını azaltmaya yardımcı olur. Bunun için atıkların doğru kutulara ayrılması önemlidir.',
      prompts:[
        {label:'Ana amaç',options:['Kaynak ve atığı azaltmak','Daha çok çöp üretmek','Kutuları karıştırmak'],correctIndex:0},
        {label:'Temel işlem',options:['Atıkları ayırmak','Hepsini yakmak','Sokağa bırakmak'],correctIndex:0},
        {label:'Kapsam',options:['Kâğıt, cam, metal ve bazı plastikler','Yalnız su','Yalnız taş'],correctIndex:0},
      ],
    },
    transfer:{
      title:'Enerji Tasarrufu',
      source:'Gereksiz yanan lambaları kapatmak, kullanılmayan cihazları prizden çekmek ve doğal ışıktan yararlanmak elektrik tüketimini azaltabilir. Küçük alışkanlıklar birlikte uygulandığında enerji tasarrufuna katkı sağlar.',
      prompts:[
        {label:'Ana amaç',options:['Enerji tüketimini azaltmak','Daha çok cihaz açmak','Işığı hiç kapatmamak'],correctIndex:0},
        {label:'Örnek davranış',options:['Gereksiz lambayı kapatmak','Bütün cihazları açık bırakmak','Gündüz perdeyi kapatmak'],correctIndex:0},
        {label:'Sonuç',options:['Küçük alışkanlıklar tasarrufa katkı sağlar','Hiçbir şey değişmez','Elektrik sınırsızdır'],correctIndex:0},
      ],
    },
  },
];

export type EffectiveNoteTrialScore={
  correct:number;
  promptCount:number;
  selectionAccuracy:number;
  noteWordCount:number;
  sourceWordCount:number;
  compressionRatio:number;
  durationMs:number;
};

function wordCount(text:string){
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function scoreEffectiveNoteTrial(input:{
  task:EffectiveNoteTask;
  answers:number[];
  note:string;
  startedAt:number;
  completedAt:number;
}):EffectiveNoteTrialScore{
  const correct=input.task.prompts.reduce((sum,prompt,index)=>sum+(input.answers[index]===prompt.correctIndex?1:0),0);
  const noteWordCount=wordCount(input.note);
  const sourceWordCount=wordCount(input.task.source);
  return {
    correct,
    promptCount:input.task.prompts.length,
    selectionAccuracy:input.task.prompts.length?correct/input.task.prompts.length:0,
    noteWordCount,
    sourceWordCount,
    compressionRatio:sourceWordCount?noteWordCount/sourceWordCount:0,
    durationMs:Math.max(0,Math.round(input.completedAt-input.startedAt)),
  };
}

export function effectiveNoteSummary(input:{first:EffectiveNoteTrialScore;transfer:EffectiveNoteTrialScore}){
  const transferCompact=input.transfer.compressionRatio>0&&input.transfer.compressionRatio<=.45;
  return {
    firstAccuracy:Number(input.first.selectionAccuracy.toFixed(2)),
    transferAccuracy:Number(input.transfer.selectionAccuracy.toFixed(2)),
    transferCompression:Number(input.transfer.compressionRatio.toFixed(2)),
    band:input.transfer.selectionAccuracy===1&&transferCompact
      ?'STRONG_TRANSFER'
      :input.transfer.selectionAccuracy>=2/3
        ?'DEVELOPING'
        :'NEEDS_GUIDED_PRACTICE',
  } as const;
}

export function buildEffectiveNoteLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  mode:EffectiveNoteMode;
  startedAt:string;
  completedAt:string;
  first:EffectiveNoteTrialScore;
  transfer:EffectiveNoteTrialScore;
}){
  const summary=effectiveNoteSummary({first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'effective_notes',
    moduleVersion:'1.0.0',
    activityType:'effective_notes_'+input.mode,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:'independent' as const,
    performance:{
      firstAccuracy:summary.firstAccuracy,
      transferAccuracy:summary.transferAccuracy,
      firstCompression:Number(input.first.compressionRatio.toFixed(2)),
      transferCompression:summary.transferCompression,
      firstNoteWordCount:input.first.noteWordCount,
      transferNoteWordCount:input.transfer.noteWordCount,
      band:summary.band,
    },
    skills:['main_idea','keyword_extraction','note_compression',input.mode,'note_transfer'],
    metadata:{mode:input.mode,rawNoteStored:false,semanticAutoGrading:false,educationalOnly:true},
  };
}
