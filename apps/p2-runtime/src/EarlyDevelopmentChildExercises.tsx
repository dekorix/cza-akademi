import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@appdeploy/client';
import './early-exercises.css';

type EarlyRating = 'independent' | 'prompted' | 'verbal_prompt' | 'visual_prompt' | 'modeled' | 'physical_assist' | 'not_observed' | 'not_assessed';
type EarlyResponse = { itemId: string; rating: EarlyRating; metrics?: Record<string, number>; recordedAt: string };
type EarlyState = { responses: EarlyResponse[]; childCompletedAt?: string };
type DigitalTask = { kind: 'digital'; id: string; title: string; prompt: string; sample?: string; options: string[]; correct: number; minAge?: number };
type ObserveTask = { kind: 'observe'; id: string; title: string; instruction: string; material: string; observe: string; metrics?: string[]; minAge?: number };
type Task = DigitalTask | ObserveTask;

const digitalTasks: DigitalTask[] = [
  { kind: 'digital', id: 'DX_MATCH_OBJ', title: 'Aynısını bul', prompt: 'Bunun aynısını bul.', sample: '🍎', options: ['🐶', '🍎', '🚗'], correct: 1 },
  { kind: 'digital', id: 'DX_MATCH_SHAPE', title: 'Aynı şekli bul', prompt: 'Aynı şekli seç.', sample: 'shape:circle:red', options: ['shape:square:blue', 'shape:circle:red', 'shape:triangle:yellow'], correct: 1 },
  { kind: 'digital', id: 'DX_MATCH_COLOR', title: 'Aynı rengi bul', prompt: 'Aynı renkte olanı seç.', sample: 'shape:circle:red', options: ['shape:circle:blue', 'shape:circle:yellow', 'shape:circle:red'], correct: 2 },
  { kind: 'digital', id: 'DX_BIG', title: 'Büyük olanı bul', prompt: 'Büyük olanı seç.', options: ['size:circle:large', 'size:circle:small'], correct: 0 },
  { kind: 'digital', id: 'DX_ONE', title: 'Bir tane', prompt: 'Bir tane olanı bul.', options: ['group:⭐:4', 'group:⭐:1'], correct: 1 },
  { kind: 'digital', id: 'DX_MANY', title: 'Çok olan', prompt: 'Çok olanı bul.', options: ['group:⚽:1', 'group:⚽:5'], correct: 1 },
  { kind: 'digital', id: 'DX_OBJECT', title: 'Topu bul', prompt: 'Topu bul.', options: ['🥄', '⚽', '🚗'], correct: 1 },
  { kind: 'digital', id: 'DX_ACTION', title: 'Uyuyanı bul', prompt: 'Uyuyanı bul.', options: ['🏃', '🍽️', '😴'], correct: 2 },
  { kind: 'digital', id: 'DX_ANIMAL', title: 'Hayvanı bul', prompt: 'Hayvanı bul.', options: ['🐶', '🚗', '🥄'], correct: 0 },
  { kind: 'digital', id: 'DX_INSIDE', title: 'İçinde olanı bul', prompt: 'Top kutunun içinde olan resmi bul.', options: ['scene:outside', 'scene:inside'], correct: 1 },
  { kind: 'digital', id: 'DX_FIT', title: 'Hangisi sığar?', prompt: 'Küçük kutuya sığacak parçayı seç.', sample: 'box:small', options: ['size:square:large', 'size:square:small'], correct: 1 },
  { kind: 'digital', id: 'DX_PAIR', title: 'Aynı sırayı bul', prompt: 'Aynı iki parçalı sırayı seç.', sample: 'pair:red:yellow', options: ['pair:yellow:yellow', 'pair:red:yellow', 'pair:blue:red'], correct: 1 },
  { kind: 'digital', id: 'DX_ODD', title: 'Farklı olanı bul', prompt: 'Diğerlerinden farklı olanı seç.', options: ['🚗', '🐶', '🚗'], correct: 1, minAge: 30 },
  { kind: 'digital', id: 'DX_CATEGORY', title: 'Aynı gruba ekle', prompt: 'Bunlarla aynı gruba ait olanı seç.', sample: 'text:🚗   🚌', options: ['🐶', '🥄', '🚚'], correct: 2, minAge: 30 },
  { kind: 'digital', id: 'DX_PATTERN', title: 'Sırada ne var?', prompt: 'Diziyi tamamla.', sample: 'pattern:red:blue:red', options: ['shape:circle:blue', 'shape:circle:red', 'shape:circle:yellow'], correct: 0, minAge: 30 },
  { kind: 'digital', id: 'DX_TWO', title: 'İki tane', prompt: 'İki tane olanı bul.', options: ['group:🍎:3', 'group:🍎:2'], correct: 1, minAge: 30 },
  { kind: 'digital', id: 'DX_MORE', title: 'Daha çok olan', prompt: 'Daha çok olanı seç.', options: ['group:⭐:2', 'group:⭐:4'], correct: 1, minAge: 30 },
];

const observationTasks: ObserveTask[] = [
  { kind: 'observe', id: 'OV_JOINT', title: 'Ortak dikkat paylaşımı', instruction: 'İlgi çekici bir oyuncağı birlikte inceleyin. Nesne ile yetişkin arasında kendiliğinden dikkat paylaşımını izleyin.', material: 'İlgi çekici oyuncak', observe: 'Nesne-yetişkin arasında bakış/dikkat geçişi ve paylaşma girişimi.' },
  { kind: 'observe', id: 'OV_INIT', title: 'Kendiliğinden iletişim başlatma', instruction: 'Çocuğun istediği bir materyali görünür fakat erişimi sınırlı biçimde sunup kısa süre bekleyin.', material: 'Tercih edilen oyuncak', observe: 'Bakış, işaret, jest, ses veya sözcükle yetişkine kendiliğinden yönelmesi.' },
  { kind: 'observe', id: 'OV_NAME', title: 'Adına doğal yönelme', instruction: 'Çocuk başka bir etkinlikle meşgulken adını bir kez doğal sesle söyleyin.', material: 'Doğal oyun', observe: 'Adına yönelme ve sosyal dikkati yeniden kurma.' },
  { kind: 'observe', id: 'OV_IMIT', title: 'Hareket ve nesne taklidi', instruction: 'Alkış, masaya vurma veya oyuncağa basit bir işlev verme gibi iki kısa model gösterin.', material: 'Basit oyuncak', observe: 'Modeli kopyalama ve ikinci örneğe aktarabilme.' },
  { kind: 'observe', id: 'OV_FUNCPLAY', title: 'İşlevsel oyun', instruction: 'Araba, kaşık, fincan gibi tanıdık oyuncakları serbestçe sunun.', material: '3 tanıdık oyuncak', observe: 'Nesneyi amacına uygun kullanma ve oyunu sürdürme.' },
  { kind: 'observe', id: 'OV_TURN', title: 'Karşılıklı sıra alma', instruction: 'Topu veya ortak oyuncağı birkaç tur sırayla kullanın.', material: 'Top veya ortak oyuncak', observe: 'Sırasını fark etme, karşı tarafa yönelme ve oyunu devam ettirme.' },
  { kind: 'observe', id: 'OV_GROSS', title: 'Kaba motor oyun', instruction: 'Yumuşak topu tekmeleme/atma ve kısa git-dur oyununa doğal biçimde yer verin.', material: 'Yumuşak top + güvenli alan', observe: 'Amaçlı hareket, denge ve basit durma işaretine yönelme.' },
  { kind: 'observe', id: 'OV_FINE', title: 'İnce motor yapı', instruction: 'Bloklarla küçük kule kurma ve kalın boya kalemiyle kısa karalama fırsatı verin.', material: 'Blok + kalın boya kalemi', observe: 'El-göz koordinasyonu, nesne kontrolü ve iki farklı ince motor göreve geçiş.' },
  { kind: 'observe', id: 'OV_TRANSITION', title: 'Etkinlik geçişi', instruction: 'Tercih ettiği etkinlikten ikinci tanıdık etkinliğe kısa uyarıyla geçin.', material: 'İki tanıdık etkinlik', observe: 'Geçişi kabul etme, yeniden düzenlenme ve gereken destek düzeyi.' },
  { kind: 'observe', id: 'OV_PROBLEM', title: 'Gerçek nesneyle problem çözme', instruction: 'Oyuncağa ulaşmak için kapağı açma, kısa bir şeridi çekme veya engeli kaldırma gerektiren güvenli bir durum kurun.', material: 'Oyuncak + basit güvenli engel', observe: 'Deneme, araç kullanma, strateji değiştirme ve yardım sonrası öğrenme.' },
  { kind: 'observe', id: 'OV_LANGSAMPLE', title: 'Kısa doğal iletişim örneklemi', instruction: '5–10 dakikalık doğal oyunda iletişimi mümkün olduğunca kendiliğinden bırakın ve sayımları kaydedin.', material: 'Tercih edilen oyuncaklar', observe: 'İletişimin sıklığı, işlev çeşitliliği ve anlaşılabilir sözel üretim.', metrics: ['Kendiliğinden girişim', 'İstek', 'Yorum/paylaşma', 'Soruya yanıt', 'Taklit edilen ifade', 'Anlaşılır sözcük'] },
  { kind: 'observe', id: 'OV_PRETEND', title: 'Sembolik oyun', instruction: 'Bebek, fincan veya küçük günlük yaşam oyuncaklarıyla mış gibi oyun fırsatı verin.', material: 'Bebek/günlük yaşam oyuncakları', observe: 'Sembolik kullanım ve iki oyun eylemini bağlama.', minAge: 30 },
  { kind: 'observe', id: 'OV_TWOSTEP', title: 'İki bağlantılı yönerge', instruction: 'Tek seferde iki bağlantılı basit adım verin: “Topu al ve kutuya koy.” gibi.', material: 'Top + kutu', observe: 'İki bilgiyi kısa süre tutup doğru sırayla uygulama.', minAge: 30 },
];

function Visual({ code }: { code: string }) {
  if (code.startsWith('shape:')) {
    const [, shape, color] = code.split(':');
    return <span className={'ex-shape ' + shape} style={{ background: color }} />;
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
    return <span className='ex-pair'>{parts.map((color, index) => <i key={index} style={{ background: color }} />)}</span>;
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

export default function EarlyDevelopmentChildExercises({ sessionId, ageMonths, initialState, onBack, onUpdated }: { sessionId: string; ageMonths?: number; initialState?: EarlyState; onBack: () => void; onUpdated: (session: unknown) => void }) {
  const tasks = useMemo<Task[]>(() => [...digitalTasks, ...observationTasks].filter((task) => !task.minAge || (ageMonths ?? 24) >= task.minAge), [ageMonths]);
  const [responses, setResponses] = useState(initialState?.responses ?? []);
  const done = useMemo(() => new Set(responses.map((response) => response.itemId)), [responses]);
  const first = tasks.findIndex((task) => !done.has(task.id));
  const [index, setIndex] = useState(first < 0 ? Math.max(0, tasks.length - 1) : first);
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
      const result = await api.post('/api/session/' + sessionId + '/early-development-response', { itemId: task.id, rating: itemRating, note: note.trim().slice(0, 300), metrics: { ...metrics, ...extraMetrics } });
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

  return <div className='early-shell ex-shell'>
    <div className='early-progress-top'><div><strong>{task.kind === 'digital' ? 'Çocuk Ekran Egzersizleri' : 'Doğal Oyun / Gerçek Materyal'}</strong><span>{completed}/{tasks.length} · %{pct}</span></div><i><b style={{ width: pct + '%' }} /></i></div>
    <main className='early-main'>
      <section className={'early-task-card ' + (task.kind === 'digital' ? 'ex-child-card' : '')}>
        <button type='button' className='early-back ex-operator-only' onClick={onBack}>← E2 ana ekranına dön</button>
        <div className='ex-block-summary ex-operator-only'><b>{digitalCount} dokunmatik egzersiz</b><b>{observationCount} doğal gözlem</b><span>İlk seçim + tepki süresi otomatik kanıt</span></div>
        {task.kind === 'digital' ? <>
          <div className='ex-child-head'><small>OYUN {index + 1} / {tasks.length}</small><h1>{task.title}</h1><p>{task.prompt}</p></div>
          {task.sample && <div className='ex-sample'><small>BAK</small><Visual code={task.sample} /></div>}
          <div className='ex-options'>{task.options.map((option, optionIndex) => <button type='button' key={optionIndex} disabled={busy} onClick={() => choose(optionIndex)}><Visual code={option} /></button>)}</div>
          {firstMiss && <div className='ex-support-panel ex-operator-only'><strong>İlk seçim kaydedildi. Çocuğa “yanlış” demeyin.</strong><p>Gerekiyorsa bir destek düzeyi seçin, desteği verin ve çocuğun ekrandan tekrar seçmesine izin verin.</p><div>{supportOptions.map((item) => <button type='button' className={support === item.value ? 'active' : ''} key={item.value} onClick={() => setSupport(item.value)}>{item.label}</button>)}</div><div className='ex-support-end'><button type='button' onClick={() => void save('not_observed', { firstCorrect: 0, firstSelection, latencyMs: Math.max(0, Date.now() - shownAt.current) })}>Henüz gözlenmedi</button><button type='button' onClick={() => void save('not_assessed')}>Görevi geç</button></div></div>}
          {!firstMiss && <div className='ex-quiet-note ex-operator-only'>Yönergeyi bir kez kısa söyleyin. Çocuğun ilk dokunuşunu mümkün olduğunca bağımsız bırakın.</div>}
        </> : <>
          <div className='early-task-head'><div><span>DOĞAL GÖZLEM {index + 1} / {tasks.length}</span><h1>{task.title}</h1></div><b>{ageMonths ?? '—'} ay</b></div>
          <div className='early-instruction'><small>UYGULAMA</small><p>{task.instruction}</p></div>
          <div className='early-two'><div><small>MATERYAL</small><strong>{task.material}</strong></div><div><small>NEYE BAKIYORUZ?</small><strong>{task.observe}</strong></div></div>
          {task.metrics && <div className='early-metrics'><h2>Kısa sayımlar</h2>{task.metrics.map((key) => <label key={key}><span>{key}</span><input type='number' min='0' value={metrics[key] ?? ''} onChange={(event) => setMetrics((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}</div>}
          <div className='early-rating'><h2>Beceri hangi destek düzeyinde ortaya çıktı?</h2>{[{ value: 'independent', label: 'Bağımsız' }, ...supportOptions, { value: 'not_observed', label: 'Henüz gözlenmedi' }].map((item) => <button type='button' className={rating === item.value ? 'active' : ''} key={item.value} onClick={() => setRating(item.value as EarlyRating)}><strong>{item.label}</strong></button>)}</div>
          <label className='early-note'><span>Kısa gözlem notu <small>(isteğe bağlı)</small></span><textarea maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} placeholder='Örn. Modelden sonra hemen yaptı; ikinci örnekte yardım azaldı.' /></label>
          <div className='early-actions'><button type='button' className='early-skip' disabled={busy} onClick={() => void save('not_assessed')}>Görevi geç · değerlendirilemedi</button><button type='button' className='early-primary' disabled={!rating || busy} onClick={() => rating && void save(rating)}>{busy ? 'Kaydediliyor…' : 'Kaydet ve devam et →'}</button></div>
        </>}
        {error && <div className='early-error'>{error}</div>}
        <footer className='ex-operator-only'>Dokunmatik görevlerde çocuğa doğru/yanlış geri bildirimi verilmez. Kısa ekran bloğundan sonra gerçek oyun/gözlem bölümüne geçilir.</footer>
      </section>
    </main>
  </div>;
}

