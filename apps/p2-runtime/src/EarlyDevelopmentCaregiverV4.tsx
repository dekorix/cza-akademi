import { useMemo, useState } from 'react';
import { api } from '@appdeploy/client';

export type CaregiverResponse = { questionId: string; answer: string; note?: string; recordedAt: string };
export type CaregiverState = { responses: CaregiverResponse[]; startedAt: string; completedAt?: string };
type Q = { id: string; section: string; label: string; kind: 'text' | 'number' | 'yesno' | 'partial' | 'choice'; options?: string[]; redFlag?: boolean };
const q = (id: string, section: string, label: string, kind: Q['kind'] = 'partial', options?: string[], redFlag = false): Q => ({ id, section, label, kind, options, redFlag });

const qs: Q[] = [
  q('CV4_RESPONDENT', '1 · Gelişim Bağlamı ve Sağlık', 'Bu görüşmede çocuğu günlük yaşamda en yakından gözleyen kişi kim?', 'choice', ['Anne', 'Baba', 'Anne ve baba birlikte', 'Diğer bakımveren']),
  q('CV4_MAIN_REASON', '1 · Gelişim Bağlamı ve Sağlık', 'Bugün değerlendirmeye gelmenizin en önemli nedeni nedir?', 'text'),
  q('CV4_HEARING', '1 · Gelişim Bağlamı ve Sağlık', 'Son dönemde sese tepki veya işitme ile ilgili bir kaygınız oldu mu?', 'yesno', undefined, true),
  q('CV4_VISION', '1 · Gelişim Bağlamı ve Sağlık', 'Görme, göz teması kurarken görsel takip ya da nesnelere çok yaklaşma konusunda bir kaygınız var mı?', 'yesno', undefined, true),
  q('CV4_REGRESSION', '1 · Gelişim Bağlamı ve Sağlık', 'Daha önce kullandığı bir sözcük, oyun, hareket veya sosyal beceride belirgin kayıp fark ettiniz mi?', 'yesno', undefined, true),
  q('CV4_FEEDING', '1 · Gelişim Bağlamı ve Sağlık', 'Çiğneme, yutma veya beslenme güvenliği konusunda sizi endişelendiren bir durum var mı?', 'yesno', undefined, true),
  q('CV4_SLEEP', '1 · Gelişim Bağlamı ve Sağlık', 'Uyku düzeni çocuğun gündüz dikkatini veya davranışını ne ölçüde etkiliyor?', 'choice', ['Belirgin etkilemiyor', 'Bazen etkiliyor', 'Sık etkiliyor', 'Emin değilim']),

  q('CV4_REQUEST', '2 · Evde İletişim Profili', 'Bir şey istediğinde en sık hangi yolu kullanıyor?', 'choice', ['İşaret / jest', 'Tek sözcük', 'İki veya daha fazla sözcük', 'Yetişkini nesneye götürme', 'Karışık kullanıyor']),
  q('CV4_NAME', '2 · Evde İletişim Profili', 'Adı söylendiğinde çoğu doğal durumda size yöneliyor mu?'),
  q('CV4_ONE_STEP', '2 · Evde İletişim Profili', 'Günlük yaşamda “getir, koy, ver, otur” gibi kısa yönergeleri çoğunlukla anlıyor mu?'),
  q('CV4_WORDS', '2 · Evde İletişim Profili', 'Kendiliğinden, yalnız taklit etmeden anlamlı sözcükler kullanıyor mu?'),
  q('CV4_COMBINE', '2 · Evde İletişim Profili', 'İki ya da daha fazla sözcüğü anlamlı biçimde bir araya getiriyor mu?'),
  q('CV4_SHARE', '2 · Evde İletişim Profili', 'Sadece bir şey istemek için değil, size bir şeyi göstermek veya paylaşmak için iletişim başlatıyor mu?'),
  q('CV4_INTELLIG', '2 · Evde İletişim Profili', 'Tanıdık yetişkinler konuşmasının ne kadarını anlayabiliyor?', 'choice', ['Çoğunu', 'Yaklaşık yarısını', 'Az bir kısmını', 'Sözel üretimi çok sınırlı', 'Emin değilim']),

  q('CV4_IMITATE', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Sizin yaptığınız yeni bir hareketi veya oyuncak kullanımını taklit ediyor mu?'),
  q('CV4_FUNCPLAY', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Tanıdık oyuncakları işlevine uygun kullanıyor mu?'),
  q('CV4_PRETEND', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Bebeği besleme, telefonda konuşuyormuş gibi yapma gibi mış gibi oyunlar görülüyor mu?'),
  q('CV4_TURN', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Kısa karşılıklı oyunları birkaç tur sürdürebiliyor mu?'),
  q('CV4_PEER', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Akranları gördüğünde onları izleme, yaklaşma veya oyuna katılma girişimi oluyor mu?'),
  q('CV4_LEARN', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Yeni bir şeyi en kolay nasıl öğreniyor? Örneğin gösterildiğinde, birlikte yapıldığında, sözel anlatıldığında veya tekrarlarla.', 'text'),

  q('CV4_TRANSITION', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Sevdiği bir etkinlikten başka bir etkinliğe kısa hazırlıkla geçebiliyor mu?'),
  q('CV4_RECOVER', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Üzüldüğünde veya istediği olmadığında genellikle ne kadar destekle yeniden sakinleşiyor?', 'choice', ['Kısa destek yeterli', 'Biraz zaman ve yardım gerekiyor', 'Yoğun yetişkin desteği gerekiyor', 'Duruma göre çok değişiyor']),
  q('CV4_SENSORY_AVOID', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Ses, dokunma, ışık, hareket veya belirli dokular içinde özellikle kaçındığı durumlar var mı? Varsa hangileri?', 'text'),
  q('CV4_SENSORY_SEEK', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Sürekli dönme, zıplama, sıkıştırılma isteme, nesneleri ağza götürme gibi aradığı duyusal deneyimler var mı? Günlük yaşamı etkiliyor mu?', 'text'),
  q('CV4_SCREEN', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Ekran günlük yaşamda nasıl bir yer tutuyor?', 'choice', ['Az / sınırlı kullanıyor', 'Yönetilebilir düzeyde', 'Bırakmakta sık zorlanıyor', 'Günün önemli kısmını etkiliyor']),

  q('CV4_EATDRINK', '5 · Günlük Yaşam ve Güvenlik', 'Yeme ve içmede bağımsızlığı hangi düzeyde?', 'choice', ['Çoğunlukla bağımsız', 'Kısmi yardım', 'Yoğun yardım', 'Değişken']),
  q('CV4_DRESS', '5 · Günlük Yaşam ve Güvenlik', 'Basit giyinme/çıkarma rutinlerine aktif katılıyor mu?'),
  q('CV4_HYGIENE', '5 · Günlük Yaşam ve Güvenlik', 'El yıkama, yüz silme gibi kısa özbakım rutinlerine katılıyor mu?'),
  q('CV4_TOILET', '5 · Günlük Yaşam ve Güvenlik', 'Tuvalet farkındalığı şu anda hangi düzeyde?', 'choice', ['Henüz belirgin değil', 'Islak/kirli olmayı fark ediyor', 'Rutin başlatıldı', 'Büyük ölçüde bağımsız']),
  q('CV4_STOP', '5 · Günlük Yaşam ve Güvenlik', 'Güvenlik durumunda “dur” veya “bekle” gibi kısa işaretlere çoğunlukla tepki veriyor mu?'),

  q('CV4_STRENGTH', '6 · Aile Hedefleri ve Eğitim Planı', 'Çocuğunuzun şu anda en güçlü gördüğünüz üç özelliği nedir?', 'text'),
  q('CV4_MOTIVATE', '6 · Aile Hedefleri ve Eğitim Planı', 'Hangi oyuncaklar, etkinlikler veya sosyal oyunlar onu en çok motive ediyor?', 'text'),
  q('CV4_HARD_ROUTINE', '6 · Aile Hedefleri ve Eğitim Planı', 'Gün içinde en çok zorlandığınız rutin hangisi ve genellikle ne oluyor?', 'text'),
  q('CV4_GOALS', '6 · Aile Hedefleri ve Eğitim Planı', 'Önümüzdeki üç ayda değişmesini en çok istediğiniz üç somut beceri nedir?', 'text'),
  q('CV4_WORKS', '6 · Aile Hedefleri ve Eğitim Planı', 'Şimdiye kadar çocuğa yardımcı olduğunu fark ettiğiniz yaklaşım veya yöntemler neler?', 'text'),

  q('CV4_MOTOR_RISK', '7 · Yönlendirme İçin Kısa Güvenlik Kontrolü', 'Son dönemde belirgin güçsüzlük, yeni başlayan sık düşme veya motor beceride gerileme fark ettiniz mi?', 'yesno', undefined, true),
  q('CV4_SELF_HARM', '7 · Yönlendirme İçin Kısa Güvenlik Kontrolü', 'Kendine zarar verme veya ciddi güvenlik riski oluşturan bir davranış var mı?', 'yesno', undefined, true),
];

const options = (question: Q) => question.options || (question.kind === 'yesno' ? ['Evet', 'Hayır', 'Emin değilim'] : question.kind === 'partial' ? ['Evet', 'Kısmen', 'Hayır', 'Emin değilim'] : []);

export default function EarlyDevelopmentCaregiverV4({ sessionId, studentLabel, initialState, onBack, onUpdated }: { sessionId: string; studentLabel: string; initialState?: CaregiverState; onBack: () => void; onUpdated: (session: unknown) => void }) {
  const initialDone = new Set((initialState?.responses || []).map((response) => response.questionId));
  const first = qs.findIndex((question) => !initialDone.has(question.id));
  const [index, setIndex] = useState(first < 0 ? Math.max(0, qs.length - 1) : first);
  const [answer, setAnswer] = useState('');
  const [note, setNote] = useState('');
  const [responses, setResponses] = useState(initialState?.responses || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const question = qs[index];
  const completed = new Set(responses.map((response) => response.questionId)).size;
  const pct = Math.round((completed / qs.length) * 100);
  const sections = useMemo(() => [...new Set(qs.map((item) => item.section))], []);

  async function save(value: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await api.post('/api/session/' + sessionId + '/early-caregiver-response', { questionId: question.id, answer: value, note: note.trim().slice(0, 500) });
      const next = result.data as { earlyDevelopment?: { caregiver?: CaregiverState } };
      const nextResponses = next.earlyDevelopment?.caregiver?.responses || responses;
      setResponses(nextResponses);
      setAnswer('');
      setNote('');
      onUpdated(result.data);
      if (index < qs.length - 1) setIndex((current) => current + 1); else onBack();
    } catch {
      setError('Veli görüşmesi kaydedilemedi. Önceki yanıtlar korunur; yeniden deneyin.');
    } finally {
      setBusy(false);
    }
  }

  return <div className='early-shell'>
    <div className='early-progress-top'><div><strong>CZA Veli Gelişim Görüşmesi · {question.section}</strong><span>{completed}/{qs.length} · %{pct}</span></div><i><b style={{ width: pct + '%' }} /></i></div>
    <main className='early-main'><section className='early-task-card caregiver-card'>
      <button type='button' className='early-back' onClick={onBack}>← E2 ana ekranına dön</button>
      <div className='early-task-head'><div><span>VELİ GÖRÜŞMESİ {index + 1} / {qs.length}</span><h1>{question.label}</h1></div><b>{studentLabel}</b></div>
      <div className='caregiver-section-map'>{sections.map((section) => <span className={section === question.section ? 'active' : ''} key={section}>{section.replace(/^\d+ · /, '')}</span>)}</div>
      {options(question).length > 0 ? <div className='early-rating caregiver-options'>{options(question).map((value) => <button type='button' className={answer === value ? 'active' : ''} key={value} onClick={() => setAnswer(value)}><strong>{value}</strong></button>)}</div> : question.kind === 'number' ? <input className='caregiver-input' inputMode='decimal' value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder='Cevabı yazın' /> : <textarea className='caregiver-textarea' value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder='Kısa ve somut bir örnek yazabilirsiniz…' />}
      <label className='early-note'><span>Ek not <small>(isteğe bağlı)</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} placeholder='Gerekirse ortam, sıklık veya örnek ekleyin.' /></label>
      {question.redFlag && <div className='early-caution'><strong>Yönlendirme açısından önemli bilgi</strong><p>Bu yanıt tek başına tanı anlamına gelmez; gerekirse uygun sağlık/gelişim uzmanı değerlendirmesi düşünülür.</p></div>}
      {error && <div className='early-error'>{error}</div>}
      <div className='early-actions'><button type='button' className='early-skip' disabled={busy} onClick={() => void save('SKIP')}>Bilmiyorum / geç</button><button type='button' className='early-primary' disabled={!answer.trim() || busy} onClick={() => void save(answer)}>{busy ? 'Kaydediliyor…' : index === qs.length - 1 ? 'Kaydet ve görüşmeyi bitir' : 'Kaydet ve devam et →'}</button></div>
      <footer>Bu görüşme, çocuğun doğrudan performansını tamamlayan ayrı bir veri kaynağıdır; çocuk görevlerinin yerine geçmez.</footer>
    </section></main>
  </div>;
}

