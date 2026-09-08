import { warmupTasks } from './assessment-engine';
import { mathTasks } from './assessment-math';

export const assessmentTasks = [...warmupTasks, ...mathTasks];

const anchorAnswers: Record<string, string[]> = {
  'MAT-01A': ['4 onluk 7 birlik', '4 onluk ve 7 birlik', '4,7', '4 7'],
  'MAT-01S': ['47'],
  'MAT-02A': ['15'],
  'MAT-03A': ['8'],
  'MAT-03S': ['8'],
  'MAT-04A': ['63'],
  'MAT-05A': ['10'],
  'MAT-05S': ['10'],
};

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ')
    .replace(/[.!?]/g, '');
}

function answerMatches(taskCode: string, answer: string) {
  const expected = anchorAnswers[taskCode];
  if (!expected) return null;
  const value = normalize(answer);
  return expected.some((item) => normalize(item) === value);
}

const fixedNext: Record<string, string | null> = {
  'WARM-01A': 'WARM-01B', 'WARM-01B': 'WARM-02A',
  'WARM-02A': 'WARM-02B', 'WARM-02B': 'WARM-03A',
  'WARM-03A': 'WARM-03B', 'WARM-03B': 'WARM-04A',
  'WARM-04A': 'WARM-04B', 'WARM-04B': 'WARM-05A',
  'WARM-05A': 'WARM-05B', 'WARM-05B': 'MAT-01A',
  'MAT-01S': 'MAT-01B', 'MAT-01B': 'MAT-01T', 'MAT-01T': 'MAT-02A',
  'MAT-02S': 'MAT-02B', 'MAT-02B': 'MAT-02T', 'MAT-02T': 'MAT-03A',
  'MAT-03S': 'MAT-03B', 'MAT-03B': 'MAT-03T', 'MAT-03T': 'MAT-04A',
  'MAT-04S': 'MAT-04B', 'MAT-04B': 'MAT-04T', 'MAT-04T': 'MAT-05A',
  'MAT-05S': 'MAT-05B', 'MAT-05B': 'MAT-05T', 'MAT-05T': null,
};

const adaptiveNext: Record<string, { correct: string; incorrect: string }> = {
  'MAT-01A': { correct: 'MAT-01B', incorrect: 'MAT-01S' },
  'MAT-02A': { correct: 'MAT-02B', incorrect: 'MAT-02S' },
  'MAT-03A': { correct: 'MAT-03B', incorrect: 'MAT-03S' },
  'MAT-04A': { correct: 'MAT-04B', incorrect: 'MAT-04S' },
  'MAT-05A': { correct: 'MAT-05B', incorrect: 'MAT-05S' },
};

export function routeAssessmentTask(taskCode: string, answer: string) {
  const adaptive = adaptiveNext[taskCode];
  if (adaptive) {
    const correct = answerMatches(taskCode, answer) === true;
    return {
      nextTaskCode: correct ? adaptive.correct : adaptive.incorrect,
      correctness: correct ? 'correct' : 'incorrect',
      supportTriggered: !correct,
    };
  }

  const nextTaskCode = Object.prototype.hasOwnProperty.call(fixedNext, taskCode)
    ? fixedNext[taskCode]
    : null;
  return { nextTaskCode, correctness: null, supportTriggered: false };
}
