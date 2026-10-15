export const MATH_ATTITUDE_CHALLENGES = {
  short: { display: '4 + 3', correct: '7', options: ['6', '7', '8'] },
  middle: { display: '8 + 6', correct: '14', options: ['13', '14', '15'] },
  explore: { display: '16 + 7', correct: '23', options: ['22', '23', '24'] },
} as const;

export type MathAttitudeChallengeId = keyof typeof MATH_ATTITUDE_CHALLENGES;

export function mathAttitudeFollowUp(picked?: string) {
  if (picked && Object.prototype.hasOwnProperty.call(MATH_ATTITUDE_CHALLENGES, picked)) {
    return MATH_ATTITUDE_CHALLENGES[picked as MathAttitudeChallengeId];
  }
  return MATH_ATTITUDE_CHALLENGES.short;
}
