export type P2FullSection = {
  id: string;
  title: string;
  source: string;
  minTasks: number;
  maxTasks: number;
};

export const P2_FULL_SECTIONS: P2FullSection[] = [
  { id:'P2-01', title:'Tanışma ve İlgi', source:'WarmupDiscoveryLab', minTasks:9, maxTasks:9 },
  { id:'P2-02', title:'Sayı ve Nicelik Başlangıcı', source:'CzaApp/Warmup', minTasks:2, maxTasks:2 },
  { id:'P2-03', title:'Görsel Bellek', source:'CzaApp/Visual Memory', minTasks:1, maxTasks:1 },
  { id:'P2-04', title:'Dikkat Avı', source:'CzaApp/Attention Hunt', minTasks:1, maxTasks:3 },
  { id:'P2-05', title:'Matematik Güç Taraması', source:'Math Scan', minTasks:17, maxTasks:23 },
  { id:'P2-06', title:'Dil ve Anlama', source:'LanguageScan', minTasks:15, maxTasks:20 },
  { id:'P2-07', title:'Görsel Strateji ve Mantık', source:'VisualStrategyLab', minTasks:10, maxTasks:10 },
  { id:'P2-08', title:'Çalışma Belleği', source:'WorkingMemoryLab', minTasks:16, maxTasks:16 },
  { id:'P2-09', title:'Hız ve Tepki Kontrolü', source:'SpeedBalanceLab', minTasks:10, maxTasks:10 },
  { id:'P2-10', title:'Planlama ve Yönetici Beceriler', source:'PlanExecutiveLab', minTasks:16, maxTasks:16 },
  { id:'P2-11', title:'Potansiyel ve Esnek Düşünme', source:'PotentialLab', minTasks:16, maxTasks:16 },
  { id:'P2-12', title:'Organizasyon', source:'OrganizerLab', minTasks:10, maxTasks:10 },
  { id:'P2-13', title:'Karar Verme', source:'DecisionLab', minTasks:12, maxTasks:12 },
  { id:'P2-14', title:'Transfer ve Doğrulama', source:'AdaptiveTransferLab', minTasks:6, maxTasks:6 },
  { id:'P2-15', title:'Üstbiliş', source:'MetacognitionLab', minTasks:12, maxTasks:12 },
  { id:'P2-16', title:'Sesli Okuma ve Akıcılık', source:'ReadingFluencyLab', minTasks:8, maxTasks:8 },
  { id:'P2-17', title:'Sesli Dikkat', source:'VoiceStroopLab', minTasks:1, maxTasks:1 },
  { id:'P2-18', title:'Anlatım ve Sözel Üretim', source:'ExpressionLab', minTasks:14, maxTasks:14 },
  { id:'P2-19', title:'Matematik Tutumu ve Özgüven', source:'MathAttitudeLab', minTasks:10, maxTasks:10 },
  { id:'P2-20', title:'Duygusal Farkındalık', source:'EmotionalAwarenessLab', minTasks:10, maxTasks:10 },
  { id:'P2-21', title:'Koçluk ve Öz Liderlik', source:'SelfLeadershipLab', minTasks:10, maxTasks:10 },
  { id:'P2-22', title:'Karakter ve Ahlaki Gelişim', source:'CharacterCompassLab', minTasks:10, maxTasks:10 },
  { id:'P2-23', title:'Manevi Farkındalık ve Değerler', source:'SpiritualValuesLab', minTasks:10, maxTasks:10 },
];

export const P2_FULL_MIN_TASKS=P2_FULL_SECTIONS.reduce((sum,item)=>sum+item.minTasks,0);
export const P2_FULL_MAX_TASKS=P2_FULL_SECTIONS.reduce((sum,item)=>sum+item.maxTasks,0);

export const P2_FULL_REQUIRED_AREAS = [
  'Zihinsel İşlem Hızı',
  'Sayısal Mantık ve Akıl Yürütme',
  'Görsel-Mekânsal Algı ve Hafıza',
  'İşitsel Dikkat ve Hafıza',
  'Matematik Tutumu ve Özgüven',
  'Okuma Becerisi',
  'Hafıza ve Hatırlama',
  'Organize Etme Becerisi',
  'Dikkat ve Odaklanma',
  'Düşünme ve Problem Çözme',
  'Duygusal Farkındalık',
  'Koçluk ve Öz Liderlik',
  'Karakter ve Ahlaki Gelişim',
  'Manevi Farkındalık ve Değerler',
] as const;
