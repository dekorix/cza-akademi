import type { ExerciseMode } from './exercise-engine';

export type ExerciseCategory = 'paritmetik' | 'soroban' | 'arithmetic' | 'anzan';
export type ExerciseDefinition = {
  id: 'FINGER_READING' | 'FINGER_PRESSING' | 'SOROBAN_READING' | 'SOROBAN_WRITING' | 'ADDITION_SUBTRACTION' | 'FLASH_ANZAN' | 'AUDIO_ANZAN';
  title: string;
  category: ExerciseCategory;
  icon: 'hand' | 'abacus' | 'operation' | 'speed';
  description: string;
  skills: string[];
  mode?: ExerciseMode;
  href?: string;
};

export const exerciseCategories: Record<ExerciseCategory, { title: string; description: string }> = {
  paritmetik: { title: 'Paritmetik', description: 'Parmakla sayıyı tanı ve doğru teknikle kur.' },
  soroban: { title: 'Soroban', description: 'Sayıyı sorobanda oku veya boncuklarla oluştur.' },
  arithmetic: { title: 'Aritmetik', description: 'Toplama ve çıkarma işlemlerini uygula.' },
  anzan: { title: 'Anzan / Hız', description: 'Görsel ve işitsel zihinsel işlem akıcılığı.' },
};

export const exerciseRegistry: ExerciseDefinition[] = [
  { id: 'FINGER_READING', title: 'Parmak Okuma', category: 'paritmetik', icon: 'hand', description: 'Gör → Tanı → Cevapla', skills: ['finger.numberRecognition','visual.processingSpeed'], mode: 'finger-read' },
  { id: 'FINGER_PRESSING', title: 'Parmak Basma', category: 'paritmetik', icon: 'hand', description: 'Sayıyı doğru teknikle kur', skills: ['finger.numberConstruction'], href: '/paritmetik?mode=press' },
  { id: 'SOROBAN_READING', title: 'Soroban Okuma', category: 'soroban', icon: 'abacus', description: 'Gör → Oku → Cevapla', skills: ['soroban.numberRecognition','soroban.placeValue','visual.processingSpeed'], mode: 'soroban-read' },
  { id: 'SOROBAN_WRITING', title: 'Soroban Yazma', category: 'soroban', icon: 'abacus', description: 'Gör → Sorobanda oluştur', skills: ['soroban.numberConstruction','soroban.placeValue'], mode: 'soroban-write' },
  { id: 'ADDITION_SUBTRACTION', title: 'Toplama / Çıkarma', category: 'arithmetic', icon: 'operation', description: 'İşle → Uygula → Kontrol et', skills: ['arithmetic.addition','arithmetic.subtraction'], href: '/arithmetic' },
  { id: 'FLASH_ANZAN', title: 'Flash Anzan', category: 'anzan', icon: 'speed', description: 'Görsel akışla zihinden işle', skills: ['mental.visualization','anzan.calculation','visual.processingSpeed'], mode: 'flash' },
  { id: 'AUDIO_ANZAN', title: 'Sesli Anzan', category: 'anzan', icon: 'speed', description: 'Dinle ve zihinden işle', skills: ['anzan.calculation','response.fluency'], mode: 'audio' },
];

export function exerciseForMode(mode: ExerciseMode) {
  return exerciseRegistry.find(exercise => exercise.mode === mode);
}
