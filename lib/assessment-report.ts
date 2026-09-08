import type { AssessmentTask, SkillId } from './assessment-engine';
import { skillCatalog } from './assessment-engine';
import type { LearningResponseSummary } from './assessment-learning-response';

export type SkillEvidenceConfidence = 'INSUFFICIENT' | 'LOW' | 'MEDIUM' | 'HIGH';
export type SkillProfileStatus = 'RELATIVE_STRENGTH' | 'DEVELOPING' | 'NEEDS_SUPPORT' | 'INSUFFICIENT';

export interface ReportAttempt {
  id?: string;
  task_code: string;
  answer_text?: string | null;
  answer_payload?: Record<string, unknown> | null;
  rubric_scores?: Record<string, number> | null;
  support_level?: number | null;
  self_corrected?: boolean | null;
  response_latency_ms?: number | null;
  total_response_time_ms?: number | null;
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
  confidence: SkillEvidenceConfidence;
  status: SkillProfileStatus;
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
  persevered: number;
  helpSeeking: number;
  impulsive: number;
  trialAndError: number;
  visualStrategy: number;
  topSignals: string[];
}

export interface CzaAssessmentReport {
  version: number;
  evidenceCoverage: number;
  evidenceNote: string;
  skills: SkillReport[];
  strengths: SkillReport[];
  developing: SkillReport[];
  needsSupport: SkillReport[];
  learningResponse: LearningResponseSummary;
  math: {
    summary: string;
    families: MathFamilyReport[];
  };
  strategyProfile: StrategyProfile;
  process: {
    completedTaskCount: number;
    supportTaskCount: number;
    selfCorrectionCount: number;
    averageFirstResponseMs: number | null;
    averageTotalResponseMs: number | null;
  };
  parentSummary: string[];
  recommendations: string[];
  cautions: string[];
  educatorNotes: string[];
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: Array<number | null | undefined>) {
  const usable = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!usable.length) return null;
  return Math.round(usable.reduce((sum, value) => sum + value, 0) / usable.length);
}

function routeScore(attempt: ReportAttempt) {
  const correctness = attempt.answer_payload?.routeCorrectness;
  if (correctness === 'correct') return 100;
  if (correctness === 'incorrect') return 0;
  return null;
}

function rubricScore(attempt: ReportAttempt, task: AssessmentTask) {
  const scores = attempt.rubric_scores || {};
  let earned = 0;
  let possible = 0;
  for (const dimension of task.rubric) {
    const raw = scores[dimension.id];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
    earned += Math.min(dimension.max, Math.max(0, raw));
    possible += dimension.max;
  }
  return possible ? Math.round((earned / possible) * 100) : null;
}

function dimensionPercent(attempt: ReportAttempt | undefined, task: AssessmentTask | undefined, id: string) {
  if (!attempt || !task) return null;
  const dimension = task.rubric.find((item) => item.id === id);
  const raw = attempt.rubric_scores?.[id];
  if (!dimension || typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return Math.round((Math.min(dimension.max, Math.max(0, raw)) / Math.max(1, dimension.max)) * 100);
}

function attemptQuality(attempt: ReportAttempt, task: AssessmentTask) {
  const direct = routeScore(attempt);
  const rubric = rubricScore(attempt, task);
  if (direct != null && rubric != null) return Math.round(direct * 0.55 + rubric * 0.45);
  return direct ?? rubric;
}

function confidenceFor(evidenceCount: number, groupCount: number): SkillEvidenceConfidence {
  if (evidenceCount < 2 || groupCount < 2) return 'INSUFFICIENT';
  if (evidenceCount >= 6 && groupCount >= 3) return 'HIGH';
  if (evidenceCount >= 4 && groupCount >= 2) return 'MEDIUM';
  return 'LOW';
}

function statusFor(score: number | null, confidence: SkillEvidenceConfidence): SkillProfileStatus {
  if (score == null || confidence === 'INSUFFICIENT') return 'INSUFFICIENT';
  if (score >= 80) return 'RELATIVE_STRENGTH';
  if (score >= 58) return 'DEVELOPING';
  return 'NEEDS_SUPPORT';
}

function buildSkillReports(attempts: ReportAttempt[], tasks: AssessmentTask[]): SkillReport[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return (Object.keys(skillCatalog) as SkillId[]).map((skillId) => {
    const evidence: Array<{ score: number; weight: number; groupId: string; support: boolean }> = [];
    let supportEvidence = 0;
    for (const attempt of attempts) {
      const task = taskById.get(attempt.task_code);
      if (!task) continue;
      const mapping = task.skillWeights.find((item) => item.skillId === skillId);
      if (!mapping) continue;
      const score = attemptQuality(attempt, task);
      if (score == null) continue;
      const support = task.role === 'SUPPORT_PROBE' || Number(attempt.support_level ?? 0) > 0;
      const independenceFactor = clamp(100 - Number(attempt.support_level ?? 0) * 10) / 100;
      evidence.push({ score: score * independenceFactor, weight: mapping.weight, groupId: task.groupId, support });
      if (support) supportEvidence += 1;
    }
    const weightSum = evidence.reduce((sum, item) => sum + item.weight, 0);
    const score = weightSum ? Math.round(evidence.reduce((sum, item) => sum + item.score * item.weight, 0) / weightSum) : null;
    const groupCount = new Set(evidence.map((item) => item.groupId)).size;
    const confidence = confidenceFor(evidence.length, groupCount);
    return {
      skillId,
      label: skillCatalog[skillId].label,
      cluster: skillCatalog[skillId].cluster,
      score,
      evidenceCount: evidence.length,
      groupCount,
      confidence,
      status: statusFor(score, confidence),
      supportRate: evidence.length ? Math.round((supportEvidence / evidence.length) * 100) : 0,
    };
  });
}

const mathLabels: Record<string, string> = {
  'MAT-01': 'Basamak değeri ve sayı yapısı',
  'MAT-02': 'Toplama ve işlem esnekliği',
  'MAT-03': 'Çıkarma ve eksiltme kavramı',
  'MAT-04': 'Sayı karşılaştırma',
  'MAT-05': 'Örüntü ve kural çıkarma',
  'MAT-06': 'Eşitlik ve eksik sayı',
  'MAT-07': 'Problem çözme',
  'MAT-08': 'Geometri ve görsel-uzamsal düşünme',
};

function buildMathReport(attempts: ReportAttempt[], tasks: AssessmentTask[]) {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const attemptByTask = new Map<string, ReportAttempt>();
  for (const attempt of attempts) attemptByTask.set(attempt.task_code, attempt);
  const families = Object.keys(mathLabels).map((groupId): MathFamilyReport => {
    const groupTasks = tasks.filter((task) => task.groupId === groupId);
    const anchor = groupTasks.find((task) => task.role === 'ACADEMIC_ANCHOR');
    const support = groupTasks.find((task) => task.role === 'SUPPORT_PROBE');
    const transfer = groupTasks.find((task) => task.role === 'TRANSFER');
    const probe = groupTasks.find((task) => task.role === 'CZA_PROBE');
    const anchorAttempt = anchor ? attemptByTask.get(anchor.id) : undefined;
    const supportAttempt = support ? attemptByTask.get(support.id) : undefined;
    const transferAttempt = transfer ? attemptByTask.get(transfer.id) : undefined;
    const probeAttempt = probe ? attemptByTask.get(probe.id) : undefined;
    const correctness = anchorAttempt?.answer_payload?.routeCorrectness;
    const initial = !anchorAttempt ? 'not_seen' : correctness === 'correct' ? 'correct' : correctness === 'incorrect' ? 'incorrect' : 'review';
    const supportTriggered = Boolean(anchorAttempt?.answer_payload?.supportTriggered) || Boolean(supportAttempt);
    const transferScore = dimensionPercent(transferAttempt, transfer, 'transfer') ?? (transferAttempt && transfer ? attemptQuality(transferAttempt, transfer) : null);
    const strategyScore = dimensionPercent(probeAttempt, probe, 'strategy');
    const independenceScore = dimensionPercent(probeAttempt, probe, 'independence') ?? dimensionPercent(transferAttempt, transfer, 'independence');

    let interpretation = 'Bu alan için henüz yeterli kanıt oluşmadı.';
    if (initial === 'correct' && (transferScore ?? 0) >= 70) interpretation = 'Tanıdık akademik görev bağımsız yapıldı ve düşünme yolu yeni duruma taşınabildi. Kavramsal temel ile transfer kanıtı birlikte güçlü görünüyor.';
    else if (initial === 'correct') interpretation = 'Tanıdık akademik giriş başarıyla yapıldı. Kavramın farklı temsil veya yeni bağlamdaki kullanımını doğrulamak için transfer kanıtı tamamlanmalı.';
    else if (initial === 'incorrect' && supportTriggered && (transferScore ?? 0) >= 65) interpretation = 'İlk sembolik/akademik yanıtta zorlanma oldu; destekten sonra performans toparlandı ve yeni duruma aktarım görüldü. Bu görünüm kavramın tamamen eksik olmasından çok erişim, temsil veya otomatiklik ihtiyacını düşündürür.';
    else if (initial === 'incorrect' && supportTriggered) interpretation = 'İlk görevde zorlanma sonrası destek dalı açıldı. Destek ve transfer kanıtı birlikte izlenmeli; tek yanlış yanıttan kavramsal yetersizlik sonucu çıkarılmamalıdır.';
    else if (initial === 'review') interpretation = 'Yanıt sözlü/eğitmen incelemesi gerektiriyor. Otomatik olarak doğru veya yanlış sınıflandırılmadı.';

    return { groupId, label: mathLabels[groupId], initial, supportTriggered, transferScore, strategyScore, independenceScore, interpretation };
  });
  const seen = families.filter((family) => family.initial !== 'not_seen');
  const direct = seen.filter((family) => family.initial === 'correct').length;
  const supported = seen.filter((family) => family.initial === 'incorrect' && family.supportTriggered).length;
  const summary = seen.length
    ? `${seen.length}/8 matematik alanından kanıt toplandı. ${direct} alanda tanıdık akademik giriş bağımsız doğru, ${supported} alanda destek dalı açıldı. Sonuçlar transfer ve strateji kanıtlarıyla birlikte yorumlanmalıdır.`
    : 'Matematik derin tarama görevleri henüz başlamadı.';
  return { summary, families };
}

function buildStrategyProfile(observations: ReportObservation[]): StrategyProfile {
  const count = (code: string) => observations.reduce((sum, observation) => sum + (observation.observation_codes?.includes(code) ? 1 : 0), 0);
  const profile: StrategyProfile = {
    planned: count('PLANNED_RESPONSE'),
    verbalReasoning: count('VERBAL_REASONING'),
    selfCorrection: count('SELF_CORRECTION'),
    changedStrategy: count('CHANGED_STRATEGY'),
    persevered: count('PERSEVERED'),
    helpSeeking: count('ASKED_FOR_HELP'),
    impulsive: count('IMPULSIVE_RESPONSE'),
    trialAndError: count('TRIAL_AND_ERROR'),
    visualStrategy: count('VISUAL_STRATEGY'),
    topSignals: [],
  };
  const labels: Array<[number, string]> = [
    [profile.planned, 'Planlayarak ilerleme'],
    [profile.verbalReasoning, 'Düşüncesini sözel açıklama'],
    [profile.selfCorrection, 'Öz-düzeltme'],
    [profile.changedStrategy, 'Strateji değiştirme'],
    [profile.persevered, 'Sebat'],
    [profile.visualStrategy, 'Görsel strateji kullanımı'],
    [profile.trialAndError, 'Deneme-yanılma'],
    [profile.helpSeeking, 'Uygun yardım isteme'],
    [profile.impulsive, 'Aceleci yanıt eğilimi'],
  ];
  profile.topSignals = labels.filter(([value]) => value > 0).sort((a, b) => b[0] - a[0]).slice(0, 4).map(([, label]) => label);
  return profile;
}

function parentSummary(skills: SkillReport[], learningResponse: LearningResponseSummary, mathSummary: string) {
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
    evidenceCoverage,
    evidenceNote,
    skills,
    strengths,
    developing,
    needsSupport,
    learningResponse,
    math,
    strategyProfile,
    process: {
      completedTaskCount: attempts.length,
      supportTaskCount: attempts.filter((attempt) => Number(attempt.support_level ?? 0) > 0 || attempt.task_code.endsWith('S')).length,
      selfCorrectionCount: attempts.filter((attempt) => Boolean(attempt.self_corrected)).length,
      averageFirstResponseMs,
      averageTotalResponseMs,
    },
    parentSummary: parentSummary(skills, learningResponse, math.summary),
    recommendations: buildRecommendations(skills, learningResponse, strategyProfile),
    cautions: [
      'Bu rapor klinik tanı, zekâ testi veya nöropsikolojik değerlendirme değildir.',
      'Tek bir oturumdaki performans; yorgunluk, bağlantı koşulları, okuma yükü ve çocuğun rahatlık düzeyinden etkilenebilir.',
      'Bir beceri için yeterli sayıda farklı görev kanıtı yoksa sistem düşük puan yerine kanıt yetersiz durumunu kullanır.',
      'Çocuğun kendi söylediği öğrenme tercihi sabit bir öğrenme stili etiketi olarak yorumlanmaz.',
    ],
    educatorNotes,
  };
}
