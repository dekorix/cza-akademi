export type SpecialLearningStatus =
  | 'RELATIVE_STRENGTH'
  | 'WATCH'
  | 'PRIORITY'
  | 'EXPERT_REVIEW'
  | 'INSUFFICIENT';

export type SpecialLearningDomain = {
  key: string;
  label: string;
  evidenceCount: number;
  independentCount: number;
  supportedCount: number;
  score: number | null;
  status: SpecialLearningStatus;
  recurringFlags: string[];
};

export type SpecialLearningProfile = {
  sessionId: string;
  profileCode: string;
  profileLabel: string;
  templateCode: string;
  completedAt: string | null;
  evidenceCount: number;
  independentCount: number;
  supportedCount: number;
  overallStatus: SpecialLearningStatus;
  domains: SpecialLearningDomain[];
  priorities: {
    key: string;
    label: string;
    status: SpecialLearningStatus;
    reason: string;
  }[];
  note: string;
};

type AttemptRow = {
  task_code?: unknown;
  answer_payload?: unknown;
  support_level?: unknown;
};

type ObservationRow = {
  task_code?: unknown;
  observation_codes?: unknown;
};

const profileLabels: Record<string, string> = {
  'SP-DYS': 'Disleksi / Okuma Güçlüğü Tarama Profili',
  'SP-SLD': 'Özgül Öğrenme Güçlüğü Eğitsel Profili',
  'SP-DYSC': 'Diskalkuli / Matematik Öğrenme Güçlüğü',
  'SP-DYSG': 'Disgrafi / Yazılı Anlatım-Yazma Güçlüğü',
  'SP-ASD': 'Otizm Spektrumu Eğitsel Profili',
  'SP-LANG': 'Dil ve Konuşma Gelişimi',
  'SP-ATTN': 'Dikkat – Odaklanma – Yürütücü İşlevler',
  'SP-DELAY': 'Gelişimsel Gecikme',
  'SP-COG': 'Bilişsel / Öğrenme Hızı Profili',
  'SP-MIX': 'Karma Profil',
};

const dyslexiaDomains: [RegExp, string, string][] = [
  [/^DYS-PH/, 'phonological', 'Fonolojik İşleme'],
  [/^DYS-LS/, 'letter_sound', 'Harf–Ses Otomatikliği'],
  [/^DYS-OR/, 'orthographic', 'Görsel / Ortografik Ayırt Etme'],
  [/^DYS-BL/, 'blending', 'Hece Birleştirme ve Köprüleme'],
  [/^DYS-DE/, 'decoding', 'Gerçek + Uydurma Kelime Çözümleme'],
  [/^DYS-RA/, 'ran', 'Hızlı Otomatik İsimlendirme'],
  [/^DYS-WM/, 'working_memory', 'İşitsel Çalışma Belleği'],
  [/^DYS-FL/, 'fluency', 'Okuma Akıcılığı'],
  [/^DYS-CO/, 'comprehension', 'Okuma–Dinleme Anlama Ayrımı'],
  [/^DYS-DI/, 'dictation', 'Dikte ve Yazılı Kodlama'],
  [/^DYS-ER/, 'error_awareness', 'Hata Farkındalığı ve Öz-Düzeltme'],
  [/^DYS-TR/, 'learning_transfer', 'Öğrenme Tepkisi ve Transfer'],
];

function payloadOf(row: AttemptRow) {
  return row.answer_payload && typeof row.answer_payload === 'object' && !Array.isArray(row.answer_payload)
    ? row.answer_payload as Record<string, unknown>
    : {};
}

function verdictPoints(verdict: unknown) {
  if (verdict === 'MATCH') return 0;
  if (verdict === 'PARTIAL') return 1;
  if (verdict === 'DIFFERENT' || verdict === 'NO_RESPONSE') return 2;
  return 1.5;
}

function supportPoints(payload: Record<string, unknown>, row: AttemptRow) {
  const support = payload.supportLevel;
  if (support === 'INDEPENDENT' || row.support_level === 0) return 0;
  if (support === 'VERBAL_PROMPT' || support === 'VISUAL_PROMPT' || row.support_level === 1 || row.support_level === 2) return 0.5;
  if (support === 'MODELED' || support === 'PHYSICAL_ASSIST' || row.support_level === 3 || row.support_level === 4) return 1;
  return 0.75;
}

export function specialStatusForScore(score: number | null, evidenceCount: number): SpecialLearningStatus {
  if (evidenceCount < 2 || score == null) return 'INSUFFICIENT';
  if (score < 0.65) return 'RELATIVE_STRENGTH';
  if (score < 1.15) return 'WATCH';
  if (score < 1.7) return 'PRIORITY';
  return 'EXPERT_REVIEW';
}

function domainFor(profileCode: string, taskCode: string, payload: Record<string, unknown>) {
  if (profileCode === 'SP-DYS') {
    const match = dyslexiaDomains.find(([pattern]) => pattern.test(taskCode));
    if (match) return { key: match[1], label: match[2] };
  }
  const area = typeof payload.area === 'string' && payload.area.trim()
    ? payload.area.trim().slice(0, 120)
    : 'Diğer eğitimsel kanıt';
  return { key: area.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi, '_').replace(/^_+|_+$/g, ''), label: area };
}

function reasonFor(domain: SpecialLearningDomain) {
  if (domain.status === 'EXPERT_REVIEW') return `${domain.label} alanında destek ve farklı yanıt örüntüleri birden fazla kanıtta tekrar ediyor. Hedefli eğitim desteğiyle birlikte kalıcı işlevsel güçlük varsa yetkili uzman değerlendirmesi düşünülmelidir.`;
  if (domain.status === 'PRIORITY') return `${domain.label} alanı kısa dönem eğitim planında öncelikli çalışılmalıdır; bağımsız performans ve destek sonrası değişim yeniden ölçülmelidir.`;
  if (domain.status === 'WATCH') return `${domain.label} alanında karışık kanıt var. Kısa hedefli destek ve yakın yeniden ölçüm önerilir.`;
  return `${domain.label} alanı göreli güçlü kaynak olarak kullanılabilir.`;
}

export function buildSpecialLearningProfile(input: {
  session: { id: string; template_code: string; completed_at?: string | null; metadata?: unknown };
  attempts: AttemptRow[];
  observations: ObservationRow[];
}): SpecialLearningProfile | null {
  const metadata = input.session.metadata && typeof input.session.metadata === 'object' && !Array.isArray(input.session.metadata)
    ? input.session.metadata as Record<string, unknown>
    : {};
  const profileCode = typeof metadata.profileCode === 'string' ? metadata.profileCode : '';
  if (!profileLabels[profileCode]) return null;

  const observationByTask = new Map<string, string[]>();
  for (const row of input.observations) {
    const taskCode = typeof row.task_code === 'string' ? row.task_code : '';
    if (!taskCode) continue;
    const flags = Array.isArray(row.observation_codes)
      ? row.observation_codes.map(String).filter(Boolean).slice(0, 24)
      : [];
    observationByTask.set(taskCode, flags);
  }

  const buckets = new Map<string, {
    label: string;
    evidence: number;
    independent: number;
    supported: number;
    points: number;
    flags: Map<string, number>;
  }>();

  let evidenceCount = 0;
  let independentCount = 0;
  let supportedCount = 0;

  for (const row of input.attempts) {
    const taskCode = typeof row.task_code === 'string' ? row.task_code : '';
    if (!taskCode) continue;
    const payload = payloadOf(row);
    const domain = domainFor(profileCode, taskCode, payload);
    const support = payload.supportLevel;
    const independent = support === 'INDEPENDENT' || row.support_level === 0;
    const notAssessed = support === 'NOT_ASSESSED' || support === 'NOT_OBSERVED';
    if (notAssessed) continue;

    const bucket = buckets.get(domain.key) || {
      label: domain.label,
      evidence: 0,
      independent: 0,
      supported: 0,
      points: 0,
      flags: new Map<string, number>(),
    };

    bucket.evidence += 1;
    bucket.points += verdictPoints(payload.verdict) + supportPoints(payload, row);
    if (independent) bucket.independent += 1;
    else bucket.supported += 1;

    const flags = [
      ...(Array.isArray(payload.flags) ? payload.flags.map(String) : []),
      ...(observationByTask.get(taskCode) || []),
    ];
    for (const flag of flags) bucket.flags.set(flag, (bucket.flags.get(flag) || 0) + 1);

    buckets.set(domain.key, bucket);
    evidenceCount += 1;
    if (independent) independentCount += 1;
    else supportedCount += 1;
  }

  const domains = [...buckets.entries()].map(([key, bucket]) => {
    const score = bucket.evidence ? bucket.points / bucket.evidence : null;
    return {
      key,
      label: bucket.label,
      evidenceCount: bucket.evidence,
      independentCount: bucket.independent,
      supportedCount: bucket.supported,
      score,
      status: specialStatusForScore(score, bucket.evidence),
      recurringFlags: [...bucket.flags.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([flag]) => flag),
    } satisfies SpecialLearningDomain;
  }).sort((a, b) => {
    const rank: Record<SpecialLearningStatus, number> = { EXPERT_REVIEW: 5, PRIORITY: 4, WATCH: 3, RELATIVE_STRENGTH: 2, INSUFFICIENT: 1 };
    return rank[b.status] - rank[a.status] || (b.score || 0) - (a.score || 0);
  });

  const priorities = domains
    .filter(domain => domain.status !== 'INSUFFICIENT')
    .slice(0, 5)
    .map(domain => ({ key: domain.key, label: domain.label, status: domain.status, reason: reasonFor(domain) }));

  const scored = domains.filter(domain => domain.status !== 'INSUFFICIENT');
  const high = scored.filter(domain => domain.status === 'EXPERT_REVIEW').length;
  const priority = scored.filter(domain => domain.status === 'PRIORITY').length;
  const watch = scored.filter(domain => domain.status === 'WATCH').length;
  const overallStatus: SpecialLearningStatus = scored.length < 2
    ? 'INSUFFICIENT'
    : high >= 2
      ? 'EXPERT_REVIEW'
      : high >= 1 || priority >= 2
        ? 'PRIORITY'
        : priority >= 1 || watch >= 2
          ? 'WATCH'
          : 'RELATIVE_STRENGTH';

  return {
    sessionId: input.session.id,
    profileCode,
    profileLabel: profileLabels[profileCode],
    templateCode: input.session.template_code,
    completedAt: input.session.completed_at || null,
    evidenceCount,
    independentCount,
    supportedCount,
    overallStatus,
    domains,
    priorities,
    note: 'Bu profil klinik tanı değildir. İlk performans, destek düzeyi, hata örüntüsü ve öğrenme tepkisini eğitim planı için birlikte yorumlar. Uzman değerlendirmesi ifadesi yalnız kalıcı ve işlevsel güçlüklerde yönlendirme önerisidir.',
  };
}
