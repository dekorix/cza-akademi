'use client';

import { useLayoutEffect, useRef } from 'react';

type Size = 'compact' | 'large' | 'hero';

export function ExerciseNumberDisplay({ value, operator, size = 'large', animate = false, className = '' }: { value: string | number; operator?: string; size?: Size; animate?: boolean; className?: string }) {
  const root=useRef<HTMLSpanElement>(null);
  useLayoutEffect(()=>{
    if(size!=='hero'||!root.current) return;
    const element=root.current, parent=element.parentElement;
    if(!parent) return;
    const resize=()=>{ const bounds=parent.getBoundingClientRect(); const characters=String(value).length+(operator?1:0); const pixels=Math.max(64,Math.min(bounds.height*.58,bounds.width/Math.max(1.15,characters*.62))); element.style.fontSize=`${pixels}px`; };
    const observer=new ResizeObserver(resize); observer.observe(parent); resize(); return()=>observer.disconnect();
  },[operator,size,value]);
  return <span ref={root} className={`exercise-number exercise-number-${size} ${animate ? 'exercise-number-enter' : ''} ${className}`}>
    {operator !== undefined && <span className="exercise-operation" aria-hidden={!operator}>{operator || '\u00a0'}</span>}
    <span>{value}</span>
  </span>;
}
