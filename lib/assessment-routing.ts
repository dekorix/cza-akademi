import { warmupTasks } from './assessment-engine';
import { mathTasks } from './assessment-math';
import { extendedMathTasks } from './assessment-math-extended';

export const assessmentTasks = [...warmupTasks, ...mathTasks, ...extendedMathTasks];

const anchorAnswers: Record<string, string[]> = {
  'MAT-01A': ['4 onluk 7 birlik', '4 onluk ve 7 birlik', '4,7', '4 7'],
  'MAT-01S': ['47'],
  'MAT-02A': ['15'],
  'MAT-03A': ['8'],
  'MAT-03S': ['8'],
  'MAT-04A': ['63'],
  'MAT-04S': ['63'],
  'MAT-05A': ['10'],
  'MAT-05S': ['10'],
  'MAT-06A': ['5'],
  'MAT-06S': ['5'],
  'MAT-06T': ['6'],
  'MAT-07A': ['13'],
  'MAT-08A': ['4', '4 köşe', '4 köşesi vardır'],
  'MAT-08S': ['4', '4 köşe', '4 köşesi vardır'],
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
  'MAT-05S': 'MAT-05B', 'MAT-05B': 'MAT-05T', 'MAT-05T': 'MAT-06A',
  'MAT-06S': 'MAT-06B', 'MAT-06B': 'MAT-06T', 'MAT-06T': 'MAT-07A',
  'MAT-07S': 'MAT-07B', 'MAT-07B': 'MAT-07T', 'MAT-07T': 'MAT-08A',
  'MAT-08S': 'MAT-08B', 'MAT-08B': 'MAT-08T', 'MAT-08T': null,
};

const adaptiveNext: Record<string, { correct: string; incorrect: string }> = {
  'MAT-01A': { correct: 'MAT-01B', incorrect: 'MAT-01S' },
  'MAT-02A': { correct: 'MAT-02B', incorrect: 'MAT-02S' },
  'MAT-03A': { correct: 'MAT-03B', incorrect: 'MAT-03S' },
  'MAT-04A': { correct: 'MAT-04B', incorrect: 'MAT-04S' },
  'MAT-05A': { correct: 'MAT-05B', incorrect: 'MAT-05S' },
  'MAT-06A': { correct: 'MAT-06B', incorrect: 'MAT-06S' },
  'MAT-07A': { correct: 'MAT-07B', incorrect: 'MAT-07S' },
  'MAT-08A': { correct: 'MAT-08B', incorrect: 'MAT-08S' },
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
