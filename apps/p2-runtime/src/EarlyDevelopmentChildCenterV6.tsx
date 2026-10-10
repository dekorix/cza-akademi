import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import './early-exercises.css';
import './early-exercises-v6.css';

type EarlyRating = 'independent' | 'prompted' | 'verbal_prompt' | 'visual_prompt' | 'modeled' | 'physical_assist' | 'not_observed' | 'not_assessed';
type EarlyResponse = { itemId: string; rating: EarlyRating; metrics?: Record<string, number>; recordedAt: string };
type EarlyState = { responses: EarlyResponse[]; childCompletedAt?: string };
type Tier = 'core' | 'explore' | 'ceiling';
type BehaviorKey = 'engaged' | 'avoidance' | 'frustration' | 'fatigue';

type BaseTask = { id: string; section: string; title: string; minAge: number; tier: Tier };
type ChooseTask = BaseTask & { kind: 'choose'; prompt: string; options: string[]; correct: number; sample?: string };
type MemoryTask = BaseTask & { kind: 'memory'; prompt: string; cue: string; options: string[]; correct: number };
type AudioTask = BaseTask & { kind: 'audio'; prompt: string; spoken: string; options: string[]; correct: number };
type ObserveTask = BaseTask & { kind: 'observe'; instruction: string; material: string; observe: string; metrics?: string[] };
type LanguageTask = BaseTask & { kind: 'language'; prompt: string; visual: string; observe: string; metrics?: string[] };
type Task = ChooseTask | MemoryTask | AudioTask | ObserveTask | LanguageTask;

type Section = { id: string; icon: string; title: string; subtitle: string; minutes: string };

const sections: Section[] = [
  { id: 'S1', icon: '🧩', title: 'Temel Kavram, Eşleme ve Kategorizasyon', subtitle: 'Aynı–farklı, renk, şekil, boyut ve kategori', minutes: '6–8 dk' },
  { id: 'S2', icon: '👂', title: 'Alıcı Dil ve Kavramlar', subtitle: 'Nesne, eylem, konum, nitelik ve yönerge', minutes: '6–8 dk' },
  { id: 'S3', icon: '👀', title: 'Dikkat ve Görsel Bellek', subtitle: 'Hedef bulma, ayırt etme, bak–sakla–hatırla', minutes: '5–7 dk' },
  { id: 'S4', icon: '💬', title: 'Konuşma, Yer–Eylem ve İlişki', subtitle: 'Adlandırma, ortak dikkat, sıra ve olay bağlantısı', minutes: '7–9 dk' },
  { id: 'S5', icon: '🔊', title: 'İşitsel Ayırt Etme ve Yansıma Sesler', subtitle: 'Hayvan/taşıt sesi, ses–nesne eşleme ve taklit', minutes: '5–7 dk' },
  { id: 'S6', icon: '🔗', title: 'Günlük Yaşam Eşleme ve İlişkilendirme', subtitle: 'Nesne–işlev, mekân–nesne ve günlük sıra', minutes: '6–8 dk' },
  { id: 'S7', icon: '🧠', title: 'Bellek ve Çalışma Belleği', subtitle: 'Gecikmeli hatırlama, sıra ve iki adımlı görev', minutes: '6–8 dk' },
  { id: 'S8', icon: '🚦', title: 'Dikkat ve Yürütücü İşlevler', subtitle: 'Git–dur, geçiş, sürdürme, engelleme ve motor kontrol', minutes: '7–9 dk' },
];

const choose = (id: string, section: string, title: string, prompt: string, options: string[], correct: number, minAge = 24, tier: Tier = 'core', sample?: string): ChooseTask => ({ kind: 'choose', id, section, title, prompt, options, correct, minAge, tier, sample });
const memory = (id: string, section: string, title: string, prompt: string, cue: string, options: string[], correct: number, minAge = 24, tier: Tier = 'core'): MemoryTask => ({ kind: 'memory', id, section, title, prompt, cue, options, correct, minAge, tier });
const audio = (id: string, section: string, title: string, prompt: string, spoken: string, options: string[], correct: number, minAge = 24, tier: Tier = 'core'): AudioTask => ({ kind: 'audio', id, section, title, prompt, spoken, options, correct, minAge, tier });
const observe = (id: string, section: string, title: string, instruction: string, material: string, observeText: string, minAge = 24, tier: Tier = 'core', metrics?: string[]): ObserveTask => ({ kind: 'observe', id, section, title, instruction, material, observe: observeText, minAge, tier, metrics });
const language = (id: string, section: string, title: string, prompt: string, visual: string, observeText: string, minAge = 24, tier: Tier = 'core', metrics?: string[]): LanguageTask => ({ kind: 'language', id, section, title, prompt, visual, observe: observeText, minAge, tier, metrics });

const tasks: Task[] = [
  choose('E6S1_FIND_BALL','S1','Tanıdık nesneyi bul','Topu göster.',['⚽','🥄'],0),
  choose('E6S1_MATCH_APPLE','S1','Aynısını bul · elma','Bunun aynısını bul.',['🍎','🚗'],0,24,'core','🍎'),
  choose('E6S1_MATCH_CAR','S1','Aynısını bul · araba','Bunun aynısını bul.',['🐶','🚗'],1,24,'core','🚗'),
  choose('E6S1_COLOR_MATCH','S1','Rengi eşleştir','Aynı renkte olanı seç.',['shape:circle:gold','shape:circle:teal'],0,24,'explore','shape:square:gold'),
  choose('E6S1_SHAPE_MATCH','S1','Şekli eşleştir','Aynı şekli seç.',['shape:circle:teal','shape:square:teal'],0,24,'explore','shape:circle:gold'),
  choose('E6S1_BIG_SMALL','S1','Büyük olanı bul','Büyük olanı göster.',['size:circle:small','size:circle:large'],1,24,'explore'),
  choose('E6S1_SAME_DIFF','S1','Aynı olanı bul','Bunun aynısını seç.',['🐶','🚗'],0,27,'explore','🐶'),
  choose('E6S1_CAT_ANIMAL','S1','Aynı gruptan olanı bul','Bunlarla aynı gruptan olanı seç.',['🐮','🚗'],0,30,'explore','text:🐶  🐱'),
  choose('E6S1_FULL_EMPTY','S1','Dolu olanı bul','Dolu olan bardağı göster.',['cup:empty','cup:full'],1,30,'explore'),
  choose('E6S1_PROF_TOOL','S1','Meslek–araç keşfi','Doktor hangisini kullanır?',['🩺','⚽'],0,33,'ceiling','🧑‍⚕️'),
  choose('E6S2_ACTION_SLEEP','S2','Eylemi anla · uyuyor','Uyuyanı göster.',['😴','🏃'],0),
  choose('E6S2_ACTION_EAT','S2','Eylemi anla · yiyor','Yemek yiyeni göster.',['🍽️','😴'],0),
  observe('E6S2_BODY2','S2','İki beden bölümünü göster','Model göstermeden iki tanıdık beden bölümünü sırayla sorun.','Ek materyal gerekmez','Sözcüğü doğru beden bölümüyle ilişkilendirmesi.'),
  observe('E6S2_ONE_STEP','S2','Tek adımlı yönerge','“Topu bana ver.” gibi tek adımlı doğal bir yönerge verin.','Top + tanıdık nesne','Tek sözel yönergeyi model olmadan uygulaması.'),
  observe('E6S2_GIVE_ME','S2','Nesne adıyla seçim','Önüne iki tanıdık nesne koyup “Kaşığı ver.” deyin.','Kaşık + ikinci tanıdık nesne','Nesne adını seçime dönüştürmesi.'),
  choose('E6S2_INSIDE','S2','İçinde kavramı','Top kutunun içinde olanı göster.',['pos:inside','pos:outside'],0,27,'explore'),
  choose('E6S2_ON','S2','Üstünde kavramı','Top kutunun üstünde olanı göster.',['pos:on','pos:inside'],0,27,'explore'),
  choose('E6S2_COLOR_WORD','S2','Renk sözcüğünü anla','Kırmızı olanı göster.',['shape:circle:red','shape:circle:blue'],0,30),
  observe('E6S2_TWO_STEP','S2','İki bağlantılı yönerge','Tek seferde iki bağlantılı adım verin: “Topu al ve kutuya koy.”','Top + kutu','İki bilgiyi kısa süre tutup doğru sırayla uygulaması.',30),
  choose('E6S2_LONG_SHORT','S2','Uzun–kısa keşfi','Uzun olanı göster.',['line:short','line:long'],1,33,'ceiling'),
  choose('E6S3_TARGET2','S3','İki seçenekten hedefi bul','Kediyi bul.',['🐱','🚗'],0),
  memory('E6S3_MEMORY1','S3','Bak–sakla–hatırla · tek görsel','Biraz önce hangisini gördün?','🍎',['🍎','⚽'],0),
  observe('E6S3_HIDDEN_LOCATION','S3','Saklanan yeri hatırla','Oyuncağı iki kaptan birine saklayın; kısa bir başka eylemden sonra bulmasını isteyin.','İki kap + küçük oyuncak','Kısa gecikme sonrası konumu hatırlaması.'),
  choose('E6S3_SAME_TARGET','S3','Benzerler arasından hedef','Arabayı bul.',['🚗','🚌'],0),
  choose('E6S3_TARGET3','S3','Üç seçenekten hedefi bul','Topu bul.',['🥄','⚽','🚗'],1,27,'explore'),
  memory('E6S3_MEMORY2','S3','İki görseli hatırla','Aynı ikiliyi seç.','text:🍎  🚗',['text:🍎  🚗','text:🚗  ⚽'],0,27,'explore'),
  choose('E6S3_ODD','S3','Farklı olanı bul','Farklı olanı göster.',['🚗','🚗','🐶'],2,30,'explore'),
  choose('E6S3_SEARCH4','S3','Çeldiriciler arasından bul','Kediyi bul.',['🚗','🐱','🚗','🚗'],1,30,'explore'),
  memory('E6S3_MEMORY3','S3','Üçlü görsel tavanı','Aynı sırayı bul.','text:🍎  🚗  🐶',['text:🍎  🚗  🐶','text:🐶  🚗  🍎'],0,33,'ceiling'),
  language('E6S4_OBJECT_NAME','S4','Nesneyi adlandır','Bu ne?','⚽','Kendiliğinden nesne adı, yaklaşık üretim ve anlaşılabilirlik.',24,'core',['Sözcük sayısı']),
  observe('E6S4_REQUEST','S4','Kendiliğinden isteme','Tercih edilen nesneyi görünür fakat erişimi sınırlı sunup kısa süre bekleyin.','Tercih edilen oyuncak','Bakış, işaret, ses veya sözcükle iletişimi kendisinin başlatması.'),
  observe('E6S4_GESTURE','S4','Jestlerle iletişim','El sallama, başla evet/hayır veya gösterme için doğal fırsat oluşturun.','Doğal etkileşim','Birden fazla iletişim jestini işlevsel kullanması.'),
  observe('E6S4_JOINT','S4','Ortak dikkati paylaşma','İlgi çekici bir nesnede çocuğun nesne ile yetişkin arasında dikkati paylaşmasını bekleyin.','İlgi çekici oyuncak','Nesne–yetişkin arasında bakış/dikkat geçişi.'),
  choose('E6S4_PLACE_BED','S4','Yer–eylem ilişkisi · yatak','Yatakta ne yapılır?',['😴','🏃'],0,24,'core','🛏️'),
  choose('E6S4_PLACE_KITCHEN','S4','Yer–nesne ilişkisi · mutfak','Mutfakta hangisi olur?',['🍲','🧸'],0,27,'explore','🏠'),
  language('E6S4_ACTION_NAME','S4','Eylemi adlandır','Ne yapıyor?','🍽️','Eylem sözcüğü, sözcük birleşimi ve cümleye yaklaşım.',30,'core',['Sözcük sayısı','İki+ sözcüklü ifade']),
  observe('E6S4_DIALOG','S4','Kısa karşılıklı konuşma','Çocuğun ilgilendiği konuda iki kısa karşılıklı konuşma turu için fırsat verin.','Doğal oyun','Yanıt verme, konuya dönme ve karşılıklı iletişimi sürdürme.',30,'core',['Karşılıklı tur']),
  memory('E6S4_BEFORE_AFTER','S4','Önce–sonra','Doğru sırayı seç.','text:🧼  👐',['text:🧼  👐','text:👐  🧼'],0,30,'explore'),
  choose('E6S4_CAUSE_RAIN','S4','Basit neden keşfi','Şemsiye neden açık?',['🌧️','☀️'],0,33,'ceiling','☂️'),
  audio('E6S5_CAT_SOUND','S5','Sesi kartla eşleştir · kedi','Sesi dinle, doğru resmi seç.','Miyav',['🐱','🚗'],0),
  audio('E6S5_DOG_SOUND','S5','Sesi kartla eşleştir · köpek','Sesi dinle, doğru resmi seç.','Hav hav',['🐶','🐱'],0),
  audio('E6S5_CAR_SOUND','S5','Sesi kartla eşleştir · araba','Sesi dinle, doğru resmi seç.','Düt düt',['🚗','🐶'],0),
  audio('E6S5_BIRD_SOUND','S5','Sesi kartla eşleştir · kuş','Sesi dinle, doğru resmi seç.','Cik cik',['🐦','⚽'],0),
  observe('E6S5_ANIMAL_IMITATE','S5','Hayvan sesini taklit','Tanıdık hayvanı gösterip sesini doğal biçimde modelleyin ve çocuğa fırsat verin.','Hayvan resmi/oyuncağı','Ses taklidi isteği, sesletim ve sembol–ses bağı.'),
  audio('E6S5_SOUND_DISCRIM','S5','İki sesi ayırt et','Sesi dinle, hangisi olduğunu göster.','Miyav',['🐱','🐶'],0,27,'explore'),
  observe('E6S5_VEHICLE_IMITATE','S5','Taşıt sesini taklit','Araba veya tren oyuncağıyla kısa yansıma ses modeli verin.','Taşıt oyuncağı','Ses taklidi ve oyuna taşıma.',27,'explore'),
  audio('E6S5_AUDIO_SEQ','S5','İki seslik sıra','İki sesi dinle, doğru sırayı seç.','Miyav, sonra düt düt',['text:🐱  🚗','text:🚗  🐱'],0,30,'explore'),
  observe('E6S5_SPEECH_SAMPLE','S5','Kısa sesletim örneklemi','Doğal oyunda 5–8 tanıdık sözcük/ifade örneği toplayın.','Doğal oyun','Anlaşılabilirlik, ses çeşitliliği ve iletişim işlevi.',30,'core',['Anlaşılır üretim','Yaklaşık üretim']),
  choose('E6S6_SPOON_FOOD','S6','Nesne–işlev · kaşık','Kaşık hangisiyle kullanılır?',['🍲','⚽'],0,24,'core','🥄'),
  choose('E6S6_SHOE_FOOT','S6','Nesne–beden ilişkisi','Ayakkabı nereye giyilir?',['🦶','✋'],0,24,'core','👟'),
  choose('E6S6_BED_SLEEP','S6','Nesne–eylem ilişkisi','Yatakla hangisi birlikte olur?',['😴','🍽️'],0,24,'core','🛏️'),
  choose('E6S6_CUP_DRINK','S6','Nesne–işlev · bardak','Bardakla ne yapılır?',['🥤','⚽'],0,24,'core','🥛'),
  observe('E6S6_CAUSE_BUTTON','S6','Neden–sonuç oyuncağı','Bir kez basınca çalışan güvenli bir oyuncağı gösterin; sonra çocuğa verin.','Basit neden–sonuç oyuncağı','Eylem–sonuç ilişkisini keşfedip yeniden oluşturması.'),
  choose('E6S6_TOOTHBRUSH_TEETH','S6','Nesne–işlev · diş fırçası','Diş fırçası neyle birlikte olur?',['🦷','🦶'],0,27,'explore','🪥'),
  choose('E6S6_KITCHEN_OBJECT','S6','Mekân–nesne · mutfak','Mutfakta hangisi olur?',['🍳','🛏️'],0,30,'explore','🏠'),
  memory('E6S6_DAILY_SEQUENCE','S6','Günlük yaşam sırası','Doğru sırayı seç.','text:🧼  👐',['text:🧼  👐','text:👐  🧼'],0,30,'explore'),
  observe('E6S6_TRANSFER','S6','Öğrendiği kuralı yeni örneğe taşı','Bir renk eşleme kuralını bir kez modelleyip farklı renkte yeni örneği kendisinin yapmasını bekleyin.','İki renk kart + eş parçalar','Modelden öğrenme ve kuralı yeni materyale transfer etme.',30),
  choose('E6S6_DOCTOR_TOOL','S6','Meslek–araç tavanı','Doktor hangisini kullanır?',['🩺','🚜'],0,33,'ceiling','🧑‍⚕️'),
  observe('E6S7_DELAYED_IMITATE','S7','Gecikmeli taklit','Basit bir nesne kullanımını bir kez modelleyin; kısa başka etkinlikten sonra yeniden denemesini isteyin.','Basit oyuncak','Kısa gecikme sonrası modeli hatırlayıp yeniden kullanması.'),
  observe('E6S7_HIDE_CUP','S7','İki kapta yer belleği','Oyuncağı iki kaptan birine saklayın, kısa dikkat değişiminden sonra bulmasını isteyin.','İki kap + oyuncak','Konum bilgisini kısa süre koruması.'),
  memory('E6S7_VISUAL_ONE','S7','Tek görseli hatırla','Biraz önce hangisini gördün?','🚗',['🚗','🐶'],0),
  observe('E6S7_NEW_ACTION','S7','Yeni eylemi kısa süre sonra yap','Yeni bir hareketi modelleyip kısa ara sonrası tekrar isteyin.','Ek materyal gerekmez','Modelin kısa süreli bellekte tutulması ve yeniden üretimi.'),
  memory('E6S7_VISUAL_TWO','S7','İki görseli hatırla','Aynı ikiliyi seç.','text:🍎  ⚽',['text:🍎  ⚽','text:⚽  🚗'],0,27,'explore'),
  observe('E6S7_TWO_STEP','S7','Çalışma belleği · iki adım','“Topu al, kutuya koy.” gibi iki bağlantılı yönergeyi tek sefer söyleyin.','Top + kutu','İki bilgiyi aynı anda tutup sırayla uygulaması.',30),
  observe('E6S7_RED_BLUE','S7','İki bilgiyi sırayla uygula','“Önce kırmızıyı ver, sonra maviyi getir.” gibi iki nesneli yönerge verin.','Kırmızı + mavi nesne','Renk bilgisi ile sırayı birlikte koruması.',30,'explore'),
  memory('E6S7_STORY2','S7','İki olaylık sıra belleği','Aynı sırayı bul.','text:🍽️  😴',['text:🍽️  😴','text:😴  🍽️'],0,30,'explore'),
  memory('E6S7_STORY3','S7','Üç olaylık tavan belleği','Aynı sırayı bul.','text:🧼  🍽️  😴',['text:🧼  🍽️  😴','text:😴  🍽️  🧼'],0,33,'ceiling'),
  choose('E6S8_TARGET_SEARCH','S8','Hedefi bul','Topu bul.',['⚽','🥄'],0),
  observe('E6S8_TRANSITION','S8','Etkinlik geçişi','Sevdiği etkinlikten ikinci tanıdık etkinliğe kısa ve sakin hazırlıkla geçin.','İki tanıdık etkinlik','Geçişe uyum, yeniden düzenlenme ve destek ihtiyacı.'),
  observe('E6S8_SUSTAIN','S8','Ortak oyunu sürdür','Tercih edilen ortak oyunu 1–2 dakika doğal biçimde sürdürün.','Tercih edilen oyuncak','Dikkati sürdürme ve dağıldığında etkinliğe geri dönme.'),
  observe('E6S8_GO_STOP','S8','Git–dur oyunu','Güvenli alanda “git” ile hareket, “dur” ile kısa durma oyunu oynayın.','Boş güvenli alan','Sözel işarete yönelme ve hareketi kısa süre engelleme.'),
  observe('E6S8_FINE_BLOCK','S8','Blok ve ince motor kontrol','4–6 büyük blokla serbest küçük yapı fırsatı verin.','Büyük bloklar','El–göz koordinasyonu, iki el kullanımı ve motor planlama.'),
  observe('E6S8_GROSS_BALL','S8','Topla kaba motor oyun','Yumuşak topu yuvarlama, atma veya tekmeleme fırsatı verin.','Yumuşak top','Amaçlı kaba motor hareket ve karşılıklı oyuna katılım.'),
  observe('E6S8_RECOVERY','S8','Zorlanma sonrası toparlanma','Doğal bir küçük zorlanma olduğunda yetişkin desteğiyle nasıl yeniden düzenlendiğini gözleyin.','Doğal oyun','Frustrasyon sonrası sakinleşme ve yardımı kabul etme.'),
  choose('E6S8_DISTRACTOR','S8','Çeldirici arasından hedef','Kediyi bul.',['🚗','🐱','🚗'],1,27,'explore'),
  observe('E6S8_FREEZE','S8','Don–kal oyunu','Kısa hareketli oyunda “don” işaretiyle bedeni kısa süre durdurma fırsatı verin.','Müziksiz kısa hareket oyunu','Engelleme kontrolü ve yönergeye dönme.',27,'explore'),
  observe('E6S8_SIMON2','S8','İki hareketli yönerge','Birbiriyle bağlantılı iki kısa hareket söyleyin: “Alkışla, sonra başına dokun.”','Ek materyal gerekmez','İki hareketi akılda tutma ve sırayla uygulama.',30,'explore'),
  choose('E6S8_RULE_SWITCH','S8','Kural değiştirme tavanı','Şimdi arabayı seç.',['🐶','🚗'],1,33,'ceiling','text:Önce 🐶 → şimdi 🚗'),
];

function Visual({ code }: { code: string }) {
  const colorMap: Record<string, string> = { teal: '#3f8e89', gold: '#e2b84c', red: '#dc5c54', blue: '#4c7fc7' };
  if (code.startsWith('shape:')) { const [, shape, color] = code.split(':'); return <span className={'ex-shape ' + shape} style={{ background: colorMap[color] || color }} />; }
  if (code.startsWith('size:')) { const [, shape, size] = code.split(':'); return <span className={'ex-shape neutral ' + shape + ' ' + size} />; }
  if (code.startsWith('group:')) { const [, icon, count] = code.split(':'); return <span className='ex-group'>{Array.from({ length: Number(count) }, (_, index) => <i key={index}>{icon}</i>)}</span>; }
  if (code.startsWith('pos:')) { const position = code.split(':')[1]; return <span className={'v6-position ' + position}><i>●</i><b /></span>; }
  if (code.startsWith('cup:')) return <span className={'v6-cup ' + code.split(':')[1]}><i /></span>;
  if (code.startsWith('line:')) return <span className={'v6-line ' + code.split(':')[1]} />;
  if (code.startsWith('text:')) return <span className='ex-emoji v6-text-visual'>{code.slice(5)}</span>;
  return <span className='ex-emoji'>{code}</span>;
}

const supportOptions: Array<{ value: EarlyRating; label: string }> = [
  { value: 'verbal_prompt', label: 'Sözel ipucu' },
  { value: 'visual_prompt', label: 'Jest / görsel ipucu' },
  { value: 'modeled', label: 'Model' },
  { value: 'physical_assist', label: 'Fiziksel yardım' },
];

const behaviorLabels: Array<{ key: BehaviorKey; label: string }> = [
  { key: 'engaged', label: 'İlgili / katıldı' },
  { key: 'avoidance', label: 'Kaçındı' },
  { key: 'frustration', label: 'Zorlandı / frustrasyon' },
  { key: 'fatigue', label: 'Yorulma belirtisi' },
];

export default function EarlyDevelopmentChildCenterV6({ sessionId, ageMonths, initialState, onBack, onUpdated }: { sessionId: string; ageMonths?: number; initialState?: EarlyState; onBack: () => void; onUpdated: (session: unknown) => void }) {
  const age = ageMonths ?? 24;
  const eligibleTasks = useMemo(() => tasks.filter((task) => age >= task.minAge), [age]);
  const [responses, setResponses] = useState(initialState?.responses ?? []);
  const done = useMemo(() => new Set(responses.map((response) => response.itemId)), [responses]);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [practiceDone, setPracticeDone] = useState((initialState?.responses.length ?? 0) > 0);
  const [practiceHint, setPracticeHint] = useState(false);
  const [support, setSupport] = useState<EarlyRating | ''>('');
  const [firstMiss, setFirstMiss] = useState(false);
  const [firstSelection, setFirstSelection] = useState(-1);
  const [firstLatency, setFirstLatency] = useState(0);
  const [pendingRating, setPendingRating] = useState<EarlyRating | ''>('');
  const [pendingMetrics, setPendingMetrics] = useState<Record<string, number>>({});
  const [rating, setRating] = useState<EarlyRating | ''>('');
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [behavior, setBehavior] = useState<Set<BehaviorKey>>(new Set());
  const [memoryHidden, setMemoryHidden] = useState(false);
  const [passedBreaks, setPassedBreaks] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shownAt = useRef(Date.now());

  const sectionTasks = useMemo(() => activeSection ? eligibleTasks.filter((task) => task.section === activeSection) : [], [activeSection, eligibleTasks]);
  const task = sectionTasks[taskIndex];
  const completedTotal = eligibleTasks.filter((entry) => done.has(entry.id)).length;
  const overallPct = Math.round((completedTotal / Math.max(1, eligibleTasks.length)) * 100);
  const routeLabel = age < 27 ? '24–26 ay' : age < 30 ? '27–29 ay' : age < 33 ? '30–32 ay' : '33–35 ay';

  useEffect(() => {
    shownAt.current = Date.now(); setSupport(''); setFirstMiss(false); setFirstSelection(-1); setFirstLatency(0); setPendingRating(''); setPendingMetrics({}); setRating(''); setMetrics({}); setNote(''); setBehavior(new Set()); setMemoryHidden(false);
  }, [activeSection, taskIndex]);

  function behaviorMetrics() { return { engaged: behavior.has('engaged') ? 1 : 0, avoidance: behavior.has('avoidance') ? 1 : 0, frustration: behavior.has('frustration') ? 1 : 0, fatigue: behavior.has('fatigue') ? 1 : 0 }; }
  function toggleBehavior(key: BehaviorKey) { setBehavior((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; }); }
  function openSection(sectionId: string) { const list = eligibleTasks.filter((entry) => entry.section === sectionId); const firstIncomplete = list.findIndex((entry) => !done.has(entry.id)); setActiveSection(sectionId); setTaskIndex(firstIncomplete < 0 ? 0 : firstIncomplete); }

  async function save(itemRating: EarlyRating, extraMetrics: Record<string, number> = {}) {
    if (busy || !task) return;
    setBusy(true); setError('');
    try {
      const result = await api.post('/api/session/' + sessionId + '/early-development-response', { itemId: task.id, rating: itemRating, note: note.trim().slice(0, 300), metrics: { ...metrics, ...behaviorMetrics(), exploreProbe: task.tier === 'explore' ? 1 : 0, ceilingProbe: task.tier === 'ceiling' ? 1 : 0, ...extraMetrics } });
      const session = result.data as { earlyDevelopment?: EarlyState };
      const nextResponses = session.earlyDevelopment?.responses ?? responses;
      setResponses(nextResponses); onUpdated(result.data);
      if (session.earlyDevelopment?.childCompletedAt) { onBack(); return; }
      const nextDone = new Set(nextResponses.map((response) => response.itemId));
      const nextIndex = sectionTasks.findIndex((entry, index) => index > taskIndex && !nextDone.has(entry.id));
      if (nextIndex >= 0) setTaskIndex(nextIndex); else setActiveSection(null);
    } catch { setError('Görev kaydedilemedi. Önceki kayıtlar korunur; yeniden deneyin.'); } finally { setBusy(false); }
  }

  function chooseOption(optionIndex: number) {
    if (busy || !task || pendingRating || (task.kind !== 'choose' && task.kind !== 'audio' && task.kind !== 'memory')) return;
    const latencyMs = Math.max(0, Date.now() - shownAt.current);
    if (!firstMiss) {
      if (optionIndex === task.correct) { setPendingRating('independent'); setPendingMetrics({ firstCorrect: 1, firstSelection: optionIndex, latencyMs }); }
      else { setFirstMiss(true); setFirstSelection(optionIndex); setFirstLatency(latencyMs); }
      return;
    }
    if (support && optionIndex === task.correct) { setPendingRating(support); setPendingMetrics({ firstCorrect: 0, firstSelection, latencyMs: firstLatency }); }
  }

  function speak(text: string) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'tr-TR'; utterance.rate = 0.82; window.speechSynthesis.speak(utterance);
  }

  if (!activeSection) return <div className='early-shell v6-shell'><main className='early-main'><section className='v6-center'><button type='button' className='early-back' onClick={onBack}>← E2 ana ekranına dön</button><header className='v6-hero'><span>CZA · E2-v6 BÜTÜNCÜL DEĞERLENDİRME MERKEZİ</span><h1>8 bölüm · tek uzun test değil</h1><p>Her bölüm ayrı uygulanabilir. Çocuk yorulursa burada bırakıp başka gün aynı bölümden devam edebilirsiniz. Ekran görevleri gerçek oyun, dil ve motor gözlemlerinin yerini almaz; onları tamamlar.</p><div><b>{routeLabel}</b><b>{eligibleTasks.length} yaşa uygun görev</b><b>{completedTotal}/{eligibleTasks.length} kaydedildi</b><b>%{overallPct} genel ilerleme</b></div></header><div className='v6-section-grid'>{sections.map((section, index) => { const list = eligibleTasks.filter((entry) => entry.section === section.id); const completed = list.filter((entry) => done.has(entry.id)).length; const ceilings = list.filter((entry) => entry.tier === 'ceiling').length; const finished = list.length > 0 && completed === list.length; return <article className={'v6-section-card ' + (finished ? 'done' : completed > 0 ? 'progress' : '')} key={section.id}><div className='v6-section-number'><span>{section.icon}</span><b>{index + 1}</b></div><h2>{section.title}</h2><p>{section.subtitle}</p><div className='v6-section-meta'><span>{list.length} görev</span><span>{section.minutes}</span>{ceilings > 0 && <span>{ceilings} nötr keşif</span>}</div><div className='v6-section-progress'><i><b style={{ width: Math.round((completed / Math.max(1, list.length)) * 100) + '%' }} /></i><small>{completed}/{list.length}</small></div><button type='button' onClick={() => openSection(section.id)}>{finished ? 'Bölümü aç' : completed > 0 ? 'Devam et →' : 'Bölümü başlat →'}</button></article>; })}</div><div className='early-rule'><strong>Uygulama kuralı:</strong> Her bölümde basitten zora ilerlenir. “Keşif/tavan” görevini yapamamak olumsuz gelişim sonucu değildir. Çocuğa puan, süre baskısı veya doğru–yanlış geri bildirimi verilmez.</div></section></main></div>;

  if (!practiceDone) return <div className='early-shell v6-shell'><main className='early-main'><section className='early-task-card v6-practice'><button type='button' className='early-back v6-operator' onClick={() => setActiveSection(null)}>← Bölümlere dön</button><small>PUANSIZ DENEME</small><h1>Önce dokunma oyununu anlayalım</h1><p>“Elmayı göster.” deyin. Bu deneme rapora girmez.</p><div className='ex-options v6-practice-options'><button type='button' onClick={() => setPracticeDone(true)}><Visual code='🍎' /></button><button type='button' onClick={() => setPracticeHint(true)}><Visual code='🚗' /></button></div>{practiceHint && <div className='ex-quiet-note v6-operator'>“Elmaya dokunalım.” deyip yalnız bir kez birlikte gösterin. “Yanlış” veya “olmadı” demeyin.</div>}<button type='button' className='early-skip v6-operator' onClick={() => setPracticeDone(true)}>Deneme oyununu geç</button></section></main></div>;
  if (!task) return <div className='early-shell v6-shell'><main className='early-main'><section className='early-task-card'><button type='button' className='early-primary' onClick={() => setActiveSection(null)}>Bölümlere dön</button></section></main></div>;

  const breakKey = taskIndex > 0 && taskIndex % 4 === 0 ? activeSection + '-' + taskIndex : '';
  if (breakKey && !passedBreaks.has(breakKey)) return <div className='early-shell v6-shell'><main className='early-main'><section className='early-task-card v6-break-card'><span>MİNİ MOLA</span><h1>Biraz hareket, sonra devam</h1><p>20–30 saniye ayağa kalkın, topu yuvarlayın veya kısa bir hareket oyunu yapın. Çocuk hazır olduğunda devam edin.</p><button type='button' className='early-primary' onClick={() => setPassedBreaks((current) => new Set([...current, breakKey]))}>Hazır olduğunda devam et →</button><button type='button' className='early-skip' onClick={() => setActiveSection(null)}>Burada dur · başka gün devam et</button></section></main></div>;

  const selectable = task.kind === 'choose' || task.kind === 'audio' || task.kind === 'memory';
  const options = selectable ? task.options : [];
  const section = sections.find((entry) => entry.id === activeSection)!;
  const sectionCompleted = sectionTasks.filter((entry) => done.has(entry.id)).length;

  return <div className='early-shell v6-shell'><div className='early-progress-top v6-top'><div><strong>{section.icon} {section.title}</strong><span>{sectionCompleted}/{sectionTasks.length} bölüm ilerlemesi</span></div><i><b style={{ width: Math.round((sectionCompleted / Math.max(1, sectionTasks.length)) * 100) + '%' }} /></i></div><main className='early-main'><section className={'early-task-card v6-task-card ' + (selectable ? 'v6-child-task' : '')}><button type='button' className='early-back v6-operator' onClick={() => setActiveSection(null)}>← Bölümlere dön</button><div className='v6-task-heading'><small>{task.tier === 'ceiling' ? 'NÖTR TAVAN / KEŞİF' : task.kind === 'observe' || task.kind === 'language' ? 'GERÇEK OYUN / DİL GÖREVİ' : 'ÇOCUK PANELİ EGZERSİZİ'}</small><h1>{task.title}</h1>{task.tier === 'ceiling' && <p>Bu görev üst sınırı keşfeder; ortaya çıkmaması olumsuz sonuç değildir.</p>}</div>{task.kind === 'choose' && <>{task.sample && <div className='ex-sample'><small>BAK</small><Visual code={task.sample} /></div>}<p className='v6-child-prompt'>{task.prompt}</p></>}{task.kind === 'audio' && <><p className='v6-child-prompt'>{task.prompt}</p><button type='button' className='v6-audio-button' onClick={() => speak(task.spoken)}>🔊 Sesi dinle</button><small className='v6-operator v6-audio-fallback'>Ses düğmesi çalışmazsa uygulayıcı aynı yansıma sesi doğal biçimde söyleyebilir.</small></>}{task.kind === 'memory' && <><p className='v6-child-prompt'>{task.prompt}</p><div className='v6-memory-cue'>{memoryHidden ? <span>🙈</span> : <Visual code={task.cue} />}</div>{!memoryHidden && <button type='button' className='early-primary v6-operator' onClick={() => { setMemoryHidden(true); shownAt.current = Date.now(); }}>Şimdi sakla · seçenekleri aç</button>}</>}{task.kind === 'language' && <><div className='v6-language-visual'><Visual code={task.visual} /></div><p className='v6-child-prompt'>{task.prompt}</p><div className='early-instruction v6-operator'><small>NEYE BAKIYORUZ?</small><p>{task.observe}</p></div></>}{task.kind === 'observe' && <><div className='early-instruction'><small>UYGULAMA</small><p>{task.instruction}</p></div><div className='early-two'><div><small>MATERYAL</small><strong>{task.material}</strong></div><div><small>NEYE BAKIYORUZ?</small><strong>{task.observe}</strong></div></div></>}{selectable && (task.kind !== 'memory' || memoryHidden) && <div className='ex-options v6-options'>{options.map((option, optionIndex) => <button type='button' key={optionIndex} disabled={busy || Boolean(pendingRating)} onClick={() => chooseOption(optionIndex)}><Visual code={option} /></button>)}</div>}{(task.kind === 'observe' || task.kind === 'language') && task.metrics && <div className='early-metrics v6-operator'><h2>Kısa kayıtlar</h2>{task.metrics.map((key) => <label key={key}><span>{key}</span><input type='number' min='0' value={metrics[key] ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}</div>}<div className='v6-behavior v6-operator'><strong>İsteğe bağlı davranış kaydı</strong><div>{behaviorLabels.map((item) => <button type='button' key={item.key} className={behavior.has(item.key) ? 'active' : ''} onClick={() => toggleBehavior(item.key)}>{item.label}</button>)}</div></div>{firstMiss && !pendingRating && selectable && <div className='ex-support-panel v6-operator'><strong>İlk seçim kaydedildi. Çocuğa “yanlış” demeyin.</strong><p>Yardımı azdan çoğa artırın; sonra çocuğun yeniden seçmesine izin verin.</p><div>{supportOptions.map((item) => <button type='button' className={support === item.value ? 'active' : ''} key={item.value} onClick={() => setSupport(item.value)}>{item.label}</button>)}</div><div className='ex-support-end'><button type='button' onClick={() => void save('not_observed', { firstCorrect: 0, firstSelection, latencyMs: firstLatency })}>{task.tier === 'ceiling' ? 'Keşif görevini kapat' : 'Henüz gözlenmedi'}</button><button type='button' onClick={() => void save('not_assessed')}>Görevi geç</button></div></div>}{pendingRating && <div className='v6-confirm v6-operator'><strong>İlk seçim kanıtı hazır.</strong><span>Davranış kaydını istersen ekle, sonra görevi kaydet.</span><button type='button' className='early-primary' disabled={busy} onClick={() => void save(pendingRating, pendingMetrics)}>{busy ? 'Kaydediliyor…' : 'Kaydet ve devam et →'}</button></div>}{(task.kind === 'observe' || task.kind === 'language') && <><div className='early-rating v6-operator'><h2>Beceri hangi destek düzeyinde ortaya çıktı?</h2>{[{ value: 'independent', label: 'Bağımsız' }, ...supportOptions, { value: 'not_observed', label: task.tier === 'ceiling' ? 'Bu keşifte ortaya çıkmadı' : 'Henüz gözlenmedi' }].map((item) => <button type='button' className={rating === item.value ? 'active' : ''} key={item.value} onClick={() => setRating(item.value as EarlyRating)}><strong>{item.label}</strong></button>)}</div><label className='early-note v6-operator'><span>Kısa not <small>(isteğe bağlı)</small></span><textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder='Örn. Modelden sonra yaptı; ikinci denemede yardım azaldı.' /></label><div className='early-actions v6-operator'><button type='button' className='early-skip' disabled={busy} onClick={() => void save('not_assessed')}>Görevi geç · değerlendirilemedi</button><button type='button' className='early-primary' disabled={!rating || busy} onClick={() => rating && void save(rating)}>{busy ? 'Kaydediliyor…' : 'Kaydet ve devam et →'}</button></div></>}{selectable && !firstMiss && !pendingRating && <div className='ex-quiet-note v6-operator'>Yönergeyi bir kez kısa söyleyin. Çocuğu hızlandırmayın. İlk dokunuş tepki süresiyle birlikte kanıt olarak tutulur.</div>}{error && <div className='early-error'>{error}</div>}<footer className='v6-operator'>E2-v6 · Bölüm {sections.findIndex((entry) => entry.id === activeSection) + 1}/8 · Tek oturum zorunlu değildir.</footer></section></main></div>;
}

