'use client';

import type { FingerName, HandPattern } from '@/lib/finger-engine';

const paths: Record<FingerName, string> = {
  index: 'M99 193V80C99 51 112 38 126 38s25 13 25 39v116Z',
  middle: 'M148 192V53C148 23 162 10 176 10s25 14 24 42l-4 140Z',
  ring: 'M194 198l7-112c2-26 15-38 29-35s22 17 18 43l-15 112Z',
  little: 'M230 218l22-82c7-25 19-34 32-29s17 20 8 42l-32 89Z',
  thumb: 'M91 222L45 180c-20-19-21-36-10-47s28-4 43 15l38 49c7 10-10 35-25 25Z',
};

const nails: Record<FingerName, { x: number; y: number }> = {
  index: { x: 114, y: 49 },
  middle: { x: 165, y: 21 },
  ring: { x: 217, y: 61 },
  little: { x: 267, y: 115 },
  thumb: { x: 42, y: 136 },
};

const labels: Record<FingerName, string> = {
  thumb: 'başparmak',
  index: 'işaret parmağı',
  middle: 'orta parmak',
  ring: 'yüzük parmağı',
  little: 'serçe parmak',
};

export function FingerHand({
  side,
  pattern,
  interactive,
  onFinger,
}: {
  side: 'left' | 'right';
  pattern: HandPattern;
  interactive?: boolean;
  onFinger?: (finger: FingerName) => void;
}) {
  const fingers: FingerName[] = ['index', 'middle', 'ring', 'little', 'thumb'];
  const sideLabel = side === 'left' ? 'Sol el, onlar basamağı' : 'Sağ el, birler basamağı';

  return (
    <svg
      className="finger-hand"
      viewBox="0 0 300 390"
      aria-label={sideLabel}
      style={side === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <defs>
        <linearGradient id={`active-${side}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f3483f" />
          <stop offset=".46" stopColor="#eb7967" />
          <stop offset="1" stopColor="#f1dfd3" />
        </linearGradient>
      </defs>
      <path className="finger-palm" d="M82 190C82 160 100 150 120 148H205C225 160 230 185 226 218L216 330C210 365 185 382 154 382S91 365 86 330Z" />
      {fingers.map((finger) => (
        <g
          key={finger}
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? `${sideLabel}: ${labels[finger]} ${pattern[finger] ? 'aktif' : 'pasif'}` : undefined}
          aria-pressed={interactive ? pattern[finger] : undefined}
          className={interactive ? 'finger-hit' : undefined}
          onClick={() => interactive && onFinger?.(finger)}
          onKeyDown={(event) => {
            if (interactive && (event.key === 'Enter' || event.key === ' ')) {
              event.preventDefault();
              onFinger?.(finger);
            }
          }}
        >
          <path
            className={pattern[finger] ? 'finger-active' : 'finger-passive'}
            style={pattern[finger] ? { fill: `url(#active-${side})` } : undefined}
            d={paths[finger]}
          />
          <rect className="finger-nail" x={nails[finger].x} y={nails[finger].y} width="20" height="29" rx="8" />
        </g>
      ))}
    </svg>
  );
}
