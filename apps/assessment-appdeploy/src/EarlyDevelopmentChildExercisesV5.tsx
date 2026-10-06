import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import './early-exercises.css';
import './early-exercises-v5.css';

type EarlyRating = 'independent' | 'verbal_prompt' | 'visual_prompt' | 'modeled' | 'physical_assist' | 'not_observed' | 'not_assessed';
type EarlyResponse = { itemId: string; rating: EarlyRating; metrics?: Record<string, number>; recordedAt: string };
type EarlyState = { responses: EarlyResponse[]; childCompletedAt?: string };
type Tier = 'core' | 'explore' | 'ceiling';
type DigitalTask = { kind: 'digital'; id: string; title: string; prompt: string; sample?: string; options: string[]; correct: number; minAge: number; phase: 1 | 2 | 3 | 4; tier: Tier };
type ObserveTask = { kind: 'observe'; id: string; title: string; instruction: string; material: string; observe: string; metrics?: string[]; minAge: number; tier: Tier };
type Task = DigitalTask | ObserveTask;

const digitalTasks: DigitalTask[] = [
  { kind: 'digital', id: 'DX_OBJECT', title: 'Topu bul', prompt: 'Topu göster.', options: ['⚽', '🥄'], correct: 0, minAge: 24, phase: 1, tier: 'core' },
  { kind: 'digital', id: 'DX_MATCH_OBJ', title: 'Aynısını bul', prompt: 'Bunun aynısını bul.', sample: '🍎', options: ['🍎', '🚗'], correct: 0, minAge: 24, phase: 1, tier: 'core' },
  { kind: 'digital', id: 'DX_MATCH_SHAPE', title: 'Aynı şekli bul', prompt: 'Aynı şekli seç.', sample: 'shape:circle:teal', options: ['shape:circle:teal', 'shape:square:teal'], correct: 0, minAge: 24, phase: 1, tier: 'explore' },
  { kind: 'digital', id: 'DX_MATCH_COLOR', title: 'Aynı rengi bul', prompt: 'Aynı renkte olanı seç.', sample: 'shape:circle:gold', options: ['shape:circle:gold', 'shape:circle:teal'], correct: 0, minAge: 24, phase: 1, tier: 'explore' },

  { kind: 'digital', id: 'DX_BIG', title: 'Büyük olanı bul', prompt: 'Büyük olanı seç.', options: ['size:circle:small', 'size:circle:large'], correct: 1, minAge: 24, phase: 2, tier: 'explore' },
  { kind: 'digital', id: 'DX_ONE', title: 'Bir tane', prompt: 'Bir tane olanı göster.', options: ['group:⭐:1', 'group:⭐:3'], correct: 0, minAge: 24, phase: 2, tier: 'explore' },
  { kind: 'digital', id: 'DX_MANY', title: 'Çok olan', prompt: 'Çok olanı göster.', options: ['group:⚽:1', 'group:⚽:4'], correct: 1, minAge: 24, phase: 2, tier: 'explore' },
  { kind: 'digital', id: 'DX_FIT', title: 'Hangisi sığar?', prompt: 'Kutunun içine sığacak parçayı seç.', sample: 'box:small', options: ['size:square:small', 'size:square:large'], correct: 0, minAge: 24, phase: 2, tier: 'core' },
  { kind: 'digital', id: 'DX_ACTION', title: 'Uyuyanı bul', prompt: 'Uyuyanı göster.', options: ['😴', '🏃'], correct: 0, minAge: 27, phase: 2, tier: 'core' },
  { kind: 'digital', id: 'DX_INSIDE', title: 'İçinde olanı bul', prompt: 'Top kutunun içinde olanı göster.', options: ['scene:inside', 'scene:outside'], correct: 0, minAge: 27, phase: 2, tier: 'explore' },

  { kind: 'digital', id: 'DX_COLOR_WORD', title: 'Kırmızıyı bul', prompt: 'Kırmızı olanı göster.', options: ['shape:circle:red', 'shape:circle:blue'], correct: 0, minAge: 30, phase: 3, tier: 'core' },
  { kind: 'digital', id: 'DX_ODD', title: 'Farklı olanı bul', prompt: 'Farklı olanı göster.', options: ['🚗', '🚗', '🐶'], correct: 2, minAge: 30, phase: 3, tier: 'explore' },
  { kind: 'digital', id: 'DX_CATEGORY', title: 'Aynı aileden olanı bul', prompt: 'Bunlarla birlikte olanı seç.', sample: 'text:🚗   🚌', options: ['🚚', '🐶'], correct: 0, minAge: 30, phase: 3, tier: 'ceiling' },

  { kind: 'digital', id: 'DX_PAIR', title: 'Aynı sırayı bul', prompt: 'Aynı sırayı seç.', sample: 'pair:gold:teal', options: ['pair:gold:teal', 'pair:teal:gold'], correct: 0, minAge: 33, phase: 4, tier: 'ceiling' },
  { kind: 'digital', id: 'DX_PATTERN', title: 'Sırada ne var?', prompt: 'Sırayı tamamla.', sample: 'pattern:gold:teal:gold', options: ['shape:circle:teal', 'shape:circle:gold'], correct: 0, minAge: 33, phase: 4, tier: 'ceiling' },
];

const observationTasks: ObserveTask[] = [
  { kind: 'observe', id: 'OV_JOINT', title: 'Ortak dikkati paylaşma', instruction: 'İlgi çekici bir oyuncağı birlikte inceleyin. Çocuğun nesne ile yetişkin arasında dikkati kendiliğinden paylaşmasını bekleyin.', material: 'İlgi çekici oyuncak', observe: 'Bakış/dikkat geçişi, paylaşma girişimi ve yetişkini iletişim ortağı olarak kullanma.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_INIT', title: 'Kendiliğinden iletişim başlatma', instruction: 'Tercih edilen bir materyali görünür fakat erişimi sınırlı biçimde sunun ve kısa süre sessizce bekleyin.', material: 'Tercih edilen oyuncak', observe: 'Bakış, işaret, jest, ses veya sözcükle kendiliğinden iletişim başlatma.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_NAME', title: 'Adına doğal yönelme', instruction: 'Çocuk başka bir etkinlikle meşgulken adını bir kez doğal sesle söyleyin.', material: 'Doğal oyun', observe: 'Adına yönelme ve sosyal dikkati yeniden kurma.', minAge: 24, tier: 'explore' },
  { kind: 'observe', id: 'OV_GESTURE', title: 'Jestlerle anlatma', instruction: 'Günlük oyunda işaret etme dışında başıyla evet/hayır, el sallama, öpücük gönderme gibi jestleri doğal fırsatlarda gözleyin.', material: 'Doğal etkileşim', observe: 'İletişim amacıyla birden fazla jest türünü kullanma.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_BODY2', title: 'İki beden bölümünü gösterme', instruction: 'Model göstermeden iki tanıdık beden bölümünü sırayla sorun: “Burnun nerede?”, “Karnın nerede?” gibi.', material: 'Ek materyal gerekmez', observe: 'Sözcüğü beden bölümüyle ilişkilendirip göstermesi.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_IMIT', title: 'Hareket ve nesne taklidi', instruction: 'Bir motor hareket ve bir nesne kullanımını kısa modelleyin; çocuğun taklit etmesini bekleyin.', material: 'Basit oyuncak', observe: 'Modeli kopyalama ve yeni örneğe taşıma.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_FUNCPLAY', title: 'Birden fazla oyuncakla işlevsel oyun', instruction: 'Araba, fincan, kaşık gibi tanıdık oyuncakları birlikte sunun ve serbest oyuna izin verin.', material: '3 tanıdık oyuncak', observe: 'Nesneleri amacına uygun kullanma ve iki nesneyi aynı oyun içinde ilişkilendirme.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_TURN', title: 'Karşılıklı sıra alma', instruction: 'Topu veya ortak oyuncağı birkaç tur sırayla kullanın.', material: 'Top veya ortak oyuncak', observe: 'Karşı tarafa yönelme ve kısa karşılıklı oyunu sürdürme.', minAge: 24, tier: 'explore' },
  { kind: 'observe', id: 'OV_GROSS', title: 'Top ve hareket oyunu', instruction: 'Yumuşak topa amaçlı vurma/tekmeleme ve kısa koşu fırsatı verin.', material: 'Yumuşak top + güvenli alan', observe: 'Topa amaçlı yönelme, kaba motor kontrol ve hareket planlama.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_BIMANUAL', title: 'İki eli birlikte kullanma', instruction: 'Kolay açılan bir kabı verirken bir eliyle kabı tutup diğer eliyle kapağı kullanmasına fırsat verin.', material: 'Güvenli kapaklı kap', observe: 'İki elin farklı görevlerde eşgüdümlü kullanılması.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_PROBLEM', title: 'Gerçek nesneyle problem çözme', instruction: 'Oyuncağa ulaşmak için kapağı açma, kısa bir şeridi çekme veya basit engeli kaldırma gerektiren güvenli bir durum kurun.', material: 'Oyuncak + basit güvenli engel', observe: 'Deneme, araç kullanma, strateji değiştirme ve yardım sonrası öğrenme.', minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_LANGSAMPLE', title: 'Doğal iletişim örneklemi', instruction: '5–8 dakikalık doğal oyunda iletişimi mümkün olduğunca kendiliğinden bırakın ve kısa sayımları kaydedin.', material: 'Tercih edilen oyuncaklar', observe: 'İletişimin sıklığı, işlev çeşitliliği, sözcük birleşimleri ve anlaşılabilir üretim.', metrics: ['Kendiliğinden girişim', 'İstek', 'Yorum/paylaşma', 'İki+ sözcüklü birleşim', 'Eylem sözcüklü birleşim', 'Karşılıklı konuşma turu', 'Anlaşılır sözcük'], minAge: 24, tier: 'core' },
  { kind: 'observe', id: 'OV_FINE', title: 'İnce motor yapı', instruction: 'Bloklarla küçük yapı kurma ve kalın boya kalemiyle serbest karalama fırsatı verin.', material: 'Blok + kalın boya kalemi', observe: 'El-göz koordinasyonu ve nesne kontrolü.', minAge: 27, tier: 'explore' },
  { kind: 'observe', id: 'OV_TRANSITION', title: 'Etkinlik geçişi', instruction: 'Tercih ettiği etkinlikten ikinci tanıdık etkinliğe kısa ve sakin bir hazırlıkla geçin.', material: 'İki tanıdık etkinlik', observe: 'Geçişi kabul etme, yeniden düzenlenme ve gereken destek düzeyi.', minAge: 27, tier: 'explore' },
  { kind: 'observe', id: 'OV_PRETEND', title: 'Mış gibi oyun', instruction: 'Bebek, fincan veya günlük yaşam oyuncaklarıyla serbest oyun fırsatı verin.', material: 'Bebek / günlük yaşam oyuncakları', observe: 'Bir nesneyi başka bir şeyi temsil edecek biçimde veya mış gibi kullanma.', minAge: 30, tier: 'core' },
  { kind: 'observe', id: 'OV_TWOSTEP', title: 'İki bağlantılı yönerge', instruction: 'Tek seferde iki bağlantılı basit adım verin: “Topu bırak ve kutuyu kapat.” gibi.', material: 'Top + kutu', observe: 'İki bilgiyi kısa süre tutup doğru sırayla uygulama.', minAge: 30, tier: 'core' },
  { kind: 'observe', id: 'OV_TWIST', title: 'Çevirme ve açma', instruction: 'Kolay çevrilen bir kapak veya büyük düğme/çevirme parçası sunun.', material: 'Güvenli döner kapak / büyük düğme', observe: 'Eli bilekten döndürerek işlevsel çevirme hareketi kullanma.', minAge: 30, tier: 'core' },
  { kind: 'observe', id: 'OV_JUMP', title: 'İki ayakla zıplama', instruction: 'Güvenli zeminde kısa bir model gösterip iki ayağıyla yerden ayrılmasını bekleyin.', material: 'Boş ve güvenli alan', observe: 'İki ayağın birlikte yerden ayrılması ve dengeli iniş girişimi.', minAge: 30, tier: 'core' },
  { kind: 'observe', id: 'OV_PAGES', title: 'Sayfaları tek tek çevirme', instruction: 'Kalın sayfalı bir kitabı birlikte inceleyin ve çocuğun sayfaları çevirmesine fırsat verin.', material: 'Kalın sayfalı kitap', observe: 'Sayfaları amaçlı ve mümkün olduğunca tek tek çevirme.', minAge: 30, tier: 'core' },
  { kind: 'observe', id: 'OV_ACTIONNAME', title: 'Resimdeki eylemi adlandırma', instruction: 'Koşan veya yemek yiyen bir kişinin resmini gösterip “Ne yapıyor?” diye sorun.', material: 'Net eylem resmi', observe: 'Eylemi sözel olarak adlandırma.', minAge: 33, tier: 'ceiling' },
  { kind: 'observe', id: 'OV_CIRCLE', title: 'Daireyi modelden çizme', instruction: 'Büyük bir daire çizin ve çocuğun kendi kâğıdında benzer bir daire denemesine fırsat verin.', material: 'Kalın kalem + kâğıt', observe: 'Modelden kapalı dairesel şekil oluşturma girişimi.', minAge: 33, tier: 'ceiling' },
  { kind: 'observe', id: 'OV_STRING', title: 'Büyük parçaları ipe geçirme', instruction: 'Büyük delikli 2–3 parçayı kalın bir ipe geçirmesi için fırsat verin.', material: 'Büyük parçalar + kalın ip', observe: 'İki el koordinasyonu ve hedefe yönlendirme.', minAge: 33, tier: 'ceiling' },
];

function Visual({ code }: { code: string }) {
  const colorMap: Record<string, string> = { teal: '#3f8e89', gold: '#e2b84c', red: '#dc5c54', blue: '#4c7fc7' };
  if (code.startsWith('shape:')) {
    const [, shape, color] = code.split(':');
    return <span className={'ex-shape ' + shape} style={{ background: colorMap[color] || color }} />;
  }
  if (code.startsWith('size:')) {
    const [, shape, size] = code.split(':');
    return <span className={'ex-shape neutral ' + shape + ' ' + size} />;
  }
  if (code.startsWith('group:')) {
    const [, icon, count] = code.split(':');
    return <span className='ex-group'>{Array.from({ length: Number(count) }, (_, index) => <i key={index}>{icon}</i>)}</span>;
  }
  if (code.startsWith('scene:')) {
    const inside = code.endsWith('inside');
    return <span className='ex-scene'><i className={inside ? 'ball inside' : 'ball outside'}>●</i><b /></span>;
  }
  if (code.startsWith('pair:') || code.startsWith('pattern:')) {
    const parts = code.split(':').slice(1);
    return <span className='ex-pair'>{parts.map((color, index) => <i key={index} style={{ background: colorMap[color] || color }} />)}</span>;
  }
  if (code.startsWith('box:')) return <span className='ex-box-sample' />;
  if (code.startsWith('text:')) return <span className='ex-emoji'>{code.slice(5)}</span>;
  return <span className='ex-emoji'>{code}</span>;
}

const supportOptions: Array<{ value: EarlyRating; label: string }> = [
  { value: 'verbal_prompt', label: 'Sözel ipucu sonrası' },
  { value: 'visual_prompt', label: 'Jest / görsel ipucu sonrası' },
  { value: 'modeled', label: 'Model sonrası' },
  { value: 'physical_assist', label: 'Fiziksel yardım sonrası' },
];

const phaseCopy: Record<number, { eyebrow: string; title: string; text: string }> = {
  2: { eyebrow: 'MİNİ MOLA', title: 'Biraz hareket, sonra devam', text: '20–30 saniye ayağa kalkın, esneyin veya kısa bir top oyunu yapın. Hazır olduğunda ikinci mini bloğa geçin.' },
  3: { eyebrow: 'YENİ MİNİ BLOK', title: 'Şimdi biraz düşünme oyunu', text: 'Görevler bir basamak daha zorlaşacak. Çocuk yorulduysa bu bölümü daha sonra sürdürmek uygundur.' },
  4: { eyebrow: 'KEŞİF / TAVAN', title: 'Bunlar zor olmak zorunda', text: 'Bu bölüm gelişimin üst sınırını örnekler. Yapamaması olumsuz puan, gerilik veya risk kanıtı değildir.' },
  5: { eyebrow: 'EKRAN BÖLÜMÜ BİTTİ', title: 'Şimdi gerçek oyun zamanı', text: 'Ekranı kenara alın. Ortak dikkat, dil, oyun, motor ve problem çözme gerçek materyal ve yüz yüze etkileşimle gözlenecek.' },
};

export default function EarlyDevelopmentChildExercisesV5({ sessionId, ageMonths, initialState, onBack, onUpdated }: { sessionId: string; ageMonths?: number; initialState?: EarlyState; onBack: () => void; onUpdated: (session: unknown) => void }) {
  const age = ageMonths ?? 24;
  const tasks = useMemo<Task[]>(() => [...digitalTasks, ...observationTasks].filter((task) => age >= task.minAge), [age]);
  const [responses, setResponses] = useState(initialState?.responses ?? []);
  const done = useMemo(() => new Set(responses.map((response) => response.itemId)), [responses]);
  const first = tasks.findIndex((task) => !done.has(task.id));
  const [index, setIndex] = useState(first < 0 ? Math.max(0, tasks.length - 1) : first);
  const [practiceDone, setPracticeDone] = useState((initialState?.responses.length ?? 0) > 0);
  const [practiceHint, setPracticeHint] = useState(false);
  const [passedPhases, setPassedPhases] = useState<Set<number>>(new Set([1]));
  const [support, setSupport] = useState<EarlyRating | ''>('');
  const [firstMiss, setFirstMiss] = useState(false);
  const [firstSelection, setFirstSelection] = useState(-1);
  const [rating, setRating] = useState<EarlyRating | ''>('');
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const shownAt = useRef(Date.now());
  const task = tasks[index];
  const completed = tasks.filter((entry) => done.has(entry.id)).length;
  const digitalCount = tasks.filter((entry) => entry.kind === 'digital').length;
  const observationCount = tasks.length - digitalCount;
  const pct = Math.round((completed / Math.max(1, tasks.length)) * 100);
  const phase = task.kind === 'digital' ? task.phase : 5;
  const routeLabel = age < 27 ? '24–26 ay · temel erişim' : age < 30 ? '27–29 ay · genişleyen kavramlar' : age < 33 ? '30–32 ay · iki aşamalı öğrenme' : '33–35 ay · temel + nötr tavan örneklemesi';

  useEffect(() => {
    shownAt.current = Date.now();
    setSupport('');
    setFirstMiss(false);
    setFirstSelection(-1);
    setRating('');
    setMetrics({});
    setNote('');
  }, [index]);

  async function save(itemRating: EarlyRating, extraMetrics: Record<string, number> = {}) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const tierMetrics = { exploreProbe: task.tier === 'explore' ? 1 : 0, ceilingProbe: task.tier === 'ceiling' ? 1 : 0 };
      const result = await api.post('/api/session/' + sessionId + '/early-development-response', { itemId: task.id, rating: itemRating, note: note.trim().slice(0, 300), metrics: { ...metrics, ...tierMetrics, ...extraMetrics } });
      const session = result.data as { earlyDevelopment?: EarlyState };
      const nextResponses = session.earlyDevelopment?.responses ?? responses;
      setResponses(nextResponses);
      onUpdated(result.data);
      if (session.earlyDevelopment?.childCompletedAt) {
        onBack();
        return;
      }
      const nextDone = new Set(nextResponses.map((response) => response.itemId));
      const nextIndex = tasks.findIndex((entry, taskIndex) => taskIndex > index && !nextDone.has(entry.id));
      setIndex(nextIndex >= 0 ? nextIndex : Math.min(tasks.length - 1, index + 1));
    } catch {
      setError('Görev kaydedilemedi. Önceki kayıtlar korunur; yeniden deneyin.');
    } finally {
      setBusy(false);
    }
  }

  function choose(optionIndex: number) {
    if (busy || task.kind !== 'digital') return;
    const latencyMs = Math.max(0, Date.now() - shownAt.current);
    if (!firstMiss) {
      if (optionIndex === task.correct) {
        void save('independent', { firstCorrect: 1, firstSelection: optionIndex, latencyMs });
        return;
      }
      setFirstMiss(true);
      setFirstSelection(optionIndex);
      return;
    }
    if (support && optionIndex === task.correct) void save(support, { firstCorrect: 0, firstSelection, latencyMs });
  }

  if (!practiceDone) return <div className='early-shell ex-shell ex-v5-shell'><main className='early-main'><section className='early-task-card ex-practice-card'><button type='button' className='early-back ex-operator-only' onClick={onBack}>← E2 ana ekranına dön</button><div className='ex-practice-copy'><small>PUANSIZ DENEME OYUNU</small><h1>Önce ekrana birlikte alışalım</h1><p>“Elmayı göster.” deyin. Bu deneme rapora girmez; amaç yalnızca dokunarak seçim yapmayı anlamaktır.</p></div><div className='ex-options ex-practice-options'><button type='button' onClick={() => setPracticeDone(true)}><Visual code='🍎' /></button><button type='button' onClick={() => setPracticeHint(true)}><Visual code='🚗' /></button></div>{practiceHint && <div className='ex-quiet-note ex-operator-only'>Yalnızca “Elmaya dokunalım.” deyip birlikte gösterin. Yanlış, olmadı, tekrar dene gibi ifadeler kullanmayın.</div>}<button type='button' className='early-skip ex-operator-only' onClick={() => setPracticeDone(true)}>Deneme oyununu geç</button></section></main></div>;

  if (phase > 1 && !passedPhases.has(phase)) {
    const copy = phaseCopy[phase];
    return <div className='early-shell ex-shell ex-v5-shell'><main className='early-main'><section className='early-task-card ex-phase-card'><span>{copy.eyebrow}</span><h1>{copy.title}</h1><p>{copy.text}</p><div className='ex-phase-route ex-operator-only'><b>{routeLabel}</b><span>{completed}/{tasks.length} görev kaydedildi</span></div><button type='button' className='early-primary' onClick={() => setPassedPhases((current) => new Set([...current, phase]))}>{phase === 5 ? 'Ekranı bırak · gerçek oyuna geç →' : 'Hazır olduğunda devam et →'}</button><button type='button' className='early-skip ex-operator-only' onClick={onBack}>Burada dur · daha sonra devam et</button></section></main></div>;
  }

  return <div className='early-shell ex-shell ex-v5-shell'>
    <div className='early-progress-top ex-operator-progress'><div><strong>{task.kind === 'digital' ? 'E2-v5 · kısa ekran bloğu' : 'E2-v5 · doğal oyun / gerçek materyal'}</strong><span>{completed}/{tasks.length} · %{pct}</span></div><i><b style={{ width: pct + '%' }} /></i></div>
    <main className='early-main'>
      <section className={'early-task-card ' + (task.kind === 'digital' ? 'ex-child-card ex-v5-child-card' : '')}>
        <button type='button' className='early-back ex-operator-only' onClick={onBack}>← E2 ana ekranına dön</button>
        <div className='ex-block-summary ex-operator-only'><b>{routeLabel}</b><b>{digitalCount} kısa ekran görevi</b><b>{observationCount} gerçek oyun gözlemi</b><span>Tek oturum zorunlu değil</span></div>
        {task.kind === 'digital' ? <>
          <div className='ex-child-head'><small>{task.phase === 1 ? 'BAK VE DOKUN' : task.phase === 2 ? 'EŞLEŞTİR VE KAVRAM' : task.phase === 3 ? 'DÜŞÜN VE BUL' : 'KEŞİF'}</small><h1>{task.title}</h1><p>{task.prompt}</p></div>
          {task.tier === 'ceiling' && <div className='ex-ceiling-note ex-operator-only'><b>Tavan / keşif görevi</b><span>Yapamaması olumsuz gelişim kanıtı sayılmaz.</span></div>}
          {task.sample && <div className='ex-sample'><small>BAK</small><Visual code={task.sample} /></div>}
          <div className='ex-options'>{task.options.map((option, optionIndex) => <button type='button' key={optionIndex} disabled={busy} onClick={() => choose(optionIndex)} aria-label={'Seçenek ' + (optionIndex + 1)}><Visual code={option} /></button>)}</div>
          {firstMiss && <div className='ex-support-panel ex-operator-only'><strong>İlk dokunuş kaydedildi. Çocuğa “yanlış” demeyin.</strong><p>Önce kısa sözel ipucu, gerekirse jest/görsel ipucu, sonra model kullanın. Yardımı mümkün olduğunca azdan çoğa artırın.</p><div>{supportOptions.map((item) => <button type='button' className={support === item.value ? 'active' : ''} key={item.value} onClick={() => setSupport(item.value)}>{item.label}</button>)}</div><div className='ex-support-end'><button type='button' onClick={() => void save('not_observed', { firstCorrect: 0, firstSelection, latencyMs: Math.max(0, Date.now() - shownAt.current) })}>{task.tier === 'ceiling' ? 'Bu tavan görevini kapat' : 'Henüz gözlenmedi'}</button><button type='button' onClick={() => void save('not_assessed')}>Görevi geç</button></div></div>}
          {!firstMiss && <div className='ex-quiet-note ex-operator-only'>Yönergeyi bir kez, kısa ve doğal söyleyin. Çocuğu hızlandırmayın; görünür süre veya geri sayım yoktur.</div>}
        </> : <>
          <div className='early-task-head'><div><span>{task.tier === 'ceiling' ? 'NÖTR TAVAN GÖZLEMİ' : 'DOĞAL OYUN GÖZLEMİ'}</span><h1>{task.title}</h1></div><b>{age} ay</b></div>
          {task.tier === 'ceiling' && <div className='ex-ceiling-note'><b>Bu görev üst sınır örneğidir.</b><span>Ortaya çıkmaması yaşa ilişkin olumsuz sonuç üretmez.</span></div>}
          <div className='early-instruction'><small>UYGULAMA</small><p>{task.instruction}</p></div>
          <div className='early-two'><div><small>MATERYAL</small><strong>{task.material}</strong></div><div><small>NEYE BAKIYORUZ?</small><strong>{task.observe}</strong></div></div>
          {task.metrics && <div className='early-metrics'><h2>Kısa sayımlar</h2>{task.metrics.map((key) => <label key={key}><span>{key}</span><input type='number' min='0' value={metrics[key] ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}</div>}
          <div className='early-rating'><h2>Beceri hangi destek düzeyinde ortaya çıktı?</h2>{[{ value: 'independent', label: 'Bağımsız' }, ...supportOptions, { value: 'not_observed', label: task.tier === 'ceiling' ? 'Bu tavan örneğinde çıkmadı' : 'Henüz gözlenmedi' }].map((item) => <button type='button' className={rating === item.value ? 'active' : ''} key={item.value} onClick={() => setRating(item.value as EarlyRating)}><strong>{item.label}</strong></button>)}</div>
          <label className='early-note'><span>Kısa gözlem notu <small>(isteğe bağlı)</small></span><textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder='Örn. Modelden sonra yaptı; ikinci denemede yardım azaldı.' /></label>
          <div className='early-actions'><button type='button' className='early-skip' disabled={busy} onClick={() => void save('not_assessed')}>Görevi geç · değerlendirilemedi</button><button type='button' className='early-primary' disabled={!rating || busy} onClick={() => rating && void save(rating)}>{busy ? 'Kaydediliyor…' : 'Kaydet ve devam et →'}</button></div>
        </>}
        {error && <div className='early-error'>{error}</div>}
        <footer className='ex-operator-only'>E2-v5: kısa ekran örneklemesi + yetişkin eşliğinde gerçek oyun. Çocukta puan, süre baskısı ve doğru/yanlış geri bildirimi gösterilmez.</footer>
      </section>
    </main>
  </div>;
}
