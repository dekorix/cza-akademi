export const MATH_ATTITUDE_CHALLENGES = {
  short: { display: '4 + 3', correct: '7', options: ['6', '7', '8'] },
  middle: { display: '8 + 6', correct: '14', options: ['13', '14', '15'] },
  explore: { display: '16 + 7', correct: '23', options: ['22', '23', '24'] },
} as const;

export type MathAttitudeChallengeId = keyof typeof MATH_ATTITUDE_CHALLENGES;

export function mathAttitudeFollowUp(picked?: string) {
  if (picked && Object.prototype.hasOwnProperty.call(MATH_ATTITUDE_CHALLENGES, picked)) {
    return { ...MATH_ATTITUDE_CHALLENGES[picked as MathAttitudeChallengeId], fallback: false as const };
  }
  return { ...MATH_ATTITUDE_CHALLENGES.short, fallback: true as const };
}

type AttitudeRow = { id: string; answer: string; correct: number; ms: number; changes: number; help: number; listens: number };

export function encodeMathAttitude(rows: AttitudeRow[]) {
  const fallback = mathAttitudeFollowUp(rows.find((row) => row.id === 'A7')?.answer).fallback;
  const math = rows.filter((row) => {
    if (row.answer === 'SKIP') return false;
    if (row.id === 'A8') return !fallback;
    return row.id === 'A2' || row.id === 'A4' || row.id === 'A5';
  });
  const a5 = rows.find((row) => row.id === 'A5');
  const a6 = rows.find((row) => row.id === 'A6');
  const field = (id: string) => rows.find((row) => row.id === id)?.answer || '';
  return 'MT|n=' + rows.length
    + '|math=' + math.reduce((sum, row) => sum + row.correct, 0) + '/' + math.length
    + '|pre=' + field('A1')
    + '|post=' + field('A10')
    + '|approach=' + field('A3')
    + '|support=' + (rows.find((row) => row.id === 'A4')?.help || 0)
    + '|challenge=' + field('A7')
    + '|a8=' + (fallback ? 'FALLBACK' : field('A8'))
    + '|persist=' + field('A9')
    + '|cal=' + (a5?.correct ?? 0) + '@' + (a6?.answer || '')
    + '|r=' + rows.map((row) => [row.id, row.answer, row.correct, row.ms, row.changes, row.help, row.listens].join('~')).join(',');
}
