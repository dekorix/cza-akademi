'use client';

import { useCallback, useRef, useState } from 'react';

export type ExercisePlayerPhase =
  | 'ready'
  | 'countdown'
  | 'prepare'
  | 'stimulus'
  | 'sequence'
  | 'answer'
  | 'feedback'
  | 'finished';

export type QuestionPresentation = 'stimulus' | 'sequence' | 'answer';
export type ExercisePlayerIntent =
  | 'START_COUNTDOWN'
  | 'START_STIMULUS'
  | 'START_SEQUENCE'
  | 'START_ANSWER'
  | 'PRESENTATION_COMPLETE'
  | 'SUBMIT'
  | 'SUBMIT_FEEDBACK'
  | 'NEXT'
  | 'COMPLETE'
  | 'RETRY'
  | 'RESET';

const intents = (...values: ExercisePlayerIntent[]) => Object.freeze(values);

export const allowedPlayerTransitions: Readonly<
  Record<ExercisePlayerPhase, readonly ExercisePlayerIntent[]>
> = Object.freeze({
  ready: intents(
    'START_COUNTDOWN',
    'START_STIMULUS',
    'START_SEQUENCE',
    'START_ANSWER',
    'RESET',
  ),
  countdown: intents(
    'START_STIMULUS',
    'START_SEQUENCE',
    'START_ANSWER',
    'COMPLETE',
    'RESET',
  ),
  prepare: intents(
    'START_STIMULUS',
    'START_SEQUENCE',
    'START_ANSWER',
    'COMPLETE',
    'RESET',
  ),
  stimulus: intents('PRESENTATION_COMPLETE', 'COMPLETE', 'RESET'),
  sequence: intents('PRESENTATION_COMPLETE', 'COMPLETE', 'RESET'),
  answer: intents('SUBMIT', 'SUBMIT_FEEDBACK', 'NEXT', 'COMPLETE', 'RESET'),
  feedback: intents('NEXT', 'COMPLETE', 'RETRY', 'RESET'),
  finished: intents('RESET'),
});

export type PlayerTransitionResult = Readonly<{
  accepted: boolean;
  phase: ExercisePlayerPhase;
}>;

function phaseForIntent(intent: ExercisePlayerIntent): ExercisePlayerPhase {
  if (intent === 'RESET') return 'ready';
  if (intent === 'COMPLETE') return 'finished';
  if (intent === 'NEXT' || intent === 'RETRY') return 'prepare';
  if (intent === 'SUBMIT') return 'answer';
  if (intent === 'SUBMIT_FEEDBACK') return 'feedback';
  if (intent === 'START_COUNTDOWN') return 'countdown';
  if (intent === 'START_STIMULUS') return 'stimulus';
  if (intent === 'START_SEQUENCE') return 'sequence';
  return 'answer';
}

export function playerTransition(
  phase: ExercisePlayerPhase,
  intent: ExercisePlayerIntent,
): PlayerTransitionResult {
  if (!allowedPlayerTransitions[phase].includes(intent))
    return Object.freeze({ accepted: false, phase });
  return Object.freeze({ accepted: true, phase: phaseForIntent(intent) });
}

export function applyPlayerIntent(
  phase: ExercisePlayerPhase,
  intent: ExercisePlayerIntent,
  onAllowed: () => void,
) {
  const result = playerTransition(phase, intent);
  if (result.accepted) onAllowed();
  return result;
}

export function nextPlayerPhase(
  phase: ExercisePlayerPhase,
  intent: ExercisePlayerIntent,
): ExercisePlayerPhase {
  return playerTransition(phase, intent).phase;
}

export function useExercisePlayerController<TAttempt>() {
  const [phase, setPhase] = useState<ExercisePlayerPhase>('ready');
  const [round, setRound] = useState(0);
  const [term, setTerm] = useState(0);
  const [paused, setPaused] = useState(false);
  const [answer, setAnswer] = useState('');
  const [abacusValue, setAbacusValue] = useState(0);
  const [feedbackAttempt, setFeedbackAttempt] = useState<TAttempt | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [sequenceVisible, setSequenceVisible] = useState(true);
  const [answerRemainingMs, setAnswerRemainingMs] = useState(0);
  const phaseRef = useRef<ExercisePlayerPhase>('ready');

  const transition = useCallback((intent: ExercisePlayerIntent) => {
    const result = playerTransition(phaseRef.current, intent);
    if (!result.accepted) return false;
    phaseRef.current = result.phase;
    setPhase(result.phase);
    return true;
  }, []);

  const resetQuestion = useCallback(() => {
    setTerm(0);
    setSequenceVisible(true);
    setAnswer('');
    setAbacusValue(0);
    setFeedbackAttempt(null);
    setAnswerRemainingMs(0);
  }, []);

  const configure = useCallback(() => transition('RESET'), [transition]);
  const begin = useCallback(
    (initialPhase: ExercisePlayerPhase) => {
      const intent =
        initialPhase === 'countdown'
          ? 'START_COUNTDOWN'
          : initialPhase === 'stimulus'
            ? 'START_STIMULUS'
            : initialPhase === 'sequence'
              ? 'START_SEQUENCE'
              : initialPhase === 'answer'
                ? 'START_ANSWER'
                : null;
      if (!intent || !transition(intent)) return false;
      setRound(0);
      resetQuestion();
      setRetrying(false);
      setPaused(false);
      return true;
    },
    [resetQuestion, transition],
  );
  const present = useCallback(
    (presentation: QuestionPresentation) => {
      return transition(
        presentation === 'stimulus'
          ? 'START_STIMULUS'
          : presentation === 'sequence'
            ? 'START_SEQUENCE'
            : 'START_ANSWER',
      );
    },
    [transition],
  );
  const presentationComplete = useCallback(
    () => transition('PRESENTATION_COMPLETE'),
    [transition],
  );
  const advanceSequence = useCallback(
    (currentTerm: number, length: number) => {
      if (phaseRef.current !== 'sequence') return false;
      if (currentTerm + 1 < length) {
        setSequenceVisible(false);
        setTerm(currentTerm + 1);
        return false;
      }
      return presentationComplete();
    },
    [presentationComplete],
  );
  const submitted = useCallback(
    (attempt: TAttempt, showFeedback: boolean) => {
      if (!transition(showFeedback ? 'SUBMIT_FEEDBACK' : 'SUBMIT'))
        return false;
      setFeedbackAttempt(attempt);
      setRetrying(false);
      return true;
    },
    [transition],
  );
  const next = useCallback(() => {
    if (!transition('NEXT')) return false;
    setRound((current) => current + 1);
    resetQuestion();
    return true;
  }, [resetQuestion, transition]);
  const complete = useCallback(() => {
    if (!transition('COMPLETE')) return false;
    setPaused(false);
    return true;
  }, [transition]);
  const reset = useCallback(() => {
    if (!transition('RESET')) return false;
    resetQuestion();
    setRound(0);
    setRetrying(false);
    setPaused(false);
    return true;
  }, [resetQuestion, transition]);
  const retry = useCallback(() => {
    if (!transition('RETRY')) return false;
    setAnswer('');
    setAbacusValue(0);
    setFeedbackAttempt(null);
    setRetrying(true);
    setAnswerRemainingMs(0);
    return true;
  }, [transition]);
  const addAnswerDigit = useCallback((digit: number) => {
    setAnswer((value) => `${value}${digit}`.slice(0, 8));
  }, []);

  return {
    phase,
    round,
    term,
    paused,
    answer,
    abacusValue,
    feedbackAttempt,
    retrying,
    sequenceVisible,
    answerRemainingMs,
    setPaused,
    setAnswer,
    setAbacusValue,
    setSequenceVisible,
    setAnswerRemainingMs,
    configure,
    begin,
    present,
    presentationComplete,
    advanceSequence,
    submitted,
    next,
    complete,
    reset,
    retry,
    addAnswerDigit,
  };
}
