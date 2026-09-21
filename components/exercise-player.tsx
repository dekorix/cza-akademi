'use client';

import { Maximize2, Moon, Pause, Play, Sun } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { AnzanExerciseRenderer } from '@/components/anzan-exercise-renderer';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { anzanThemes, type AnzanTheme } from '@/lib/anzan-engine';
import { engineDefinition } from '@/lib/engine-registry';
import { exerciseForMode } from '@/lib/exercise-registry';
import type {
  ExerciseConfig,
  ExerciseMode,
  ExerciseQuestion,
} from '@/lib/exercise-engine';

export type ExercisePlayerPhase =
  | 'ready'
  | 'countdown'
  | 'prepare'
  | 'stimulus'
  | 'sequence'
  | 'answer'
  | 'feedback'
  | 'finished';

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

type Props = {
  phase: ExercisePlayerPhase;
  config: ExerciseConfig;
  runConfig: ExerciseConfig;
  current?: ExerciseQuestion;
  round: number;
  term: number;
  paused: boolean;
  sequenceVisible: boolean;
  saving: boolean;
  assignmentId: string;
  completedAnswers: number;
  title: string;
  children: ReactNode;
  onAdvance: () => void;
  onPauseChange: (paused: boolean) => void;
  onFinish: () => void;
  onError: (message: string) => void;
};

export function ExercisePlayer({
  phase,
  config,
  runConfig,
  current,
  round,
  term,
  paused,
  sequenceVisible,
  saving,
  assignmentId,
  completedAnswers,
  title,
  children,
  onAdvance,
  onPauseChange,
  onFinish,
  onError,
}: Props) {
  const [darkStage, setDarkStage] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const active = phase !== 'ready' && phase !== 'finished';
  const mental = runConfig.mode === 'flash' || runConfig.mode === 'audio';
  const selectedConfig = active || phase === 'finished' ? runConfig : config;
  const definition = resolvePlayerEngine(selectedConfig.mode);
  const theme =
    anzanThemes[(runConfig.backgroundToken ?? 'PAPER_BLACK') as AnzanTheme];
  const content =
    phase === 'sequence' ? (
      definition && current ? (
        <AnzanExerciseRenderer
          definition={definition}
          config={runConfig}
          question={current}
          round={round}
          term={term}
          paused={paused}
          sequenceVisible={sequenceVisible}
          onAdvance={onAdvance}
        />
      ) : (
        (() => {
          throw new Error(
            definition
              ? 'missing_player_question'
              : 'unsupported_engine_activity',
          );
        })()
      )
    ) : (
      children
    );

  return (
    <div
      ref={stageRef}
      data-player-phase={phase}
      data-engine-id={definition?.engineId}
      data-engine-version={definition?.engineVersion}
      style={
        active && mental
          ? { backgroundColor: theme.background, color: theme.foreground }
          : undefined
      }
      className={`overflow-hidden rounded-2xl border ${active && mental ? 'anzan-focus-stage ' : ''}${darkStage ? 'border-[#273c51] bg-[#182739] text-white' : 'border-border bg-white'}`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-5 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#91baa5]" />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={darkStage ? 'Açık çalışma alanı' : 'Koyu çalışma alanı'}
            onClick={() => setDarkStage((value) => !value)}
          >
            {darkStage ? <Sun /> : <Moon />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Tam ekran"
            onClick={() => {
              if (stageRef.current?.requestFullscreen)
                void stageRef.current
                  .requestFullscreen()
                  .catch(() => onError('Tam ekran bu ortamda desteklenmiyor.'));
              else onError('Tam ekran bu ortamda desteklenmiyor.');
            }}
          >
            <Maximize2 />
          </Button>
        </div>
      </div>
      <div className="flex min-h-[430px] flex-col items-center justify-center px-5 py-9 md:min-h-[475px]">
        {content}
      </div>
      {active && (
        <div
          className={`border-t px-6 py-4 ${darkStage ? 'border-white/10' : 'border-border'}`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs opacity-60">
              {completedAnswers} / {runConfig.rounds} yanıt
            </span>
            <div className="flex gap-2">
              {['countdown', 'stimulus', 'sequence'].includes(phase) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onPauseChange(!paused)}
                >
                  {paused ? <Play /> : <Pause />}
                  {paused ? 'Sürdür' : 'Duraklat'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={onFinish}
              >
                {assignmentId ? 'Ara ver' : 'Bitir ve kaydet'}
              </Button>
            </div>
          </div>
          <Progress
            value={(completedAnswers / runConfig.rounds) * 100}
            aria-label="Seans ilerlemesi"
          />
          <p className="mt-3 text-[10px] opacity-55">
            Bitirdiğinde o ana kadar verdiğin bütün cevaplar eğitimci kaydında
            kalır.
          </p>
        </div>
      )}
    </div>
  );
}
