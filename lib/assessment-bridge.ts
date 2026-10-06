export const SPECIAL_BRIDGE_PROFILE_CODES = [
  'SP-DYS','SP-SLD','SP-DYSC','SP-DYSG','SP-ASD','SP-LANG','SP-ATTN','SP-DELAY','SP-COG','SP-MIX',
] as const;

export const INTAKE_PROFILE_CODES = [
  'E0','E1','E2','E3','E4','E5',
  'P1','P2','P3','P4','P5','P6','P7','P8','P9','P10',
] as const;

export type IntakeProfileCode = typeof INTAKE_PROFILE_CODES[number];

export type AssessmentPurpose =
  | 'GENERAL'
  | 'LANGUAGE'
  | 'SCHOOL_READINESS'
  | 'ACADEMIC'
  | 'COGNITIVE'
  | 'LGS'
  | 'YKS'
  | 'REASSESSMENT';

export type AssessmentBridgeStatus =
  | 'CENTRAL_READY'
  | 'SOURCE_REFERENCE_ONLY'
  | 'PLANNED';

export type AssessmentBridgeTarget = {
  profileCode: string;
  sourceLabel: string;
  status: AssessmentBridgeStatus;
  centralRoute: string | null;
  templateFamily: string | null;
  requiresBirthDate: boolean;
  allowedPurposes: AssessmentPurpose[];
  reason: string;
};

const BASE: Record<IntakeProfileCode, AssessmentBridgeTarget> = {
  E0:{profileCode:'E0',sourceLabel:'0–12 ay · Erken Gelişim',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'Yaşa özel merkezi görev bankası henüz port edilmedi.'},
  E1:{profileCode:'E1',sourceLabel:'12–24 ay · Erken Gelişim',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'Yaşa özel merkezi görev bankası henüz port edilmedi.'},
  E2:{profileCode:'E2',sourceLabel:'24–36 ay · Erken Gelişim',status:'CENTRAL_READY',centralRoute:'/api/assessment-e2-linked',templateFamily:'CZA_E2_V7',requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'138 görevlik E2-v7 adaptif motoru, bakımveren kanıtı ve rapor merkezi CZA öğrenci kimliğiyle hazır.'},
  E3:{profileCode:'E3',sourceLabel:'36–48 ay · Erken Gelişim',status:'CENTRAL_READY',centralRoute:'/api/assessment-e3-linked',templateFamily:'CZA_E3',requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'Merkezi öğrenci kimliği ve eğitimci yetkisi ile hazır.'},
  E4:{profileCode:'E4',sourceLabel:'48–60 ay · Erken Gelişim',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:true,allowedPurposes:['GENERAL','LANGUAGE'],reason:'Yaşa özel merkezi görev bankası henüz port edilmedi.'},
  E5:{profileCode:'E5',sourceLabel:'60–72 ay · Okula Hazırlık',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:true,allowedPurposes:['GENERAL','SCHOOL_READINESS'],reason:'Okula hazırlık görev bankası merkezi hatta henüz port edilmedi.'},
  P1:{profileCode:'P1',sourceLabel:'1. Sınıf',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'1. sınıf merkezi görev bankası henüz port edilmedi.'},
  P2:{profileCode:'P2',sourceLabel:'1. sınıf sonu / 2. sınıf başlangıcı',status:'SOURCE_REFERENCE_ONLY',centralRoute:null,templateFamily:'CZA_P2_FULL_V1',requiresBirthDate:false,allowedPurposes:['GENERAL'],reason:'Eski gerçek P2 motorundaki 23 bölüm ve tüm mikro-görevler merkezi CZA’ya eksiksiz port edilene kadar kilitli.'},
  P3:{profileCode:'P3',sourceLabel:'3. Sınıf',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'3. sınıf merkezi görev bankası henüz port edilmedi.'},
  P4:{profileCode:'P4',sourceLabel:'4. Sınıf',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'4. sınıf merkezi görev bankası henüz port edilmedi.'},
  P5:{profileCode:'P5',sourceLabel:'5. Sınıf',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'5. sınıf merkezi görev bankası henüz port edilmedi.'},
  P6:{profileCode:'P6',sourceLabel:'6. Sınıf',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'6. sınıf merkezi görev bankası henüz port edilmedi.'},
  P7:{profileCode:'P7',sourceLabel:'7. Sınıf · LGS Ön Hazırlık',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC','LGS'],reason:'7. sınıf / LGS ön hazırlık merkezi görev bankası henüz port edilmedi.'},
  P8:{profileCode:'P8',sourceLabel:'8. Sınıf · LGS',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC','LGS'],reason:'8. sınıf / LGS merkezi görev bankası henüz port edilmedi.'},
  P9:{profileCode:'P9',sourceLabel:'9–10. Sınıf · Lise Öğrenme Sistemi',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC'],reason:'Lise merkezi görev bankası henüz port edilmedi.'},
  P10:{profileCode:'P10',sourceLabel:'11–12 / Mezun · YKS-TYT',status:'PLANNED',centralRoute:null,templateFamily:null,requiresBirthDate:false,allowedPurposes:['GENERAL','ACADEMIC','YKS'],reason:'YKS/TYT merkezi görev bankası henüz port edilmedi.'},
};

function isSpecialBridgeProfileCode(value: unknown): value is (typeof SPECIAL_BRIDGE_PROFILE_CODES)[number] {
  return typeof value === 'string' && SPECIAL_BRIDGE_PROFILE_CODES.includes(value as (typeof SPECIAL_BRIDGE_PROFILE_CODES)[number]);
}

export function isIntakeProfileCode(value: unknown): value is IntakeProfileCode {
  return typeof value === 'string' && INTAKE_PROFILE_CODES.includes(value as IntakeProfileCode);
}

export function isAssessmentPurpose(value: unknown): value is AssessmentPurpose {
  return typeof value === 'string' && [
    'GENERAL','LANGUAGE','SCHOOL_READINESS','ACADEMIC','COGNITIVE','LGS','YKS','REASSESSMENT',
  ].includes(value);
}

export function resolveAssessmentBridge(profileCode: unknown, purpose: unknown): AssessmentBridgeTarget | null {
  if (isSpecialBridgeProfileCode(profileCode)) {
    return {
      profileCode,
      sourceLabel: profileCode,
      status:'CENTRAL_READY',
      centralRoute:'/api/assessment-special-linked',
      templateFamily:'CZA_SPECIAL_V1',
      requiresBirthDate:false,
      allowedPurposes:['GENERAL','REASSESSMENT'],
      reason:'Özel Eğitim ve Öğrenme Profili merkezi assessment omurgasında hazır.',
    };
  }
  if (!isIntakeProfileCode(profileCode)) return null;
  const target=BASE[profileCode];
  if (!isAssessmentPurpose(purpose)) return target;
  if (!target.allowedPurposes.includes(purpose)) {
    return {
      ...target,
      status:target.status==='CENTRAL_READY'?'PLANNED':target.status,
      centralRoute:null,
      reason:'Bu profil ile seçilen değerlendirme amacı için merkezi route henüz açılmadı.',
    };
  }
  return target;
}

export function assessmentBridgeCatalog() {
  return [
    ...INTAKE_PROFILE_CODES.map(code=>BASE[code]),
    ...SPECIAL_BRIDGE_PROFILE_CODES.map(code=>resolveAssessmentBridge(code,'GENERAL')!),
  ];
}
