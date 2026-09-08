import { warmupTasks } from './assessment-engine';
import { mathTasks } from './assessment-math';
import { extendedMathTasks } from './assessment-math-extended';
import { languageTasks } from './assessment-language';
import { cognitiveTasks } from './assessment-cognitive';

export const assessmentTasks = [...warmupTasks, ...mathTasks, ...extendedMathTasks, ...languageTasks, ...cognitiveTasks];

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
  'TR-01A': ['bahçeye', 'bahçe'],
  'TR-01S': ['bahçeye', 'bahçe'],
  'TR-02A': ['sepette', 'sepet', 'sepette olur'],
  'TR-02S': ['sepette', 'sepet'],
  'TR-03A': ['meyve', 'bir meyve', 'meyvedir'],
  'TR-03S': ['meyve', 'meyveler'],
  'TR-05A': ['35*', '35⭐', '3 5 yıldız', '3 5 *'],
  'TR-05S': ['35', '3 5'],
  'COG-01A': ['4', '4 tane'],
  'COG-01S': ['3', '3 tane'],
  'COG-01B': ['2', '2 tane'],
  'COG-02A': ['417', '4 1 7', '4-1-7'],
  'COG-02S': ['47', '4 7', '4-7'],
  'COG-02B': ['714', '7 1 4', '7-1-4'],
  'COG-02T': ['825', '8 2 5', '8-2-5'],
  'COG-03A': ['1221', '1 2 2 1'],
  'COG-03S': ['12', '1 2'],
  'COG-03B': ['2112', '2 1 1 2'],
  'COG-04A': ['▲', 'üçgen', 'üçgen olmalı'],
  'COG-04S': ['▲', 'üçgen'],
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
  'MAT-08S': 'MAT-08B', 'MAT-08B': 'MAT-08T', 'MAT-08T': 'TR-01A',
  'TR-01S': 'TR-01B', 'TR-01B': 'TR-01T', 'TR-01T': 'TR-02A',
  'TR-02S': 'TR-02B', 'TR-02B': 'TR-02T', 'TR-02T': 'TR-03A',
  'TR-03S': 'TR-03B', 'TR-03B': 'TR-03T', 'TR-03T': 'TR-04A',
  'TR-04A': 'TR-04B', 'TR-04B': 'TR-04T', 'TR-04T': 'TR-05A',
  'TR-05S': 'TR-05B', 'TR-05B': 'TR-05T', 'TR-05T': 'COG-01A',
  'COG-01S': 'COG-01B', 'COG-01B': 'COG-01T', 'COG-01T': 'COG-02A',
  'COG-02S': 'COG-02B', 'COG-02B': 'COG-02T', 'COG-02T': 'COG-03A',
  'COG-03S': 'COG-03B', 'COG-03B': 'COG-03T', 'COG-03T': 'COG-04A',
  'COG-04S': 'COG-04B', 'COG-04B': 'COG-04T', 'COG-04T': 'COG-05A',
  'COG-05A': 'COG-05B', 'COG-05B': 'COG-05T', 'COG-05T': null,
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
  'TR-01A': { correct: 'TR-01B', incorrect: 'TR-01S' },
  'TR-02A': { correct: 'TR-02B', incorrect: 'TR-02S' },
  'TR-03A': { correct: 'TR-03B', incorrect: 'TR-03S' },
  'TR-05A': { correct: 'TR-05B', incorrect: 'TR-05S' },
  'COG-01A': { correct: 'COG-01B', incorrect: 'COG-01S' },
  'COG-02A': { correct: 'COG-02B', incorrect: 'COG-02S' },
  'COG-03A': { correct: 'COG-03B', incorrect: 'COG-03S' },
  'COG-04A': { correct: 'COG-04B', incorrect: 'COG-04S' },
};

export function routeAssessmentTask(taskCode: string, answer: string) {
  const matched = answerMatches(taskCode, answer);
  const adaptive = adaptiveNext[taskCode];
  if (adaptive) {
    const correct = matched === true;
    return {
      nextTaskCode: correct ? adaptive.correct : adaptive.incorrect,
      correctness: correct ? 'correct' : 'incorrect',
      supportTriggered: !correct,
    };
  }

  const nextTaskCode = Object.prototype.hasOwnProperty.call(fixedNext, taskCode)
    ? fixedNext[taskCode]
    : null;
  return {
    nextTaskCode,
    correctness: matched === true ? 'correct' : matched === false ? 'incorrect' : null,
    supportTriggered: false,
  };
}
