export const PHASE2_INTEGRATION_VERSION = '0.1.0-isolated-preview';

export type Phase2Audience = 'student' | 'educator';

export type Phase2ModuleLink = Readonly<{
  id: 'fast-reading' | 'book-preparation' | 'attention';
  audience: Phase2Audience;
  title: string;
  description: string;
  href: string;
  status: 'isolated_prototype';
  evidenceLabel: 'client_telemetry' | 'synthetic_attention' | 'content_summary';
  persistence: 'disabled';
}>;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export const PHASE2_MODULES: readonly Phase2ModuleLink[] = deepFreeze([
  {
    id: 'fast-reading',
    audience: 'student',
    title: 'Hızlı Okuma',
    description:
      'Odak genişletme, Schulte tarama ve sunucu saatli kelime yakalama çalışmaları.',
    href: '/speed-reading',
    status: 'isolated_prototype',
    evidenceLabel: 'client_telemetry',
    persistence: 'disabled',
  },
  {
    id: 'attention',
    audience: 'student',
    title: 'Dikkat ve Odaklanma',
    description:
      'Stroop çelişki yönetimi ve süreli görsel hafıza matrisi alıştırmaları.',
    href: '/attention',
    status: 'isolated_prototype',
    evidenceLabel: 'synthetic_attention',
    persistence: 'disabled',
  },
  {
    id: 'book-preparation',
    audience: 'educator',
    title: 'Kitap Hazırlama',
    description:
      'Eğitimci kimlik kapısı arkasında metin blokları ve hedef okuma ayarları hazırlama alanı.',
    href: '/book-preparation/access',
    status: 'isolated_prototype',
    evidenceLabel: 'content_summary',
    persistence: 'disabled',
  },
]);

export const PHASE2_TRUST_BOUNDARY = deepFreeze({
  environment: 'isolated_preview' as const,
  database: 'not_connected' as const,
  canonicalLedger: 'disabled' as const,
  productionEligible: false as const,
  sharedModuleToken: false as const,
  timingTerm: 'server_observed_approximation' as const,
  attentionEvidenceTerm: 'synthetic_attention' as const,
});

export function phase2IntegrationEnabled(
  environment: NodeJS.ProcessEnv = process.env,
) {
  return (
    environment.NODE_ENV !== 'production' &&
    environment.CZA_PHASE2_INTEGRATION_PREVIEW === 'true'
  );
}
