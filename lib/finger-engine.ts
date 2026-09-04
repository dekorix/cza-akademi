export const fingerOrder = ['index', 'middle', 'ring', 'little'] as const;
export type FingerName = 'thumb' | (typeof fingerOrder)[number];
export type HandPattern = Record<FingerName, boolean>;

export function emptyHand(): HandPattern {
  return { thumb: false, index: false, middle: false, ring: false, little: false };
}

export function digitPattern(value: number): HandPattern {
  const pattern = emptyHand();
  if (value >= 5) pattern.thumb = true;
  for (let index = 0; index < value % 5; index += 1) pattern[fingerOrder[index]] = true;
  return pattern;
}

export function numberPattern(value: number) {
  return {
    left: digitPattern(Math.floor(value / 10)),
    right: digitPattern(value % 10),
  };
}

export function readHand(pattern: HandPattern) {
  let gapFound = false;
  let smallFingers = 0;
  for (const finger of fingerOrder) {
    if (pattern[finger]) {
      if (gapFound) {
        return {
          valid: false as const,
          code: 'F01',
          message: 'Parmak sırası doğru değil. Önce işaret parmağından başlamalısın.',
        };
      }
      smallFingers += 1;
    } else {
      gapFound = true;
    }
  }
  return { valid: true as const, value: (pattern.thumb ? 5 : 0) + smallFingers };
}

export function readHands(left: HandPattern, right: HandPattern) {
  const leftResult = readHand(left);
  if (!leftResult.valid) return leftResult;
  const rightResult = readHand(right);
  if (!rightResult.valid) return rightResult;
  return { valid: true as const, value: leftResult.value * 10 + rightResult.value };
}
