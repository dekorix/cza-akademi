'use client';

import { useRef, useState } from 'react';
import type { FingerName, HandPattern } from '@/lib/finger-engine';

const regions: Record<FingerName, string> = {
  index: 'M211 428 C207 400 244 397 254 420 C273 462 290 550 305 618 L251 640 C245 562 223 477 211 428Z',
  middle: 'M135 452 C131 421 167 416 179 445 C200 501 218 566 239 632 L190 662 C174 590 147 496 135 452Z',
  ring: 'M83 520 C74 491 108 481 122 505 C147 553 170 607 187 658 L141 710 C134 648 98 565 83 520Z',
  little: 'M46 614 C36 587 67 577 81 599 C107 642 125 680 140 718 L102 744 C83 704 59 648 46 614Z',
  thumb: 'M334 678 C333 626 333 574 361 549 C378 533 406 540 400 563 C389 610 395 658 400 709 L356 729Z',
};

const nails = 'M219 433 C210 410 237 406 244 424 L251 444 Q238 452 224 450Z M144 453 C136 431 161 427 168 443 L176 464 Q163 472 150 470Z M91 517 C85 496 107 493 115 510 L122 529 Q109 537 98 534Z M52 611 C44 592 66 589 73 602 L79 618 Q67 626 58 624Z M365 582 C363 555 380 543 397 550 L397 590 Q379 590 365 584Z';
const labels: Record<FingerName, string> = { thumb: 'başparmak', index: 'işaret parmağı', middle: 'orta parmak', ring: 'yüzük parmağı', little: 'serçe parmak' };

export function FingerHand({ side, pattern, interactive, rejectedFinger, onFinger }: {
  side: 'left' | 'right'; pattern: HandPattern; interactive?: boolean; rejectedFinger?: FingerName | null; onFinger?: (finger: FingerName) => void;
}) {
  const [pressing, setPressing] = useState<FingerName | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fingers: FingerName[] = ['index', 'middle', 'ring', 'little', 'thumb'];
  const sideLabel = side === 'left' ? 'Sol el, onlar basamağı' : 'Sağ el, birler basamağı';
  const id = `exact-${side}`;
  function press(finger: FingerName) {
    if (!interactive) return;
    if (timer.current) clearTimeout(timer.current);
    setPressing(finger);
    try { navigator.vibrate?.(10); } catch { /* Desteklenmeyebilir. */ }
    timer.current = setTimeout(() => setPressing(null), 160);
  }
  return (
    <svg className="finger-hand exact-hand" viewBox="35 390 385 630" aria-label={sideLabel}>
      <defs>
        <clipPath id={`${id}-nails`}><path d={nails} /></clipPath>
        {fingers.map((finger) => <linearGradient key={finger} id={`${id}-wash-${finger}`} x1="0%" y1="0%" x2="0%" y2="100%"><stop stopColor="#ff2419" stopOpacity=".92" /><stop offset=".25" stopColor="#ff2419" stopOpacity=".85" /><stop offset=".8" stopColor="#ff2419" stopOpacity="0" /><stop offset="1" stopColor="#ff2419" stopOpacity="0" /></linearGradient>)}
      </defs>
      <g transform={side === 'right' ? 'translate(455 0) scale(-1 1)' : undefined}>
        <image data-exact-asset="true" href="/assets/approved-reference.png" x="0" y="0" width="864" height="1536" />
        {fingers.map((finger) => <path key={`overlay-${finger}`} data-overlay={`${side}-${finger}`} className={`exact-active ${pressing === finger ? 'pressing' : ''}`} d={regions[finger]} fill={`url(#${id}-wash-${finger})`} style={{ opacity: pattern[finger] ? 1 : 0, mixBlendMode: 'multiply' }} />)}
        {Object.values(pattern).some(Boolean) && <image href="/assets/approved-reference.png" x="0" y="0" width="864" height="1536" clipPath={`url(#${id}-nails)`} pointerEvents="none" />}
        {fingers.map((finger) => <path key={`hit-${finger}`} d={regions[finger]} data-finger={`${side}-${finger}`} className={`hand-hit ${rejectedFinger === finger ? 'rejected' : ''}`} role={interactive ? 'button' : undefined} tabIndex={interactive ? 0 : -1} aria-label={interactive ? `${sideLabel}: ${labels[finger]} ${pattern[finger] ? 'aktif' : 'pasif'}` : undefined} aria-pressed={interactive ? pattern[finger] : undefined} aria-disabled={!interactive} onPointerDown={() => press(finger)} onClick={() => interactive && onFinger?.(finger)} onKeyDown={(event) => { if (interactive && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); press(finger); onFinger?.(finger); } }} />)}
      </g>
    </svg>
  );
}
