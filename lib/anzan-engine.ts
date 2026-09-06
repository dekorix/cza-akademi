import type { ExerciseQuestion } from './exercise-engine';

export type AnzanStimulusMode = 'FLASH_ANZAN' | 'AUDIO_ANZAN';
export type AnzanTransitionEffect = 'NONE' | 'FADE' | 'MICRO_SCALE' | 'SLIDE_UP' | 'SLIDE_DOWN' | 'PULSE' | 'BLINK_CLEAN' | 'FLIP_SOFT';
export type AnzanTheme = 'PAPER_BLACK' | 'WHITE_BLACK' | 'CREAM_NAVY' | 'DARK_LIGHT';

export const transitionEffects: { id: AnzanTransitionEffect; label: string }[] = [
  { id: 'NONE', label: 'Efektsiz' }, { id: 'FADE', label: 'Yumuşak belirme' },
  { id: 'MICRO_SCALE', label: 'Hafif yaklaşma' }, { id: 'SLIDE_UP', label: 'Aşağıdan geçiş' },
  { id: 'SLIDE_DOWN', label: 'Yukarıdan geçiş' }, { id: 'PULSE', label: 'Yumuşak vurgu' },
  { id: 'BLINK_CLEAN', label: 'Temiz kesme' }, { id: 'FLIP_SOFT', label: 'Yumuşak çevirme' },
];

export const anzanThemes: Record<AnzanTheme, { label: string; background: string; foreground: string }> = {
  PAPER_BLACK: { label: 'Kitap kâğıdı + siyah', background: '#FCFBF7', foreground: '#101318' },
  WHITE_BLACK: { label: 'Beyaz + siyah', background: '#FFFFFF', foreground: '#090B0E' },
  CREAM_NAVY: { label: 'Açık krem + koyu lacivert', background: '#FBF5E9', foreground: '#102A43' },
  DARK_LIGHT: { label: 'Koyu zemin + açık yazı', background: '#142333', foreground: '#F8FAFC' },
};

export const anzanLanguageRegistry = {
  'tr-TR': {
    id: 'tr-TR', label: 'Türkçe', enabled: true,
    utterance(term: number, index: number) { return index === 0 ? String(term) : term < 0 ? `eksi ${Math.abs(term)}` : String(term); },
  },
} as const;

export type AnzanLanguage = keyof typeof anzanLanguageRegistry;

export type AnzanPresentationEvent = {
  eventIndex: number;
  term: number;
  phase: 'ENTER' | 'VISIBLE' | 'EXIT' | 'GAP';
  visibleMs: number;
  gapMs: number;
};

export function createPresentationEvents(question: ExerciseQuestion, visibleMs: number, gapMs: number): AnzanPresentationEvent[] {
  return question.sequence.flatMap((term, eventIndex) => ([
    { eventIndex, term, phase: 'ENTER' as const, visibleMs, gapMs },
    { eventIndex, term, phase: 'VISIBLE' as const, visibleMs, gapMs },
    { eventIndex, term, phase: 'EXIT' as const, visibleMs, gapMs },
    { eventIndex, term, phase: 'GAP' as const, visibleMs, gapMs },
  ]));
}

export function contrastRatio(background: string, foreground: string) {
  const luminance = (hex: string) => {
    const parts = [1,3,5].map(index => parseInt(hex.slice(index,index+2),16)/255).map(value => value <= .03928 ? value/12.92 : ((value+.055)/1.055)**2.4);
    return .2126*parts[0] + .7152*parts[1] + .0722*parts[2];
  };
  const a=luminance(background), b=luminance(foreground);
  return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}

export function anzanDifficulty(config: { stimulusVisibleMs?: number; minDigits?: number; maxDigits?: number; terms: number; additionPool?: number[]; subtractionPool?: number[]; operation: string; mode: string }) {
  return {
    stimulusSpeed: config.stimulusVisibleMs,
    digitCount: { min: config.minDigits, max: config.maxDigits },
    operationCount: config.terms,
    additionDigitPool: config.additionPool,
    subtractionDigitPool: config.subtractionPool,
    operationType: config.operation,
    audioVisualMode: config.mode === 'audio' ? 'AUDITORY' : 'VISUAL',
  };
}

export function numberAudioManifest(min=0,max=99) {
  if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min||max>999) throw new Error('Geçerli bir sayı ses aralığı seçin.');
  return Array.from({length:max-min+1},(_,index)=>min+index);
}

export function scheduleAudioClips(durationsMs: number[], gapMs: number) {
  let cursor=0;
  return durationsMs.map((duration,index)=>{ if(!Number.isFinite(duration)||duration<=0||!Number.isFinite(gapMs)||gapMs<0) throw new Error('Ses süresi ve boşluk geçerli olmalı.'); const event={index,startMs:cursor,endMs:cursor+duration}; cursor=event.endMs+gapMs; return event; });
}
