import type { CzaAssessmentReport, SkillProfileStatus, SkillReport } from './assessment-report';

export type CzaWorkModuleCode =
  | 'finger_read'
  | 'soroban_read'
  | 'soroban_write'
  | 'arithmetic'
  | 'flash_anzan'
  | 'audio_anzan';

export type CzaRecommendationPriority = 'HIGH' | 'MEDIUM' | 'MAINTAIN';

export interface CzaWorkRecommendation {
  id: string;
  moduleCode: CzaWorkModuleCode;
  moduleLabel: string;
  priority: CzaRecommendationPriority;
  sourceSkills: string[];
  reason: string;
  suggestedSettings: Record<string, string | number | boolean>;
  launchPath: string;
  educatorApprovalRequired: true;
}

type RecommendationPlan = Omit<CzaWorkRecommendation, 'id' | 'sourceSkills' | 'reason' | 'priority' | 'educatorApprovalRequired'>;

const labels: Record<CzaWorkModuleCode, string> = {
  finger_read: 'Parmak Okuma',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  arithmetic: 'Toplama / Çıkarma',
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
};

const priorityRank: Record<CzaRecommendationPriority, number> = { HIGH: 3, MEDIUM: 2, MAINTAIN: 1 };

function priorityFor(status: SkillProfileStatus): CzaRecommendationPriority | null {
  if (status === 'NEEDS_SUPPORT') return 'HIGH';
  if (status === 'DEVELOPING') return 'MEDIUM';
  if (status === 'RELATIVE_STRENGTH') return 'MAINTAIN';
  return null;
}

function planFor(skill: SkillReport): RecommendationPlan | null {
  const support = skill.status === 'NEEDS_SUPPORT';
  const developing = skill.status === 'DEVELOPING';

  if (skill.skillId === 'working_memory') {
    return {
      moduleCode: 'audio_anzan',
      moduleLabel: labels.audio_anzan,
      launchPath: '/studio?mode=audio',
      suggestedSettings: support
        ? { digits: 1, terms: 2, speechRate: 0.85, interStimulusGapMs: 1100, practiceMode: 'guided_practice', countdownEnabled: false }
        : developing
          ? { digits: 1, terms: 3, speechRate: 0.9, interStimulusGapMs: 900, practiceMode: 'guided_practice', countdownEnabled: false }
          : { digits: 1, terms: 4, speechRate: 1, interStimulusGapMs: 700, practiceMode: 'performance', countdownEnabled: false },
    };
  }

  if (skill.skillId === 'processing_speed') {
    return {
      moduleCode: 'flash_anzan',
      moduleLabel: labels.flash_anzan,
      launchPath: '/studio?mode=flash',
      suggestedSettings: support
        ? { digits: 1, terms: 2, stimulusVisibleMs: 1400, interStimulusGapMs: 300, practiceMode: 'guided_practice', countdownEnabled: false }
        : developing
          ? { digits: 1, terms: 3, stimulusVisibleMs: 1000, interStimulusGapMs: 220, practiceMode: 'guided_practice', countdownEnabled: false }
          : { digits: 1, terms: 4, stimulusVisibleMs: 700, interStimulusGapMs: 160, practiceMode: 'performance', countdownEnabled: false },
    };
  }

  if (skill.skillId === 'visual_spatial') {
    return {
      moduleCode: 'soroban_read',
      moduleLabel: labels.soroban_read,
      launchPath: '/studio',
      suggestedSettings: support
        ? { digits: 1, rods: 4, presentationDurationMs: 1600, practiceMode: 'guided_practice', countdownEnabled: false }
        : developing
          ? { digits: 1, rods: 5, presentationDurationMs: 1200, practiceMode: 'guided_practice', countdownEnabled: false }
          : { digits: 2, rods: 5, presentationDurationMs: 900, practiceMode: 'performance', countdownEnabled: false },
    };
  }

  if (skill.skillId === 'attention' || skill.skillId === 'self_regulation') {
    return {
      moduleCode: 'finger_read',
      moduleLabel: labels.finger_read,
      launchPath: '/studio?mode=fingers',
      suggestedSettings: support
        ? { digits: 1, presentationDurationMs: 1800, answerDurationMs: 0, practiceMode: 'guided_practice', countdownEnabled: false }
        : developing
          ? { digits: 1, presentationDurationMs: 1400, answerDurationMs: 0, practiceMode: 'guided_practice', countdownEnabled: false }
          : { digits: 2, presentationDurationMs: 1000, answerDurationMs: 0, practiceMode: 'performance', countdownEnabled: false },
    };
  }

  if (['number_sense', 'math_reasoning', 'problem_solving', 'pattern_reasoning', 'cognitive_flexibility'].includes(skill.skillId)) {
    return {
      moduleCode: 'arithmetic',
      moduleLabel: labels.arithmetic,
      launchPath: '/arithmetic',
      suggestedSettings: support
        ? { digits: 1, terms: 2, practiceMode: 'guided_practice', countdownEnabled: false }
        : developing
          ? { digits: 1, terms: 3, practiceMode: 'guided_practice', countdownEnabled: false }
          : { digits: 1, terms: 4, practiceMode: 'performance', countdownEnabled: false },
    };
  }

  return null;
}

function reasonFor(skill: SkillReport, priority: CzaRecommendationPriority) {
  if (priority === 'HIGH') return `${skill.label} alanında yapılandırılmış destek gerektiren kanıtlar görüldüğü için düşük yükle ve rehberli başlanması önerilir.`;
  if (priority === 'MEDIUM') return `${skill.label} alanındaki gelişen profil için kontrollü güçlendirme ve ardından yeni durumda yeniden ölçüm önerilir.`;
  return `${skill.label} göreli güçlü alan olarak göründüğü için beceriyi koruyan, aşırı yük bindirmeyen bir ilerletme çalışması önerilir.`;
}

export function buildCzaWorkRecommendations(report: CzaAssessmentReport, limit = 4): CzaWorkRecommendation[] {
  const candidates = report.skills
    .filter((skill) => skill.confidence !== 'INSUFFICIENT')
    .map((skill) => {
      const priority = priorityFor(skill.status);
      const plan = planFor(skill);
      if (!priority || !plan) return null;
      return {
        ...plan,
        id: `${plan.moduleCode}:${skill.skillId}:${priority}`,
        priority,
        sourceSkills: [skill.label],
        reason: reasonFor(skill, priority),
        educatorApprovalRequired: true as const,
      };
    })
    .filter((item): item is CzaWorkRecommendation => Boolean(item));

  const byModule = new Map<CzaWorkModuleCode, CzaWorkRecommendation>();
  for (const candidate of candidates) {
    const current = byModule.get(candidate.moduleCode);
    if (!current) {
      byModule.set(candidate.moduleCode, candidate);
      continue;
    }
    if (!current.sourceSkills.includes(candidate.sourceSkills[0])) current.sourceSkills.push(candidate.sourceSkills[0]);
    if (priorityRank[candidate.priority] > priorityRank[current.priority]) {
      byModule.set(candidate.moduleCode, { ...candidate, sourceSkills: [...new Set([...current.sourceSkills, ...candidate.sourceSkills])] });
    }
  }

  return [...byModule.values()]
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])
    .slice(0, Math.max(1, Math.min(8, limit)));
}
