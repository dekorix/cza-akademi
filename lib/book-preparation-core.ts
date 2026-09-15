export const BOOK_PREPARATION_SCHEMA_VERSION = 'CZA_BOOK_PREVIEW_V1';
export const BOOK_PREPARATION_MODULE_VERSION = '0.1.0-preview';

export type BookDifficulty = 'foundation' | 'developing' | 'advanced';
export type BookBlockKind = 'heading' | 'paragraph';

export type BookContentBlock = {
  clientBlockId: string;
  kind: BookBlockKind;
  text: string;
};

export type BookTargetWpm = {
  minimum: number;
  preferred: number;
  maximum: number;
};

export type BookDraftInput = {
  title: string;
  language: 'tr-TR';
  difficulty: BookDifficulty;
  targetWpm: BookTargetWpm;
  blocks: BookContentBlock[];
};

export type ServerVerifiedBookContentSummary = Readonly<{
  schemaVersion: typeof BOOK_PREPARATION_SCHEMA_VERSION;
  moduleVersion: typeof BOOK_PREPARATION_MODULE_VERSION;
  summaryType: 'server_verified_content_summary';
  serverValidated: true;
  persistenceEnabled: false;
  productionLedgerEligible: false;
  contentHash: string;
  wordCount: number;
  approximateReadingSeconds: number;
  draft: BookDraftInput;
}>;

export function deepFreezeBookValue<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreezeBookValue(nested);
    Object.freeze(value);
  }
  return value;
}

export const BOOK_DIFFICULTY_LABELS: Readonly<Record<BookDifficulty, string>> =
  deepFreezeBookValue({
    foundation: 'Temel',
    developing: 'Gelişen',
    advanced: 'İleri',
  });

export const SYNTHETIC_BOOK_DRAFT: Readonly<BookDraftInput> =
  deepFreezeBookValue({
    title: 'Gökyüzü Kütüphanesi',
    language: 'tr-TR',
    difficulty: 'foundation',
    targetWpm: {
      minimum: 80,
      preferred: 120,
      maximum: 160,
    },
    blocks: [
      {
        clientBlockId: 'block-opening',
        kind: 'heading',
        text: 'Bulutların Arasındaki Kitaplık',
      },
      {
        clientBlockId: 'block-story',
        kind: 'paragraph',
        text: 'Ada, sabah penceresini açınca gökyüzünde süzülen küçük bir kütüphane gördü. Her raf, yeni bir merak sorusuna açılıyordu.',
      },
    ],
  });
