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
    setup: 'Kısa ve temiz uyaranlarla başla; işitsel ve görsel bilgiyi ayrı dene. Serbest hatırlama, tanıma, sıra ve güncelleme görevlerini karıştırmadan ilerle; ardından model sonrası strateji öğrenmesini ve yeni örneğe aktarımı gözle.',
    primaryEvidence: ['serbest hatırlama', 'görsel yer belleği', 'içerik-sıra ayrımı', 'kodlama stratejisi', 'model sonrası değişim', 'yakın ve uzak transfer', 'kural/çalışma belleği'],
    materials: ['iki eş kap', 'tanıdık nesne kartları', '3 gerçek nesne', 'hareket dizileri', 'renk kartları'],
    educatorRules: ['Uyaranı gereksiz tekrar etme; tekrar gerekiyorsa destek düzeyine işle.', 'Hatırlama ile tanımayı aynı beceri gibi yorumlama.', 'İçerik hatası ile sıra hatasını ayrı not et.', 'Strateji kullanımını yalnız sözel açıklamaya bağlama; bakış, adlandırma, gruplayarak bakma veya tekrar etme de kanıttır.', 'Model sonrası strateji görevinde öğretim kartları ile test kartlarını farklı tut.', 'Yorgunluk ve dikkat dağınıklığını bellek yetersizliği gibi yorumlama.', '45+ kural belleği görevini nötr tavan olarak koru.'],
    pauseRule: 'Yorgunluk, kaçınma veya dikkat kopması belirginleşirse bellek yükünü artırma; kısa mola ver veya bölümü başka oturuma bırak. Tek oturumdaki zayıf hatırlama tanısal sonuç değildir.',
  },  executive_attention: {
    sectionId: 'executive_attention', shortLabel: 'Dikkat / Yürütücü',
    setup: 'Kısa ve oyun temelli turlarla başla; seçici dikkat, bekleme ve kural sürdürmeyi ayrı ayrı gözle. Sonra model sonrası kural öğrenme, hedef değiştirme, ters kural ve tek set değişimine ilerle.',
    primaryEvidence: ['ilk yönelim ve seçici dikkat', 'bekleme/inhibisyon', 'kural sürdürme', 'strateji ve yanıt gecikmesi', 'model sonrası kural edinimi', 'eski kurala dönme', 'set değiştirme'],
    materials: ['hedef-çeldirici görseller', 'renk/şekil kartları', 'top', 'müzik/ritim', 'güvenli hareket alanı'],
    educatorRules: ['Görünür geri sayım, hız puanı veya kırmızı hata göstergesi kullanma.', 'Erken tepkiyi otomatik yanlış sayma; dürtüsel başlangıç olarak ayrı kaydet.', 'Yanıt gecikmesini tek başına düşük performans olarak yorumlama.', 'Kural değişiminde eski kurala dönmeyi perseverasyon kanıtı olarak not et; çocuğu üst üste uyarılarla yönlendirme.', 'Model sonrası görevde öğretim uyaranı ile test uyaranını farklı tut.', 'Dikkat kopması ile yönergeyi anlamamayı mümkün olduğunca ayrı değerlendir.', 'İnhibisyon görevlerini arka arkaya uzatma; hareket molası ver.', '45+ çift kural/set değiştirme görevini nötr tavan olarak koru.'],
    pauseRule: 'Kaçınma, aşırı hareketlenme, yorgunluk veya frustrasyon artarsa performansı zorlayarak sürdürme. Kısa hareket molası ver veya bölümü başka oturuma bırak; tek oturumdaki dalgalanma tanısal sonuç değildir.',
  },  social_emotion_play: {
    sectionId: 'social_emotion_play', shortLabel: 'Sosyal / Oyun',
    setup: 'Belirgin duygu ipucuyla başla; sıra alma ve sembolik oyunu gerçek etkileşimde gözle. Sonra sosyal problem çözme, model sonrası sosyal giriş, farklı tercih, esneklik ve nötr zihinsel durum keşfine ilerle.',
    primaryEvidence: ['duygu ipucu', 'sıra alma ve ortak dikkat', 'sembolik oyun', 'işlevsel sosyal çözüm', 'model sonrası sosyal başlatma', 'bakış açısı', 'sosyal esneklik', 'zihinsel durum çıkarımı'],
    materials: ['bloklar', 'bebek/figür', 'rol oyunu seti', 'duygu ve sosyal sahne kartları'],
    educatorRules: ['Tek bir sosyal cevabı “doğru karakter” ölçütü yapma.', 'Kültürel, ailevi ve iletişim tarzı farklılıklarını patoloji veya ahlaki yetersizlik gibi yorumlama.', 'Göz teması, fiziksel yakınlık veya belirli nezaket kalıplarını zorunlu başarı ölçütü yapma.', 'Sosyal cevabın işlevine ve bağlama uygunluğuna bak; alternatif çözümleri kabul et.', 'Model sonrası görevde model sahnesi ile test sahnesini farklı tut.', 'Rol oyununa katılmak istemeyen çocuğu zorlamadan doğal oyun gözlemine dön.', '45+ zihinsel durum görevini nötr tavan olarak koru.'],
    pauseRule: 'Çocuk rol oyunu ya da sosyal senaryodan rahatsız olursa zorlamayı bırak; doğal etkileşim gözlemine veya başka bölüme geç. Tek bir sosyal yanıt kişilik, ahlak veya tanı göstergesi değildir.',
  },  motor_graphomotor: {
    sectionId: 'motor_graphomotor', shortLabel: 'Motor / Grafomotor',
    setup: 'Gerçek materyal ve güvenli fiziksel ortam kullan. İnce motor, kaba motor ve grafomotor görevlerini kısa bloklara böl; hız, estetik veya “doğru kalem tutuşu” baskısı oluşturma.',
    primaryEvidence: ['iki el koordinasyonu', 'kaba motor zamanlama', 'çizgi/şekil stratejisi', 'model sonrası motor öğrenme', 'yakın ve uzak transfer', 'araç kullanımı'],
    materials: ['büyük boncuk ve kalın ip', 'büyük yumuşak top', 'kalın boya kalemi ve kağıt', 'iki farklı yol sayfası', 'büyük düğmeli çerçeve', 'çocuk makası'],
    educatorRules: ['Kalem tutuşunu görev sırasında zorla düzeltme; işlevsel yaklaşımı betimle.', 'Mükemmel şekil veya çizgi bekleme; ürün kadar süreç ve stratejiyi kaydet.', 'Model gerekiyorsa farklı öğretim örneği kullan ve model sonrası yeni örnekle yeniden dene.', 'Kaba motor görevinde başarı sayısından çok hazırlık, zamanlama ve koordinasyonu gözle.', 'Makas, top ve hareket görevlerinde fiziksel güvenlik önceliklidir.', '45+ makas görevi nötr tavan kanıtıdır; başarısızlık alan puanını düşürmez.'],
    pauseRule: 'Fiziksel yorgunluk, huzursuzluk, ağrı belirtisi veya güvenli olmayan hareket görülürse görevi hemen kes. Tamamlama zorunluluğu yoktur; motor kanıtı yorgunluk altında zorlanmaz.',
  },  daily_living_safety: {
    sectionId: 'daily_living_safety', shortLabel: 'Özbakım / Güvenlik',
    setup: 'Mümkün olduğunda gerçek ve tanıdık günlük rutin kullan. Güvenlik görevlerini korkutucu senaryo, gerçek tehlike veya performans baskısı olmadan uygula; bakımveren bilgisini doğrudan gözlemin bağlamı olarak kullan.',
    primaryEvidence: ['rutin başlatma ve sürdürme', 'giyinme/özbakım bağımsızlığı', 'işlevsel yardım isteme', 'model sonrası günlük rutin öğrenme', 'güvenlik planı ve gerekçe', 'yardım düzeyi'],
    materials: ['tanıdık oyuncak ve saklama yeri', 'mont veya kolay giyilen giysi', 'lavabo/sabun/havlu ya da rutin kartları', 'güvenli kapaklı kap', 'temiz mendil ve çöp kutusu'],
    educatorRules: ['Evde fırsat verilmemiş beceriyi çocuk yetersizliği sayma.', 'Bilgi, sözel anlatım ve gerçek bağımsız performansı birbirinden ayır.', 'Yardım istemede sözcük kadar işaret, bakış ve nesneyi uzatma gibi işlevsel yolları da kabul et.', 'Model gerekiyorsa farklı öğretim materyali kullan ve model sonrası yeni örnekle yeniden dene.', 'Mahremiyet gerektiren özbakım görevini doğrudan uygulamaya zorlama; bakımveren kaynağına geç.', 'Güvenlik görevlerinde korkutma, gerçek tehlike, suçlama veya tek aile kuralını evrensel doğru gibi puanlama kullanma.', '45+ güvenlik muhakemesi görevi nötr tavandır; başarısızlık alan puanını düşürmez.'],
    pauseRule: 'Mahremiyet, utanç, huzursuzluk, korku veya güvenli olmayan durum oluşursa görevi hemen durdur. Çocuğu günlük yaşam becerisini kanıtlamaya zorlamak yerine bakımveren kaynağı ve başka oturum kanıtı kullan.',
  },  learning_transfer: {
    sectionId: 'learning_transfer', shortLabel: 'Öğrenme Tepkisi / Transfer',
    setup: 'Her mümkün olduğunda önce bağımsız başlangıç kanıtı al; ardından tek ve tanımlı destek ver; destekten sonra yeni örnekle yeniden gözle. Amaç tek sonucun doğruluğu değil, çocuğun destekten nasıl yararlandığını ve kuralı ne kadar taşıdığını görünür kılmaktır.',
    primaryEvidence: ['bağımsız başlangıç', 'strateji değiştirme', 'ipucuna tepki', 'model öncesi-sonrası değişim', 'planlama', 'yakın transfer', 'uzak transfer ve alternatif çözüm'],
    materials: ['büyük bloklar', 'şekil kutusu', 'basit eşleme/sınıflama kartları', 'öğretim ve test için farklı materyal setleri', 'çok çözümlü basit problem'],
    educatorRules: ['İlk başarısızlığı sonuç değil başlangıç kanıtı olarak kaydet.', 'Bir görevde verdiğin desteğin türünü ve sırasını değiştirmeden not et; çoklu ipuçlarıyla sonucu yapay biçimde yükseltme.', 'Model veya ipucundan sonra aynı örneği ezberletmek yerine yeni örnek kullan.', 'Model öncesi, model sonrası ve yeni örnek performansını mümkün olduğunca ayrı betimle.', 'Sözel planı zorunlu tutma; işaret, parça seçme ve eylem sırası da strateji kanıtıdır.', 'Tek çözüm yolu dayatma; işlevsel alternatifleri kabul et.', '45+ uzak transfer görevi nötr tavandır; yanıt vermemek alan puanını düşürmez.'],
    pauseRule: 'Çocuk art arda desteklere rağmen zorlanıyor, kaçınıyor veya yoruluyorsa ipucu miktarını artırarak sonuca zorlamayı bırak. Öğrenmeye tepkiyi başka gün, daha düşük yükte ve farklı materyalle yeniden gözle.',
  },};

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
