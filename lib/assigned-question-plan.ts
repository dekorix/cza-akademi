import {
  createQuestion,
  type ExerciseConfig,
  type ExerciseQuestion,
} from './exercise-engine';
export type AssignedQuestion = ExerciseQuestion & { questionId?: string };
/** Validate the bounded server plan against the existing finger-read engine. */
export function assignedQuestionPlan(
  value: unknown,
  config: ExerciseConfig,
): AssignedQuestion[] | null {
  if (value === undefined) return null; // Existing non-QA engines remain unchanged.
  if (
    !Array.isArray(value) ||
    value.length !== config.rounds ||
    config.mode !== 'finger-read' ||
    config.digits !== 1
  )
    throw new Error('invalid_assigned_question_plan');
  return value.map((q) => {
    if (
      !q ||
      typeof q !== 'object' ||
      !Number.isInteger(q.answer) ||
      q.answer < 1 ||
      q.answer > 9 ||
      typeof q.questionId !== 'string' ||
      !Array.isArray(q.sequence) ||
      q.sequence.length !== 1 ||
      q.sequence[0] !== q.answer
    )
      throw new Error('invalid_assigned_question_plan');
    const existing = createQuestion(config, () => (q.answer - 0.5) / 9);
    if (existing.answer !== q.answer)
      throw new Error('invalid_assigned_question_plan');
    return { ...existing, questionId: q.questionId };
  });
}
