import type { E3SectionId, E3SupportLevel } from './preschool-e3';

export type E3BehaviorFlag = 'ENGAGED' | 'AVOIDANCE' | 'FRUSTRATION' | 'FATIGUE' | 'SELF_CORRECTION' | 'SPONTANEOUS_EXPLANATION';

export type E3SectionProtocol = {
  sectionId: E3SectionId;
  shortLabel: string;
  setup: string;
  primaryEvidence: string[];
  materials: string[];
  educatorRules: string[];
  pauseRule: string;
};

export const e3SupportLadder: Array<{ value: E3SupportLevel; label: string; meaning: string }> = [
  { value: 'INDEPENDENT', label: 'Bağımsız', meaning: 'Ek yardım olmadan ortaya çıktı.' },
  { value: 'VERBAL_PROMPT', label: 'Sözel ipucu', meaning: 'Kısa sözel hatırlatma sonrası ortaya çıktı.' },
  { value: 'VISUAL_PROMPT', label: 'Görsel / jest ipucu', meaning: 'İşaret, jest veya görsel destek sonrası ortaya çıktı.' },
  { value: 'MODELED', label: 'Model sonrası', meaning: 'Yetişkin örnekledikten sonra ortaya çıktı.' },
  { value: 'PHYSICAL_ASSIST', label: 'Fiziksel yardım', meaning: 'Kısmi veya tam fiziksel destek gerekti.' },
  { value: 'NOT_OBSERVED', label: 'Henüz gözlenmedi', meaning: 'Uygun fırsat verildi ancak bu oturumda ortaya çıkmadı.' },
];

export const e3BehaviorFlags: Array<{ value: E3BehaviorFlag; label: string }> = [
  { value: 'ENGAGED', label: 'İlgili / katıldı' },
  { value: 'AVOIDANCE', label: 'Kaçınma' },
  { value: 'FRUSTRATION', label: 'Zorlanma / hayal kırıklığı' },
  { value: 'FATIGUE', label: 'Yorgunluk belirtisi' },
  { value: 'SELF_CORRECTION', label: 'Kendi hatasını düzeltti' },
  { value: 'SPONTANEOUS_EXPLANATION', label: 'Kendiliğinden açıklama yaptı' },
];

export const e3SectionProtocols: Record<E3SectionId, E3SectionProtocol> = {
  visual_concepts: {
    sectionId: 'visual_concepts', shortLabel: 'Görsel Kavram',
    setup: 'Az uyaranlı, yüksek kontrastlı ve tanıdık görsellerle başla; seçenek sayısını yaş ve göreve göre artır.',
    primaryEvidence: ['ilk seçim', 'kategori kuralı', 'parça-bütün', 'iki özelliği birlikte kullanma'],
    materials: ['nesne/fotoğraf kartları', 'temel şekil ve renk kartları'],
    educatorRules: ['İlk seçimi düzeltmeden kaydet.', 'Seçimin yeşil görünmesi yalnız seçildi anlamına gelir.', '45+ tavan görevini zayıflık hesabına katma.'],
    pauseRule: 'Arka arkaya iki kaçınma/yorgunluk belirtisinde bölümü durdur ve başka oturuma bırak.',
  },
  receptive_language: {
    sectionId: 'receptive_language', shortLabel: 'Alıcı Dil',
    setup: 'Gerçek nesne ve doğal yönergeler kullan; yönergeyi gereksiz tekrar ederek işitsel yükü değiştirme.',
    primaryEvidence: ['tek aşamalı yönerge', 'konum sözcükleri', 'nitelik', 'iki aşamalı yönerge'],
    materials: ['top', 'kutu', 'küp', 'kaşık', 'boyut/renk karşıtlığı olan nesneler'],
    educatorRules: ['İlk yönergeyi bir kez ver.', 'Tekrar gerekiyorsa destek düzeyine işle.', 'Konuşma üretimini değil anlama davranışını değerlendir.'],
    pauseRule: 'Dil yükü nedeniyle huzursuzluk artarsa gerçek nesneli daha kısa göreve dön veya mola ver.',
  },
  expressive_language: {
    sectionId: 'expressive_language', shortLabel: 'İfade Edici Dil',
    setup: 'Sınav sorusu tonu yerine doğal sohbet, resim anlatma ve oyun bağlamı oluştur.',
    primaryEvidence: ['kendiliğinden başlatma', 'eylem anlatımı', 'olay sırası', 'iletişim onarımı'],
    materials: ['olay sıralı resimler', 'tanıdık oyuncak sahnesi'],
    educatorRules: ['Tek bir gramer hatasını başarısızlık sayma.', 'Anlaşılabilir yaklaşık üretimleri not et.', 'Çocuğun kendi cümlesini yetişkin cümlesine zorla dönüştürme.'],
    pauseRule: 'Çocuk konuşmak istemiyorsa zorlamadan başka modaliteye geç; sessizlik otomatik yanlış değildir.',
  },
  early_math: {
    sectionId: 'early_math', shortLabel: 'Erken Matematik',
    setup: 'İşlem sembolü yerine nesne, nicelik, karşılaştırma ve örüntü kullan.',
    primaryEvidence: ['bir-bir eşleme', 'nicelik karşılaştırma', 'örüntü', 'değişimi fark etme'],
    materials: ['küp/blok', 'tabaklar', 'renkli çubuklar', 'küçük nesne grupları'],
    educatorRules: ['Ezbere sayma ile gerçek niceliği ayır.', 'Parmak kullanımı stratejidir; hata olarak işaretleme.', '45+ keşif görevini norm gibi yorumlama.'],
    pauseRule: 'Sayısal kaygı veya kaçınma görünürse gerçek oyun bağlamına dön ve oturumu kısalt.',
  },
  memory: {
    sectionId: 'memory', shortLabel: 'Bellek',
    setup: 'Uyaranı kısa ve temiz sun; tekrar sayısını sabit tut ve gecikmeyi gereksiz uzatma.',
    primaryEvidence: ['görsel yer belleği', 'işitsel sıra', 'motor sıra', 'güncelleme'],
    materials: ['iki kap', '3 tanıdık nesne', 'renk kartları'],
    educatorRules: ['Tekrar edilen yönergeyi destek olarak kaydet.', 'Hatırlama ile tanımayı birbirine karıştırma.', 'Sıra hatasını içerik hatasından ayrı not et.'],
    pauseRule: 'Yorgunluk bellek performansını belirgin etkiliyorsa bölümü aynı gün zorlamadan kapat.',
  },
  executive_attention: {
    sectionId: 'executive_attention', shortLabel: 'Dikkat / Yürütücü',
    setup: 'Kısa oyun turları kullan; süre baskısı ve görünür geri sayım gösterme.',
    primaryEvidence: ['seçici dikkat', 'bekleme', 'kural sürdürme', 'kural değiştirme'],
    materials: ['renk/şekil kartları', 'müzik veya ritim', 'hedef-çeldirici görseller'],
    educatorRules: ['5 saniye gecikmeyi otomatik yanlış sayma.', 'Dürtüsel ilk tepkiyi ayrıca not et.', 'Kural değişiminde eski kurala dönmeyi gözlem kanıtı olarak kaydet.'],
    pauseRule: 'İnhibisyon görevleri üst üste gelmesin; kısa hareket molası ver.',
  },
  social_emotion_play: {
    sectionId: 'social_emotion_play', shortLabel: 'Sosyal / Oyun',
    setup: 'Gerçek etkileşim, rol oyunu ve sosyal senaryo kullan; tek doğru sosyal cevap arama.',
    primaryEvidence: ['duygu tanıma', 'sıra alma', 'sembolik oyun', 'sosyal problem çözme'],
    materials: ['bebek/figür', 'rol oyunu seti', 'duygu yüzleri', 'bloklar'],
    educatorRules: ['Kültürel/ailevi farklılığı patoloji gibi yorumlama.', 'Sosyal cevabın işlevselliğine bak.', 'Bakış açısı görevleri keşif kanıtıdır.'],
    pauseRule: 'Çocuk rol oyununa girmek istemiyorsa zorlamadan doğal oyun gözlemine dön.',
  },
  motor_graphomotor: {
    sectionId: 'motor_graphomotor', shortLabel: 'Motor / Grafomotor',
    setup: 'Ekran üzerinden motor beceri ölçme; gerçek materyal ve güvenli fiziksel ortam kullan.',
    primaryEvidence: ['iki el koordinasyonu', 'kalem/çizgi kontrolü', 'şekil taklidi', 'kaba motor koordinasyon'],
    materials: ['kalın boya kalemi', 'kağıt', 'büyük boncuk/ip', 'yumuşak top', 'çocuk makası'],
    educatorRules: ['Kalem tutuşunu görev sırasında zorla düzeltme.', 'Mükemmel şekil bekleme.', 'Makas ve hareket görevlerinde güvenlik önceliklidir.'],
    pauseRule: 'Fiziksel yorgunluk veya huzursuzlukta görevi kes; tamamlamayı zorunlu kılma.',
  },
  daily_living_safety: {
    sectionId: 'daily_living_safety', shortLabel: 'Özbakım / Güvenlik',
    setup: 'Mümkün olduğunda gerçek rutin ve bakımveren örneği kullan; korkutucu güvenlik senaryolarından kaçın.',
    primaryEvidence: ['giyinme', 'düzen/rutin', 'yardım isteme', 'temel güvenlik bilgisi'],
    materials: ['mont/giysi', 'oyuncak kutusu', 'mendil/çöp kutusu'],
    educatorRules: ['Evde fırsat verilmemiş beceriyi çocuk yetersizliği sayma.', 'Bilgi ile gerçek bağımsız performansı ayır.', 'Güvenlik sorularında korkutma kullanma.'],
    pauseRule: 'Özbakım görevi mahremiyet veya rahatsızlık doğuruyorsa bakımveren kaynağına geç.',
  },
  learning_transfer: {
    sectionId: 'learning_transfer', shortLabel: 'Öğrenme Tepkisi / Transfer',
    setup: 'Önce bağımsız deneme, sonra küçük destek, ardından yeni örnek kullan; değişimi görünür kıl.',
    primaryEvidence: ['modelden öğrenme', 'ipucuna tepki', 'strateji değiştirme', 'yakın/uzak transfer'],
    materials: ['şekil kutusu', 'bloklar', 'iki farklı eşleme seti'],
    educatorRules: ['İlk başarısızlığı sonuç değil başlangıç kanıtı olarak gör.', 'Destek sonrası değişimi özellikle kaydet.', 'Tek çözüm yolu dayatma.'],
    pauseRule: 'Çocuk destekle toparlanmıyorsa yükü artırma; başka gün aynı ilkeyi farklı materyalle yeniden gözle.',
  },
};

export function e3AgeBandLabel(ageMonths: number) {
  if (ageMonths <= 38) return '36–38 ay · temel kanıt';
  if (ageMonths <= 41) return '39–41 ay · genişleyen kanıt';
  if (ageMonths <= 44) return '42–44 ay · birleşik kural ve transfer';
  return '45–47 ay · nötr keşif/tavan eklenebilir';
}

export const e3GlobalApplicationRules = [
  'Çocuğa doğru/yanlış, puan, kırmızı hata veya performans karşılaştırması gösterme.',
  'Seçili seçeneğin yeşil görünmesi yalnız seçimi gösterir; doğruluğu göstermez.',
  'Uygulanamayan görev NOT_ASSESSED olarak nötr geçilir ve başarı oranını düşürmez.',
  'Tavan/keşif görevleri destek ihtiyacı hesabına katılmaz.',
  'Çocuk performansı ile bakımveren beyanını ayrı kanıt kaynakları olarak koru.',
  'Yorgunluk, kaçınma veya yoğun zorlanmada oturumu böl; tek oturumda bitirme zorunluluğu yoktur.',
  'Rapor norm, tanı, gelişim yaşı veya standart tarama sonucu üretmez.',
] as const;
