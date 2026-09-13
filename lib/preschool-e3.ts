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
  { phase: 'WARMUP', title: 'İstediğini Anlat', childInstruction: 'Bu oyuncaklardan birini seç. Hangisini istediğini bana söyler misin?', educatorInstruction: 'İki tanıdık oyuncak sun. Sözcük, kısa ifade veya doğal cümleyle isteği başlatmasını gözle; yetişkin cümlesi dayatma.', educatorFollowUp: 'İlk üretimi aynen not et. Yalnız işaret ederse “Bana söylemek ister misin?” diye tek fırsat ver; zorlamayı sürdürme.', visualSpec: 'İki tanıdık gerçek oyuncak veya foto-gerçekçi kart; sade masa, eşit erişim, dikkat dağıtıcı etiket yok.', responseMode: 'SPEAK', materials: ['2 tanıdık oyuncak'], evidenceFocus: ['işlevsel ifade', 'sözel başlatma', 'ilk üretim', 'yanıt gecikmesi'] },
  { phase: 'CORE', title: 'Resimde Ne Oluyor?', childInstruction: 'Bu resimde ne oluyor?', educatorInstruction: 'Tek ve açık bir eylem içeren tanıdık sahne göster. Eylem sözcüğü ve anlamlı özne-nesne bilgisini doğal anlatım içinde gözle.', educatorFollowUp: 'Tek kelime yanıt verirse “Biraz daha anlatmak ister misin?” diye bir kez genişletme fırsatı ver; model cümle vermeden önce ilk üretimi kaydet.', visualSpec: 'Foto-gerçekçi, tek ana eylemli çocuk dostu sahne; örneğin çocuk top atıyor. Arka plan sade, olay açık.', responseMode: 'SPEAK', evidenceFocus: ['eylem anlatımı', 'anlaşılabilirlik', 'kendiliğinden genişletme'] },
  { phase: 'DEEPEN', title: 'Bugünden Bir Olay', childInstruction: 'Bugün yaptığın bir şeyi bana anlatır mısın?', educatorInstruction: 'Tek bir gerçek olay bile yeterlidir. Zaman sırası ya da uzun cümle şartı koyma; kendi deneyimini sözel olarak çağırmasını gözle.', educatorFollowUp: 'Gerekirse yalnız “Sonra ne oldu?” diye açık uçlu tek takip sorusu sor. Soruyu içerik vermeden kullan.', visualSpec: 'Görsel materyal zorunlu değil; gerekiyorsa nötr “bugün” simgesi kullanılabilir, olay içeriğini ipuçlandıran resim gösterme.', responseMode: 'SPEAK', evidenceFocus: ['deneyim anlatımı', 'olay bilgisi', 'kendiliğinden ayrıntı'] },
  { phase: 'STRATEGY', title: 'Neden Böyle Oldu?', childInstruction: 'Sence çocuk neden şemsiye kullanıyor?', educatorInstruction: 'Yağmur + şemsiye gibi görünür ipuçlu bir sahne kullan. Tek kalıp cümle arama; anlamlı neden bağlantısını ve kullandığı görsel ipucunu gözle.', educatorFollowUp: 'Yanıt sonrası “Bunu nereden anladın?” diye sor; sözel açıklama yoksa baktığı görsel ipucunu not et.', visualSpec: 'Yağmur damlaları belirgin, çocuk şemsiye tutuyor; başka güçlü neden ipucu eklenmemiş foto-gerçekçi sahne.', responseMode: 'SPEAK', evidenceFocus: ['neden-sonuç', 'görsel ipucundan anlatım', 'gerekçe stratejisi'] },
  { phase: 'LEARNING_RESPONSE', title: 'Başka Türlü Anlat', childInstruction: 'Ben seni tam anlayamadım. Bunu başka türlü anlatmayı dener misin?', educatorInstruction: 'Önce çocuğun kendi yeniden ifade denemesini bekle. Zorlanırsa FARKLI bir örnekte “Kedi koşuyor → Kedi hızlı gidiyor” gibi tek iletişim onarımı modeli göster; sonra hedef anlatıma geri dön.', educatorFollowUp: 'Model öncesi ve sonrası değişimi ayrı kaydet: aynı ifadeyi yineledi / yeni sözcük ekledi / farklı anlatım kurdu / iletişimi bıraktı.', visualSpec: 'Model için hedeften farklı basit eylem kartı; hedef içerikle aynı görsel kullanılmaz ki tekrar ezbere dönüşmesin.', responseMode: 'SPEAK', evidenceFocus: ['iletişim onarımı', 'modelden öğrenme', 'yeniden ifade', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'İki Resmi Sırala ve Anlat', childInstruction: 'Bu iki resimde olanları sırayla anlatır mısın?', educatorInstruction: '39+ ay için açık başlangıç-sonuç ilişkili iki sahne kullan. Bağlaç zorunlu tutma; doğru olay sırasını ve anlam bağlantısını gözle.', educatorFollowUp: 'İki olayı tek tek söylüyor ama bağlamıyorsa “Önce ne oldu, sonra ne oldu?” diye tek yapılandırıcı ipucu ver ve VERBAL_PROMPT olarak kaydet.', visualSpec: 'İki foto-gerçekçi kart: örneğin çocuk bardağa su dolduruyor → su içiyor. Zaman sırası açık ama metin yok.', responseMode: 'SPEAK', evidenceFocus: ['olay sırası', 'bağlantılı dil', 'yakın transfer', 'önce-sonra anlatımı'] },
  { phase: 'FAR_TRANSFER', title: 'Üç Resimden Hikâye Kur', childInstruction: 'Bu üç resme bakıp bana küçük bir hikâye anlatır mısın?', educatorInstruction: '42+ ay için karakter + olay + sonuç içeren üç sahne kullan. Gramer doğruluğundan çok anlam bağlantısı, sıra ve kendiliğinden ilişkilendirmeyi kaydet.', educatorFollowUp: 'Hikâye parçalıysa yalnız “Bunlar nasıl birbirine bağlanıyor?” diye sor; yetişkin cümlesiyle tamamlamadan çocuğun kurduğu bağlantıyı gözle.', visualSpec: 'Aynı karakterli üç foto-gerçekçi çocuk dostu sahne; başlangıç, problem/eylem ve sonuç net; yazı ve numara yok.', responseMode: 'SPEAK', evidenceFocus: ['anlatı bütünlüğü', 'olay sırası', 'nedensel bağ', 'uzak transfer'] },
  { phase: 'CEILING', title: 'Hikâyeyi Yeni Bir Yere Taşı', childInstruction: 'Sence bundan sonra başka ne olabilir?', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. Tek doğru son bekleme; öngörü, yaratıcı genişletme veya karakter niyetine dayalı olası devamları keşif kanıtı olarak kaydet.', educatorFollowUp: 'Yanıt kısa ya da sıra dışı olsa da anlamlıysa kabul et. Ortaya çıkmaması ifade alanı puanını düşürmez.', visualSpec: 'Önceki üçlü hikâyenin son karesi ya da yeni ama açık uçlu bir sahne; geleceğe dair tek zorunlu cevap üretmeyecek biçimde tasarlanır.', responseMode: 'SPEAK', evidenceFocus: ['öngörü', 'yaratıcı anlatı', 'esnek dil', 'nötr tavan'] },
]);
const earlyMathTasks = sectionTasks('early_math', [
  { phase: 'WARMUP', title: 'Hangisinde Daha Çok?', childInstruction: 'Hangi tabakta daha çok var?', educatorInstruction: 'Aynı tür nesnelerle belirgin 2 ve 5 karşılaştırması kullan. Saymasını istemeden ilk nicelik seçimini gözle.', educatorFollowUp: 'Seçimden sonra isterse “Nasıl anladın?” diye sor; parmakla gösterme, bakış veya yaklaşık karşılaştırma da strateji kanıtıdır.', visualSpec: 'İki aynı tabak; solda 2, sağda 5 aynı boy gerçekçi nesne. Nesne aralıkları benzer, dikkat dağıtıcı renk farkı yok.', responseMode: 'SELECT', options: ['2 nesne olan tabak', '5 nesne olan tabak'], expected: ['5 nesne olan tabak'], evidenceFocus: ['nicelik karşılaştırma', 'ilk seçim', 'yanıt gecikmesi'] },
  { phase: 'CORE', title: 'Bana Bir Tane Ver', childInstruction: 'Bana bir tane küp verir misin?', educatorInstruction: 'Önünde 5 benzer küp olsun. “Bir tane” sayı sözcüğünü gerçek nesne miktarına dönüştürmesini gözle.', educatorFollowUp: 'Birden fazla verirse hemen düzeltme; “Bir tane istemiştim” biçiminde tek sözel ipucu verilebilir ve destek olarak kaydedilir.', visualSpec: 'Beş özdeş büyük küp; masa üzerinde dağınık ama erişilebilir, başka sayısal işaret yok.', responseMode: 'MANIPULATIVE', materials: ['5 özdeş küp'], evidenceFocus: ['sayı sözcüğü-nicelik eşleme', 'bir-bir seçme', 'sözel ipucuna tepki'] },
  { phase: 'DEEPEN', title: 'Üç Nesneyi Fark Et', childInstruction: 'Burada kaç tane var?', educatorInstruction: 'Üç aynı nesneyi kısa ve temiz düzende sun. Ezbere sayı dizisinden çok toplam küçük niceliği ifade edip etmediğini gözle.', educatorFollowUp: 'Çocuk tek tek sayarsa bunu strateji olarak not et; saymadan “üç” demesi de kabul edilir. Parmak kullanımını hata sayma.', visualSpec: 'Üç aynı nesne, üçgen ya da yatay sade düzen; arka plan boş, sayı rakamı gösterilmez.', responseMode: 'SPEAK', materials: ['3 aynı nesne'], expected: ['3', 'üç'], evidenceFocus: ['küçük nicelik', 'sayma stratejisi', 'kardinal sonuç'] },
  { phase: 'STRATEGY', title: 'Hangisi Daha Uzun?', childInstruction: 'Hangisi daha uzun?', educatorInstruction: 'Aynı renk ve kalınlıkta iki çubuğu aynı başlangıç çizgisinden hizala. Görsel karşılaştırma stratejisini gözle.', educatorFollowUp: 'Yanıt sonrası “Nereden anladın?” diye sorabilirsin; uçları karşılaştırma, yan yana getirme veya işaret etme strateji kanıtıdır.', visualSpec: 'Aynı başlangıç noktasından başlayan, yalnız uzunluğu farklı iki sade çubuk; renk/kalınlık eşit.', responseMode: 'SELECT', options: ['Uzun çubuk', 'Kısa çubuk'], expected: ['Uzun çubuk'], evidenceFocus: ['ölçü karşılaştırma', 'strateji', 'görsel-mekânsal muhakeme'] },
  { phase: 'LEARNING_RESPONSE', title: 'Örüntüyü Gör ve Yeniden Dene', childInstruction: 'Kırmızı, mavi, kırmızı, mavi… sonra hangisi gelir?', educatorInstruction: 'Önce AB örüntüsünde bağımsız deneme ver. Zorlanırsa FARKLI şekillerle daire-kare-daire-kare modelini bir kez göster; ardından tekrar renk örüntüsüne dön.', educatorFollowUp: 'Model öncesi ve sonrası değişimi ayrı kaydet: kuralı fark etmedi / model sonrası tamamladı / yeni örneğe aktaramadı.', visualSpec: 'Renk örüntüsü hedefi ve model için ayrı şekil örüntüsü. Öğretim örneği ile test örneği görsel olarak farklı.', responseMode: 'SELECT', options: ['Kırmızı', 'Mavi', 'Sarı'], expected: ['Kırmızı'], evidenceFocus: ['örüntü', 'modelden öğrenme', 'kural çıkarma', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'Bir Tane Daha Eklenirse', childInstruction: 'İki küp vardı. Bir küp daha koydum. Şimdi kaç oldu?', educatorInstruction: '39+ ay için değişimi gerçek nesneyle görünür yap. İşlem sembolü kullanma; başlangıç miktarı ile eklenen birimi ilişkilendirmesini gözle.', educatorFollowUp: 'Parmakla sayma, nesneleri yeniden sayma veya doğrudan üç deme stratejisini ayrı not et; tek stratejiyi üstün sayma.', visualSpec: 'Önce 2 özdeş küp, sonra aynı türden 1 küp fiziksel olarak eklenir; “+” işareti veya rakam kartı yok.', responseMode: 'SPEAK', materials: ['3 özdeş küp'], expected: ['3', 'üç'], evidenceFocus: ['erken toplamsal düşünme', 'değişim takibi', 'yakın transfer', 'strateji'] },
  { phase: 'FAR_TRANSFER', title: 'Bir Tane Gidince', childInstruction: 'Dört nesne vardı. Birini sakladım. Sence kaç kaldı?', educatorInstruction: '42+ ay için dört nesneyi kısa süre görünür tut, birini fiziksel olarak kaldır. Kalan niceliği çıkarım yoluyla takip etmesini gözle.', educatorFollowUp: 'Çocuk kalanları yeniden sayarsa kabul et ve strateji olarak kaydet. Başlangıç miktarını unutma ile çıkarımsal hatayı ayrı not et.', visualSpec: 'Dört aynı nesne; biri çocuğun gözü önünde kap altına alınır ya da kaldırılır. Rakam ve işlem sembolü gösterilmez.', responseMode: 'SPEAK', materials: ['4 aynı nesne', 'örtü veya küçük kutu'], expected: ['3', 'üç'], evidenceFocus: ['erken çıkarımsal nicelik', 'eksilme', 'çalışma belleği', 'uzak transfer'] },
  { phase: 'CEILING', title: 'Yeni Örüntünün Kuralını Bul', childInstruction: 'Bu dizinin kuralını bana anlatabilir misin?', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. AB’den farklı ama yaşa uygun AAB ya da ABB örüntüsü kullan; tek başarısızlık alan puanını düşürmez.', educatorFollowUp: 'Sözel kural veremezse devam parçasını seçmesi, işaret etmesi veya örüntüyü sürdürmesi de keşif kanıtıdır.', visualSpec: 'Üçlü tekrar yapısına sahip sade gerçek nesne/şekil dizisi; metin ve rakam yok, tekrar birimi görsel olarak izlenebilir.', responseMode: 'SPEAK', evidenceFocus: ['kural keşfi', 'örüntü genelleme', 'gerekçe veya davranışsal açıklama', 'nötr tavan'] },
]);
const memoryTasks = sectionTasks('memory', [
  { phase: 'WARMUP', title: 'İki Şeyi Hatırla', childInstruction: 'Top ve kaşık. Birazdan hangilerini söylediğimi soracağım.', educatorInstruction: 'İki tanıdık sözcüğü doğal hızda bir kez söyle. 2–3 saniye sonra serbest hatırlama iste; tekrar gerekirse destek düzeyine işle.', educatorFollowUp: 'İki öğeden birini hatırlama, sıra değiştirme veya ikisini birlikte hatırlama biçimini ayrı not et.', visualSpec: 'Ekranda yanıt ipucu göstermeyen sade alan; gerekirse eğitimci için yalnız küçük top ve kaşık materyal kartı, çocuk hatırlama sırasında görmemeli.', responseMode: 'SPEAK', expected: ['top ve kaşık', 'kaşık ve top'], evidenceFocus: ['işitsel kısa süreli bellek', 'serbest hatırlama', 'ilk yanıt gecikmesi'] },
  { phase: 'CORE', title: 'Nerede Saklandı?', childInstruction: 'Oyuncak hangi kutudaydı?', educatorInstruction: 'Aynı görünümlü iki konumdan birine nesneyi çocuğun gözü önünde sakla; kısa gecikmeden sonra seçim yaptır.', educatorFollowUp: 'Bakışını, ilk seçimini ve konum değiştirirse öz-düzeltmeyi kaydet; yön adını söylemesini şart koşma.', visualSpec: 'Birbirine eş iki kap ve tek küçük oyuncak; kaplar simetrik ve ayırt edici renk ipucu taşımamalı.', responseMode: 'SELECT', options: ['Sol kutu', 'Sağ kutu'], evidenceFocus: ['görsel yer belleği', 'tanıma', 'ilk seçim'] },
  { phase: 'DEEPEN', title: 'İki Hareketi Sırayla Yap', childInstruction: 'Benim yaptığım iki hareketi aynı sırayla yap.', educatorInstruction: 'Başa dokun + alkış gibi iki kısa hareketi yalnız bir kez modelle; içerik ile sıra doğruluğunu ayrı gözle.', educatorFollowUp: 'İki hareketi de yapıp sırayı değiştirdiyse bunu sıra hatası olarak; hareketlerden birini unuttuysa içerik kaybı olarak not et.', visualSpec: 'Ekran gerektirmez; eğitimci karşılıklı oturur, sade arka plan ve dikkat dağıtıcı olmayan ortam.', responseMode: 'OBSERVE', evidenceFocus: ['motor sıra belleği', 'sıra', 'içerik-sıra ayrımı'] },
  { phase: 'STRATEGY', title: 'Resimde Neler Vardı?', childInstruction: 'Az önceki resimde hangi şeyleri gördün?', educatorInstruction: 'Üç tanıdık nesneli görseli kısa süre gösterip kaldır. Serbest hatırlama sonrası çocuğun kendiliğinden kullandığı stratejiyi gözle.', educatorFollowUp: '“Hatırlamak için ne yaptın?” sorusu isteğe bağlıdır; görsele tekrar bakma isteği, içinden/sesli adlandırma veya parmakla izleme de strateji kanıtıdır.', visualSpec: 'Tek sahnede üç tanıdık nesne: top, fincan, oyuncak araba; eşit belirginlikte, temiz arka plan, ek metin yok.', responseMode: 'SPEAK', evidenceFocus: ['görsel serbest hatırlama', 'kodlama stratejisi', 'öz-açıklama başlangıcı'] },
  { phase: 'LEARNING_RESPONSE', title: 'Hatırlama Yolunu Gör ve Dene', childInstruction: 'Ben iki resmi sırayla söyleyip kapatacağım. Sonra sen yeni iki resimde aynı yolu dene.', educatorInstruction: 'Önce farklı iki kartta “bak–adını söyle–kapat–hatırla” modelini bir kez göster. Ardından YENİ iki kartla çocuğun aynı stratejiyi kullanıp kullanmadığını gözle.', educatorFollowUp: 'Model öncesi/sonrası değişimi kaydet: stratejiyi kullanmadı / taklit etti / yeni kartlarda bağımsız kullandı.', visualSpec: 'Model için örneğin muz+top; test için kuş+fincan gibi tamamen farklı, yüksek kontrastlı gerçekçi kart çiftleri.', responseMode: 'OBSERVE', materials: ['2 model kartı', '2 yeni test kartı'], evidenceFocus: ['öğrenmeye tepki', 'modelden strateji öğrenme', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'Üçlü Sırayı Koru', childInstruction: 'Kedi, top, elma. Aynı sırayla söyle.', educatorInstruction: '39+ ay için üç birimli işitsel sıra sun. Sözcükleri bir kez ve eşit vurgu ile söyle; tekrar gerekiyorsa destek olarak kaydet.', educatorFollowUp: 'İçerik doğru ama sıra farklıysa sıra belleği; bir öğe kayıpsa içerik tutma kanıtı olarak ayrı not et.', visualSpec: 'Çocuk ekranında görsel ipucu yok; eğitimciye hazırlık için kedi, top, elma kartları yalnız uygulama öncesi gösterilebilir.', responseMode: 'SPEAK', expected: ['kedi top elma'], evidenceFocus: ['işitsel sıra', 'yük artışı', 'yakın transfer'] },
  { phase: 'FAR_TRANSFER', title: 'Ne Değişti?', childInstruction: 'Az önce hangisi başka yerdeydi?', educatorInstruction: '42+ ay için üç nesnenin yerini göster, kısa kapatma sonrası yalnız bir nesnenin yerini değiştir. Değişen nesneyi bulmasını iste.', educatorFollowUp: 'Nesneyi doğru tanıyıp eski yerini karıştırma ile değişen nesneyi hiç hatırlayamamayı ayrı not et.', visualSpec: 'Top, küp ve kaşık üç sabit konumda; ikinci sahnede yalnız bir nesnenin konumu değişir, nesnelerin görünümü aynı kalır.', responseMode: 'SELECT', options: ['Top', 'Küp', 'Kaşık'], evidenceFocus: ['görsel güncelleme', 'yer değişikliği', 'uzak transfer', 'çalışma belleği'] },
  { phase: 'CEILING', title: 'İki Kuralı Hatırla ve Uygula', childInstruction: 'Kırmızı görünce alkışla, mavi görünce masaya dokun.', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. İki renk-kural eşlemesini kısa seri içinde uygulat; performans düşüklüğünü alan puanına risk olarak ekleme.', educatorFollowUp: 'Eski kuralı karıştırma, kuralı unutma ve dürtüsel tepkiyi birbirinden ayır; tek denemeyle sonuç çıkarma.', visualSpec: 'Sırayla gösterilen büyük kırmızı ve mavi kartlar; ek sembol veya yazı yok, seri kısa tutulur.', responseMode: 'OBSERVE', evidenceFocus: ['kural belleği', 'çalışma belleği', 'inhibisyon yükü', 'nötr tavan'] },
]);
const executiveAttentionTasks = sectionTasks('executive_attention', [
  { phase: 'WARMUP', title: 'Hedefi Bul', childInstruction: 'Bu resimde kediyi bul.', educatorInstruction: 'Düşük çeldiricili üç seçenekle başla. İlk bakış yönü, seçim ve gecikmeyi kaydet; hız baskısı verme.', educatorFollowUp: 'Yanlış seçerse hemen düzeltme. Bakışla tarama, parmakla işaretleme veya doğrudan hedefe gitme biçimini strateji olarak not et.', visualSpec: 'Kedi, araba ve top üç büyük gerçekçi görsel; eşit boyut, sade arka plan, hedefi renk avantajıyla öne çıkarmayan düzen.', responseMode: 'SELECT', options: ['Kedi', 'Araba', 'Top'], expected: ['Kedi'], evidenceFocus: ['seçici dikkat', 'ilk yönelim', 'yanıt gecikmesi'] },
  { phase: 'CORE', title: 'Bekle ve Başla', childInstruction: 'Ben “şimdi” deyince topa dokun.', educatorInstruction: '1–2 saniyelik kısa bekleme koy. Erken dokunuşu cezalandırma; ilk tepkiyi ve bekleme başarısını gözle.', educatorFollowUp: 'Erken tepki olursa ikinci denemede yalnız yönergeyi tekrar et; tekrar sonrası değişimi destek düzeyiyle kaydet.', visualSpec: 'Tek büyük top veya gerçek top; ek görsel işaret, sayaç ya da geri sayım yok.', responseMode: 'OBSERVE', materials: ['top'], evidenceFocus: ['dürtü kontrolü', 'bekleme', 'sözel sinyale tepki'] },
  { phase: 'DEEPEN', title: 'Aynı Kuralı Sürdür', childInstruction: 'Her yıldızı gördüğünde bana göster.', educatorInstruction: 'Hedef ve çeldirici içeren kısa bir seri sun. Birkaç tur boyunca aynı kuralı koruyup korumadığını gözle.', educatorFollowUp: 'İlk tur doğru olup sonraki turda kural kaybı yaşanırsa bunu sürdürülen dikkat/kural sürdürme olarak ayrıca not et.', visualSpec: 'Yıldız hedef; daire ve kare çeldiriciler. Kısa seri, eşit boyut ve yüksek kontrast; ekran başına tek uyaran.', responseMode: 'OBSERVE', evidenceFocus: ['sürdürülen dikkat', 'kural sürdürme', 'hedef-çeldirici ayrımı'] },
  { phase: 'STRATEGY', title: 'Dur-Kalk Oyunu', childInstruction: 'Müzik varken yürü, durunca sen de dur.', educatorInstruction: 'Doğal oyun formunda iki-üç kısa dur-kalk turu yap. Hareketi durdurma gecikmesini ve kendi kendine kullandığı ipucunu gözle.', educatorFollowUp: 'Çocuk müziği, yetişkin yüzünü veya beden hareketini ipucu olarak kullanıyorsa strateji notuna ekle; tek gecikmeyi başarısızlık sayma.', visualSpec: 'Ekran zorunlu değil; hareket alanı güvenli ve boş. İstenirse sade oynat/dur simgesi yalnız eğitimci kontrolünde.', responseMode: 'OBSERVE', evidenceFocus: ['inhibisyon', 'motor kontrol', 'strateji', 'yanıt gecikmesi'] },
  { phase: 'LEARNING_RESPONSE', title: 'Yeni Kuralı Gör ve Dene', childInstruction: 'Önce ben göstereceğim: kırmızıda dokun, mavide bekle. Şimdi sen dene.', educatorInstruction: 'Önce bağımsız kısa deneme ver; zorlanırsa farklı iki sembolle tek bir model göster. Ardından kırmızı-mavi setine dönerek model sonrası değişimi ölç.', educatorFollowUp: 'Model öncesi/sonrası değişimi kaydet: eski tepki sürdü / kuralı kısmen aldı / yeni örneğe bağımsız aktardı.', visualSpec: 'Test: kırmızı ve mavi büyük kartlar. Model: örneğin güneş ve ay kartları; öğretim ve test uyaranı farklı olmalı.', responseMode: 'OBSERVE', evidenceFocus: ['öğrenmeye tepki', 'kural edinimi', 'inhibisyon', 'destek sonrası değişim'] },
  { phase: 'NEAR_TRANSFER', title: 'Hedef Değişti', childInstruction: 'Şimdi sadece mavi olanlara dokun.', educatorInstruction: '39+ ay için önceki tek-kural yapısını yeni hedef özelliğine taşı. Kuralı bir kez söyle ve bağımsız ilk turu kaydet.', educatorFollowUp: 'Eski hedefe dönme olursa bunu perseverasyon/kural geçişi olarak not et; hemen tekrar tekrar uyarmayıp destek düzeyini koru.', visualSpec: 'Mavi ve kırmızı geometrik kartlar kısa seri halinde; aynı büyüklük ve biçim, yalnız hedef rengi değişir.', responseMode: 'OBSERVE', evidenceFocus: ['yakın transfer', 'kural değiştirme', 'seçici dikkat', 'eski kurala dönme'] },
  { phase: 'FAR_TRANSFER', title: 'Tersini Yap', childInstruction: 'Ben ellerimi açınca sen kapat, ben kapatınca sen aç.', educatorInstruction: '42+ ay için doğal tepkinin tersini gerektiren kısa seri uygula. Önce iki örnek, sonra bağımsız iki-üç tur gözle.', educatorFollowUp: 'Doğrudan taklit ile ters kuralı uygulamayı ayır; öz-düzeltme varsa ayrıca kaydet.', visualSpec: 'Ekran gerektirmez; eğitimci karşılıklı oturur. İstenirse açık/kapalı el silüeti yalnız hazırlık desteği olarak kullanılabilir.', responseMode: 'OBSERVE', evidenceFocus: ['uzak transfer', 'inhibisyon', 'çalışma belleği', 'öz-düzeltme'] },
  { phase: 'CEILING', title: 'İki Kural Arasında Geçiş', childInstruction: 'Yuvarlakta alkışla, karede masaya dokun. Zil çalınca kuralları değiştireceğiz.', educatorInstruction: '45+ ay nötr keşif/tavan görevidir. Çok kısa seri ve tek kural değişimi kullan; başarısızlığı alan puanını düşürmek için kullanma.', educatorFollowUp: 'Kuralı unutma, eski kurala takılma ve dürtüsel tepkiyi ayrı not et; tek denemeyle gelişimsel yorum yapma.', visualSpec: 'Büyük yuvarlak ve kare kartları, tek kısa zil sesi; görünür sayaç, puan veya hata rengi yok.', responseMode: 'OBSERVE', evidenceFocus: ['set değiştirme', 'çalışma belleği', 'inhibisyon', 'nötr tavan'] },
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
