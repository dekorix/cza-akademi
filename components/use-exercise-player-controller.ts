'use client';

import { useCallback, useState } from 'react';

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

export function nextPlayerPhase(
  phase: ExercisePlayerPhase,
  intent:
    | 'START_STIMULUS'
    | 'START_SEQUENCE'
    | 'START_ANSWER'
    | 'PRESENTATION_COMPLETE'
    | 'SUBMIT_FEEDBACK'
    | 'NEXT'
    | 'COMPLETE'
    | 'RESET',
): ExercisePlayerPhase {
  if (intent === 'RESET') return 'ready';
  if (intent === 'COMPLETE') return 'finished';
  if (intent === 'NEXT') return 'prepare';
  if (intent === 'SUBMIT_FEEDBACK') return 'feedback';
  if (intent === 'START_STIMULUS') return 'stimulus';
  if (intent === 'START_SEQUENCE') return 'sequence';
  if (intent === 'START_ANSWER') return 'answer';
  if (
    intent === 'PRESENTATION_COMPLETE' &&
    (phase === 'stimulus' || phase === 'sequence')
  )
    return 'answer';
  throw new Error('invalid_player_transition');
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

  const resetQuestion = useCallback(() => {
    setTerm(0);
    setSequenceVisible(true);
    setAnswer('');
    setAbacusValue(0);
    setFeedbackAttempt(null);
    setAnswerRemainingMs(0);
  }, []);

  const configure = useCallback(() => setPhase('ready'), []);
  const begin = useCallback(
    (initialPhase: ExercisePlayerPhase) => {
      setRound(0);
      resetQuestion();
      setRetrying(false);
      setPaused(false);
      setPhase(initialPhase);
    },
    [resetQuestion],
  );
  const present = useCallback((presentation: QuestionPresentation) => {
    setPhase(
      nextPlayerPhase(
        'prepare',
        presentation === 'stimulus'
          ? 'START_STIMULUS'
          : presentation === 'sequence'
            ? 'START_SEQUENCE'
            : 'START_ANSWER',
      ),
    );
  }, []);
  const presentationComplete = useCallback(() => {
    setPhase((current) => nextPlayerPhase(current, 'PRESENTATION_COMPLETE'));
  }, []);
  const advanceSequence = useCallback(
    (currentTerm: number, length: number) => {
      if (currentTerm + 1 < length) {
        setSequenceVisible(false);
        setTerm(currentTerm + 1);
        return false;
      }
      presentationComplete();
      return true;
    },
    [presentationComplete],
  );
  const submitted = useCallback((attempt: TAttempt, showFeedback: boolean) => {
    setFeedbackAttempt(attempt);
    setRetrying(false);
    if (showFeedback)
      setPhase((current) => nextPlayerPhase(current, 'SUBMIT_FEEDBACK'));
  }, []);
  const next = useCallback(() => {
    setRound((current) => current + 1);
    resetQuestion();
    setPhase((current) => nextPlayerPhase(current, 'NEXT'));
  }, [resetQuestion]);
  const complete = useCallback(() => {
    setPaused(false);
    setPhase((current) => nextPlayerPhase(current, 'COMPLETE'));
  }, []);
  const reset = useCallback(() => {
    resetQuestion();
    setRound(0);
    setRetrying(false);
    setPaused(false);
    setPhase((current) => nextPlayerPhase(current, 'RESET'));
  }, [resetQuestion]);
  const retry = useCallback(
    (presentation: QuestionPresentation) => {
      setAnswer('');
      setAbacusValue(0);
      setFeedbackAttempt(null);
      setRetrying(true);
      setAnswerRemainingMs(0);
      present(presentation);
    },
    [present],
  );
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
