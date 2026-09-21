'use client';

import { Maximize2, Moon, Pause, Play, Sun } from 'lucide-react';
import {
  Children,
  isValidElement,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ExerciseRendererDispatch,
  playerPresentation,
} from '@/components/exercise-renderer-dispatch';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { ExerciseConfig, ExerciseQuestion } from '@/lib/exercise-engine';
import type { ExercisePlayerPhase } from '@/components/use-exercise-player-controller';

type Props = {
  phase: ExercisePlayerPhase;
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

export function PlayerPhase({
  children,
}: {
  when: Exclude<ExercisePlayerPhase, 'sequence'>;
  children: ReactNode;
}) {
  return children;
}

export function ExercisePlayer({
  phase,
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
  const presentation = active ? playerPresentation(runConfig) : {};
  const content =
    phase === 'sequence' ? (
      <ExerciseRendererDispatch
        config={runConfig}
        question={current}
        round={round}
        term={term}
        paused={paused}
        sequenceVisible={sequenceVisible}
        onAdvance={onAdvance}
      />
    ) : (
      Children.toArray(children).filter(
        (child) =>
          isValidElement<{ when?: ExercisePlayerPhase }>(child) &&
          child.type === PlayerPhase &&
          child.props.when === phase,
      )
    );

  return (
    <div
      ref={stageRef}
      data-player-phase={phase}
      style={presentation.style}
      className={`overflow-hidden rounded-2xl border ${presentation.className ?? ''} ${darkStage ? 'border-[#273c51] bg-[#182739] text-white' : 'border-border bg-white'}`}
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
