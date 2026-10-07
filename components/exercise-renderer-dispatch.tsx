'use client';

import type { CSSProperties } from 'react';
import { AnzanExerciseRenderer } from '@/components/anzan-exercise-renderer';
import { anzanThemes, type AnzanTheme } from '@/lib/anzan-engine';
import { engineDefinition } from '@/lib/engine-registry';
import { exerciseForMode } from '@/lib/exercise-registry';
import type {
  ExerciseConfig,
  ExerciseMode,
  ExerciseQuestion,
} from '@/lib/exercise-engine';

export function resolvePlayerEngine(mode: ExerciseMode, activityType?: string) {
  const exercise = exerciseForMode(mode);
  if (!exercise) throw new Error('unknown_exercise_activity');
  if (!exercise.engine) return null;
  const definition = engineDefinition(
    exercise.engine.engineId,
    exercise.engine.engineVersion,
  );
  const canonicalActivity = activityType ?? exercise.id;
  if (
    canonicalActivity !== exercise.id ||
    !definition.supportedActivityTypes.includes(
      canonicalActivity as 'FLASH_ANZAN' | 'AUDIO_ANZAN',
    )
  ) {
    throw new Error('unsupported_engine_activity');
  }
  return definition;
}

export function playerPresentation(config: ExerciseConfig): {
  style?: CSSProperties;
  className?: string;
} {
  const definition = resolvePlayerEngine(config.mode);
  if (!definition) return {};
  if (definition.rendererKey !== 'ANZAN_STUDIO')
    throw new Error('unsupported_engine_renderer');
  const theme =
    anzanThemes[(config.backgroundToken ?? 'PAPER_BLACK') as AnzanTheme];
  return {
    style: { backgroundColor: theme.background, color: theme.foreground },
    className: 'anzan-focus-stage',
  };
}

type Props = {
  config: ExerciseConfig;
  question?: ExerciseQuestion;
  round: number;
  term: number;
  paused: boolean;
  sequenceVisible: boolean;
  onAdvance: () => void;
};

export function ExerciseRendererDispatch(props: Props) {
  const definition = resolvePlayerEngine(props.config.mode);
  if (!definition) throw new Error('unsupported_engine_activity');
  if (!props.question) throw new Error('missing_player_question');
  if (definition.rendererKey === 'ANZAN_STUDIO')
    return (
      <AnzanExerciseRenderer
        definition={definition}
        config={props.config}
        question={props.question}
        round={props.round}
        term={props.term}
        paused={props.paused}
        sequenceVisible={props.sequenceVisible}
        onAdvance={props.onAdvance}
      />
    );
  throw new Error('unsupported_engine_renderer');
}
