(function(root){
  'use strict';
  const bank=root.E3_BANK;if(!bank)throw new Error('E3_BANK must load first');
  const extra={
    VC:{id:'VC15',minAge:36,tier:1,role:'anchor',modality:'sorting',title:'Görsel Gruplama Masası',childPrompt:'Bunları sana göre gruplara ayırır mısın?',protocol:'Dört–altı gerçek nesne/kart kullan. Gruplama kuralını söyleme; çocuğun kendiliğinden seçtiği ortaklığı kaydet.',facets:['kategori','çoklu-özellik'],scoring:'process'},
    RL:{id:'RL15',minAge:36,tier:1,role:'anchor',modality:'gesture-choice',title:'Jest ve Sözel Bilgiyi Birleştir',childPrompt:'Bana gösterdiğim yerdeki oyuncağı getir.',protocol:'Sözel yönergeye tek bir doğal jest ekle. Jest tek başına cevabı göstermesin; iki kanalı birlikte kullanmasını gözle.',facets:['tek-adım','konum'],scoring:'process'},
    EL:{id:'EL15',minAge:36,tier:1,role:'anchor',modality:'dialogue',title:'Kısa Karşılıklı Konuşma',childPrompt:'Ben sana bir şey soracağım, sonra sen de bana sorabilirsin.',protocol:'Tanıdık tema üzerinde iki–üç dönüşlü kısa diyalog kur. Konu sürdürme ve karşılıklı dönüşü not et.',facets:['istek','onarım','olay-anlatımı'],scoring:'process'},
    MA:{id:'MA15',minAge:36,tier:1,role:'anchor',modality:'movement-math',title:'Bedensel Nicelik',childPrompt:'İki kez zıplar mısın?',protocol:'1–3 arası küçük niceliği bedensel eylemle eşleştir. Saymayı modelleme; eylem sayısını gözle.',facets:['nicelik','sayma'],scoring:'process'},
    MM:{id:'MM15',minAge:36,tier:1,role:'anchor',modality:'spatial-retrieval',title:'İki Konumdan Geri Çağırma',childPrompt:'Oyuncaklardan hangisi hangi kutudaydı?',protocol:'İki farklı nesneyi iki konuma yerleştir, kısa süre kapat ve her ikisinin konumunu sırayla sor.',facets:['konum','görsel-kısa','sıra'],scoring:'process'},
    EF:{id:'EF15',minAge:36,tier:1,role:'anchor',modality:'auditory-target',title:'Ses Hedefini Bekle',childPrompt:'Sadece zil sesini duyunca dokun.',protocol:'İki farklı ses kullan; hedef dışı seste yanıtı ketleme ve hedef seste başlatmayı gözle.',facets:['hedef-seçimi','ketleme','bekleme'],scoring:'process'},
    SE:{id:'SE15',minAge:36,tier:1,role:'anchor',modality:'cooperative-play',title:'Ortak Yapım Oyunu',childPrompt:'Bunu birlikte yapalım.',protocol:'İki kişinin sırayla parça eklediği kısa yapı oyunu kur. Sıra, ortak hedef ve yardım isteme/verme davranışlarını gözle.',facets:['sıra','oyuna-katılma','yardım-etme'],scoring:'process'},
    MO:{id:'MO15',minAge:36,tier:1,role:'anchor',modality:'pegboard',title:'Delik–Parça Yerleştirme',childPrompt:'Parçaları uygun yerlere yerleştir.',protocol:'Büyük ve güvenli yerleştirme parçaları kullan; görsel-motor yönelim, kavrama ve iki el kullanımını kaydet.',facets:['ince-motor','iki-el'],scoring:'process'},
    DL:{id:'DL15',minAge:36,tier:1,role:'anchor',modality:'picture-sequence',title:'Günlük Rutin Kartları',childPrompt:'Önce hangisi olur, sonra hangisi?',protocol:'İki tanıdık günlük rutin görselini kullan; kültürel olarak tek doğru sıra olmayan örneklerden kaçın.',facets:['rutin-sıra','düzen'],scoring:'process'},
    LT:{id:'LT15',minAge:36,tier:1,role:'anchor',modality:'guided-discovery',title:'İpucunu Kullanıp Kuralı Bul',childPrompt:'Sana küçük bir ipucu vereceğim; sonra nasıl yapacağını sen bul.',protocol:'Çözümü göstermeyen tek ipucu ver. İpucundan sonra strateji değişimi ve bağımsız tamamlama olup olmadığını kaydet.',facets:['ipucu-kullanma','strateji','öz-düzeltme'],scoring:'process'}
  };
  for(const d of bank.domains){if(extra[d.id])d.tasks.push(extra[d.id])}
  bank.allTasks=bank.domains.flatMap(d=>d.tasks);
  bank.meta.version='E3-v3.2';
  bank.meta.depthExpansion='Her gelişim alanına farklı yöntemle ek kanıt görevi eklendi';
})(typeof globalThis!=='undefined'?globalThis:this);
