export type PracticeMode = 'free_practice' | 'guided_practice' | 'performance' | 'assessment';
export type FeedbackMode = 'immediate' | 'end_of_session' | 'none_during_test';

export const practiceModeLabels: Record<PracticeMode, string> = {
  free_practice: 'Serbest antrenman',
  guided_practice: 'Rehberli antrenman',
  performance: 'Performans çalışması',
  assessment: 'Değerlendirme',
};

export const practiceModeDescriptions: Record<PracticeMode, string> = {
  free_practice: 'Süre baskısı olmadan rahatça dene ve öğren.',
  guided_practice: 'Kurallı destek ve açıklamalarla tekniğini geliştir.',
  performance: 'Hız, doğruluk ve tutarlılığını ölç.',
  assessment: 'Standart koşullarda mevcut düzeyini belirle.',
};

export function shouldShowCountdown({ practiceMode, countdownEnabled }: { practiceMode: PracticeMode; exerciseType?: string; timed?: boolean; assessmentMode?: boolean; countdownEnabled?: boolean }) {
  if (practiceMode === 'performance' || practiceMode === 'assessment') return true;
  return countdownEnabled === true;
}

export function feedbackModeFor(practiceMode: PracticeMode): FeedbackMode {
  if (practiceMode === 'free_practice' || practiceMode === 'guided_practice') return 'immediate';
  return practiceMode === 'performance' ? 'end_of_session' : 'none_during_test';
}

export function isMeasuredMode(practiceMode: PracticeMode) {
  return practiceMode === 'performance' || practiceMode === 'assessment';
}

export function learningModeFor(practiceMode: PracticeMode) {
  return practiceMode;
}
