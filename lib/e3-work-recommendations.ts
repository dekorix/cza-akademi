import type { AssignableModuleCode } from './training-recipes';
import type { E3ProfileStatus, E3SectionId, E3SectionReport } from './preschool-e3';

export type E3WorkPriority = 'HIGH' | 'MEDIUM' | 'MAINTAIN';

export interface E3WorkRecommendation {
  id: string;
  moduleCode: AssignableModuleCode;
  moduleLabel: string;
  priority: E3WorkPriority;
  sourceSections: string[];
  reason: string;
  suggestedSettings: Record<string, string | number | boolean>;
  educatorApprovalRequired: true;
  ageGate: string;
}

export interface E3DeferredDevelopmentAction {
  sectionId: E3SectionId;
  sectionLabel: string;
  reason: string;
  nextAction: string;
}

const priorityRank: Record<E3WorkPriority, number> = { HIGH: 3, MEDIUM: 2, MAINTAIN: 1 };

function priorityFor(status: E3ProfileStatus): E3WorkPriority | null {
  if (status === 'WATCH_SUPPORT') return 'HIGH';
  if (status === 'DEVELOPING') return 'MEDIUM';
  if (status === 'RELATIVE_STRENGTH') return 'MAINTAIN';
  return null;
}

const labels: Record<AssignableModuleCode, string> = {
  finger_read: 'Parmak Okuma',
  soroban_read: 'Soroban Okuma',
  soroban_write: 'Soroban Yazma',
  flash_anzan: 'Flash Anzan',
  audio_anzan: 'Sesli Anzan',
};

function slowFinger(priority: E3WorkPriority) {
  return {
    digits: 1,
    rounds: priority === 'HIGH' ? 5 : 6,
    presentationDurationMs: priority === 'HIGH' ? 2200 : 1800,
    answerDurationMs: 0,
    practiceMode: 'guided_practice',
    countdownEnabled: false,
  };
}

function slowFlash(priority: E3WorkPriority) {
  return {
    digits: 1,
    terms: 2,
    rounds: priority === 'HIGH' ? 4 : 5,
    stimulusVisibleMs: priority === 'HIGH' ? 1800 : 1500,
    interStimulusGapMs: priority === 'HIGH' ? 700 : 550,
    showNumbers: true,
    practiceMode: 'guided_practice',
    countdownEnabled: false,
  };
}

function slowAudio(priority: E3WorkPriority) {
  return {
    digits: 1,
    terms: 2,
    rounds: priority === 'HIGH' ? 4 : 5,
    speechRate: priority === 'HIGH' ? 0.72 : 0.8,
    interStimulusGapMs: priority === 'HIGH' ? 1500 : 1200,
    showNumbersDuringAudio: false,
    practiceMode: 'guided_practice',
    countdownEnabled: false,
  };
}

function gentleSoroban() {
  return {
    digits: 1,
    rods: 4,
    rounds: 5,
    presentationDurationMs: 2200,
    answerDurationMs: 0,
    practiceMode: 'guided_practice',
    countdownEnabled: false,
  };
}

function sectionRecommendation(section: E3SectionReport, ageMonths: number): E3WorkRecommendation | null {
  const priority = priorityFor(section.status);
  if (!priority) return null;

  // E3 is not a miniature school-age program. Existing numeric Work Panel modules
  // are used only where developmental evidence and age make the transfer defensible.
  if (section.sectionId === 'executive_attention' && ageMonths >= 39) {
    return {
      id: `E3:finger_read:${section.sectionId}:${priority}`,
      moduleCode: 'finger_read',
      moduleLabel: labels.finger_read,
      priority,
      sourceSections: [section.label],
      reason: `${section.label} alanındaki kanıt örüntüsü için kısa, yavaş ve rehberli görsel odak çalışması önerilir. Bu çalışma gelişim alanının yerine geçmez; yalnız dikkat-kural sürdürme kanıtını destekler.`,
      suggestedSettings: slowFinger(priority),
      educatorApprovalRequired: true,
      ageGate: '39+ ay · yalnız rehberli ve süre baskısız',
    };
  }

  if (section.sectionId === 'memory' && ageMonths >= 42) {
    return {
      id: `E3:audio_anzan:${section.sectionId}:${priority}`,
      moduleCode: 'audio_anzan',
      moduleLabel: labels.audio_anzan,
      priority,
      sourceSections: [section.label],
      reason: `${section.label} alanındaki kanıtı desteklemek için iki uyaranlı, yavaş ve süre baskısız işitsel takip önerilir. Amaç hız değil kısa süreli işitsel tutma ve sırayı korumadır.`,
      suggestedSettings: slowAudio(priority),
      educatorApprovalRequired: true,
      ageGate: '42+ ay · 2 uyaran · yavaş ses · performans modu yok',
    };
  }

  if (section.sectionId === 'visual_concepts' && ageMonths >= 45) {
    return {
      id: `E3:flash_anzan:${section.sectionId}:${priority}`,
      moduleCode: 'flash_anzan',
      moduleLabel: labels.flash_anzan,
      priority,
      sourceSections: [section.label],
      reason: `${section.label} alanındaki görsel seçme ve sürdürme kanıtını desteklemek için çok yavaş, iki uyaranlı görsel takip önerilir. Hızlandırma veya performans karşılaştırması yapılmaz.`,
      suggestedSettings: slowFlash(priority),
      educatorApprovalRequired: true,
      ageGate: '45+ ay · 2 uyaran · çok yavaş · süre baskısız',
    };
  }

  if (section.sectionId === 'early_math' && ageMonths >= 45 && section.status !== 'WATCH_SUPPORT') {
    return {
      id: `E3:soroban_read:${section.sectionId}:${priority}`,
      moduleCode: 'soroban_read',
      moduleLabel: labels.soroban_read,
      priority,
      sourceSections: [section.label],
      reason: `${section.label} alanında en az gelişen düzeyde kanıt bulunduğu için yalnız tanıştırıcı, tek basamaklı ve yavaş soroban görsel okuma önerilebilir. Yakın destek profili varsa önce gerçek nesne/nicelik çalışmaları tercih edilir.`,
      suggestedSettings: gentleSoroban(),
      educatorApprovalRequired: true,
      ageGate: '45+ ay · yalnız tanıştırıcı tek basamak · 4 çubuk',
    };
  }

  if (section.sectionId === 'learning_transfer' && ageMonths >= 42 && section.status !== 'RELATIVE_STRENGTH') {
    return {
      id: `E3:finger_read:${section.sectionId}:${priority}`,
      moduleCode: 'finger_read',
      moduleLabel: labels.finger_read,
      priority,
      sourceSections: [section.label],
      reason: `${section.label} alanında modelden öğrenme ve yeni duruma aktarımı tekrar gözlemek için düşük yükle, aynı kuralı birkaç kısa turda kullanan rehberli parmak okuma önerilir.`,
      suggestedSettings: slowFinger(priority),
      educatorApprovalRequired: true,
      ageGate: '42+ ay · kısa tur · rehberli · süre baskısız',
    };
  }

  return null;
}

export function buildE3WorkRecommendations(sections: E3SectionReport[], ageMonths: number, limit = 3): E3WorkRecommendation[] {
  if (!Number.isInteger(ageMonths) || ageMonths < 36 || ageMonths > 47) return [];
  const candidates = sections.map((section) => sectionRecommendation(section, ageMonths)).filter((item): item is E3WorkRecommendation => Boolean(item));
  const byModule = new Map<AssignableModuleCode, E3WorkRecommendation>();
  for (const candidate of candidates) {
    const current = byModule.get(candidate.moduleCode);
    if (!current || priorityRank[candidate.priority] > priorityRank[current.priority]) {
      byModule.set(candidate.moduleCode, candidate);
      continue;
    }
    if (current && !current.sourceSections.includes(candidate.sourceSections[0])) current.sourceSections.push(candidate.sourceSections[0]);
  }
  return [...byModule.values()]
    .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority])
    .slice(0, Math.max(1, Math.min(4, limit)));
}

const developmentalOnly: E3SectionId[] = [
  'receptive_language',
  'expressive_language',
  'social_emotion_play',
  'motor_graphomotor',
  'daily_living_safety',
];

export function buildE3DeferredDevelopmentActions(sections: E3SectionReport[]): E3DeferredDevelopmentAction[] {
  return sections
    .filter((section) => developmentalOnly.includes(section.sectionId) && (section.status === 'WATCH_SUPPORT' || section.status === 'DEVELOPING'))
    .map((section) => ({
      sectionId: section.sectionId,
      sectionLabel: section.label,
      reason: `${section.label} alanını mevcut Anzan/Soroban modüllerine zorla eşlemek pedagojik olarak uygun değildir.`,
      nextAction: section.sectionId === 'motor_graphomotor'
        ? 'Gerçek materyal, çizim, ince/kaba motor ve doğrudan gözlem çalışması planla.'
        : section.sectionId === 'daily_living_safety'
          ? 'Ev-okul rutini içinde özbakım ve güvenlik basamaklarını gerçek yaşamda çalış.'
          : section.sectionId === 'social_emotion_play'
            ? 'Rol oyunu, sıra alma, duygu adlandırma ve sosyal problem çözme etkinliği planla.'
            : 'Doğal konuşma, yönerge/anlatı ve oyun temelli dil etkinliği planla.',
    }));
}
