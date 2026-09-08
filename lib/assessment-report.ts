import type { AssessmentTask, SkillId } from './assessment-engine';
import { skillCatalog } from './assessment-engine';
import type { LearningResponseSummary } from './assessment-learning-response';

export interface ReportAttempt {
  id?: string;
  task_code: string;
  support_level?: number | null;
  rubric_scores?: Record<string, number> | null;
  answer_payload?: Record<string, unknown> | null;
  response_latency_ms?: number | null;
  total_response_time_ms?: number | null;
  answer_changes?: number | null;
  self_corrected?: boolean | null;
}

export interface ReportObservation {
  task_code: string;
  observation_codes?: string[] | null;
  educator_note?: string | null;
  confidence?: number | null;
}

export interface SkillReport {
  skillId: SkillId;
  label: string;
  cluster: string;
  score: number | null;
  evidenceCount: number;
  groupCount: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  status: 'RELATIVE_STRENGTH' | 'DEVELOPING' | 'NEEDS_SUPPORT' | 'INSUFFICIENT';
  supportRate: number;
}

export interface MathFamilyReport {
  groupId: string;
  label: string;
  initial: 'correct' | 'incorrect' | 'review' | 'not_seen';
  supportTriggered: boolean;
  transferScore: number | null;
  strategyScore: number | null;
  independenceScore: number | null;
  interpretation: string;
}

export interface StrategyProfile {
  planned: number;
  verbalReasoning: number;
  selfCorrection: number;
  changedStrategy: number;
  perseverance: number;
  helpSeeking: number;
  impulsive: number;
  trialAndError: number;
  visualStrategy: number;
  topSignals: string[];
}

export interface CzaAssessmentReport {
  version: number;
  generatedAt: string;
  evidenceCoverage: number;
  evidenceNote: string;
  skills: SkillReport[];
  strengths: SkillReport[];
  developing: SkillReport[];
  needsSupport: SkillReport[];
  math: {
    families: MathFamilyReport[];
    summary: string;
  };
  learningResponse: LearningResponseSummary;
  strategyProfile: StrategyProfile;
  process: {
    averageFirstResponseMs: number | null;
    averageTotalResponseMs: number | null;
    selfCorrectionCount: number;
    supportTaskCount: number;
    completedTaskCount: number;
  };
  educatorNotes: string[];
  parentSummary: string[];
  recommendations: string[];
  cautions: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function rubricPercent(attempt: ReportAttempt, task: AssessmentTask) {
  const scores = attempt.rubric_scores || {};
  const scored = task.rubric
    .map((dimension) => ({ dimension, value: scores[dimension.id] }))
    .filter((item) => typeof item.value === 'number' && Number.isFinite(item.value));
  if (!scored.length) return null;
  const earned = scored.reduce((sum, item) => sum + Number(item.value), 0);
  const possible = scored.reduce((sum, item) => sum + item.dimension.max, 0);
  return possible ? clamp((earned / possible) * 100) : null;
}

function routeScore(attempt: ReportAttempt) {
  const value = attempt.answer_payload?.routeCorrectness;
  if (value === 'correct') return 100;
  if (value === 'incorrect') return 0;
  return null;
}

function attemptEvidenceScore(attempt: ReportAttempt, task: AssessmentTask) {
  const base = routeScore(attempt) ?? rubricPercent(attempt, task);
  if (base == null) return null;
  const support = Math.max(0, Math.min(5, Number(attempt.support_level ?? 0)));
  const independenceFactor = Math.max(0.62, 1 - support * 0.075);
  return Math.round(base * independenceFactor);
}

function mean(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!valid.length) return null;
  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function confidenceFor(evidenceCount: number, groupCount: number): SkillReport['confidence'] {
  if (evidenceCount < 2 || groupCount < 2) return 'INSUFFICIENT';
  if (evidenceCount >= 6 && groupCount >= 4) return 'HIGH';
  if (evidenceCount >= 4 && groupCount >= 3) return 'MEDIUM';
  return 'LOW';
}

function statusFor(score: number | null, confidence: SkillReport['confidence']): SkillReport['status'] {
  if (score == null || confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (score >= 78) return 'RELATIVE_STRENGTH';
  if (score >= 55) return 'DEVELOPING';
  return 'NEEDS_SUPPORT';
}

function buildSkillReports(attempts: ReportAttempt[], tasks: AssessmentTask[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const buckets = new Map<SkillId, Array<{ score: number; groupId: string; support: boolean; weight: number }>>();

  for (const attempt of attempts) {
    const task = taskById.get(attempt.task_code);
    if (!task) continue;
    const score = attemptEvidenceScore(attempt, task);
    if (score == null) continue;
    for (const mapping of task.skillWeights) {
      const bucket = buckets.get(mapping.skillId) ?? [];
      bucket.push({ score, groupId: task.groupId, support: Number(attempt.support_level ?? 0) > 0 || task.role === 'SUPPORT_PROBE', weight: mapping.weight });
      buckets.set(mapping.skillId, bucket);
    }
  }

  return (Object.keys(skillCatalog) as SkillId[]).map((skillId): SkillReport => {
    const evidence = buckets.get(skillId) ?? [];
    const groups = new Set(evidence.map((item) => item.groupId));
    const totalWeight = evidence.reduce((sum, item) => sum + item.weight, 0);
    const score = totalWeight
      ? Math.round(evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight)
      : null;
    const confidence = confidenceFor(evidence.length, groups.size);
    return {
      skillId,
      label: skillCatalog[skillId].label,
      cluster: skillCatalog[skillId].cluster,
      score,
      evidenceCount: evidence.length,
      groupCount: groups.size,
      confidence,
      status: statusFor(score, confidence),
      supportRate: evidence.length ? Math.round((evidence.filter((item) => item.support).length / evidence.length) * 100) : 0,
    };
  });
}

const mathFamilyLabels: Record<string, string> = {
  'MAT-01': 'Basamak değeri ve sayı yapısı',
  'MAT-02': 'Toplama ve strateji esnekliği',
  'MAT-03': 'Çıkarma ve eksiltme kavramı',
  'MAT-04': 'Sayı karşılaştırma',
  'MAT-05': 'Örüntü ve kural çıkarma',
  'MAT-06': 'Eşitlik ve eksik sayı',
  'MAT-07': 'Problem çözme',
  'MAT-08': 'Görsel-uzamsal geometri',
};

function preferredRubric(attempt: ReportAttempt | undefined, task: AssessmentTask | undefined, ids: string[]) {
  if (!attempt || !task) return null;
  const scores = attempt.rubric_scores || {};
  for (const id of ids) {
    const dimension = task.rubric.find((item) => item.id === id);
    const value = scores[id];
    if (dimension && typeof value === 'number' && Number.isFinite(value)) {
      return Math.round(clamp((value / Math.max(1, dimension.max)) * 100));
    }
  }
  return null;
}

function buildMathReport(attempts: ReportAttempt[], tasks: AssessmentTask[]) {
  const attemptsByTask = new Map<string, ReportAttempt>();
  for (const attempt of attempts) attemptsByTask.set(attempt.task_code, attempt);
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const families: MathFamilyReport[] = [];

  for (const groupId of Object.keys(mathFamilyLabels)) {
    const groupTasks = tasks.filter((task) => task.groupId === groupId);
    const anchor = groupTasks.find((task) => task.role === 'ACADEMIC_ANCHOR');
    const support = groupTasks.find((task) => task.role === 'SUPPORT_PROBE');
    const transfer = groupTasks.find((task) => task.role === 'TRANSFER');
    const anchorAttempt = anchor ? attemptsByTask.get(anchor.id) : undefined;
    const supportAttempt = support ? attemptsByTask.get(support.id) : undefined;
    const transferAttempt = transfer ? attemptsByTask.get(transfer.id) : undefined;
    const correctness = anchorAttempt?.answer_payload?.routeCorrectness;
    const initial: MathFamilyReport['initial'] = !anchorAttempt ? 'not_seen' : correctness === 'correct' ? 'correct' : correctness === 'incorrect' ? 'incorrect' : 'review';
    const transferScore = preferredRubric(transferAttempt, transfer ? taskById.get(transfer.id) : undefined, ['transfer', 'accuracy', 'strategy']);
    const strategyScore = mean(groupTasks.map((task) => preferredRubric(attemptsByTask.get(task.id), task, ['strategy'])));
    const independenceScore = mean(groupTasks
      .map((task) => attemptsByTask.get(task.id))
      .filter(Boolean)
      .map((attempt) => Math.round(100 - Math.max(0, Math.min(5, Number(attempt?.support_level ?? 0))) * 14)));
    const supportTriggered = Boolean(anchorAttempt?.answer_payload?.supportTriggered) || Boolean(supportAttempt);

    let interpretation = 'Bu alan için henüz yeterli görev tamamlanmadı.';
    if (initial === 'correct' && !supportTriggered && (transferScore == null || transferScore >= 65)) {
      interpretation = 'Tanıdık akademik düzey bağımsız görünüyor; yeni duruma taşıma kanıtı da olumlu.';
    } else if (initial === 'incorrect' && supportAttempt && (transferScore ?? 0) >= 65) {
      interpretation = 'İlk sembolik/akademik yanıtta zorlanma görüldü; destekten sonra yeni duruma taşıma belirgin. Kavramın öğrenilebilirliği güçlü.';
    } else if (initial === 'incorrect' && supportAttempt && transferScore == null) {
      interpretation = 'İlk yanıtta zorlanma sonrası destek görevi açıldı. Transfer rubriği tamamlanmadan kesin yorum yapılmamalı.';
    } else if (initial === 'incorrect' && (transferScore ?? 100) < 55) {
      interpretation = 'Başlangıçta ve transferde zorlanma işareti var; öğretimsel destek ve yeniden örnekleme önerilir.';
    } else if (initial === 'review') {
      interpretation = 'Yanıt otomatik sınıflanamadı; eğitmen rubriği ve sözlü açıklama belirleyici olmalı.';
    }

    families.push({
      groupId,
      label: mathFamilyLabels[groupId],
      initial,
      supportTriggered,
      transferScore,
      strategyScore,
      independenceScore,
      interpretation,
    });
  }

  const seen = families.filter((family) => family.initial !== 'not_seen');
  const supportCount = seen.filter((family) => family.supportTriggered).length;
  const transferStrong = seen.filter((family) => (family.transferScore ?? 0) >= 70).length;
  const summary = !seen.length
    ? 'Matematik derin taraması henüz başlamadı.'
    : supportCount === 0 && transferStrong >= Math.max(2, Math.ceil(seen.length / 2))
      ? 'Matematikte tanıdık görevlerden yeni durumlara geçiş genel olarak bağımsız ve güçlü görünüyor.'
      : supportCount > 0 && transferStrong >= Math.max(1, supportCount)
        ? 'Bazı matematik alanlarında ilk performans dalgalı olsa da destek sonrası transfer olumlu; başlangıç hataları tek başına kavramsal yetersizlik olarak yorumlanmamalı.'
        : 'Matematik profili alanlara göre farklılaşıyor; özellikle destek açılan görev aileleri öğretim planında ayrı izlenmeli.';

  return { families, summary };
}

function buildStrategyProfile(observations: ReportObservation[]): StrategyProfile {
  const counts = new Map<string, number>();
  for (const observation of observations) {
    for (const code of observation.observation_codes || []) counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const value = (code: string) => counts.get(code) ?? 0;
  const labels: Array<[string, string]> = [
    ['PLANNED_RESPONSE', 'Planlı ilerleme'],
    ['VERBAL_REASONING', 'Düşünceyi sözelleştirme'],
    ['SELF_CORRECTION', 'Öz-düzeltme'],
    ['CHANGED_STRATEGY', 'Strateji değiştirme'],
    ['PERSEVERED', 'Sebat'],
    ['VISUAL_STRATEGY', 'Görsel strateji'],
    ['TRIAL_AND_ERROR', 'Deneme-yanılma'],
    ['ASKED_FOR_HELP', 'Uygun yardım isteme'],
  ];
  const topSignals = labels
    .map(([code, label]) => ({ label, count: value(code) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map((item) => `${item.label} (${item.count})`);
  return {
    planned: value('PLANNED_RESPONSE'),
    verbalReasoning: value('VERBAL_REASONING'),
    selfCorrection: value('SELF_CORRECTION'),
    changedStrategy: value('CHANGED_STRATEGY'),
    perseverance: value('PERSEVERED'),
    helpSeeking: value('ASKED_FOR_HELP'),
    impulsive: value('IMPULSIVE_RESPONSE'),
    trialAndError: value('TRIAL_AND_ERROR'),
    visualStrategy: value('VISUAL_STRATEGY'),
    topSignals,
  };
}

function buildParentSummary(skills: SkillReport[], learningResponse: LearningResponseSummary, mathSummary: string) {
  const strong = skills.filter((skill) => skill.status === 'RELATIVE_STRENGTH').slice(0, 3);
  const developing = skills.filter((skill) => skill.status === 'DEVELOPING').slice(0, 3);
  const needs = skills.filter((skill) => skill.status === 'NEEDS_SUPPORT').slice(0, 2);
  const lines: string[] = [];
  if (strong.length) lines.push(`Göreli olarak güçlü görünen alanlar: ${strong.map((item) => item.label).join(', ')}.`);
  if (developing.length) lines.push(`Gelişimi devam eden ve uygun görevlerle güçlenebilecek alanlar: ${developing.map((item) => item.label).join(', ')}.`);
  if (needs.length) lines.push(`Daha yapılandırılmış öğretim ve tekrar örneklemesi önerilen alanlar: ${needs.map((item) => item.label).join(', ')}.`);
  if (learningResponse.index != null) lines.push(`Öğrenme tepkisi: ${learningResponse.label} (indeks ${learningResponse.index}/100). Bu değer başlangıç performansı, destek ve bağımsız transfer birlikte değerlendirilerek hesaplanır.`);
  lines.push(mathSummary);
  return lines;
}

function buildRecommendations(skills: SkillReport[], learningResponse: LearningResponseSummary, strategy: StrategyProfile) {
  const recommendations: string[] = [];
  const needs = skills.filter((skill) => skill.status === 'NEEDS_SUPPORT');
  if (needs.length) recommendations.push(`${needs.slice(0, 3).map((item) => item.label).join(', ')} alanlarında kısa, somut ve kademeli çalışmalar planlanmalı; aynı beceri farklı görev türleriyle yeniden örneklenmeli.`);
  if (learningResponse.responsiveFamilies > 0) recommendations.push('İpucu sonrası hızlı toparlanan alanlarda sonucu söylemek yerine küçük ipucu → yeniden deneme → yeni transfer görevi döngüsü kullanılmalı.');
  if (strategy.selfCorrection > 0 || strategy.changedStrategy > 0) recommendations.push('Öz-düzeltme ve strateji değiştirme davranışı görünür biçimde pekiştirilmeli; “hangi yolu değiştirdin?” türü kısa yansıtma soruları kullanılmalı.');
  if (strategy.impulsive > strategy.planned && strategy.impulsive > 0) recommendations.push('Hız yerine önce planlama vurgulanmalı; cevap öncesi kısa kontrol rutini kullanılabilir.');
  if (!recommendations.length) recommendations.push('Mevcut profili doğrulamak için farklı gün ve görev türlerinde ek kanıt toplanması önerilir.');
  return recommendations;
}

export function generateAssessmentReport(
  attempts: ReportAttempt[],
  observations: ReportObservation[],
  tasks: AssessmentTask[],
  learningResponse: LearningResponseSummary,
): CzaAssessmentReport {
  const skills = buildSkillReports(attempts, tasks);
  const scorable = skills.filter((skill) => skill.score != null);
  const adequate = skills.filter((skill) => skill.confidence !== 'INSUFFICIENT');
  const evidenceCoverage = Math.round((adequate.length / Math.max(1, skills.length)) * 100);
  const math = buildMathReport(attempts, tasks);
  const strategyProfile = buildStrategyProfile(observations);
  const averageFirstResponseMs = mean(attempts.map((attempt) => attempt.response_latency_ms));
  const averageTotalResponseMs = mean(attempts.map((attempt) => attempt.total_response_time_ms));
  const educatorNotes = observations
    .map((observation) => observation.educator_note?.trim())
    .filter((note): note is string => Boolean(note));
  const strengths = skills.filter((skill) => skill.status === 'RELATIVE_STRENGTH').sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const developing = skills.filter((skill) => skill.status === 'DEVELOPING').sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const needsSupport = skills.filter((skill) => skill.status === 'NEEDS_SUPPORT').sort((a, b) => (a.score ?? 100) - (b.score ?? 100));
  const evidenceNote = evidenceCoverage >= 75
    ? 'Beceri profili birden fazla görev ailesinden yeterli kanıt içeriyor; yine de tek oturumluk değerlendirme kalıcı etiket olarak kullanılmamalıdır.'
    : evidenceCoverage >= 45
      ? 'Profil kısmen oluştu. Bazı beceriler için farklı görevlerden ek kanıt toplanmadan güçlü sonuç çıkarılmamalıdır.'
      : 'Kanıt kapsamı henüz düşük. Bu rapor ön gözlem niteliğindedir ve beceri puanları kesin sonuç olarak yorumlanmamalıdır.';

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    evidenceCoverage,
    evidenceNote,
    skills,
    strengths,
    developing,
    needsSupport,
    math,
    learningResponse,
    strategyProfile,
    process: {
      averageFirstResponseMs,
      averageTotalResponseMs,
      selfCorrectionCount: attempts.filter((attempt) => Boolean(attempt.self_corrected)).length,
      supportTaskCount: attempts.filter((attempt) => Number(attempt.support_level ?? 0) > 0).length,
      completedTaskCount: attempts.length,
    },
    educatorNotes,
    parentSummary: buildParentSummary(skills, learningResponse, math.summary),
    recommendations: buildRecommendations(skills, learningResponse, strategyProfile),
    cautions: [
      'Bu değerlendirme bir klinik tanı veya zekâ testi değildir.',
      'Bir beceri tek soruya göre düşük ya da yüksek olarak etiketlenmez; rapor çoklu kanıt mantığı kullanır.',
      'Sözlü ve açık uçlu görevlerde eğitmen rubriği tamamlanmadıysa sistem bilinmeyen alanı otomatik başarısızlık olarak kabul etmez.',
      'Çocuğun performansı yorgunluk, çevrim içi ortam, motivasyon ve yönerge koşullarından etkilenebilir.',
    ],
  };
}
