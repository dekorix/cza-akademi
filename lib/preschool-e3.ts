export type E3SectionId =
  | 'visual_concepts'
  | 'receptive_language'
  | 'expressive_language'
  | 'early_math'
  | 'memory'
  | 'executive_attention'
  | 'social_emotion_play'
  | 'motor_graphomotor'
  | 'daily_living_safety'
  | 'learning_transfer';

export type E3ResponseMode = 'SELECT' | 'SPEAK' | 'OBSERVE' | 'MANIPULATIVE' | 'DRAW';
export type E3SupportLevel =
  | 'INDEPENDENT'
  | 'VERBAL_PROMPT'
  | 'VISUAL_PROMPT'
  | 'MODELED'
  | 'PHYSICAL_ASSIST'
  | 'NOT_OBSERVED'
  | 'NOT_ASSESSED';

export type E3Band = '36-38' | '39-41' | '42-44' | '45-47';
export type E3ProfileStatus = 'RELATIVE_STRENGTH' | 'DEVELOPING' | 'WATCH_SUPPORT' | 'INSUFFICIENT';
export type E3TaskPhase =
  | 'WARMUP'
  | 'CORE'
  | 'DEEPEN'
  | 'STRATEGY'
  | 'LEARNING_RESPONSE'
  | 'NEAR_TRANSFER'
  | 'FAR_TRANSFER'
  | 'CEILING';

export interface E3Task {
  id: string;
  sectionId: E3SectionId;
  order: number;
  minMonth: 36 | 39 | 42 | 45;
  neutralProbe?: boolean;
  phase?: E3TaskPhase;
  educatorFollowUp?: string;
  visualSpec?: string;
  title: string;
  childInstruction: string;
  educatorInstruction: string;
  responseMode: E3ResponseMode;
  options?: string[];
  expected?: string[];
  materials?: string[];
  evidenceFocus: string[];
}

export interface E3Evidence {
  taskId: string;
  sectionId: E3SectionId;
  supportLevel: E3SupportLevel;
  firstMatch: boolean | null;
  latencyMs: number | null;
  touches?: number | null;
  note?: string;
  neutralProbe?: boolean;
}

export interface E3SectionReport {
  sectionId: E3SectionId;
  label: string;
  assessed: number;
  independent: number;
  supported: number;
  notObserved: number;
  firstMatchRate: number | null;
  independenceRate: number | null;
  averageLatencyMs: number | null;
  status: E3ProfileStatus;
}

export const E3_TEMPLATE_CODE = 'CZA_E3_36_48_V1';
export const E3_TASK_BANK_VERSION = 'E3_TASK_BANK_V1.0';
export const E3_REPORT_VERSION = 'E3_REPORT_V1.0';

export const e3Sections: { id: E3SectionId; label: string; purpose: string }[] = [
  { id: 'visual_concepts', label: 'Görsel Kavramlar ve Kategorizasyon', purpose: 'Benzerlik, farklılık, kategori, parça-bütün ve görsel ilişki kurma.' },
  { id: 'receptive_language', label: 'Alıcı Dil ve Yönerge Takibi', purpose: 'Sözel yönerge, konum, nitelik, işlev ve iki aşamalı yönergeyi anlama.' },
  { id: 'expressive_language', label: 'İfade Edici Dil ve Anlatı', purpose: 'İstek, açıklama, olay sırası, deneyim ve kısa anlatı üretme.' },
  { id: 'early_math', label: 'Erken Matematik ve Akıl Yürütme', purpose: 'Nicelik, karşılaştırma, örüntü, basit değişim ve neden-sonuç akıl yürütmesi.' },
  { id: 'memory', label: 'Görsel-İşitsel Bellek', purpose: 'Kısa süreli hatırlama, sıra, görsel yer ve işitsel bilgi tutma.' },
  { id: 'executive_attention', label: 'Dikkat ve Yürütücü İşlevler', purpose: 'Odaklanma, bekleme, kural sürdürme, kural değiştirme ve dürtü kontrolü.' },
  { id: 'social_emotion_play', label: 'Sosyal Biliş, Duygu ve Oyun', purpose: 'Duygu anlama, rol oyunu, sıra alma, sosyal problem çözme ve bakış açısı.' },
  { id: 'motor_graphomotor', label: 'Motor ve Grafomotor', purpose: 'El kullanımı, çizgi/şekil taklidi, kaba motor koordinasyon ve günlük ince motor.' },
  { id: 'daily_living_safety', label: 'Günlük Yaşam, Özbakım ve Güvenlik', purpose: 'Giyinme, düzen, yardım isteme, temel güvenlik ve günlük rutin bağımsızlığı.' },
  { id: 'learning_transfer', label: 'Öğrenmeye Tepki, Transfer ve Problem Çözme', purpose: 'Modelden öğrenme, strateji değiştirme, yeni duruma aktarım ve yardım sonrası gelişim.' },
];

const agePattern: (36 | 39 | 42 | 45)[] = [36, 36, 36, 36, 36, 39, 42, 45];

function sectionTasks(
  sectionId: E3SectionId,
  rows: Array<Omit<E3Task, 'id' | 'sectionId' | 'order' | 'minMonth' | 'neutralProbe'>>,
): E3Task[] {
  return rows.map((row, index) => ({
    ...row,
    id: `E3-${sectionId.toUpperCase().replace(/_/g, '-')}-${String(index + 1).padStart(2, '0')}`,
    sectionId,
    order: index + 1,
    minMonth: agePattern[index],
    neutralProbe: index === 7,
  }));
}

const visualConceptTasks = sectionTasks('visual_concepts', [
  { phase: 'WARMUP', title: 'Aynısını Bul', childInstruction: 'Bu resmin aynısını bulur musun?', educatorInstruction: 'Tanıdık tek hedef + iki belirgin çeldirici sun. İlk seçimi düzeltmeden kaydet.', educatorFollowUp: 'Seçimden sonra yalnız gerekirse “Bunu nasıl buldun?” diye sor; açıklamayı zorunlu tutma.', visualSpec: 'Yüksek kontrastlı, foto-gerçekçi tek köpek hedefi; aynı köpeğin eş görseli + araba + elma. Metin/emoji yerine gerçek görsel kart.', responseMode: 'SELECT', options: ['Köpek eş görseli', 'Araba', 'Elma'], expected: ['Köpek eş görseli'], evidenceFocus: ['görsel eşleme', 'ilk seçim', 'yanıt gecikmesi'] },
  { phase: 'CORE', title: 'Aynı Aileyi Bul', childInstruction: 'Hangileri birlikte olur?', educatorInstruction: 'İki tanıdık hayvan ve bir araç kullan. Kategori adını söylemeden ilk sınıflamayı gözle.', educatorFollowUp: 'Çocuk isterse “Bunlar neden birlikte?” diye kısa gerekçe al; sözel üretimi şart koşma.', visualSpec: 'Gerçekçi kedi, köpek ve otomobil kartları; üçlü sade düzen, arka plan dikkat dağıtmayan.', responseMode: 'SELECT', options: ['Kedi + Köpek', 'Kedi + Araba', 'Köpek + Araba'], expected: ['Kedi + Köpek'], evidenceFocus: ['kategori', 'genelleme', 'ilk strateji'] },
  { phase: 'DEEPEN', title: 'Parça Bütünü Tamamla', childInstruction: 'Bu parça hangi resme ait olabilir?', educatorInstruction: 'Tanıdık bir bütünün belirgin parçasını göster. Çocuğun parçadan bütüne ilişki kurmasını gözle.', educatorFollowUp: 'Yanıt sonrası “Nereden anladın?” sorusu isteğe bağlıdır; bakış/işaret de strateji kanıtı olabilir.', visualSpec: 'Yakın plan araba tekeri hedef parça; seçeneklerde gerçekçi araba, elma ve kedi.', responseMode: 'SELECT', options: ['Araba', 'Elma', 'Kedi'], expected: ['Araba'], evidenceFocus: ['parça-bütün', 'görsel çıkarım', 'strateji ipucu'] },
  { phase: 'STRATEGY', title: 'Nerede Olduğunu Bul', childInstruction: 'Oyuncak kutunun altında olan resmi göster.', educatorInstruction: 'İçinde/üstünde/altında ilişkisini üç net görselle sun. İlk seçimden sonra stratejiyi kısa notla görünür kıl.', educatorFollowUp: '“Neye baktın da bunu seçtin?” diye sor; sözel yanıt yoksa işaret ettiği konumsal ipucunu kaydet.', visualSpec: 'Aynı oyuncak ve aynı kutu ile üç sahne: içinde, üstünde, altında; kamera açısı ve ölçek sabit.', responseMode: 'SELECT', options: ['Kutunun içinde', 'Kutunun üstünde', 'Kutunun altında'], expected: ['Kutunun altında'], evidenceFocus: ['mekânsal ilişki', 'strateji', 'öz-açıklama başlangıcı'] },
  { phase: 'LEARNING_RESPONSE', title: 'Kuralı Gör ve Yeniden Dene', childInstruction: 'Bak, ben birini birlikte olan yere koyacağım. Şimdi sen de diğerini koyar mısın?', educatorInstruction: 'Önce bağımsız kısa deneme fırsatı ver. Gerekirse tek bir açık model göster; modelden SONRA yeni örnekle tekrar denet ve yardım düzeyini MODELLED olarak kaydet.', educatorFollowUp: 'Notta model öncesi davranış ile model sonrası değişimi ayrı yaz: değişmedi / kısmen değişti / yeni örneğe aktardı.', visualSpec: 'İki kategori kutusu ve dört gerçekçi kart: iki hayvan, iki taşıt. Model örneği ile test örneği farklı kart olmalı.', responseMode: 'MANIPULATIVE', materials: ['2 kategori alanı', '4 görsel kart'], evidenceFocus: ['öğrenmeye tepki', 'modelden öğrenme', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'Aynı Kural, Yeni Resimler', childInstruction: 'Şimdi başka resimlerle aynı oyunu yapalım. Hangileri birlikte?', educatorInstruction: '39+ ay için bir önceki sınıflama kuralını yeni yüzey örnekleriyle sun; kuralı yeniden söyleme.', educatorFollowUp: 'Kuralın hatırlatılmadan korunup korunmadığını ve ilk stratejiyi not et.', visualSpec: 'Önceki görevde kullanılmayan kuş, balık, otobüs gibi yeni gerçekçi kartlar; aynı sade düzen.', responseMode: 'SELECT', options: ['Kuş + Balık', 'Kuş + Otobüs', 'Balık + Otobüs'], expected: ['Kuş + Balık'], evidenceFocus: ['yakın transfer', 'kural koruma', 'genelleme'] },
  { phase: 'FAR_TRANSFER', title: 'İki Özelliği Birlikte Kullan', childInstruction: 'Hem kırmızı hem yuvarlak olanı bul.', educatorInstruction: '42+ ay için renk + şekil bilgisini aynı anda tutmayı iste. Tek özelliğe göre seçerse hangi ipucunu kullandığını not et.', educatorFollowUp: 'İlk seçimden sonra gerekirse “İkisini birden düşünürsek hangisi?” diyerek ikinci denemeyi destek düzeyiyle kaydet.', visualSpec: 'Aynı boyutta üç sade şekil: kırmızı daire, kırmızı kare, mavi daire; yüksek kontrast ve eşit yerleşim.', responseMode: 'SELECT', options: ['Kırmızı daire', 'Kırmızı kare', 'Mavi daire'], expected: ['Kırmızı daire'], evidenceFocus: ['iki özellik', 'uzak transfer', 'seçici dikkat', 'öz-düzeltme'] },
  { phase: 'CEILING', title: 'Yeni Kuralı Keşfet', childInstruction: 'Sence hangisi bu gruba en iyi uyar? İstersen nedenini de söyleyebilirsin.', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. Açık öğretilmemiş yeni bir görsel ilişki kullan; ortaya çıkmaması alan puanını düşürmez.', educatorFollowUp: 'Tek doğru gerekçe arama. Seçim, bakış, deneme ve açıklama biçimini keşif kanıtı olarak kaydet.', visualSpec: 'Tanıdık ama yeni kurala göre gruplanabilir 4 gerçekçi nesne; kategori cevabı yüzeyden hemen görünmemeli, yine de yaşa uygun olmalı.', responseMode: 'SPEAK', evidenceFocus: ['kural keşfi', 'soyutlama', 'gerekçe', 'nötr tavan'] },
]);
const receptiveLanguageTasks = sectionTasks('receptive_language', [
  { phase: 'WARMUP', title: 'Tek Adımlı Yönerge', childInstruction: 'Topu bana ver.', educatorInstruction: 'Top ve belirgin bir çeldirici nesneyi görünür bırak. Yönergeyi doğal sesle bir kez söyle; tekrar gerekiyorsa yardım düzeyine işle.', educatorFollowUp: 'İlk tepkiyi kaydet: doğru nesneye yöneldi / başka nesneye yöneldi / bekledi. Konuşma üretmesini isteme.', visualSpec: 'Sade masa üzerinde gerçek top ve ilgisiz tek nesne; temiz arka plan, yüksek görsel ayrım.', responseMode: 'MANIPULATIVE', materials: ['top', 'tek çeldirici nesne'], evidenceFocus: ['tek aşamalı yönerge', 'ilk tepki', 'yanıt gecikmesi'] },
  { phase: 'CORE', title: 'İşlevine Göre Bul', childInstruction: 'Hangisiyle su içeriz? Onu bana göster.', educatorInstruction: 'Tanıdık üç nesne sun; nesnenin adını söylemeden işlev sözcüğünü anlamasını gözle.', educatorFollowUp: 'Yanlış seçimde hemen doğruyu söyleme. Gerekirse “Su içmek için hangisini kullanırız?” biçiminde tek sözel yeniden çerçeveleme yap ve destek olarak kaydet.', visualSpec: 'Gerçekçi bardak, ayakkabı ve yastık görselleri ya da gerçek nesneler; eşit boyutlu ve sade düzen.', responseMode: 'SELECT', options: ['Bardak', 'Ayakkabı', 'Yastık'], expected: ['Bardak'], evidenceFocus: ['işlev dili', 'anlamdan seçim', 'sözel ipucuna tepki'] },
  { phase: 'DEEPEN', title: 'Konumu Dinle ve Uygula', childInstruction: 'Arabayı kutunun içine koy.', educatorInstruction: 'Gerçek oyuncak ve kutu kullan. “İçine” sözcüğünü jestle desteklemeden ilk denemeyi al; konum bilgisini eyleme dönüştürmesini gözle.', educatorFollowUp: 'İlk denemeden sonra gerekiyorsa yalnız konum sözcüğünü vurgula. Jest veya işaret kullanırsan VISUAL_PROMPT olarak kaydet.', visualSpec: 'Gerçek oyuncak araba ve tek kutu; konum ilişkisi elle uygulanabilir, ekran seçimine indirgenmez.', responseMode: 'MANIPULATIVE', materials: ['oyuncak araba', 'kutu'], evidenceFocus: ['konum dili', 'sözel bilgiyi eyleme dönüştürme', 'destek ayrımı'] },
  { phase: 'STRATEGY', title: 'Niteliği Dinle ve Seç', childInstruction: 'Uzun kalemi bana ver.', educatorInstruction: 'Aynı renkte ve benzer kalınlıkta biri uzun biri kısa iki kalem sun. Yalnız uzunluk sözcüğünün ayırt edici olmasını sağla.', educatorFollowUp: 'Seçimden sonra “Hangi sözcük sana yardım etti?” diye sorabilirsin; sözel açıklama yoksa baktığı/işaret ettiği özelliği not et.', visualSpec: 'Aynı renk ve tipte, yalnız uzunluğu belirgin farklı iki gerçek kalem; dikkat dağıtıcı başka özellik yok.', responseMode: 'MANIPULATIVE', materials: ['uzun kalem', 'kısa kalem'], evidenceFocus: ['nitelik dili', 'ayırt edici sözcük', 'strateji kanıtı'] },
  { phase: 'LEARNING_RESPONSE', title: 'İpucundan Sonra Yeni Yönerge', childInstruction: 'Arabayı kutunun altına koy.', educatorInstruction: 'Önce bağımsız deneme ver. Anlamazsa farklı bir nesneyle “Küpü kutunun altına koyuyorum” diye tek model göster; sonra yeniden ARABA ile aynı konum ilişkisini denet. Model öncesi ve sonrası performansı ayrı kaydet.', educatorFollowUp: 'Notta değişimi açık yaz: modelden önce yapamadı / model sonrası aynı ilişkiyi yeni nesneye aktardı / hâlâ yoğun destek gerekti.', visualSpec: 'Kutu, oyuncak araba ve model için farklı renkli küp; aynı mekânsal ilişki yeni nesneyle tekrar denenebilir.', responseMode: 'MANIPULATIVE', materials: ['oyuncak araba', 'küp', 'kutu'], evidenceFocus: ['öğrenmeye tepki', 'model sonrası anlama', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'İki Aşamalı Yönerge', childInstruction: 'Önce küpü kutuya koy, sonra bana kaşığı ver.', educatorInstruction: '39+ ay için iki farklı eylemi tek kez söyle. İlk performansta sıra, her iki adımın tamamlanması ve tekrar gereksinimini ayrı gözle.', educatorFollowUp: 'Yalnız ikinci adımı unutursa yönergenin tamamını tekrar etme; verdiğin desteğin türünü kaydet ve çalışma belleği ile dil yükünü karıştırma.', visualSpec: 'Küp, kutu ve kaşık gerçek nesneleri; tüm materyal görüş alanında, konumları sabit.', responseMode: 'MANIPULATIVE', materials: ['küp', 'kutu', 'kaşık'], evidenceFocus: ['iki aşama', 'sıralı anlama', 'işitsel çalışma belleği', 'yakın transfer'] },
  { phase: 'FAR_TRANSFER', title: 'Sıra Sözcüklerini Eyleme Çevir', childInstruction: 'Önce ellerini çırp, sonra masaya dokun.', educatorInstruction: '42+ ay için nesnesiz iki aşamalı motor yönerge kullan. “Önce/sonra” dilini gerçek hareket sırasına dönüştürmesini değerlendir.', educatorFollowUp: 'Eylemleri doğru ama ters sırada yaparsa bunu içerik hatasından ayrı not et. Tekrar veya model kullanırsan destek düzeyini yükselt.', visualSpec: 'Görsel materyal gerekmez; çocuk ve masa dışında dikkat dağıtıcı uyaranı azalt.', responseMode: 'OBSERVE', evidenceFocus: ['önce-sonra', 'sıralı yönerge', 'dilden motora transfer', 'sıra hatası'] },
  { phase: 'CEILING', title: 'Üç Özellikli Yönerge', childInstruction: 'Küçük kırmızı topu kutunun üstüne koy.', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. Boyut + renk + konum bilgisini aynı yönergede tutar; ortaya çıkmaması alan puanını düşürmez.', educatorFollowUp: 'Hangi bilgi parçasını koruduğunu gözle: küçük / kırmızı / top / üstüne. Kısmi doğru davranışı tek başarısızlık diye özetleme.', visualSpec: 'Küçük kırmızı top, büyük kırmızı top, küçük mavi top ve tek kutu; nesneler gerçek ya da foto-gerçekçi, belirgin ve eşit erişilebilir.', responseMode: 'MANIPULATIVE', materials: ['küçük kırmızı top', 'büyük kırmızı top', 'küçük mavi top', 'kutu'], evidenceFocus: ['çoklu sözel özellik', 'çalışma belleği', 'seçici dil bilgisi', 'nötr tavan'] },
]);
const expressiveLanguageTasks = sectionTasks('expressive_language', [
  { title: 'İstek Bildirme', childInstruction: 'Bir oyuncak seç ve onu benden iste.', educatorInstruction: 'Kendiliğinden sözel istek biçimini gözle.', responseMode: 'SPEAK', evidenceFocus: ['istek', 'sözel başlatma'] },
  { title: 'Resimde Ne Oluyor?', childInstruction: 'Bu resimde ne oluyor?', educatorInstruction: 'Eylem sözcüğü, özne ve anlaşılabilirlik için doğal cevap bekle.', responseMode: 'SPEAK', evidenceFocus: ['eylem anlatımı'] },
  { title: 'Bugünden Bir Şey', childInstruction: 'Bugün yaptığın bir şeyi anlatır mısın?', educatorInstruction: 'Tek olay bile olsa kendiliğinden deneyim anlatımını kaydet.', responseMode: 'SPEAK', evidenceFocus: ['deneyim anlatımı'] },
  { title: 'Neden?', childInstruction: 'Sence çocuk neden şemsiye kullanıyor?', educatorInstruction: 'Tek doğru cümle arama; anlamlı neden ilişkisini değerlendir.', responseMode: 'SPEAK', evidenceFocus: ['neden-sonuç', 'gerekçe'] },
  { title: 'İki Resmi Bağla', childInstruction: 'Bu iki resimde olanları sırayla anlat.', educatorInstruction: 'Bağlaç şartı koyma; olay sırası kanıtını kaydet.', responseMode: 'SPEAK', evidenceFocus: ['olay sırası'] },
  { title: 'Kısa Hikâye Anlat', childInstruction: 'Bu üç resme bakıp bana küçük bir hikâye anlatır mısın?', educatorInstruction: 'Karakter, eylem ve sıra bilgisini gözle; gramer hatasını tek başına risk sayma.', responseMode: 'SPEAK', evidenceFocus: ['anlatı', 'bağlantılı dil'] },
  { title: 'Yanlış Anladım', childInstruction: 'Ben seni yanlış anladım. Bir daha başka türlü anlatır mısın?', educatorInstruction: 'İletişim onarımı ve yeniden ifade becerisini gözle.', responseMode: 'SPEAK', evidenceFocus: ['iletişim onarımı', 'esneklik'] },
  { title: 'Hikâyeyi Genişlet', childInstruction: 'Bu hikâyede sonra başka ne olabilir?', educatorInstruction: '45+ ay tavan/yaratıcı anlatı kanıtıdır.', responseMode: 'SPEAK', evidenceFocus: ['öngörü', 'yaratıcı anlatı'] },
]);

const earlyMathTasks = sectionTasks('early_math', [
  { title: 'Az-Çok', childInstruction: 'Hangi tabakta daha çok var?', educatorInstruction: 'Belirgin 2 ve 5 nesne karşılaştırması kullan.', responseMode: 'SELECT', options: ['2 nesne', '5 nesne'], expected: ['5 nesne'], evidenceFocus: ['nicelik karşılaştırma'] },
  { title: 'Bir Tane Ver', childInstruction: 'Bana bir tane küp verir misin?', educatorInstruction: 'Sayı sözcüğü ile tek nesne eşlemesini gözle.', responseMode: 'MANIPULATIVE', materials: ['5 küp'], evidenceFocus: ['bir-bir eşleme'] },
  { title: 'Üçe Kadar Say', childInstruction: 'Burada kaç tane var?', educatorInstruction: '3 nesneyi sabit diz; ezbere sayı dizisinden çok niceliği kaydet.', responseMode: 'SPEAK', materials: ['3 nesne'], evidenceFocus: ['küçük nicelik'] },
  { title: 'Hangisi Uzun?', childInstruction: 'Hangisi daha uzun?', educatorInstruction: 'İki belirgin uzunluk karşılaştırması yap.', responseMode: 'SELECT', options: ['Uzun çubuk', 'Kısa çubuk'], expected: ['Uzun çubuk'], evidenceFocus: ['ölçü karşılaştırma'] },
  { title: 'Sırayı Devam Ettir', childInstruction: 'Kırmızı, mavi, kırmızı, mavi… sonra hangisi gelir?', educatorInstruction: 'AB örüntüsünü görsel nesnelerle sun.', responseMode: 'SELECT', options: ['Kırmızı', 'Mavi', 'Sarı'], expected: ['Kırmızı'], evidenceFocus: ['örüntü'] },
  { title: 'Bir Tane Daha', childInstruction: 'İki küp vardı. Bir küp daha koydum. Şimdi kaç oldu?', educatorInstruction: 'Gerçek nesneyle değişimi göster; işlem sembolü kullanma.', responseMode: 'SPEAK', materials: ['3 küp'], expected: ['3', 'üç'], evidenceFocus: ['erken toplamsal düşünme'] },
  { title: 'Eksileni Fark Et', childInstruction: 'Dört nesneden birini sakladım. Sence kaç kaldı?', educatorInstruction: 'Nesneleri önce birlikte saydırmadan doğal gözlem yap.', responseMode: 'SPEAK', expected: ['3', 'üç'], evidenceFocus: ['erken çıkarımsal nicelik'] },
  { title: 'Yeni Örüntü Kuralı', childInstruction: 'Bu dizinin kuralını bana anlatabilir misin?', educatorInstruction: '45+ ay keşif/tavan görevidir; tek başarısızlık destek göstergesi değildir.', responseMode: 'SPEAK', evidenceFocus: ['kural çıkarma', 'gerekçe'] },
]);

const memoryTasks = sectionTasks('memory', [
  { title: 'İki Nesneyi Hatırla', childInstruction: 'Top ve kaşık. Birazdan hangilerini söylediğimi soracağım.', educatorInstruction: '2–3 saniye sonra serbest hatırlama iste.', responseMode: 'SPEAK', expected: ['top ve kaşık', 'kaşık ve top'], evidenceFocus: ['işitsel kısa süreli bellek'] },
  { title: 'Nerede Saklandı?', childInstruction: 'Oyuncak hangi kutudaydı?', educatorInstruction: 'İki konumdan birine nesne sakla, kısa gecikme sonrası sor.', responseMode: 'SELECT', options: ['Sol kutu', 'Sağ kutu'], evidenceFocus: ['görsel yer belleği'] },
  { title: 'İki Hareket', childInstruction: 'Benim yaptığım iki hareketi aynı sırayla yap.', educatorInstruction: 'Örneğin başa dokun + alkışla; yalnız bir kez modelle.', responseMode: 'OBSERVE', evidenceFocus: ['motor sıra belleği'] },
  { title: 'Resimde Neler Vardı?', childInstruction: 'Az önceki resimde hangi şeyleri gördün?', educatorInstruction: '3 tanıdık nesneli görseli kısa süre göster ve kaldır.', responseMode: 'SPEAK', evidenceFocus: ['görsel serbest hatırlama'] },
  { title: 'Sırayı Koru', childInstruction: 'Kırmızı, sarı. Aynı sırayla söyle.', educatorInstruction: 'Renk adlarını bir kez söyle; tekrar istemeden ilk yanıtı kaydet.', responseMode: 'SPEAK', expected: ['kırmızı sarı'], evidenceFocus: ['işitsel sıra'] },
  { title: 'Üçlü Sıra', childInstruction: 'Kedi, top, elma. Aynı sırayla söyle.', educatorInstruction: '39+ ay için üç birimli işitsel sıra.', responseMode: 'SPEAK', expected: ['kedi top elma'], evidenceFocus: ['işitsel sıra', 'yük artışı'] },
  { title: 'Görsel Değişikliği Fark Et', childInstruction: 'Az önce hangisi başka yerdeydi?', educatorInstruction: 'Üç nesneden birinin yerini değiştir; değişen nesneyi sor.', responseMode: 'SELECT', options: ['Top', 'Küp', 'Kaşık'], evidenceFocus: ['görsel güncelleme'] },
  { title: 'Kuralı Hatırla ve Uygula', childInstruction: 'Kırmızı görünce alkışla, mavi görünce masaya dokun.', educatorInstruction: '45+ ay tavan/çalışma belleği görevidir.', responseMode: 'OBSERVE', evidenceFocus: ['kural belleği', 'çalışma belleği'] },
]);

const executiveAttentionTasks = sectionTasks('executive_attention', [
  { title: 'Kısa Odak', childInstruction: 'Bu resimde kediyi bul.', educatorInstruction: 'Dikkat dağıtıcısı düşük görselde başlangıç odağını gözle.', responseMode: 'SELECT', options: ['Kedi', 'Araba', 'Top'], expected: ['Kedi'], evidenceFocus: ['seçici dikkat'] },
  { title: 'Bekle ve Başla', childInstruction: 'Ben “şimdi” deyince topa dokun.', educatorInstruction: '1–2 saniyelik bekleme koy; erken dokunuşu cezalandırma, kaydet.', responseMode: 'OBSERVE', evidenceFocus: ['dürtü kontrolü'] },
  { title: 'Aynı Kuralı Sürdür', childInstruction: 'Her yıldızı gördüğünde bana göster.', educatorInstruction: 'Kısa seri içinde hedefi sürdürmesini gözle.', responseMode: 'OBSERVE', evidenceFocus: ['sürdürülen dikkat'] },
  { title: 'Dur-Kalk', childInstruction: 'Müzik varken yürü, durunca sen de dur.', educatorInstruction: 'Doğal oyun formunda inhibisyonu gözle.', responseMode: 'OBSERVE', evidenceFocus: ['inhibisyon', 'motor kontrol'] },
  { title: 'İki Seçenekten Hedef', childInstruction: 'Sadece kırmızı olanlara dokun.', educatorInstruction: 'Renk dışı dikkat dağıtıcı ekle; dokunuş sayısını kaydet.', responseMode: 'OBSERVE', evidenceFocus: ['seçici dikkat', 'kural sürdürme'] },
  { title: 'Kural Değişti', childInstruction: 'Şimdi kırmızıya değil, maviye dokunacağız.', educatorInstruction: '39+ ay için eski kuraldan yeni kurala geçişi gözle.', responseMode: 'OBSERVE', evidenceFocus: ['bilişsel esneklik'] },
  { title: 'Tersini Yap', childInstruction: 'Ben ellerimi açınca sen kapat, ben kapatınca sen aç.', educatorInstruction: '42+ ay için ters kuralı kısa seriyle uygula.', responseMode: 'OBSERVE', evidenceFocus: ['inhibisyon', 'kural tutma'] },
  { title: 'İki Kural Arasında Geçiş', childInstruction: 'Yuvarlakta alkışla, karede dokun; zil çalınca kuralları değiştireceğiz.', educatorInstruction: '45+ ay tavan görevidir; performansı tanısal yorumlama.', responseMode: 'OBSERVE', evidenceFocus: ['set değiştirme', 'çalışma belleği'] },
]);

const socialEmotionTasks = sectionTasks('social_emotion_play', [
  { title: 'Duyguyu Tanı', childInstruction: 'Sence bu çocuk nasıl hissediyor?', educatorInstruction: 'Mutlu/üzgün gibi belirgin yüz ifadesi kullan.', responseMode: 'SPEAK', evidenceFocus: ['duygu tanıma'] },
  { title: 'Sıra Bende-Sende', childInstruction: 'Bir sen koy, bir ben koyayım.', educatorInstruction: 'Kısa blok oyunu ile sıra alma davranışını gözle.', responseMode: 'OBSERVE', materials: ['bloklar'], evidenceFocus: ['sıra alma', 'ortak oyun'] },
  { title: 'Rol Oyunu', childInstruction: 'Bu bebeğin doktoru olsak ne yapardık?', educatorInstruction: 'Sembolik rol üretimini doğal oyunda gözle.', responseMode: 'OBSERVE', materials: ['bebek', 'oyuncak doktor seti'], evidenceFocus: ['sembolik oyun'] },
  { title: 'Arkadaş Üzgünse', childInstruction: 'Arkadaşın üzülse ne yapabilirsin?', educatorInstruction: 'Tek doğru sosyal yanıt bekleme; uygun sosyal çözüm çeşitliliğini kaydet.', responseMode: 'SPEAK', evidenceFocus: ['empati', 'sosyal çözüm'] },
  { title: 'Oyuna Katılma', childInstruction: 'İki çocuk oyun oynuyor. Sen de oynamak istersen ne dersin?', educatorInstruction: 'Sosyal giriş ifadesi ve izin istemeyi gözle.', responseMode: 'SPEAK', evidenceFocus: ['sosyal başlatma'] },
  { title: 'Ben Başka, Sen Başka', childInstruction: 'Sen dondurmayı seviyorsun; arkadaşın sevmeyebilir mi?', educatorInstruction: 'Farklı tercih olabileceğini kabul edip etmediğini gözle.', responseMode: 'SPEAK', evidenceFocus: ['bakış açısı'] },
  { title: 'Oyunun Kuralı Değişirse', childInstruction: 'Oyunda sıra değişirse ne yapabiliriz?', educatorInstruction: '42+ ay sosyal esneklik ve regülasyon kanıtı topla.', responseMode: 'SPEAK', evidenceFocus: ['sosyal esneklik', 'regülasyon'] },
  { title: 'Karakter Ne Düşünüyor?', childInstruction: 'Sence bu karakter ne düşünüyor olabilir?', educatorInstruction: '45+ ay keşif görevidir; tek yanıtı doğru kabul etme.', responseMode: 'SPEAK', evidenceFocus: ['zihinsel durum çıkarımı'] },
]);

const motorTasks = sectionTasks('motor_graphomotor', [
  { title: 'Boncuk Dizme', childInstruction: 'Bunları ipe dizmeyi dener misin?', educatorInstruction: 'Gerçek materyal kullan; ekran seçimiyle ince motor ölçme.', responseMode: 'OBSERVE', materials: ['kalın ip', 'büyük boncuklar'], evidenceFocus: ['iki el koordinasyonu', 'ince motor'] },
  { title: 'Kapağı Aç-Kapat', childInstruction: 'Bu kutuyu açıp kapatabilir misin?', educatorInstruction: 'Güvenli ve kolay kapaklı kap kullan.', responseMode: 'OBSERVE', materials: ['kapaklı kap'], evidenceFocus: ['el becerisi'] },
  { title: 'Dikey Çizgi Taklidi', childInstruction: 'Benim gibi yukarıdan aşağı bir çizgi çizer misin?', educatorInstruction: 'Bir kez modelle, kalem tutuşunu zorla düzeltme.', responseMode: 'DRAW', materials: ['kalın boya kalemi', 'kağıt'], evidenceFocus: ['grafomotor taklit'] },
  { title: 'Daire Taklidi', childInstruction: 'Benim çizdiğim yuvarlağın bir benzerini çizer misin?', educatorInstruction: 'Mükemmel geometrik şekil bekleme; kapalı forma yaklaşımı gözle.', responseMode: 'DRAW', materials: ['kalem', 'kağıt'], evidenceFocus: ['şekil taklidi'] },
  { title: 'Topu Yakala', childInstruction: 'Topu sana atacağım, yakalamayı dene.', educatorInstruction: 'Büyük ve yumuşak top kullan; 2–3 güvenli deneme yap.', responseMode: 'OBSERVE', materials: ['büyük yumuşak top'], evidenceFocus: ['kaba motor koordinasyon'] },
  { title: 'Düğme Açma', childInstruction: 'Bu büyük düğmeyi açmayı dener misin?', educatorInstruction: '39+ ay için büyük düğmeli materyal kullan; fiziksel yardımı kaydet.', responseMode: 'OBSERVE', materials: ['büyük düğmeli çerçeve'], evidenceFocus: ['ince motor', 'özbakım motoru'] },
  { title: 'Basit İnsan Çizimi', childInstruction: 'Bir insan çizer misin?', educatorInstruction: '42+ ay; parça sayısını betimle, norm puanı üretme.', responseMode: 'DRAW', materials: ['kalem', 'kağıt'], evidenceFocus: ['temsili çizim', 'grafomotor'] },
  { title: 'Kesme-Yol Takibi', childInstruction: 'Bu kalın çizgiyi makasla takip etmeyi dener misin?', educatorInstruction: '45+ ay tavan görevidir; çocuk makası ve yakın yetişkin gözetimi kullan.', responseMode: 'OBSERVE', materials: ['çocuk makası', 'kalın çizgili kağıt'], evidenceFocus: ['görsel-motor planlama'] },
]);

const dailyLivingTasks = sectionTasks('daily_living_safety', [
  { title: 'Montumu Giyiyorum', childInstruction: 'Montunu giymeyi dener misin?', educatorInstruction: 'Süre baskısı kurma; hangi aşamada yardım gerektiğini kaydet.', responseMode: 'OBSERVE', evidenceFocus: ['giyinme bağımsızlığı'] },
  { title: 'Eşyayı Yerine Koy', childInstruction: 'Oyuncağın işi bitince nereye koyabiliriz?', educatorInstruction: 'Gerçek ortam ve tanıdık rutin kullan.', responseMode: 'OBSERVE', evidenceFocus: ['rutin', 'düzen'] },
  { title: 'Eller Ne Zaman Yıkanır?', childInstruction: 'Ellerimizi ne zaman yıkarız?', educatorInstruction: 'Tek ezber cümlesi yerine günlük yaşam örneği iste.', responseMode: 'SPEAK', evidenceFocus: ['özbakım bilgisi'] },
  { title: 'Yardım İsteme', childInstruction: 'Bir şeyi açamazsan ne yaparsın?', educatorInstruction: 'Uygun yardım arama davranışını gözle.', responseMode: 'SPEAK', evidenceFocus: ['yardım isteme'] },
  { title: 'Sıcak Şeye Dokunur Muyuz?', childInstruction: 'Çok sıcak bir şeye dokunmak güvenli mi?', educatorInstruction: 'Korkutucu içerik kullanma; temel ev güvenliği dilini değerlendir.', responseMode: 'SELECT', options: ['Evet', 'Hayır'], expected: ['Hayır'], evidenceFocus: ['temel güvenlik'] },
  { title: 'Yabancı Bir Yere Giderken', childInstruction: 'Bir yere giderken yetişkininden uzaklaşırsan ne yaparsın?', educatorInstruction: '39+ ay için basit güvenlik planını konuş; yanıtı yargılayıcı puanlama.', responseMode: 'SPEAK', evidenceFocus: ['güvenlik planı'] },
  { title: 'İki Aşamalı Özbakım', childInstruction: 'Önce mendili al, sonra çöpe at.', educatorInstruction: '42+ ay için günlük yaşam içinde iki aşamalı rutin uygulat.', responseMode: 'OBSERVE', evidenceFocus: ['özbakım sırası', 'yönerge'] },
  { title: 'Güvenli Seçimi Açıkla', childInstruction: 'Bu iki durumdan hangisi daha güvenli? Neden?', educatorInstruction: '45+ ay tavan görevidir; gerekçeyi doğal biçimde al.', responseMode: 'SPEAK', evidenceFocus: ['güvenlik muhakemesi'] },
]);

const learningTransferTasks = sectionTasks('learning_transfer', [
  { title: 'Modelden Öğren', childInstruction: 'Ben bir kez yapacağım, sonra sen dene.', educatorInstruction: 'Basit iki parçalı yapıyı modelle; model sonrası değişimi kaydet.', responseMode: 'MANIPULATIVE', materials: ['2-3 blok'], evidenceFocus: ['modelden öğrenme'] },
  { title: 'İlk Yol Olmazsa', childInstruction: 'Bu parça buraya olmuyorsa başka ne deneyebiliriz?', educatorInstruction: 'İlk başarısız denemeden sonra strateji değişimini gözle.', responseMode: 'MANIPULATIVE', materials: ['şekil kutusu'], evidenceFocus: ['strateji değiştirme'] },
  { title: 'İpucundan Sonra', childInstruction: 'Şimdi sana küçük bir ipucu vereceğim. Tekrar dener misin?', educatorInstruction: 'İpucu öncesi ve sonrası performansı ayrı kaydet.', responseMode: 'OBSERVE', evidenceFocus: ['öğrenme tepkisi'] },
  { title: 'Benzerini Bul', childInstruction: 'Az önce yaptığımıza benzeyen başka hangisi var?', educatorInstruction: 'Yakın transfer için aynı kuralın farklı yüzey örneğini sun.', responseMode: 'SELECT', evidenceFocus: ['yakın transfer'] },
  { title: 'Planını Söyle', childInstruction: 'Bunu yapmaya başlamadan önce ne yapacağını söyleyebilir misin?', educatorInstruction: 'Kısa plan ifadesi yeterlidir; yetişkin dili bekleme.', responseMode: 'SPEAK', evidenceFocus: ['planlama', 'üstbiliş başlangıcı'] },
  { title: 'Yeni Malzemeyle Aynı Kural', childInstruction: 'Şimdi aynı oyunu başka oyuncaklarla yapalım.', educatorInstruction: '39+ ay için materyal değişiminde kural transferini gözle.', responseMode: 'OBSERVE', evidenceFocus: ['transfer'] },
  { title: 'Kendi Çözümünü Seç', childInstruction: 'Bunu iki farklı yoldan yapabilir miyiz?', educatorInstruction: '42+ ay için alternatif üretimi gözle; tek yol zorunluluğu koyma.', responseMode: 'SPEAK', evidenceFocus: ['alternatif üretme', 'esneklik'] },
  { title: 'Uzak Transfer Keşfi', childInstruction: 'Bu öğrendiğimiz kural başka nerede işimize yarayabilir?', educatorInstruction: '45+ ay tavan/keşif görevidir; başarısızlığı eksiklik olarak sayma.', responseMode: 'SPEAK', evidenceFocus: ['uzak transfer', 'genelleme'] },
]);

export const e3Tasks: E3Task[] = [
  ...visualConceptTasks,
  ...receptiveLanguageTasks,
  ...expressiveLanguageTasks,
  ...earlyMathTasks,
  ...memoryTasks,
  ...executiveAttentionTasks,
  ...socialEmotionTasks,
  ...motorTasks,
  ...dailyLivingTasks,
  ...learningTransferTasks,
];

export const e3CaregiverQuestions = [
  ['CG-01', 'İletişim', 'İhtiyaçlarını çoğu zaman sözcük/cümle ile anlatıyor mu?'],
  ['CG-02', 'İletişim', 'Gün içinde size bir olayı kendiliğinden anlatıyor mu?'],
  ['CG-03', 'İletişim', 'Anlaşılmadığında başka türlü anlatmayı deniyor mu?'],
  ['CG-04', 'İletişim', 'İçinde, üstünde, altında gibi konum sözcüklerini günlük hayatta anlıyor mu?'],
  ['CG-05', 'Sosyal oyun', 'Başka çocukların oyununa katılmaya çalışıyor mu?'],
  ['CG-06', 'Sosyal oyun', 'Rol yapma/evcilik/doktorculuk gibi sembolik oyunlar kuruyor mu?'],
  ['CG-07', 'Sosyal oyun', 'Sıra beklemeyi kısa oyunlarda sürdürebiliyor mu?'],
  ['CG-08', 'Sosyal oyun', 'Başkasının üzgün veya mutlu olduğunu fark edip tepki veriyor mu?'],
  ['CG-09', 'Dikkat-regülasyon', 'Sevdiği bir etkinlikte birkaç dakika odakta kalabiliyor mu?'],
  ['CG-10', 'Dikkat-regülasyon', 'Basit bir kural değiştiğinde yeni kurala geçebiliyor mu?'],
  ['CG-11', 'Dikkat-regülasyon', 'Beklemesi istendiğinde kısa süre bekleyebiliyor mu?'],
  ['CG-12', 'Dikkat-regülasyon', 'Zorlandığında tamamen bırakmak yerine yardım arıyor mu?'],
  ['CG-13', 'Özbakım', 'Bazı giysilerini kendi başına giyip çıkarabiliyor mu?'],
  ['CG-14', 'Özbakım', 'Yemek/temizlik gibi günlük rutinlerde yaşına uygun sorumluluk alıyor mu?'],
  ['CG-15', 'Özbakım', 'Oyuncak/eşyaları hatırlatmayla da olsa yerine koyabiliyor mu?'],
  ['CG-16', 'Özbakım', 'Tuvalet ve el yıkama rutininde hangi aşamalarda yardıma ihtiyaç duyuyor?'],
  ['CG-17', 'Güvenlik', 'Sıcak, keskin veya tehlikeli olabilecek şeylerden kaçınma kuralını biliyor mu?'],
  ['CG-18', 'Güvenlik', 'Yetişkininden ayrıldığında yardım istemesi gerektiğini biliyor mu?'],
  ['CG-19', 'Motor', 'Kalem/boya ile çizgi, yuvarlak veya basit şekiller çizmekten hoşlanıyor mu?'],
  ['CG-20', 'Motor', 'Top atma-yakalama, koşma, zıplama gibi hareketli oyunlara katılıyor mu?'],
  ['CG-21', 'Öğrenme', 'Yeni bir şeyi bir kez gösterdiğinizde taklit ederek öğrenebiliyor mu?'],
  ['CG-22', 'Öğrenme', 'Bir çözüm işe yaramadığında başka yol denediği oluyor mu?'],
  ['CG-23', 'Aile önceliği', 'Şu anda en çok desteklemek istediğiniz alan hangisi?'],
  ['CG-24', 'Aile önceliği', 'Son aylarda sizi özellikle düşündüren veya sevindiren bir gelişim değişikliği var mı?'],
] as const;

export function e3BandForAge(ageMonths: number): E3Band {
  if (ageMonths < 36 || ageMonths > 47) throw new Error('e3_age_out_of_range');
  if (ageMonths <= 38) return '36-38';
  if (ageMonths <= 41) return '39-41';
  if (ageMonths <= 44) return '42-44';
  return '45-47';
}

export function e3BaseTarget(ageMonths: number) {
  const band = e3BandForAge(ageMonths);
  return band === '36-38' ? 4 : band === '39-41' ? 5 : band === '42-44' ? 6 : 7;
}

export function e3EligibleTasks(sectionId: E3SectionId, ageMonths: number) {
  e3BandForAge(ageMonths);
  return e3Tasks.filter((task) => task.sectionId === sectionId && task.minMonth <= ageMonths);
}

function isWeakEvidence(evidence: E3Evidence) {
  if (evidence.neutralProbe || evidence.supportLevel === 'NOT_ASSESSED') return false;
  if (evidence.firstMatch === false) return true;
  return !['INDEPENDENT'].includes(evidence.supportLevel);
}

export function e3TargetForSection(ageMonths: number, sectionId: E3SectionId, evidence: E3Evidence[]) {
  const eligible = e3EligibleTasks(sectionId, ageMonths);
  const base = Math.min(e3BaseTarget(ageMonths), eligible.length);
  const firstThree = evidence.filter((item) => item.sectionId === sectionId && !item.neutralProbe && item.supportLevel !== 'NOT_ASSESSED').slice(0, 3);
  const weakCount = firstThree.filter(isWeakEvidence).length;
  const extra = firstThree.length >= 3 && weakCount >= 2 ? 1 : 0;
  return Math.min(eligible.length, base + extra);
}

export function e3NextTask(ageMonths: number, sectionId: E3SectionId, evidence: E3Evidence[]) {
  const target = e3TargetForSection(ageMonths, sectionId, evidence);
  const completed = new Set(evidence.filter((item) => item.sectionId === sectionId).map((item) => item.taskId));
  return e3EligibleTasks(sectionId, ageMonths).slice(0, target).find((task) => !completed.has(task.id)) ?? null;
}

export function e3NextSection(current: E3SectionId) {
  const index = e3Sections.findIndex((section) => section.id === current);
  return index >= 0 && index + 1 < e3Sections.length ? e3Sections[index + 1].id : null;
}

export function normalizeE3Answer(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR').replace(/[.!?]/g, '').replace(/\s+/g, ' ');
}

export function e3FirstMatch(task: E3Task, answer: string): boolean | null {
  if (!task.expected?.length) return null;
  const normalized = normalizeE3Answer(answer);
  if (!normalized) return null;
  return task.expected.some((item) => normalizeE3Answer(item) === normalized);
}

export function buildE3SectionReport(evidence: E3Evidence[]): E3SectionReport[] {
  return e3Sections.map((section) => {
    const rows = evidence.filter((item) => item.sectionId === section.id && !item.neutralProbe && item.supportLevel !== 'NOT_ASSESSED');
    const independent = rows.filter((item) => item.supportLevel === 'INDEPENDENT').length;
    const notObserved = rows.filter((item) => item.supportLevel === 'NOT_OBSERVED').length;
    const supported = rows.length - independent - notObserved;
    const matched = rows.filter((item) => item.firstMatch != null);
    const latencies = rows.map((item) => item.latencyMs).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const independenceRate = rows.length ? independent / rows.length : null;
    const firstMatchRate = matched.length ? matched.filter((item) => item.firstMatch === true).length / matched.length : null;
    let status: E3ProfileStatus = 'INSUFFICIENT';
    if (rows.length >= 3) {
      if ((independenceRate ?? 0) >= 0.75 && (firstMatchRate == null || firstMatchRate >= 0.7)) status = 'RELATIVE_STRENGTH';
      else if ((independenceRate ?? 0) < 0.4 || (supported + notObserved) / rows.length > 0.5) status = 'WATCH_SUPPORT';
      else status = 'DEVELOPING';
    }
    return {
      sectionId: section.id,
      label: section.label,
      assessed: rows.length,
      independent,
      supported,
      notObserved,
      firstMatchRate,
      independenceRate,
      averageLatencyMs: latencies.length ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : null,
      status,
    };
  });
}

export function e3ReportDisclaimer() {
  return 'Bu sonuçlar CZA oturumu içindeki eğitimsel kanıtları özetler; norm, tanı, gelişim yaşı veya standart gelişim taraması değildir. Tek bir görev ya da tavan görevi başarısızlığı gelişimsel gecikme olarak yorumlanmaz.';
}
