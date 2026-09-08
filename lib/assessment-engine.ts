export type TaskRole = 'WARMUP' | 'ACADEMIC_ANCHOR' | 'CZA_PROBE' | 'TRANSFER' | 'SUPPORT_PROBE';
export type ResponseMode = 'SPEAK' | 'SELECT' | 'TEXT' | 'DRAW' | 'DRAG';

export type SkillId =
  | 'number_sense'
  | 'math_reasoning'
  | 'reading_fluency'
  | 'comprehension'
  | 'written_expression'
  | 'attention'
  | 'working_memory'
  | 'processing_speed'
  | 'visual_spatial'
  | 'pattern_reasoning'
  | 'problem_solving'
  | 'cognitive_flexibility'
  | 'verbal_expression'
  | 'self_regulation';

export type SkillCluster =
  | 'Akademik Temel'
  | 'Bilişsel İşlemleme'
  | 'Üst Düzey Düşünme'
  | 'Öz Düzenleme ve İfade';

export interface SkillDefinition {
  code: string;
  label: string;
  cluster: SkillCluster;
  description: string;
}

export const CZA_SKILL_CATALOG_VERSION = 'CZA_14_SKILLS_V1.0';

export type ObservationCode =
  | 'DIRECT_RECALL'
  | 'COUNTING'
  | 'FINGER_USE'
  | 'GROUPING_STRATEGY'
  | 'VISUAL_STRATEGY'
  | 'TRIAL_AND_ERROR'
  | 'PLANNED_RESPONSE'
  | 'IMPULSIVE_RESPONSE'
  | 'SELF_CORRECTION'
  | 'ASKED_FOR_HELP'
  | 'VERBAL_REASONING'
  | 'CHANGED_STRATEGY'
  | 'PERSEVERED'
  | 'GAVE_UP';

export interface SkillWeight { skillId: SkillId; weight: number }
export interface RubricDimension { id: string; label: string; max: number }

export interface AssessmentTask {
  id: string;
  groupId: string;
  role: TaskRole;
  title: string;
  childInstruction: string;
  educatorInstruction: string;
  responseModes: ResponseMode[];
  skillWeights: SkillWeight[];
  rubric: RubricDimension[];
  estimatedSeconds: number;
  next?: Partial<Record<'success' | 'support' | 'transfer', string>>;
}

export interface TaskAttempt {
  taskId: string;
  shownAt: number;
  firstActionAt?: number;
  completedAt?: number;
  answer?: string;
  answerChanges: number;
  supportLevel: 0 | 1 | 2 | 3 | 4 | 5;
  selfCorrected: boolean;
  observations: ObservationCode[];
  rubricScores: Record<string, number>;
}

export const skillCatalog: Record<SkillId, SkillDefinition> = {
  number_sense: {
    code: 'CZA-S01',
    label: 'Sayı ve Nicelik Duyusu',
    cluster: 'Akademik Temel',
    description: 'Sayıların büyüklüğünü, miktarı, basamak değerini ve sayılar arasındaki ilişkileri kavramsal olarak anlamlandırma.'
  },
  math_reasoning: {
    code: 'CZA-S02',
    label: 'Matematiksel Muhakeme ve İşlem Esnekliği',
    cluster: 'Akademik Temel',
    description: 'İşlemlerin anlamını kavrama, uygun strateji seçme, farklı çözüm yolları üretme ve matematiksel düşünceyi yeni duruma taşıma.'
  },
  reading_fluency: {
    code: 'CZA-S03',
    label: 'Okuma Doğruluğu ve Akıcılığı',
    cluster: 'Akademik Temel',
    description: 'Yaşa ve öğretim düzeyine uygun metni doğru, anlaşılır ve giderek otomatikleşen biçimde okuyabilme.'
  },
  comprehension: {
    code: 'CZA-S04',
    label: 'Anlama ve Çıkarım',
    cluster: 'Akademik Temel',
    description: 'Okunan veya dinlenen bilgiyi anlama, neden-sonuç kurma, örtük bilgiyi çıkarma ve bilgiyi yeni bağlama aktarma.'
  },
  written_expression: {
    code: 'CZA-S05',
    label: 'Yazılı İfade',
    cluster: 'Akademik Temel',
    description: 'Düşünceyi yaş düzeyine uygun sözcük, cümle ve yazılı anlatım yoluyla anlaşılır biçimde ifade etme.'
  },
  attention: {
    code: 'CZA-S06',
    label: 'Seçici ve Sürdürülen Dikkat',
    cluster: 'Bilişsel İşlemleme',
    description: 'Hedef uyaranı seçme, dikkat dağıtıcıları baskılama ve görev boyunca odağı yeterli süre koruma.'
  },
  working_memory: {
    code: 'CZA-S07',
    label: 'Çalışma Belleği',
    cluster: 'Bilişsel İşlemleme',
    description: 'Bilgiyi kısa süre zihinde tutma, sırasını koruma ve gerektiğinde zihinsel olarak işleyip dönüştürme.'
  },
  processing_speed: {
    code: 'CZA-S08',
    label: 'İşlemleme Hızı ve Hız-Doğruluk Dengesi',
    cluster: 'Bilişsel İşlemleme',
    description: 'Basit veya öğrenilmiş bilgiyi uygun hızda işleme; hız artarken doğruluk ve kontrolü koruyabilme.'
  },
  visual_spatial: {
    code: 'CZA-S09',
    label: 'Görsel-Uzamsal İşlemleme',
    cluster: 'Bilişsel İşlemleme',
    description: 'Şekil, konum, yön, parça-bütün ve mekânsal ilişkileri zihinde temsil etme ve kullanma.'
  },
  pattern_reasoning: {
    code: 'CZA-S10',
    label: 'Mantıksal Örüntü ve Kural Çıkarma',
    cluster: 'Üst Düzey Düşünme',
    description: 'Diziler, ilişkiler ve ipuçları içinden düzeni fark etme, kuralı çıkarma ve gerekçelendirme.'
  },
  problem_solving: {
    code: 'CZA-S11',
    label: 'Problem Çözme ve Strateji Kurma',
    cluster: 'Üst Düzey Düşünme',
    description: 'Problemi tanımlama, plan yapma, uygun strateji seçme, sonucu kontrol etme ve gerektiğinde yöntemi değiştirme.'
  },
  cognitive_flexibility: {
    code: 'CZA-S12',
    label: 'Bilişsel Esneklik ve Yaratıcı Üretim',
    cluster: 'Üst Düzey Düşünme',
    description: 'Tek bir çözüme takılmadan alternatif üretme, kural değişimine uyum sağlama ve özgün fakat işe yarar fikirler geliştirme.'
  },
  verbal_expression: {
    code: 'CZA-S13',
    label: 'Sözel İfade ve Gerekçelendirme',
    cluster: 'Öz Düzenleme ve İfade',
    description: 'Düşünceyi sözlü olarak açık, bağlantılı ve gerekçeli biçimde ifade etme; nasıl düşündüğünü anlatabilme.'
  },
  self_regulation: {
    code: 'CZA-S14',
    label: 'Öz Düzenleme ve Yürütücü Kontrol',
    cluster: 'Öz Düzenleme ve İfade',
    description: 'Göreve başlama, planlama, dürtüyü kontrol etme, hatayı fark edip düzeltme, sebat etme ve yardım ihtiyacını uygun biçimde yönetme.'
  },
};

const warmRubric: RubricDimension[] = [
  { id: 'participation', label: 'Katılım', max: 3 },
  { id: 'explanation', label: 'Açıklama', max: 3 },
  { id: 'reasoning', label: 'Gerekçelendirme', max: 3 },
  { id: 'comfort', label: 'Rahatlık', max: 3 },
];

export const warmupTasks: AssessmentTask[] = [
  {
    id: 'WARM-01A', groupId: 'WARM-01', role: 'WARMUP', title: 'Bugünkü İç Havam',
    childInstruction: 'Bugün kendini nasıl hissediyorsun?',
    educatorInstruction: 'Cevabı düzeltme veya yönlendirme. Çocuğun kendiliğinden ne kadar açıldığını gözle.',
    responseModes: ['SPEAK', 'SELECT'], estimatedSeconds: 35,
    skillWeights: [{ skillId: 'verbal_expression', weight: .45 }, { skillId: 'self_regulation', weight: .35 }, { skillId: 'attention', weight: .20 }],
    rubric: warmRubric, next: { success: 'WARM-01B' },
  },
  {
    id: 'WARM-01B', groupId: 'WARM-01', role: 'CZA_PROBE', title: 'Havan Bir Şeye Dönüşse',
    childInstruction: 'Bugünkü halin bir renk ya da hava durumu olsaydı ne olurdu? Neden?',
    educatorInstruction: 'Sembolik anlatım, gerekçe ve kendini ifade etme biçimini gözle.',
    responseModes: ['SPEAK'], estimatedSeconds: 55,
    skillWeights: [{ skillId: 'verbal_expression', weight: .40 }, { skillId: 'cognitive_flexibility', weight: .35 }, { skillId: 'self_regulation', weight: .25 }],
    rubric: warmRubric,
  },
  {
    id: 'WARM-02A', groupId: 'WARM-02', role: 'WARMUP', title: 'Bende Sevdiğim Şey',
    childInstruction: 'Kendinde sevdiğin bir özelliğini söyler misin?',
    educatorInstruction: 'Örnek vermesini istemeden önce ilk cevabı kaydet.',
    responseModes: ['SPEAK'], estimatedSeconds: 35,
    skillWeights: [{ skillId: 'verbal_expression', weight: .50 }, { skillId: 'self_regulation', weight: .50 }], rubric: warmRubric, next: { success: 'WARM-02B' },
  },
  {
    id: 'WARM-02B', groupId: 'WARM-02', role: 'CZA_PROBE', title: 'Gücüm Ne Zaman Ortaya Çıkıyor?',
    childInstruction: 'Bu özelliğinin en çok ortaya çıktığı bir anı anlatabilir misin?',
    educatorInstruction: 'Somut örnekleme, olay sırası ve gerekçelendirmeyi gözle.',
    responseModes: ['SPEAK'], estimatedSeconds: 60,
    skillWeights: [{ skillId: 'verbal_expression', weight: .45 }, { skillId: 'working_memory', weight: .20 }, { skillId: 'self_regulation', weight: .35 }], rubric: warmRubric,
  },
  {
    id: 'WARM-03A', groupId: 'WARM-03', role: 'WARMUP', title: 'Ben Nasıl Daha İyi Öğreniyorum?',
    childInstruction: 'Bir şeyi öğrenirken sana en çok ne yardım eder?',
    educatorInstruction: 'Çocuğun kendi öğrenme davranışını fark edip etmediğini gözle.',
    responseModes: ['SPEAK', 'SELECT'], estimatedSeconds: 40,
    skillWeights: [{ skillId: 'self_regulation', weight: .50 }, { skillId: 'verbal_expression', weight: .30 }, { skillId: 'attention', weight: .20 }], rubric: warmRubric, next: { success: 'WARM-03B' },
  },
  {
    id: 'WARM-03B', groupId: 'WARM-03', role: 'CZA_PROBE', title: 'Öğrenme Yolumu Seçiyorum',
    childInstruction: 'Bakmak, dinlemek, denemek veya birine anlatmak... Hangisi sana daha çok yardım eder? Neden?',
    educatorInstruction: 'Tercihten çok gerekçeyi ve önceki deneyimle bağlantıyı değerlendir.',
    responseModes: ['SPEAK'], estimatedSeconds: 55,
    skillWeights: [{ skillId: 'self_regulation', weight: .45 }, { skillId: 'verbal_expression', weight: .35 }, { skillId: 'cognitive_flexibility', weight: .20 }], rubric: warmRubric,
  },
  {
    id: 'WARM-04A', groupId: 'WARM-04', role: 'WARMUP', title: 'Zor Gelirse Ne Yaparım?',
    childInstruction: 'Bir soru zor gelirse genelde ne yaparsın?',
    educatorInstruction: 'Sebat, yardım isteme ve kaçınma ifadelerini yargılamadan kaydet.',
    responseModes: ['SPEAK'], estimatedSeconds: 40,
    skillWeights: [{ skillId: 'self_regulation', weight: .60 }, { skillId: 'problem_solving', weight: .25 }, { skillId: 'verbal_expression', weight: .15 }], rubric: warmRubric, next: { success: 'WARM-04B' },
  },
  {
    id: 'WARM-04B', groupId: 'WARM-04', role: 'CZA_PROBE', title: 'B Planım',
    childInstruction: 'İlk denediğin yol işe yaramazsa ikinci olarak ne yaparsın?',
    educatorInstruction: 'Strateji değiştirme ve alternatif üretme kanıtını kaydet.',
    responseModes: ['SPEAK'], estimatedSeconds: 55,
    skillWeights: [{ skillId: 'problem_solving', weight: .35 }, { skillId: 'cognitive_flexibility', weight: .35 }, { skillId: 'self_regulation', weight: .30 }], rubric: warmRubric,
  },
  {
    id: 'WARM-05A', groupId: 'WARM-05', role: 'WARMUP', title: 'Bir Gün Öğretmen Olsam',
    childInstruction: 'Bir gün öğretmen olsan ne öğretmek isterdin?',
    educatorInstruction: 'İlgi alanını ve anlatımın kendiliğindenliğini gözle.',
    responseModes: ['SPEAK'], estimatedSeconds: 40,
    skillWeights: [{ skillId: 'verbal_expression', weight: .45 }, { skillId: 'cognitive_flexibility', weight: .35 }, { skillId: 'self_regulation', weight: .20 }], rubric: warmRubric, next: { success: 'WARM-05B' },
  },
  {
    id: 'WARM-05B', groupId: 'WARM-05', role: 'CZA_PROBE', title: 'Bunu Nasıl Öğretirdin?',
    childInstruction: 'Bunu başka bir çocuğa en güzel nasıl öğretirdin?',
    educatorInstruction: 'Planlama, perspektif alma, yöntem üretme ve açıklama kalitesini gözle.',
    responseModes: ['SPEAK', 'DRAW'], estimatedSeconds: 70,
    skillWeights: [{ skillId: 'cognitive_flexibility', weight: .35 }, { skillId: 'problem_solving', weight: .25 }, { skillId: 'verbal_expression', weight: .20 }, { skillId: 'self_regulation', weight: .20 }], rubric: warmRubric,
  },
];

export function createAttempt(taskId: string): TaskAttempt {
  return { taskId, shownAt: Date.now(), answerChanges: 0, supportLevel: 0, selfCorrected: false, observations: [], rubricScores: {} };
}

export function responseLatency(attempt: TaskAttempt) {
  return attempt.firstActionAt ? Math.max(0, attempt.firstActionAt - attempt.shownAt) : null;
}

export function totalResponseTime(attempt: TaskAttempt) {
  return attempt.completedAt ? Math.max(0, attempt.completedAt - attempt.shownAt) : null;
}

export function skillEvidence(attempts: TaskAttempt[], tasks: AssessmentTask[] = warmupTasks) {
  const totals = new Map<SkillId, { earned: number; possible: number; evidence: number }>();
  for (const attempt of attempts) {
    const task = tasks.find((item) => item.id === attempt.taskId);
    if (!task) continue;
    const rubricEarned = task.rubric.reduce((sum, item) => sum + Math.min(item.max, Math.max(0, attempt.rubricScores[item.id] ?? 0)), 0);
    const rubricPossible = task.rubric.reduce((sum, item) => sum + item.max, 0) || 1;
    const independenceFactor = 1 - attempt.supportLevel * .08;
    const normalized = (rubricEarned / rubricPossible) * Math.max(.6, independenceFactor);
    for (const sw of task.skillWeights) {
      const current = totals.get(sw.skillId) ?? { earned: 0, possible: 0, evidence: 0 };
      current.earned += normalized * sw.weight;
      current.possible += sw.weight;
      current.evidence += 1;
      totals.set(sw.skillId, current);
    }
  }
  return [...totals.entries()].map(([skillId, value]) => ({
    skillId,
    score: value.possible ? Math.round((value.earned / value.possible) * 100) : 0,
    evidenceCount: value.evidence,
  }));
}
