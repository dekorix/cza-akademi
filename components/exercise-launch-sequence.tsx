'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type LaunchStep = 0 | 1 | 2 | 3;

const steps = [
  { label: '3', accent: '#268d9a', soft: '#dff5f4' },
  { label: '2', accent: '#7865b7', soft: '#eeeafb' },
  { label: '1', accent: '#d5862d', soft: '#fff0d3' },
  { label: 'BAŞLA!', accent: '#16836e', soft: '#dff5e9' },
] as const;

export function ExerciseLaunchSequence({
  exerciseType,
  title,
  icon,
  accentToken = '#16836e',
  instruction,
  countdownEnabled = true,
  soundEnabled = false,
  onComplete,
}: {
  exerciseType: string;
  title: string;
  icon: ReactNode;
  accentToken?: string;
  instruction: string;
  countdownEnabled?: boolean;
  soundEnabled?: boolean;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<LaunchStep>(0);
  const completion = useRef(onComplete);

  useEffect(() => {
    completion.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!countdownEnabled) {
      const frame = requestAnimationFrame(() => completion.current());
      return () => cancelAnimationFrame(frame);
    }
    const startedAt = performance.now();
    let lastStep = -1;
    const timer = window.setInterval(() => {
      const nextStep = Math.min(4, Math.floor((performance.now() - startedAt) / 780));
      if (nextStep !== lastStep && nextStep < 4) {
        lastStep = nextStep;
        setStep(nextStep as LaunchStep);
        if (soundEnabled) window.dispatchEvent(new CustomEvent('cza:countdown-cue', { detail: { step: nextStep } }));
      }
      if (nextStep >= 4) {
        window.clearInterval(timer);
        requestAnimationFrame(() => completion.current());
      }
    }, 40);
    return () => window.clearInterval(timer);
  }, [countdownEnabled, soundEnabled]);

  const visual = steps[step];
  return <div className="launch-sequence w-full max-w-xl text-center" data-exercise-type={exerciseType} style={{ '--launch-accent': accentToken } as React.CSSProperties}>
    <div className="mx-auto inline-flex items-center gap-2 rounded-full border bg-white/80 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] shadow-sm" style={{ borderColor: `${accentToken}55`, color: accentToken }}>{icon}{title}</div>
    <p className="mt-5 text-base font-semibold opacity-70">{instruction}</p>
    <div key={visual.label} className="launch-scene mx-auto mt-7 grid h-48 w-48 place-items-center rounded-full" style={{ color: visual.accent, background: `radial-gradient(circle, #fff 36%, ${visual.soft} 38%, ${visual.soft} 62%, transparent 63%)` }}>
      <span className={`launch-value font-black ${step === 3 ? 'text-4xl' : 'text-[88px]'}`}>{visual.label}</span>
    </div>
    <div className="mx-auto mt-6 flex w-36 justify-center gap-2" aria-hidden="true">{steps.map((item,index)=><span key={item.label} className="h-2 rounded-full transition-all" style={{ width:index===step?34:10, background:index<=step?item.accent:'#d8dee5' }}/>)}</div>
  </div>;
}
