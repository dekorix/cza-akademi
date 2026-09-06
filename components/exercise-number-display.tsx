'use client';

type Size = 'compact' | 'large' | 'hero';

export function ExerciseNumberDisplay({ value, operator, size = 'large', animate = false, className = '' }: { value: string | number; operator?: string; size?: Size; animate?: boolean; className?: string }) {
  return <span className={`exercise-number exercise-number-${size} ${animate ? 'exercise-number-enter' : ''} ${className}`}>
    {operator !== undefined && <span className="exercise-operation" aria-hidden={!operator}>{operator || '\u00a0'}</span>}
    <span>{value}</span>
  </span>;
}
