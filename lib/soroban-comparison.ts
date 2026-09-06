import { placeName } from './soroban-curriculum';

export type SerializedSorobanState = string;

export type SorobanComparison = {
  isCorrect: boolean;
  differingRods: number[];
  differingPlaceValues: number[];
  studentValue: number;
  correctValue: number;
  message: string;
};

export function serializeSorobanState(value: number, digits: number): SerializedSorobanState {
  return Math.max(0, Math.trunc(value)).toString().padStart(digits, '0').slice(-digits);
}

export function compareSorobanStates(studentValue: number, correctValue: number, digits: number): SorobanComparison {
  const student = serializeSorobanState(studentValue, digits);
  const correct = serializeSorobanState(correctValue, digits);
  const differingRods = Array.from({ length: digits }, (_, index) => index).filter(index => student[index] !== correct[index]);
  const differingPlaceValues = differingRods.map(index => 10 ** (digits - index - 1));
  let message = 'Boncuk dizilimleri aynı.';
  if (differingRods.length === 1) {
    const index = differingRods[0];
    const delta = Number(student[index]) - Number(correct[index]);
    const place = placeName(differingPlaceValues[0]);
    if (Math.abs(delta) === 5) message = `${place} basamağında 5'lik boncuk ${delta > 0 ? 'fazladan kullanılmış' : 'eksik'}.`;
    else if (Math.abs(delta) === 1) message = `${place} basamağında bir adet 1'lik boncuk ${delta > 0 ? 'fazla' : 'eksik'}.`;
    else message = `Fark ${place} basamağında.`;
  } else if (differingRods.length > 1) {
    message = `Fark ${differingPlaceValues.map(placeName).join(' ve ')} basamaklarında.`;
  }
  return { isCorrect: differingRods.length === 0, differingRods, differingPlaceValues, studentValue, correctValue, message };
}
