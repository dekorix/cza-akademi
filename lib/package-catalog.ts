export const packageCatalog = {
  ANZAN: {
    code: 'ANZAN',
    label: 'Anzan Programı',
    priceTry: 10_000,
    description: 'Soroban, parmak tekniği ve Anzan çalışma hattı.',
    access: [
      { code: 'finger_read', label: 'Parmak Okuma', ready: true },
      { code: 'finger_press', label: 'Parmak Gösterme', ready: true },
      { code: 'soroban_read', label: 'Soroban Okuma', ready: true },
      { code: 'soroban_write', label: 'Soroban Yazma', ready: true },
      { code: 'arithmetic', label: 'Toplama / Çıkarma', ready: true },
      { code: 'flash_anzan', label: 'Flash Anzan', ready: true },
      { code: 'audio_anzan', label: 'Sesli Anzan', ready: true },
      { code: 'soroban_course', label: 'Soroban Öğrenme Yolu', ready: true },
    ],
  },
  ZIHIN_GELISIM: {
    code: 'ZIHIN_GELISIM',
    label: 'Zihin Gelişim Programı',
    priceTry: 15_000,
    description: 'Hafıza, dikkat, hızlı okuma ve öğrenmeyi öğrenme programları.',
    access: [
      { code: 'memory', label: 'Hafıza Teknikleri', ready: true },
      { code: 'speed_reading', label: 'Hızlı Okuma', ready: true },
      { code: 'attention_focus', label: 'Dikkat ve Derin Odak', ready: true },
      { code: 'mind_maps', label: 'Zihin Haritaları', ready: true },
      { code: 'intelligence_games', label: 'Zekâ Oyunları', ready: false },
      { code: 'effective_notes', label: 'Etkili Not Alma', ready: false },
      { code: 'full_learning_37', label: 'Tam Öğrenme Sistemi', ready: false },
    ],
  },
  BUTUNLESIK: {
    code: 'BUTUNLESIK',
    label: 'Anzan + Zihin Gelişim',
    priceTry: 20_000,
    description: 'Anzan ve Zihin Gelişim hatlarının birlikte kullanıldığı bütünleşik paket.',
    access: [
      { code: 'finger_read', label: 'Parmak Okuma', ready: true },
      { code: 'finger_press', label: 'Parmak Gösterme', ready: true },
      { code: 'soroban_read', label: 'Soroban Okuma', ready: true },
      { code: 'soroban_write', label: 'Soroban Yazma', ready: true },
      { code: 'arithmetic', label: 'Toplama / Çıkarma', ready: true },
      { code: 'flash_anzan', label: 'Flash Anzan', ready: true },
      { code: 'audio_anzan', label: 'Sesli Anzan', ready: true },
      { code: 'soroban_course', label: 'Soroban Öğrenme Yolu', ready: true },
      { code: 'memory', label: 'Hafıza Teknikleri', ready: true },
      { code: 'speed_reading', label: 'Hızlı Okuma', ready: true },
      { code: 'attention_focus', label: 'Dikkat ve Derin Odak', ready: true },
      { code: 'mind_maps', label: 'Zihin Haritaları', ready: true },
      { code: 'intelligence_games', label: 'Zekâ Oyunları', ready: false },
      { code: 'effective_notes', label: 'Etkili Not Alma', ready: false },
      { code: 'full_learning_37', label: 'Tam Öğrenme Sistemi', ready: false },
    ],
  },
} as const;

export type PackageCode = keyof typeof packageCatalog;
export type ActivationBasis = 'PAYMENT_CONFIRMED' | 'PILOT_COMPLIMENTARY';

export function isPackageCode(value: string): value is PackageCode {
  return Object.hasOwn(packageCatalog, value);
}

export function readyAccessCodes(packageCode: PackageCode) {
  return packageCatalog[packageCode].access.filter(item => item.ready).map(item => item.code);
}

export function allAccessCodes(packageCode: PackageCode) {
  return packageCatalog[packageCode].access.map(item => item.code);
}

export function packagePriceSnapshot(packageCode: PackageCode) {
  return packageCatalog[packageCode].priceTry;
}

export function accessCatalog() {
  const map = new Map<string, { code: string; label: string; ready: boolean }>();
  for (const pack of Object.values(packageCatalog)) {
    for (const item of pack.access) {
      const existing = map.get(item.code);
      map.set(item.code, existing ? { ...existing, ready: existing.ready || item.ready } : { ...item });
    }
  }
  return [...map.values()];
}


export function isPackageFullyReady(packageCode: PackageCode) {
  return packageCatalog[packageCode].access.every(item => item.ready);
}

export function packageReadiness(packageCode: PackageCode) {
  const all = packageCatalog[packageCode].access;
  const ready = all.filter(item => item.ready);
  return {
    ready: ready.length,
    total: all.length,
    fullyReady: ready.length === all.length,
    pendingLabels: all.filter(item => !item.ready).map(item => item.label),
  };
}


const readyAccessCodeSet: Set<string> = new Set(
  Object.values(packageCatalog).flatMap(pack => pack.access.filter(item => item.ready).map(item => item.code)),
);

export function isReadyAccessCode(value: string) {
  return readyAccessCodeSet.has(value);
}

export function isPackageAccessCode(value: string) {
  return accessCatalog().some(item => item.code === value);
}
