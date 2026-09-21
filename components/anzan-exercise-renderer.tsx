'use client';

import { AudioLines, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ExerciseNumberDisplay } from '@/components/exercise-number-display';
import type { ExerciseConfig, ExerciseQuestion } from '@/lib/exercise-engine';
import type { EngineDefinition } from '@/lib/engine-contract';

type Props = {
  definition: EngineDefinition;
  config: ExerciseConfig;
  question: ExerciseQuestion;
  round: number;
  term: number;
  paused: boolean;
  sequenceVisible: boolean;
  onAdvance: () => void;
};

export function AnzanExerciseRenderer({
  definition,
  config,
  question,
  round,
  term,
  paused,
  sequenceVisible,
  onAdvance,
}: Props) {
  if (definition.rendererKey !== 'ANZAN_STUDIO')
    throw new Error('unsupported_engine_renderer');

  return (
    <div
      className="anzan-stimulus-screen w-full text-center"
      data-engine-id={definition.engineId}
      data-engine-version={definition.engineVersion}
    >
      <span className="sr-only">
        {term + 1}. sayı, toplam {question.sequence.length}
      </span>
      {paused ? (
        <ExerciseNumberDisplay value="Ⅱ" size="hero" className="mx-auto" />
      ) : config.mode === 'audio' && !config.showNumbersDuringAudio ? (
        <div
          className="flex min-h-[42vh] items-center justify-center"
          aria-label="Sayıyı dinle"
        >
          <AudioLines size={58} strokeWidth={1.5} className="text-[#6b8190]" />
        </div>
      ) : sequenceVisible ? (
        <div
          key={`${round}-${term}`}
          data-effect={(config.transitionEffect ?? 'FADE').toLowerCase()}
          className="anzan-stimulus-event"
        >
          <ExerciseNumberDisplay
            value={Math.abs(question.sequence[term])}
            operator={term > 0 && question.sequence[term] < 0 ? '−' : ''}
            size="hero"
            className="mx-auto"
          />
        </div>
      ) : (
        <div className="min-h-[42vh]" aria-hidden="true" />
      )}
      {config.interval === 0 && !paused && (
        <Button className="mt-5 h-10 px-5" onClick={onAdvance}>
          {term + 1 < question.sequence.length ? 'Sonraki sayı' : 'Cevaba geç'}{' '}
          <ChevronRight />
        </Button>
      )}
    </div>
  );
}
