import type { SpecialLearningProfile } from './special-learning-profile';

export type ParentFriendlySpecialReport = {
  title:string;
  studentDisplayName:string;
  profileLabel:string;
  summary:string;
  strengths:string[];
  supportPriorities:string[];
  progress:{
    status:'NOT_STARTED'|'ACTIVE'|'COMPLETED';
    completedSessions:number;
    totalSessions:number;
    percent:number;
    currentWeek:number|null;
  };
  change:{
    available:boolean;
    headline:string;
    areas:{label:string;change:string;nextStep:string}[];
  };
  homeSupport:string[];
  educatorNote:string;
  disclaimer:string;
};

const homeBank:Record<string,string[]>={
  phonological:[
    'Kısa ses oyunları yapın: kelimenin ilk/son sesini bulma, sesi çıkarma veya değiştirme.',
    'Yanlış cevapta cevabı hemen söylemek yerine çocuğa birkaç saniye düşünme süresi verin.',
  ],
  letter_sound:[
    'Günde birkaç dakika, az sayıda harfle ses–harf eşleştirmesi yapın; hızdan önce doğruluğu koruyun.',
    'Karışan harfleri aynı anda çok sayıda vermek yerine küçük çiftler hâlinde çalışın.',
  ],
  orthographic:[
    'Benzer görünen harf ve kelimeleri kısa eşleştirme oyunlarıyla ayırt ettirin.',
    'Yazı tipi veya büyük-küçük harf değişse de aynı biçimi tanımaya yönelik kısa oyunlar kullanın.',
  ],
  blending:[
    'Sesleri yavaşça söyleyip çocuğun birleştirmesini bekleyin; mümkün olduğunca cevabı siz tamamlamayın.',
    'Kısa hece ve kelimelerden başlayıp yeni örneklere geçin.',
  ],
  decoding:[
    'Tahmin etmek yerine harf–ses yolunu kullanmasını teşvik edin.',
    'Gerçek kelimelerin yanında kısa, anlamsız ama okunabilir dizilerle çözümleme pratiği yapın.',
  ],
  fluency:[
    'Aynı kısa metni birkaç gün arayla tekrar okuyun; amaç hatasız ve rahat okumadır.',
    'Süre tutmayı yarışa dönüştürmeyin; önce doğruluk ve anlamı koruyun.',
  ],
  comprehension:[
    'Okuma sonrası kısa “kim, ne, nerede, neden?” soruları sorun.',
    'Çocuğun cevabını metinden kanıt göstermesiyle destekleyin.',
  ],
  dictation:[
    'Kısa ses, hece ve kelime dikteleri yapın; sonra kendi yazısını geri okumasını isteyin.',
    'Hataları topluca düzeltmek yerine bir veya iki hedef seçin.',
  ],
  working_memory:[
    '2 adımlı kısa yönergeler verin; başarı arttıkça 3 adıma geçin.',
    'Ses veya kelime dizilerini kısa oyunlarla sırayla hatırlatın.',
  ],
  ran:[
    'Tanıdığı renk, şekil veya harfleri kısa diziler hâlinde rahatça adlandırma çalışmaları yapın.',
    'Hız baskısı oluşturmayın; akıcılık doğal olarak artsın.',
  ],
  error_awareness:[
    '“Burada farklı olan ne?” gibi sorularla kendi hatasını fark etmesine fırsat verin.',
    'Doğruyu söylemeden önce kendi düzeltmesini yapıp yapamayacağını bekleyin.',
  ],
  learning_transfer:[
    'Öğrendiği kuralı farklı bir örnekte kullanmasını isteyin.',
    'Aynı örneği ezberletmek yerine benzer ama yeni örnekler kullanın.',
  ],
};

function unique(items:string[],max=6){
  return [...new Set(items.filter(Boolean))].slice(0,max);
}
function changeLabel(outcome:string){
  if(outcome==='IMPROVED') return 'Belirgin gelişim';
  if(outcome==='PARTIAL_IMPROVEMENT') return 'Kısmi gelişim';
  if(outcome==='PERSISTENT_PRIORITY') return 'Bu alanda destek ihtiyacı sürüyor';
  if(outcome==='STABLE') return 'Benzer düzeyde';
  return 'Ek gözlem gerekli';
}

export function buildParentFriendlySpecialReport(input:{
  studentDisplayName:string;
  profile:SpecialLearningProfile;
  program:null|{
    status:string;
    completedSessions:number;
    totalSessions:number;
    progress:number;
    currentWeek:number;
  };
  reassessment:null|{
    overallOutcome?:string;
    areas?:{key:string;label:string;outcome:string;nextStep:string}[];
  };
  educatorNote?:string;
}):ParentFriendlySpecialReport{
  const strengths=input.profile.domains
    .filter(domain=>domain.status==='RELATIVE_STRENGTH')
    .map(domain=>domain.label);
  const support=input.profile.domains
    .filter(domain=>domain.status==='WATCH'||domain.status==='PRIORITY'||domain.status==='EXPERT_REVIEW')
    .map(domain=>domain.label)
    .slice(0,5);

  const program=input.program;
  const progress=program?{
    status:(program.status==='completed'?'COMPLETED':'ACTIVE') as 'COMPLETED'|'ACTIVE',
    completedSessions:program.completedSessions,
    totalSessions:program.totalSessions,
    percent:program.progress,
    currentWeek:program.currentWeek,
  }:{
    status:'NOT_STARTED' as const,
    completedSessions:0,totalSessions:0,percent:0,currentWeek:null,
  };

  const reassessmentAreas=input.reassessment?.areas||[];
  const changeAvailable=reassessmentAreas.length>0;
  const changeHeadline=!changeAvailable
    ? 'Program sonrası karşılaştırma henüz tamamlanmadı.'
    : input.reassessment?.overallOutcome==='IMPROVED'
      ? 'Çalışılan alanlarda belirgin ilerleme gözlendi.'
      : input.reassessment?.overallOutcome==='PERSISTENT_PRIORITY'
        ? 'Bazı hedef alanlarda destek ihtiyacı devam ediyor.'
        : 'Bazı alanlarda gelişim var; bazı alanlarda desteğin sürmesi gerekiyor.';

  const homeSupport=unique([
    ...support.flatMap(label=>{
      const domain=input.profile.domains.find(item=>item.label===label);
      return domain?homeBank[domain.key]||[]:[];
    }),
    'Çalışmaları kısa tutun, yorgunluk ve başarısızlık hissi oluşursa ara verin.',
    'Çabayı ve kullanılan stratejiyi övün; yalnız hız veya doğru sayısına odaklanmayın.',
  ],6);

  const summary=support.length
    ? `${input.profile.profileLabel} kapsamında eğitimsel değerlendirme yapıldı. ${support.slice(0,3).join(', ')} alanları yakın destek önceliği olarak izlendi.`
    : `${input.profile.profileLabel} kapsamında eğitimsel değerlendirme yapıldı. Belirgin bir eğitim önceliği yerine mevcut becerilerin korunması ve izlenmesi öne çıktı.`;

  return {
    title:'Çelik Zihin Akademisi · Gelişim ve Destek Özeti',
    studentDisplayName:input.studentDisplayName,
    profileLabel:input.profile.profileLabel,
    summary,
    strengths:strengths.length?strengths:['Değerlendirmede göreli güçlü alanlar program içinde destekleyici kaynak olarak kullanılmaktadır.'],
    supportPriorities:support.length?support:['Şu anda belirgin bir ek öncelik bulunmuyor; gelişim izlenmektedir.'],
    progress,
    change:{
      available:changeAvailable,
      headline:changeHeadline,
      areas:reassessmentAreas.slice(0,6).map(area=>({
        label:area.label,
        change:changeLabel(area.outcome),
        nextStep:area.nextStep,
      })),
    },
    homeSupport,
    educatorNote:(input.educatorNote||'').trim().slice(0,1000),
    disclaimer:'Bu rapor eğitimsel gelişim ve destek planlaması içindir. Klinik tanı koymaz ve sağlık değerlendirmesinin yerine geçmez.',
  };
}
