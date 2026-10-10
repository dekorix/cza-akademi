export type CaregiverResponse = { questionId: string; answer: string; note?: string; recordedAt: string };
export type CaregiverState = { responses: CaregiverResponse[]; startedAt: string; completedAt?: string };
type Q = { id: string; section: string; label: string; redFlag?: boolean; priority?: boolean };
const q = (id: string, section: string, label: string, redFlag = false, priority = false): Q => ({ id, section, label, redFlag, priority });

export const caregiverQuestionsV4: Q[] = [
  q('CV4_RESPONDENT', '1 · Gelişim Bağlamı ve Sağlık', 'Bu görüşmede çocuğu günlük yaşamda en yakından gözleyen kişi kim?'),
  q('CV4_MAIN_REASON', '1 · Gelişim Bağlamı ve Sağlık', 'Bugün değerlendirmeye gelmenizin en önemli nedeni nedir?', false, true),
  q('CV4_HEARING', '1 · Gelişim Bağlamı ve Sağlık', 'Son dönemde sese tepki veya işitme ile ilgili bir kaygınız oldu mu?', true),
  q('CV4_VISION', '1 · Gelişim Bağlamı ve Sağlık', 'Görme, görsel takip ya da nesnelere çok yaklaşma konusunda bir kaygınız var mı?', true),
  q('CV4_REGRESSION', '1 · Gelişim Bağlamı ve Sağlık', 'Daha önce kullandığı bir sözcük, oyun, hareket veya sosyal beceride belirgin kayıp fark ettiniz mi?', true),
  q('CV4_FEEDING', '1 · Gelişim Bağlamı ve Sağlık', 'Çiğneme, yutma veya beslenme güvenliği konusunda sizi endişelendiren bir durum var mı?', true),
  q('CV4_SLEEP', '1 · Gelişim Bağlamı ve Sağlık', 'Uyku düzeni çocuğun gündüz dikkatini veya davranışını ne ölçüde etkiliyor?'),
  q('CV4_REQUEST', '2 · Evde İletişim Profili', 'Bir şey istediğinde en sık hangi yolu kullanıyor?'),
  q('CV4_NAME', '2 · Evde İletişim Profili', 'Adı söylendiğinde çoğu doğal durumda size yöneliyor mu?'),
  q('CV4_ONE_STEP', '2 · Evde İletişim Profili', 'Günlük yaşamda kısa yönergeleri çoğunlukla anlıyor mu?'),
  q('CV4_WORDS', '2 · Evde İletişim Profili', 'Kendiliğinden, yalnız taklit etmeden anlamlı sözcükler kullanıyor mu?'),
  q('CV4_COMBINE', '2 · Evde İletişim Profili', 'İki ya da daha fazla sözcüğü anlamlı biçimde bir araya getiriyor mu?'),
  q('CV4_SHARE', '2 · Evde İletişim Profili', 'Sadece istemek için değil, bir şeyi göstermek veya paylaşmak için iletişim başlatıyor mu?'),
  q('CV4_INTELLIG', '2 · Evde İletişim Profili', 'Tanıdık yetişkinler konuşmasının ne kadarını anlayabiliyor?'),
  q('CV4_IMITATE', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Sizin yaptığınız yeni bir hareketi veya oyuncak kullanımını taklit ediyor mu?'),
  q('CV4_FUNCPLAY', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Tanıdık oyuncakları işlevine uygun kullanıyor mu?'),
  q('CV4_PRETEND', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Mış gibi oyunlar görülüyor mu?'),
  q('CV4_TURN', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Kısa karşılıklı oyunları birkaç tur sürdürebiliyor mu?'),
  q('CV4_PEER', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Akranları gördüğünde izleme, yaklaşma veya oyuna katılma girişimi oluyor mu?'),
  q('CV4_LEARN', '3 · Oyun, Sosyal Katılım ve Öğrenme', 'Yeni bir şeyi en kolay nasıl öğreniyor?'),
  q('CV4_TRANSITION', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Sevdiği bir etkinlikten başka bir etkinliğe kısa hazırlıkla geçebiliyor mu?'),
  q('CV4_RECOVER', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Üzüldüğünde veya istediği olmadığında genellikle ne kadar destekle yeniden sakinleşiyor?'),
  q('CV4_SENSORY_AVOID', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Özellikle kaçındığı duyusal durumlar var mı?'),
  q('CV4_SENSORY_SEEK', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Belirgin duyusal arayış davranışları var mı ve günlük yaşamı etkiliyor mu?'),
  q('CV4_SCREEN', '4 · Dikkat, Düzenleme ve Duyusal İhtiyaçlar', 'Ekran günlük yaşamda nasıl bir yer tutuyor?'),
  q('CV4_EATDRINK', '5 · Günlük Yaşam ve Güvenlik', 'Yeme ve içmede bağımsızlığı hangi düzeyde?'),
  q('CV4_DRESS', '5 · Günlük Yaşam ve Güvenlik', 'Basit giyinme/çıkarma rutinlerine aktif katılıyor mu?'),
  q('CV4_HYGIENE', '5 · Günlük Yaşam ve Güvenlik', 'Kısa özbakım rutinlerine katılıyor mu?'),
  q('CV4_TOILET', '5 · Günlük Yaşam ve Güvenlik', 'Tuvalet farkındalığı şu anda hangi düzeyde?'),
  q('CV4_STOP', '5 · Günlük Yaşam ve Güvenlik', 'Güvenlik durumunda “dur” veya “bekle” gibi kısa işaretlere çoğunlukla tepki veriyor mu?'),
  q('CV4_STRENGTH', '6 · Aile Hedefleri ve Eğitim Planı', 'Çocuğunuzun şu anda en güçlü gördüğünüz üç özelliği nedir?'),
  q('CV4_MOTIVATE', '6 · Aile Hedefleri ve Eğitim Planı', 'Hangi oyuncaklar, etkinlikler veya sosyal oyunlar onu en çok motive ediyor?'),
  q('CV4_HARD_ROUTINE', '6 · Aile Hedefleri ve Eğitim Planı', 'Gün içinde en çok zorlandığınız rutin hangisi ve genellikle ne oluyor?', false, true),
  q('CV4_GOALS', '6 · Aile Hedefleri ve Eğitim Planı', 'Önümüzdeki üç ayda değişmesini en çok istediğiniz üç somut beceri nedir?', false, true),
  q('CV4_WORKS', '6 · Aile Hedefleri ve Eğitim Planı', 'Şimdiye kadar çocuğa yardımcı olduğunu fark ettiğiniz yaklaşım veya yöntemler neler?'),
  q('CV4_MOTOR_RISK', '7 · Yönlendirme İçin Kısa Güvenlik Kontrolü', 'Son dönemde belirgin güçsüzlük, yeni başlayan sık düşme veya motor beceride gerileme fark ettiniz mi?', true),
  q('CV4_SELF_HARM', '7 · Yönlendirme İçin Kısa Güvenlik Kontrolü', 'Kendine zarar verme veya ciddi güvenlik riski oluşturan bir davranış var mı?', true),
];

export const CAREGIVER_V4_IDS = new Set(caregiverQuestionsV4.map((question) => question.id));
export function isCaregiverV4Question(id: string) { return CAREGIVER_V4_IDS.has(id); }
export function buildCaregiverV4Report(state?: CaregiverState) {
  const responses = state?.responses || [];
  const byId = new Map(responses.map((response) => [response.questionId, response]));
  const sections = [...new Set(caregiverQuestionsV4.map((question) => question.section))].map((title) => ({ title, items: caregiverQuestionsV4.filter((question) => question.section === title).map((question) => ({ id: question.id, label: question.label, answer: byId.get(question.id)?.answer || '', note: byId.get(question.id)?.note || '' })) }));
  const yes = (value: string) => value.trim().toLocaleLowerCase('tr-TR') === 'evet';
  const redFlags = caregiverQuestionsV4.filter((question) => question.redFlag && yes(byId.get(question.id)?.answer || '')).map((question) => question.label);
  const priorities = caregiverQuestionsV4.filter((question) => question.priority).map((question) => byId.get(question.id)?.answer?.trim()).filter((value): value is string => Boolean(value && value !== 'SKIP'));
  return { answered: new Set(responses.map((response) => response.questionId)).size, total: caregiverQuestionsV4.length, completed: Boolean(state?.completedAt), completedAt: state?.completedAt || null, sections, redFlags, priorities };
}

