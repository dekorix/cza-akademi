import type { SpecialLearningProfile, SpecialLearningStatus } from './special-learning-profile';

export type SpecialProgramPriority = {
  key: string;
  label: string;
  status: SpecialLearningStatus;
  objective: string;
  successCriterion: string;
  activities: string[];
};

export type SpecialEducationProgramDraft = {
  profileCode: string;
  profileLabel: string;
  assessmentSessionId: string;
  durationWeeks: 4;
  sessionsPerWeek: number;
  sessionMinutes: number;
  selectedPriorityKeys: string[];
  priorities: SpecialProgramPriority[];
  weeks: {
    week: 1 | 2 | 3 | 4;
    focus: string;
    educatorAction: string;
    measurement: string;
  }[];
  reassessment: {
    week: 4;
    rule: string;
  };
  note: string;
};

const activityBank: Record<string, string[]> = {
  phonological: ['Sesi çıkar/değiştir çalışmaları', 'Ses segmentleme ve birleştirme', 'Uydurma sözcüklerle transfer'],
  letter_sound: ['Harf-ses hızlı erişim', 'Benzer harf çiftlerini kontrollü ayırt etme', 'Büyük-küçük harf transferi'],
  orthographic: ['Yakın görsel biçimleri ayırt etme', 'Harf/sıra değişimini fark etme', 'Kısa gecikmeli kelime biçimi hatırlama'],
  blending: ['Ses köprüsü', 'Hece birleştirme', 'Yeni hece yapısına transfer'],
  decoding: ['Gerçek ve uydurma kelime çözümleme', 'Tahminsiz ses-harf yolu', 'Yeni kelimede strateji açıklama'],
  ran: ['Renk/şekil/harf hızlı isimlendirme', 'Hata oluşturmadan akıcılık', 'Kısa seri tekrarları'],
  working_memory: ['İşitsel dizi tutma', '2-3 adımlı yönerge', 'Ses sırasını koruma'],
  fluency: ['Doğruluk öncelikli tekrar okuma', 'Kısa metin akıcılığı', 'Satır takibi ve öz-düzeltme'],
  comprehension: ['Dinleme-okuma karşılaştırması', 'Kısa 5N1K', 'Ana fikir ve kanıt bulma'],
  dictation: ['Ses-hece-kelime diktesi', 'Kendi yazısını geri okuma', 'Hata dedektifi'],
  error_awareness: ['Hatasını bulma', 'Neden yanlış olduğunu açıklama', 'Kendi düzeltmesini yapma'],
  learning_transfer: ['Model sonrası farklı örnek', 'İpucunu azaltarak tekrar', 'Yeni durumda transfer'],
};

function genericActivities(label: string) {
  return [
    `${label} için düşük yükle bağımsız deneme`,
    `${label} için nötr ipucuyla destekli tekrar`,
    `${label} becerisini farklı bir durumda transfer etme`,
  ];
}

function objectiveFor(label: string, status: SpecialLearningStatus) {
  if (status === 'EXPERT_REVIEW') return `${label} alanındaki işlevsel güçlüğü yapılandırılmış destekle azaltmak ve öğrenme tepkisini görünür kılmak.`;
  if (status === 'PRIORITY') return `${label} alanında bağımsız doğruluk ve strateji kullanımını artırmak.`;
  if (status === 'WATCH') return `${label} alanındaki karışık performansı netleştirmek ve daha kararlı bağımsız performans oluşturmak.`;
  return `${label} alanındaki göreli gücü diğer görevlerde destekleyici kaynak olarak kullanmak.`;
}

function criterionFor(status: SpecialLearningStatus) {
  if (status === 'EXPERT_REVIEW') return 'Aynı beceride en az 3 yeni görevde yardım düzeyinin azalması ve hata örüntüsünün seyrekleşmesi.';
  if (status === 'PRIORITY') return 'En az 3 yeni görevde çoğunlukla bağımsız veya tek nötr ipucuyla doğru/işlevsel performans.';
  if (status === 'WATCH') return 'İki farklı oturumda benzer görevlerde daha kararlı ve daha az destekli performans.';
  return 'Beceri farklı bir görevde korunuyor ve aşırı yardım gerektirmiyor.';
}

export function buildSpecialEducationProgramDraft(
  profile: SpecialLearningProfile,
  options: { sessionsPerWeek?: number; sessionMinutes?: number; selectedPriorityKeys?: string[] } = {},
): SpecialEducationProgramDraft {
  const available = profile.priorities.filter(priority => priority.status !== 'INSUFFICIENT');
  const requested = new Set(options.selectedPriorityKeys || available.slice(0, 3).map(priority => priority.key));
  const selected = available.filter(priority => requested.has(priority.key)).slice(0, 4);
  const priorities = (selected.length ? selected : available.slice(0, 3)).map(priority => ({
    key: priority.key,
    label: priority.label,
    status: priority.status,
    objective: objectiveFor(priority.label, priority.status),
    successCriterion: criterionFor(priority.status),
    activities: activityBank[priority.key] || genericActivities(priority.label),
  }));

  const sessionsPerWeek = Math.max(2, Math.min(5, Math.round(options.sessionsPerWeek || 3)));
  const sessionMinutes = Math.max(15, Math.min(45, Math.round(options.sessionMinutes || 25)));

  return {
    profileCode: profile.profileCode,
    profileLabel: profile.profileLabel,
    assessmentSessionId: profile.sessionId,
    durationWeeks: 4,
    sessionsPerWeek,
    sessionMinutes,
    selectedPriorityKeys: priorities.map(priority => priority.key),
    priorities,
    weeks: [
      { week: 1, focus: 'Taban performansı ve doğru strateji', educatorAction: 'Bağımsız deneme ile başla; yalnız gerektiğinde nötr ipucu ver.', measurement: 'İlk yanıt, süre, destek ve hata örüntüsünü kaydet.' },
      { week: 2, focus: 'Yapılandırılmış güçlendirme', educatorAction: 'Kısa tekrarlar ve kontrollü model kullan; yardım düzeyini mümkün olduğunca azalt.', measurement: 'Aynı beceride destek düzeyinin değişimini karşılaştır.' },
      { week: 3, focus: 'Bağımsızlık ve transfer', educatorAction: 'Benzer ama farklı örneklerde çocuğun stratejiyi kendisinin başlatmasını bekle.', measurement: 'Yeni örnekte ilk performans ve öz-düzeltmeyi kaydet.' },
      { week: 4, focus: 'Kalıcılık ve yeniden ölçüm', educatorAction: 'Öğretilmeyen yeni örneklerle kısa yeniden değerlendirme yap.', measurement: 'Başlangıç kanıtıyla doğruluk, destek, süre ve transferi karşılaştır.' },
    ],
    reassessment: {
      week: 4,
      rule: 'Plan sonunda aynı soruları ezberden tekrar etmek yerine aynı beceriyi ölçen yeni örneklerle yeniden ölçüm yapılır.',
    },
    note: 'Bu bireysel çalışma programı eğitimsel planlamadır; klinik tanı veya tedavi planı değildir. Eğitimci onayı olmadan öğrenci dosyasına atanmaz.',
  };
}
