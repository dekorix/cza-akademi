export type SpeedReadingMode='phrase_chunking'|'visual_span'|'paced_reading'|'comprehension_balance';

export type ReadingPassage={
  title:string;
  text:string;
  questions:{prompt:string;options:string[];correctIndex:number}[];
};

export type SpeedReadingActivity={
  code:SpeedReadingMode;
  title:string;
  instruction:string;
  first:ReadingPassage;
  transfer:ReadingPassage;
};

export const speedReadingActivities:SpeedReadingActivity[]=[
  {
    code:'phrase_chunking',
    title:'Kelime Gruplarıyla Okuma',
    instruction:'Kelime kelime durmak yerine anlamlı küçük söz gruplarını birlikte görmeye çalış.',
    first:{
      title:'Bahçedeki Sabah',
      text:'Sabah erkenden bahçeye çıkan Ece, çiçeklerin üzerinde küçük su damlaları gördü. Güneş yükseldikçe damlalar parladı. Ece önce gülleri suladı, sonra yerdeki kuru yaprakları topladı. İşini bitirince bankta oturup kuşların sesini dinledi.',
      questions:[
        {prompt:'Ece önce ne yaptı?',options:['Gülleri suladı','Kuşları besledi','Kitap okudu'],correctIndex:0},
        {prompt:'Ece en son ne yaptı?',options:['Eve girdi','Kuşları dinledi','Top oynadı'],correctIndex:1},
      ],
    },
    transfer:{
      title:'Kütüphane Günü',
      text:'Mert okuldan sonra kütüphaneye uğradı. Önce bilim kitaplarının olduğu rafı gezdi. Uzayla ilgili bir kitap seçip sessiz bir masaya oturdu. Okurken önemli bulduğu iki bilgiyi defterine yazdı. Çıkmadan önce kitabı görevliye teslim etti.',
      questions:[
        {prompt:'Mert hangi konuda kitap seçti?',options:['Uzay','Spor','Müzik'],correctIndex:0},
        {prompt:'Okurken ne yaptı?',options:['Resim çizdi','İki bilgi not etti','Arkadaşını aradı'],correctIndex:1},
      ],
    },
  },
  {
    code:'visual_span',
    title:'Görsel Alanı Genişletme',
    instruction:'Satırın ortasına bakarken yanındaki kelimeleri de tek bakışta yakalamaya çalış.',
    first:{
      title:'Deniz Kıyısında',
      text:'Deniz kıyısında yürüyen çocuklar kumların arasında parlak bir taş buldu. Taşı hemen almak yerine dikkatle incelediler. Üzerindeki çizgilerin doğal olduğunu fark ettiler. Sonra taşı yerine bırakıp yürüyüşlerine devam ettiler.',
      questions:[
        {prompt:'Çocuklar ne buldu?',options:['Parlak bir taş','Oyuncak','Kabuklu yemiş'],correctIndex:0},
        {prompt:'Taşa ne yaptılar?',options:['Eve götürdüler','Yerine bıraktılar','Denize attılar'],correctIndex:1},
      ],
    },
    transfer:{
      title:'Yağmur Sonrası',
      text:'Yağmur durunca sokaktaki hava serinledi. Duru pencereden dışarı baktı ve kaldırımdaki küçük su birikintilerini gördü. Şemsiyesini alıp annesiyle markete yürüdü. Dönüşte gökyüzünde kısa süreli bir gökkuşağı belirdi.',
      questions:[
        {prompt:'Duru nereye gitti?',options:['Parka','Markete','Okula'],correctIndex:1},
        {prompt:'Dönüşte ne gördü?',options:['Gökkuşağı','Kar','Uçak'],correctIndex:0},
      ],
    },
  },
  {
    code:'paced_reading',
    title:'Akıcı Tempo',
    instruction:'Ritmi koru; gereksiz durakları azalt ama anlamı kaybetme.',
    first:{
      title:'Küçük Deney',
      text:'Öğretmen masaya iki bardak koydu. Birine sıcak, diğerine soğuk su doldurdu. Öğrenciler iki bardağa da birer küp şeker attı. Şekerin sıcak suda daha hızlı çözündüğünü gözlemlediler ve sonucu defterlerine yazdılar.',
      questions:[
        {prompt:'Deneyde ne kullanıldı?',options:['İki bardak su','İki tabak','İki kutu'],correctIndex:0},
        {prompt:'Şeker nerede daha hızlı çözüldü?',options:['Soğuk suda','Sıcak suda','İkisinde aynı'],correctIndex:1},
      ],
    },
    transfer:{
      title:'Tohumların Takibi',
      text:'Sınıf iki aynı saksıya fasulye tohumu ekti. Saksılardan biri pencere önüne, diğeri karanlık bir dolaba bırakıldı. Her ikisine de aynı miktarda su verildi. Bir hafta sonra öğrenciler bitkilerin görünüşünü karşılaştırdı.',
      questions:[
        {prompt:'Saksılara ne ekildi?',options:['Fasulye','Buğday','Çiçek'],correctIndex:0},
        {prompt:'İki saksıda aynı olan neydi?',options:['Işık','Yer','Su miktarı'],correctIndex:2},
      ],
    },
  },
  {
    code:'comprehension_balance',
    title:'Hız + Anlama Dengesi',
    instruction:'Amacın yalnız bitirmek değil; temel bilgiyi ve olay sırasını koruyarak akıcı okumak.',
    first:{
      title:'Kaybolan Anahtar',
      text:'Bora evden çıkarken anahtarını bulamadı. Önce montunun ceplerine baktı, sonra çalışma masasını kontrol etti. Anahtar masada yoktu. En son sabah kullandığı sırt çantasını açtı ve anahtarı küçük ön gözde buldu.',
      questions:[
        {prompt:'Bora anahtarı nerede buldu?',options:['Montta','Sırt çantasında','Masada'],correctIndex:1},
        {prompt:'Masadan önce nereye baktı?',options:['Mont ceplerine','Dolaba','Ayakkabılığa'],correctIndex:0},
      ],
    },
    transfer:{
      title:'Otobüs Durağı',
      text:'Selin durağa geldiğinde otobüs henüz gelmemişti. Beklerken çantasından küçük bir kitap çıkardı. Birkaç sayfa okuduktan sonra otobüsü uzaktan gördü. Kitabı kapatıp yerine koydu ve kartını hazırladı.',
      questions:[
        {prompt:'Selin beklerken ne yaptı?',options:['Kitap okudu','Telefonla konuştu','Koştu'],correctIndex:0},
        {prompt:'Otobüsü görünce ne hazırladı?',options:['Anahtarını','Kartını','Defterini'],correctIndex:1},
      ],
    },
  },
];

export type ReadingTrialScore={
  wordCount:number;
  durationMs:number;
  wpm:number;
  correctAnswers:number;
  questionCount:number;
  comprehension:number;
};

export function countWords(text:string){
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function scoreReadingTrial(input:{
  text:string;
  durationMs:number;
  answers:number[];
  correctAnswers:number[];
}):ReadingTrialScore{
  const wordCount=countWords(input.text);
  const durationMs=Math.max(1000,Math.round(input.durationMs));
  const minutes=durationMs/60_000;
  const wpm=Math.max(0,Math.round(wordCount/minutes));
  const correctAnswers=input.correctAnswers.reduce((total,correct,index)=>total+(input.answers[index]===correct?1:0),0);
  const questionCount=input.correctAnswers.length;
  return {
    wordCount,
    durationMs,
    wpm,
    correctAnswers,
    questionCount,
    comprehension:questionCount?correctAnswers/questionCount:0,
  };
}

export function speedReadingSummary(input:{first:ReadingTrialScore;transfer:ReadingTrialScore}){
  const speedChange=input.first.wpm?((input.transfer.wpm-input.first.wpm)/input.first.wpm):0;
  const comprehensionFloor=Math.min(input.first.comprehension,input.transfer.comprehension);
  return {
    firstWpm:input.first.wpm,
    transferWpm:input.transfer.wpm,
    speedChange:Number(speedChange.toFixed(2)),
    firstComprehension:Number(input.first.comprehension.toFixed(2)),
    transferComprehension:Number(input.transfer.comprehension.toFixed(2)),
    band:comprehensionFloor<.5
      ?'COMPREHENSION_FIRST'
      :input.transfer.comprehension>=.75&&speedChange>=-.15
        ?'BALANCED_TRANSFER'
        :'BUILD_FLUENCY',
  } as const;
}

export function buildSpeedReadingLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  mode:SpeedReadingMode;
  startedAt:string;
  completedAt:string;
  first:ReadingTrialScore;
  transfer:ReadingTrialScore;
}){
  const summary=speedReadingSummary({first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'speed_reading',
    moduleVersion:'1.0.0',
    activityType:'speed_reading_'+input.mode,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:'independent' as const,
    performance:{
      firstWpm:summary.firstWpm,
      transferWpm:summary.transferWpm,
      speedChange:summary.speedChange,
      firstComprehension:summary.firstComprehension,
      transferComprehension:summary.transferComprehension,
      band:summary.band,
    },
    skills:['reading_fluency','reading_comprehension',input.mode,'reading_transfer'],
    metadata:{mode:input.mode,educationalOnly:true,normReferenced:false},
  };
}
