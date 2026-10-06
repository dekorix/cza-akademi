export type MindMapMode='branch_match'|'keyword_compression'|'hierarchy'|'transfer_build';

export type MindMapBranch={
  label:string;
  clue:string;
  answer:string;
  options:string[];
};

export type MindMapTask={
  center:string;
  branches:MindMapBranch[];
};

export type MindMapActivity={
  code:MindMapMode;
  title:string;
  instruction:string;
  first:MindMapTask;
  transfer:MindMapTask;
};

export const mindMapActivities:MindMapActivity[]=[
  {
    code:'branch_match',
    title:'Merkezden 7 Dala',
    instruction:'Merkez konudan çıkan yedi dalın her birine uygun anahtar kelimeyi yerleştir.',
    first:{
      center:'Sağlıklı Kahvaltı',
      branches:[
        {label:'Amaç',clue:'Güne hazır başlamak',answer:'enerji',options:['enerji','raf','sessizlik']},
        {label:'Yiyecek',clue:'Protein kaynağı',answer:'yumurta',options:['yumurta','otobüs','kalem']},
        {label:'İçecek',clue:'Kahvaltıda içilebilir',answer:'süt',options:['süt','taş','defter']},
        {label:'Meyve',clue:'Bir meyve örneği',answer:'elma',options:['elma','masa','kapı']},
        {label:'Zaman',clue:'Günün başlangıcı',answer:'sabah',options:['sabah','gece','öğle']},
        {label:'Yer',clue:'Kahvaltı yapılan yer',answer:'ev',options:['ev','deniz','garaj']},
        {label:'Alışkanlık',clue:'Farklı besinleri dengeleme',answer:'denge',options:['denge','acele','gürültü']},
      ],
    },
    transfer:{
      center:'Kütüphane',
      branches:[
        {label:'Amaç',clue:'Yeni şeyler edinmek',answer:'öğrenmek',options:['öğrenmek','koşmak','uyumak']},
        {label:'Yer',clue:'Kitapların bulunduğu bölüm',answer:'raflar',options:['raflar','saha','mutfak']},
        {label:'Kişi',clue:'Yardım eden görevli',answer:'kütüphaneci',options:['kütüphaneci','şoför','aşçı']},
        {label:'Araç',clue:'Okunan kaynak',answer:'kitap',options:['kitap','top','kaşık']},
        {label:'Kural',clue:'Başkalarını rahatsız etmemek',answer:'sessizlik',options:['sessizlik','koşmak','bağırmak']},
        {label:'İşlem',clue:'Raflardan kaynak belirlemek',answer:'seçmek',options:['seçmek','saklamak','atmak']},
        {label:'Sonuç',clue:'Okuma sonunda kazanılan',answer:'bilgi',options:['bilgi','gürültü','uyku']},
      ],
    },
  },
  {
    code:'keyword_compression',
    title:'Uzun Cümleden Anahtar Kelimeye',
    instruction:'Uzun açıklamayı bir anahtar kelimeye sıkıştır. Zihin haritasında cümle değil, hatırlatıcı kelime kullan.',
    first:{
      center:'Okul Günü',
      branches:[
        {label:'Başlangıç',clue:'Sabah okula gelme zamanı',answer:'giriş',options:['giriş','çıkış','tatil']},
        {label:'Ders',clue:'Yeni bilgi öğrendiğimiz bölüm',answer:'öğrenme',options:['öğrenme','uyku','yemek']},
        {label:'Ara',clue:'Dersler arasında dinlenme',answer:'teneffüs',options:['teneffüs','ödev','servis']},
        {label:'Arkadaş',clue:'Birlikte yaptığımız işler',answer:'işbirliği',options:['işbirliği','yalnızlık','yarış']},
        {label:'Ödev',clue:'Evde tamamlanacak çalışma',answer:'tekrar',options:['tekrar','oyun','gezi']},
        {label:'Araç',clue:'Not yazdığımız şey',answer:'defter',options:['defter','tabak','yastık']},
        {label:'Bitiş',clue:'Derslerin sona ermesi',answer:'çıkış',options:['çıkış','başlangıç','kahvaltı']},
      ],
    },
    transfer:{
      center:'Doğa Gezisi',
      branches:[
        {label:'Hazırlık',clue:'Gerekli eşyaları önceden toplama',answer:'çanta',options:['çanta','televizyon','yastık']},
        {label:'Gözlem',clue:'Çevreyi dikkatle inceleme',answer:'bakmak',options:['bakmak','bağırmak','uyumak']},
        {label:'Kayıt',clue:'Gördüklerini yazma',answer:'not',options:['not','şarkı','oyun']},
        {label:'Canlı',clue:'Çevrede görülen hayvan',answer:'kuş',options:['kuş','masa','bardak']},
        {label:'Bitki',clue:'Çevrede görülen yeşil canlı',answer:'ağaç',options:['ağaç','telefon','kapı']},
        {label:'Kural',clue:'Çevreyi kirletmeme',answer:'temizlik',options:['temizlik','acele','gürültü']},
        {label:'Sonuç',clue:'Geziden edinilen yeni şeyler',answer:'deneyim',options:['deneyim','uyku','trafik']},
      ],
    },
  },
  {
    code:'hierarchy',
    title:'Ana Dal ve Ayrıntı',
    instruction:'Her dalın ana fikrini ayrıntıdan ayır. Ana dal kısa ve kapsayıcı olmalı.',
    first:{
      center:'Bir Kitap',
      branches:[
        {label:'Tür',clue:'Masal, öykü, bilgi kitabı gibi',answer:'tür',options:['tür','sayfa 12','mavi']},
        {label:'Konu',clue:'Kitabın ne anlattığı',answer:'konu',options:['konu','kalem','raf']},
        {label:'Kişiler',clue:'Olaydaki kahramanlar',answer:'karakter',options:['karakter','kapak','fiyat']},
        {label:'Yer',clue:'Olayın geçtiği ortam',answer:'mekân',options:['mekân','renk','çanta']},
        {label:'Zaman',clue:'Olayın gerçekleştiği dönem',answer:'zaman',options:['zaman','sayfa','masa']},
        {label:'Mesaj',clue:'Kitabın düşündürdüğü ana fikir',answer:'ana fikir',options:['ana fikir','yazı tipi','boyut']},
        {label:'Değerlendirme',clue:'Okur olarak düşüncen',answer:'yorum',options:['yorum','barkod','numara']},
      ],
    },
    transfer:{
      center:'Bir Film',
      branches:[
        {label:'Tür',clue:'Komedi, macera gibi',answer:'tür',options:['tür','koltuk','bilet']},
        {label:'Konu',clue:'Filmin anlattığı temel olay',answer:'konu',options:['konu','perde','salon']},
        {label:'Kişiler',clue:'Olaydaki kişiler',answer:'karakter',options:['karakter','ışık','ses']},
        {label:'Yer',clue:'Olayın geçtiği ortam',answer:'mekân',options:['mekân','kamera','renk']},
        {label:'Zaman',clue:'Olayın geçtiği dönem',answer:'zaman',options:['zaman','müzik','afiş']},
        {label:'Mesaj',clue:'Filmin düşündürdüğü temel düşünce',answer:'ana fikir',options:['ana fikir','süre','koltuk']},
        {label:'Değerlendirme',clue:'İzleyici düşüncesi',answer:'yorum',options:['yorum','bilet','salon']},
      ],
    },
  },
  {
    code:'transfer_build',
    title:'Yeni Konuya Harita Kur',
    instruction:'Aynı 7 dallı düşünme yapısını yeni bir konuya taşı.',
    first:{
      center:'Bir Gezi',
      branches:[
        {label:'Nereye?',clue:'Gidilen yer',answer:'yer',options:['yer','renk','ses']},
        {label:'Kim?',clue:'Katılan kişiler',answer:'kişi',options:['kişi','masa','hava']},
        {label:'Ne zaman?',clue:'Gezinin zamanı',answer:'zaman',options:['zaman','çanta','yol']},
        {label:'Nasıl?',clue:'Ulaşım biçimi',answer:'ulaşım',options:['ulaşım','kitap','oyun']},
        {label:'Neden?',clue:'Gezinin amacı',answer:'amaç',options:['amaç','kalem','renk']},
        {label:'Ne oldu?',clue:'Önemli olay',answer:'olay',options:['olay','bardak','kapı']},
        {label:'Ne öğrendim?',clue:'Geziden kalan bilgi',answer:'öğrenme',options:['öğrenme','uyku','gürültü']},
      ],
    },
    transfer:{
      center:'Bir Proje',
      branches:[
        {label:'Ne?',clue:'Yapılacak işin konusu',answer:'konu',options:['konu','renk','masa']},
        {label:'Kim?',clue:'Projeyi yapanlar',answer:'ekip',options:['ekip','kapı','bardak']},
        {label:'Ne zaman?',clue:'Tamamlama süresi',answer:'zaman',options:['zaman','oyun','ses']},
        {label:'Nasıl?',clue:'İzlenecek yol',answer:'yöntem',options:['yöntem','şarkı','koltuk']},
        {label:'Neden?',clue:'Projenin hedefi',answer:'amaç',options:['amaç','kalem','renk']},
        {label:'Araç?',clue:'Kullanılacak malzemeler',answer:'malzeme',options:['malzeme','hava','uyku']},
        {label:'Sonuç?',clue:'Ortaya çıkacak ürün',answer:'ürün',options:['ürün','gürültü','çanta']},
      ],
    },
  },
];

export type MindMapTrialScore={
  correctBranches:number;
  completedBranches:number;
  branchCount:number;
  accuracy:number;
  completeness:number;
  durationMs:number;
};

export function scoreMindMapTrial(input:{
  task:MindMapTask;
  selections:string[];
  startedAt:number;
  completedAt:number;
}):MindMapTrialScore{
  const branchCount=input.task.branches.length;
  const completedBranches=input.selections.filter(value=>typeof value==='string'&&value.length>0).length;
  const correctBranches=input.task.branches.reduce(
    (total,branch,index)=>total+(input.selections[index]===branch.answer?1:0),
    0,
  );
  return {
    correctBranches,
    completedBranches,
    branchCount,
    accuracy:branchCount?correctBranches/branchCount:0,
    completeness:branchCount?completedBranches/branchCount:0,
    durationMs:Math.max(0,Math.round(input.completedAt-input.startedAt)),
  };
}

export function mindMapSessionSummary(input:{first:MindMapTrialScore;transfer:MindMapTrialScore}){
  const transferDelta=input.transfer.accuracy-input.first.accuracy;
  return {
    firstAccuracy:Number(input.first.accuracy.toFixed(2)),
    transferAccuracy:Number(input.transfer.accuracy.toFixed(2)),
    transferDelta:Number(transferDelta.toFixed(2)),
    transferCompleteness:Number(input.transfer.completeness.toFixed(2)),
    band:input.transfer.accuracy>=.86&&input.transfer.completeness===1
      ?'STRONG_TRANSFER'
      :input.transfer.accuracy>=.57
        ?'DEVELOPING'
        :'NEEDS_GUIDED_PRACTICE',
  } as const;
}

export function buildMindMapLearningRecord(input:{
  trainingSessionId:string;
  clientRecordId:string;
  mode:MindMapMode;
  startedAt:string;
  completedAt:string;
  first:MindMapTrialScore;
  transfer:MindMapTrialScore;
}){
  const summary=mindMapSessionSummary({first:input.first,transfer:input.transfer});
  return {
    recordType:'module_record' as const,
    schemaVersion:'CZA_MODULE_RECORD_V1' as const,
    contractVersion:'1.0.0' as const,
    clientRecordId:input.clientRecordId,
    trainingSessionId:input.trainingSessionId,
    moduleId:'mind_maps',
    moduleVersion:'1.0.0',
    activityType:'mind_map_'+input.mode,
    startedAt:input.startedAt,
    completedAt:input.completedAt,
    supportLevel:'independent' as const,
    performance:{
      firstAccuracy:summary.firstAccuracy,
      transferAccuracy:summary.transferAccuracy,
      transferDelta:summary.transferDelta,
      transferCompleteness:summary.transferCompleteness,
      firstDurationMs:input.first.durationMs,
      transferDurationMs:input.transfer.durationMs,
      band:summary.band,
    },
    skills:['mind_mapping','keyword_encoding','categorization','hierarchy','mind_map_transfer'],
    metadata:{mode:input.mode,branchCount:7,educationalOnly:true},
  };
}
