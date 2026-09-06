'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type LaunchStep = 0 | 1 | 2 | 3;

const steps = [
  { label: '3', accent: '#168ca1', soft: '#d9f5f5', direction: 'up' },
  { label: '2', accent: '#7656b7', soft: '#eee7ff', direction: 'right' },
  { label: '1', accent: '#d77b24', soft: '#fff0cf', direction: 'left' },
  { label: 'BAŞLA!', accent: '#0c8b69', soft: '#d8f6e8', direction: 'zoom' },
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
  return <div className="launch-sequence w-full max-w-xl overflow-hidden rounded-[2rem] border px-6 py-8 text-center shadow-[0_18px_50px_rgba(32,73,67,.12)] sm:px-10" data-exercise-type={exerciseType} data-step={step} style={{ '--launch-accent': accentToken, '--step-accent': visual.accent, '--step-soft': visual.soft, borderColor: `${visual.accent}38`, background: `linear-gradient(145deg,#ffffff 18%,${visual.soft} 100%)` } as React.CSSProperties}>
    <div className="launch-backdrop" aria-hidden="true"><span/><span/><span/></div>
    <div className="relative mx-auto inline-flex items-center gap-2 rounded-full border bg-white/85 px-4 py-2 text-xs font-bold uppercase tracking-[.12em] shadow-sm" style={{ borderColor: `${accentToken}55`, color: accentToken }}>{icon}{title}</div>
    <p className="mt-5 text-base font-semibold opacity-70">{instruction}</p>
    <div key={visual.label} data-direction={visual.direction} className="launch-scene mx-auto mt-7 grid h-48 w-48 place-items-center rounded-full" style={{ color: visual.accent, background: `radial-gradient(circle, #fff 33%, ${visual.soft} 35%, ${visual.soft} 61%, transparent 63%)` }}>
      <span className={`launch-value font-black ${step === 3 ? 'text-4xl' : 'text-[88px]'}`}>{visual.label}</span>
    </div>
    <div className="mx-auto mt-6 flex w-36 justify-center gap-2" aria-hidden="true">{steps.map((item,index)=><span key={item.label} className="h-2 rounded-full transition-all" style={{ width:index===step?34:10, background:index<=step?item.accent:'#d8dee5' }}/>)}</div>
  </div>;
}
