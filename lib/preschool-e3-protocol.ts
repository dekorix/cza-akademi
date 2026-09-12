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
    setup: 'Tanıdık ve az uyaranlı eşleme ile başla; kategori/parça-bütün/mekân ilişkisine ilerle. Sonraki görevlerde strateji, model sonrası öğrenme ve yeni örneğe transferi görünür kıl.',
    primaryEvidence: ['ilk seçim ve gecikme', 'kategori/parça-bütün ilişkisi', 'strateji açıklaması veya işareti', 'model sonrası değişim', 'yakın ve uzak transfer'],
    materials: ['foto-gerçekçi nesne kartları', 'kategori alanları', 'temel şekil ve renk kartları'],
    educatorRules: ['İlk seçimi düzeltmeden kaydet.', 'Strateji sorusunu sözel sınava dönüştürme; bakış/işaret de kanıttır.', 'Model gerekiyorsa yalnız bir açık örnek göster ve model sonrası YENİ örnek kullan.', 'Transfer görevinde kuralı yeniden söylemeden önce bağımsız denemeyi kaydet.', 'Seçimin yeşil görünmesi yalnız seçildi anlamına gelir.', '45+ tavan görevini zayıflık hesabına katma.'],
    pauseRule: 'Arka arkaya iki kaçınma/yorgunluk belirtisinde bölümü durdur; öğrenme/transfer kanıtını yorgunluk altında zorlamadan başka oturuma bırak.',
  },
  receptive_language: {
    sectionId: 'receptive_language', shortLabel: 'Alıcı Dil',
    setup: 'Tanıdık tek aşamalı yönergeyle başla; işlev, konum ve nitelik dilini gerçek nesnelerle derinleştir. Sonra model sonrası öğrenme, iki aşamalı yönerge ve sıra sözcüklerine geç.',
    primaryEvidence: ['ilk sözel yönergeye tepki', 'işlev/konum/nitelik sözcükleri', 'tekrar-jest-model gereksinimi', 'model sonrası değişim', 'iki aşamalı ve sıralı anlama', 'çoklu sözel özellik'],
    materials: ['top ve çeldirici nesne', 'bardak/ayakkabı/yastık', 'oyuncak araba', 'kutu', 'uzun-kısa kalem', 'küp', 'kaşık', 'renk-boyut karşıtlığı olan toplar'],
    educatorRules: ['İlk yönergeyi doğal sesle bir kez ver ve ilk tepkiyi kaydet.', 'Yönerge tekrarı VERBAL_PROMPT, jest/işaret VISUAL_PROMPT, açık örnek MODELED olarak kaydedilir.', 'Konuşma üretimini değil anlama davranışını değerlendir; sözel açıklamayı zorunlu tutma.', 'Model sonrası görevde model nesnesi ile test nesnesini farklı tut.', 'İki aşamalı yönergede içerik hatası ile sıra/çalışma belleği hatasını ayrı not et.', '45+ çoklu özellik görevini nötr tavan olarak koru.'],
    pauseRule: 'Dil yükü, yorgunluk veya huzursuzluk artarsa daha kısa gerçek-nesne görevine dön; tekrarlı başarısız denemelerle çocuğu zorlamadan bölümü başka oturuma bırak.',
  },
  expressive_language: {
    sectionId: 'expressive_language', shortLabel: 'İfade Edici Dil',
    setup: 'Doğal istek ve tek-sahne anlatımıyla başla; kişisel olay, neden açıklaması ve iletişim onarımına ilerle. Sonra iki/üç sahneli anlatı ve açık uçlu hikâye genişletme kullan.',
    primaryEvidence: ['kendiliğinden sözel başlatma', 'eylem ve olay anlatımı', 'neden/gerekçe', 'iletişim onarımı', 'model sonrası yeniden ifade', 'olay sırası ve anlatı bütünlüğü', 'öngörü/yaratıcı genişletme'],
    materials: ['2 tanıdık oyuncak', 'tek eylemli foto-gerçekçi sahne', 'neden-sonuç sahnesi', 'iki ve üç parçalı olay dizileri', 'model için farklı eylem kartı'],
    educatorRules: ['Çocuğun ilk üretimini yetişkin cümlesine dönüştürmeden aynen kaydet.', 'Tek bir gramer hatasını başarısızlık sayma; anlam ve iletişim işlevine bak.', 'Açık uçlu takip sorusunu en fazla bir kez kullan ve içerik vermeyen biçimde sor.', 'İletişim onarımında önce bağımsız yeniden ifade fırsatı ver; model gerekirse farklı örnek kullan.', 'Sözel çekingenlik veya sessizlikte zorlamayı sürdürme; NOT_ASSESSED seçeneğini kullanabilirsin.', '45+ hikâye genişletmeyi nötr tavan olarak koru.'],
    pauseRule: 'Konuşma isteği azalır, çocuk gerilir ya da yorgunluk belirginleşirse anlatı uzunluğunu artırma; oyun/gerçek nesneye dön veya bölümü başka oturuma bırak.',
  },
  early_math: {
    sectionId: 'early_math', shortLabel: 'Erken Matematik',
    setup: 'Gerçek nesne ve belirgin nicelik karşılaştırmasıyla başla; sayı sözcüğü, küçük nicelik ve ölçü stratejisine ilerle. Sonra örüntüde model sonrası öğrenme, ekleme-eksiltme ve yeni kural keşfini gözle.',
    primaryEvidence: ['nicelik karşılaştırma', 'sayı sözcüğü-nicelik eşleme', 'küçük nicelik stratejisi', 'ölçü karşılaştırma yöntemi', 'model sonrası örüntü öğrenme', 'ekleme/eksiltme değişim takibi', 'kural keşfi'],
    materials: ['aynı tür küçük nesne grupları', 'özdeş küpler', 'eş renk/kalınlıkta farklı uzunluk çubukları', 'renk ve şekil örüntü kartları', 'örtü veya küçük kutu'],
    educatorRules: ['İşlem sembolü ve görünür puan kullanma; niceliği gerçek nesne üzerinden gözle.', 'Ezbere sayma ile toplam niceliği ayır ama parmakla/tek tek saymayı hata sayma.', 'Strateji sorusunu yetişkin dili sınavına dönüştürme; işaret veya nesneyi yeniden düzenleme de kanıttır.', 'Örüntü öğrenmesinde öğretim örneği ile test örneğini farklı tut ve model öncesi/sonrası değişimi ayır.', 'Ekleme ve eksiltmede kullanılan yöntemi kaydet; tek stratejiyi üstün kabul etme.', '45+ yeni örüntü kuralını nötr tavan olarak koru.'],
    pauseRule: 'Sayısal kaçınma, yorgunluk veya performans baskısı belirtisi artarsa gerçek oyun bağlamına dön; art arda zor görevlerle sürdürmeden bölümü kısalt veya başka oturuma bırak.',
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
