import { buildCaregiverReport,type CaregiverState } from './earlyCaregiver';
import { buildCaregiverV4Report } from './earlyCaregiverV4';
import { buildV6SectionProgress, v6AgeBandLabel, v6ItemDomains, v6NeutralProbeIds, v6PrecursorDomains, v6RequiredIds } from './earlyDevelopmentV6';
import { buildV7CategoryPerformance, buildV7SectionProgress, v7AgeBandLabel, v7EligiblePoolIds, v7IsItemAllowed, v7ItemDomains, v7NeutralProbeIds, v7PrecursorDomains, v7TargetTotal, type V7AdaptiveProfile } from './earlyAdaptiveV7';
export type EarlyRating = 'independent' | 'prompted' | 'verbal_prompt' | 'visual_prompt' | 'modeled' | 'physical_assist' | 'not_observed' | 'not_assessed';

export type EarlyDevelopmentResponse = {
  itemId: string;
  rating: EarlyRating;
  note?: string;
  metrics?: Record<string, number>;
  recordedAt: string;
};

export type EarlyDevelopmentState = {
  version: 'E2-v1' | 'E2-v2' | 'E2-v3' | 'E2-v4' | 'E2-v5' | 'E2-v6' | 'E2-v7';
  responses: EarlyDevelopmentResponse[];
  adaptiveProfile?: V7AdaptiveProfile;
  adaptiveSectionsCompleted?: string[];
  startedAt: string;
  childCompletedAt?: string;
  caregiver?: CaregiverState;
  completedAt?: string;
};

const itemDomains: Record<string, string[]> = {
  RL1: ['RL'], RL2: ['RL'], RL3: ['RL'], RL4: ['RL', 'ATT'], RL5: ['RL', 'MEM'], RL6: ['RL', 'MEM', 'ATT'],
  EL1: ['EL', 'SC'], EL2: ['EL', 'SPEECH'], EL3: ['EL', 'SPEECH'], EL4: ['EL', 'SPEECH'], EL5: ['EL', 'SC'], EL6: ['EL', 'SC', 'JA'],
  JA1: ['JA', 'SC'], JA2: ['JA', 'SC'], JA3: ['JA', 'SC'], JA4: ['JA', 'SC'], JA5: ['SC', 'ATT'],
  IM1: ['IM'], IM2: ['IM', 'PLAY'], IM3: ['IM', 'SPEECH'],
  PL1: ['PLAY', 'COG'], PL2: ['PLAY', 'COG'], PL3: ['PLAY', 'COG', 'MEM'],
  CO1: ['COG', 'VIS'], CO2: ['COG', 'VIS'], CO3: ['COG', 'MEM'],
  MX1: ['COG', 'VIS'], MX2: ['COG', 'VIS'], MX3: ['COG', 'VIS'], MX4: ['COG', 'VIS'],
  QT1: ['COG'], QT2: ['COG'], QT3: ['COG', 'FINE'], CN1: ['COG', 'VIS'],
  SQ1: ['COG', 'MEM', 'VIS'], PT1: ['COG', 'MEM', 'VIS'], PT2: ['COG', 'MEM'],
  PB1: ['COG', 'MEM'], PB2: ['COG', 'FINE'], PB3: ['COG', 'VIS'], TR1: ['COG', 'MEM', 'IM'],
  AT1: ['ATT', 'SC'], AT2: ['ATT', 'ADAPT'],
  ME1: ['MEM', 'COG'], ME2: ['MEM', 'IM'],
  VM1: ['VIS', 'FINE'], VM2: ['VIS', 'FINE'],
  GM1: ['GROSS', 'ATT'], GM2: ['GROSS', 'SC'],
  AD1: ['ADAPT', 'FINE'], AD2: ['ADAPT', 'SC'],
  MOTJ:['GROSS'],MOTB:['GROSS'],MOTT:['GROSS'],MOTC:['GROSS'],FIP:['FINE'],FIL:['FINE','VIS'],FIB:['FINE','VIS'],FIC:['FINE'],FIT:['FINE','VIS'],FIPG:['FINE'],
  LNAME:['RL','SC','ATT'],LANIMAL:['EL','SPEECH','IM'],LSONG:['EL','SPEECH','SC'],LBODY5:['RL'],LREFUSE:['EL','SC'],LFAR:['JA','SC'],LEMOTION:['SC','COG'],
  NP1:['SC','ATT'],NP2:['JA','SC'],NP3:['EL','SC'],NP4:['IM'],NP5:['SC','ATT'],NP6:['PLAY','COG'],NP7:['COG'],NP8:['ATT'],LSAMP:['EL','SPEECH','SC'],
  DX_MATCH_OBJ:['COG','VIS'],DX_MATCH_SHAPE:['COG','VIS'],DX_MATCH_COLOR:['COG','VIS'],DX_BIG:['COG','VIS'],DX_ONE:['COG'],DX_MANY:['COG'],DX_OBJECT:['RL','COG'],DX_ACTION:['RL','COG'],DX_ANIMAL:['RL','COG'],DX_INSIDE:['RL','COG','VIS'],DX_FIT:['COG','VIS'],DX_PAIR:['COG','MEM','VIS'],DX_ODD:['COG','VIS'],DX_CATEGORY:['COG','VIS'],DX_PATTERN:['COG','MEM','VIS'],DX_TWO:['COG'],DX_MORE:['COG'],
  OV_JOINT:['JA','SC'],OV_INIT:['EL','SC'],OV_NAME:['RL','SC','ATT'],OV_IMIT:['IM'],OV_FUNCPLAY:['PLAY','COG'],OV_TURN:['SC','ATT'],OV_GROSS:['GROSS'],OV_FINE:['FINE','VIS'],OV_TRANSITION:['ATT','ADAPT'],OV_PROBLEM:['COG'],OV_LANGSAMPLE:['EL','SPEECH','SC'],OV_PRETEND:['PLAY','COG'],OV_TWOSTEP:['RL','MEM','ATT'],
  DX_COLOR_WORD:['RL','COG','VIS'],OV_GESTURE:['SC','EL'],OV_BODY2:['RL'],OV_BIMANUAL:['FINE','COG'],OV_TWIST:['FINE','COG'],OV_JUMP:['GROSS'],OV_PAGES:['FINE','VIS'],OV_ACTIONNAME:['EL','SPEECH'],OV_CIRCLE:['FINE','VIS','COG'],OV_STRING:['FINE','VIS'],
  ...v6ItemDomains,
  ...v7ItemDomains,
};

const legacyIds = new Set([
  'RL1','RL2','RL3','RL4','RL5','RL6','EL1','EL2','EL3','EL4','EL5','EL6','JA1','JA2','JA3','JA4','JA5',
  'IM1','IM2','IM3','PL1','PL2','PL3','CO1','CO2','CO3','ME1','ME2','AT1','AT2','VM1','VM2','GM1','GM2','AD1','AD2',
]);
const min30Ids = new Set(['RL6','EL4','PL3','CO2','QT3','PT1','PT2','TR1','MOTJ','MOTC','FIL','FIB','LBODY5','LEMOTION']);
const v3OnlyIds=new Set(['MOTJ','MOTB','MOTT','MOTC','FIP','FIL','FIB','FIC','FIT','FIPG','LNAME','LANIMAL','LSONG','LBODY5','LREFUSE','LFAR','LEMOTION','NP1','NP2','NP3','NP4','NP5','NP6','NP7','NP8','LSAMP']);
const v4BaseIds=['DX_MATCH_OBJ','DX_MATCH_SHAPE','DX_MATCH_COLOR','DX_BIG','DX_ONE','DX_MANY','DX_OBJECT','DX_ACTION','DX_ANIMAL','DX_INSIDE','DX_FIT','DX_PAIR','OV_JOINT','OV_INIT','OV_NAME','OV_IMIT','OV_FUNCPLAY','OV_TURN','OV_GROSS','OV_FINE','OV_TRANSITION','OV_PROBLEM','OV_LANGSAMPLE'];
const v4Min30Ids=['DX_ODD','DX_CATEGORY','DX_PATTERN','DX_TWO','DX_MORE','OV_PRETEND','OV_TWOSTEP'];
const v5Age24Ids=['DX_OBJECT','DX_MATCH_OBJ','DX_MATCH_SHAPE','DX_MATCH_COLOR','DX_BIG','DX_ONE','DX_MANY','DX_FIT','OV_JOINT','OV_INIT','OV_NAME','OV_GESTURE','OV_BODY2','OV_IMIT','OV_FUNCPLAY','OV_TURN','OV_GROSS','OV_BIMANUAL','OV_PROBLEM','OV_LANGSAMPLE'];
const v5Age27Ids=['DX_ACTION','DX_INSIDE','OV_FINE','OV_TRANSITION'];
const v5Age30Ids=['DX_COLOR_WORD','DX_ODD','DX_CATEGORY','OV_PRETEND','OV_TWOSTEP','OV_TWIST','OV_JUMP','OV_PAGES'];
const v5Age33Ids=['DX_PAIR','DX_PATTERN','OV_ACTIONNAME','OV_CIRCLE','OV_STRING'];
const v5NeutralProbeIds=new Set(['DX_MATCH_SHAPE','DX_MATCH_COLOR','DX_BIG','DX_ONE','DX_MANY','DX_INSIDE','DX_ODD','DX_CATEGORY','DX_PAIR','DX_PATTERN','OV_NAME','OV_TURN','OV_FINE','OV_TRANSITION','OV_ACTIONNAME','OV_CIRCLE','OV_STRING']);

const precursorDomains: Record<string, string[]> = {
  CO1: ['MATCH'], MX1: ['MATCH'], MX2: ['MATCH'], MX3: ['MATCH', 'CLASS'], MX4: ['MATCH', 'CLASS', 'CONCEPT'],
  CO2: ['CLASS'], CN1: ['CLASS', 'CONCEPT'],
  QT1: ['QUANTITY'], QT2: ['QUANTITY'], QT3: ['QUANTITY'],
  RL5: ['CONCEPT'], PB3: ['CONCEPT', 'PROBLEM'],
  SQ1: ['PATTERN'], PT1: ['PATTERN'], PT2: ['PATTERN'], PL3: ['PATTERN'], VM1: ['PATTERN'],
  CO3: ['PROBLEM'], PB1: ['PROBLEM', 'LEARNING'], PB2: ['PROBLEM'],
  ME2: ['LEARNING'], TR1: ['LEARNING', 'MATCH'],
  DX_MATCH_OBJ:['MATCH'],DX_MATCH_SHAPE:['MATCH','CONCEPT'],DX_MATCH_COLOR:['MATCH','CLASS'],DX_BIG:['CONCEPT'],DX_ONE:['QUANTITY'],DX_MANY:['QUANTITY'],DX_INSIDE:['CONCEPT'],DX_FIT:['CONCEPT','PROBLEM'],DX_PAIR:['PATTERN'],DX_ODD:['CLASS'],DX_CATEGORY:['CLASS'],DX_PATTERN:['PATTERN'],DX_TWO:['QUANTITY'],DX_MORE:['QUANTITY'],OV_PROBLEM:['PROBLEM'],DX_COLOR_WORD:['CONCEPT','CLASS'],OV_BIMANUAL:['LEARNING'],OV_TWIST:['LEARNING'],OV_CIRCLE:['PATTERN'],OV_STRING:['LEARNING'],
  ...v6PrecursorDomains,
  ...v7PrecursorDomains,
};

export const E2_ITEM_IDS = new Set(Object.keys(itemDomains));
export const E2_TOTAL_ITEMS = E2_ITEM_IDS.size;

export function e2RequiredItemIds(ageMonths?: number, version: EarlyDevelopmentState['version'] = 'E2-v2') {
  if(version==='E2-v1')return[...legacyIds];
  const age=Number.isFinite(ageMonths)?Number(ageMonths):24;
  if(version==='E2-v4')return age>=30?[...v4BaseIds,...v4Min30Ids]:[...v4BaseIds];
  if(version==='E2-v5'){const ids=[...v5Age24Ids];if(age>=27)ids.push(...v5Age27Ids);if(age>=30)ids.push(...v5Age30Ids);if(age>=33)ids.push(...v5Age33Ids);return ids;}
  if(version==='E2-v6')return v6RequiredIds(age);
  if(version==='E2-v7')return v7EligiblePoolIds(age);
  const ids=Object.keys(itemDomains).filter(id=>version==='E2-v3'||!v3OnlyIds.has(id));
  return ids.filter(id=>age>=30||!min30Ids.has(id));
}

export function isE2ItemAllowed(itemId: string, ageMonths?: number, version: EarlyDevelopmentState['version'] = 'E2-v2') {
  if(version==='E2-v7')return v7IsItemAllowed(itemId,ageMonths);
  return e2RequiredItemIds(ageMonths, version).includes(itemId);
}

export function isE2Rating(value: string): value is EarlyRating {
  return ['independent','prompted','verbal_prompt','visual_prompt','modeled','physical_assist','not_observed','not_assessed'].includes(value);
}

const areas = [
  ['RL', 'Alıcı Dil'], ['EL', 'İfade Edici Dil'], ['SPEECH', 'Konuşma ve Anlaşılırlık'], ['JA', 'Ortak Dikkat'],
  ['SC', 'Sosyal İletişim'], ['IM', 'Taklit'], ['PLAY', 'Oyun Gelişimi'], ['COG', 'Bilişsel Problem Çözme'],
  ['ATT', 'Dikkat ve Öz Düzenleme'], ['MEM', 'Bellek ve Öğrenme Tepkisi'], ['VIS', 'Görsel Algı'], ['FINE', 'İnce Motor'],
  ['GROSS', 'Kaba Motor'], ['ADAPT', 'Uyumsal / Günlük Yaşam'],
] as const;

const precursorAreas = [
  ['MATCH', 'Eşleme ve Görsel Ayırt Etme'],
  ['CLASS', 'Sınıflama ve Kavram Oluşturma'],
  ['QUANTITY', 'Nicelik ve Birebir İlişki'],
  ['CONCEPT', 'Boyut, Şekil ve Mekânsal Kavram'],
  ['PATTERN', 'Örüntü, Sıra ve Parça-Bütün'],
  ['PROBLEM', 'Neden-Sonuç ve Problem Çözme'],
  ['LEARNING', 'Modelden Öğrenme ve Transfer'],
] as const;

function areaStatus(independent: number, supported: number, notObserved: number, assessed: number, total: number) {
  if (assessed < Math.max(1, Math.ceil(total / 2))) return 'Kanıt yetersiz';
  if (independent / assessed >= 0.65) return 'Bu oturumda çoğunlukla bağımsız gözlendi';
  if ((independent + supported) / assessed >= 0.7) return 'Destekle ortaya çıkan / gelişmekte';
  if (notObserved > 0) return 'Yakın izlem ve hedefli çalışma önerilir';
  return 'Ek örnekleme önerilir';
}

function buildRows(
  definitions: readonly (readonly [string, string])[],
  mapping: Record<string, string[]>,
  requiredIds: string[],
  byId: Map<string, EarlyDevelopmentResponse>,
  neutralIds: Set<string> = new Set(),
) {
  return definitions.map(([code, title], index) => {
    const ids = requiredIds.filter((id) => mapping[id]?.includes(code));
    const values = ids.map((id) => byId.get(id)).filter((value): value is EarlyDevelopmentResponse => Boolean(value));
    const scoredIds = ids.filter((id) => !neutralIds.has(id));
    const scoredValues = scoredIds.map((id) => byId.get(id)).filter((value): value is EarlyDevelopmentResponse => Boolean(value));
    const independent = values.filter((value) => value.rating === 'independent').length;
    const legacyPrompted=values.filter(value=>value.rating==='prompted').length;
    const verbalPrompt=values.filter(value=>value.rating==='verbal_prompt').length;
    const visualPrompt=values.filter(value=>value.rating==='visual_prompt').length;
    const prompted=legacyPrompted+verbalPrompt+visualPrompt;
    const modeled=values.filter(value=>value.rating==='modeled').length;
    const physicalAssist=values.filter(value=>value.rating==='physical_assist').length;
    const notObserved=values.filter(value=>value.rating==='not_observed').length;
    const notAssessed=values.filter(value=>value.rating==='not_assessed').length;
    const supported=prompted+modeled+physicalAssist;
    const scoredIndependent=scoredValues.filter(value=>value.rating==='independent').length;
    const scoredSupported=scoredValues.filter(value=>['prompted','verbal_prompt','visual_prompt','modeled','physical_assist'].includes(value.rating)).length;
    const scoredNotObserved=scoredValues.filter(value=>value.rating==='not_observed').length;
    const scoredAssessed=scoredIndependent+scoredSupported+scoredNotObserved;
    const notes = values.map((value) => value.note?.trim()).filter((value): value is string => Boolean(value)).slice(0, 4);
    return{id:index+1,code,title,evidenceCount:values.length,totalIndicators:ids.length,independent,prompted,verbalPrompt,visualPrompt,modeled,physicalAssist,supported,notObserved,notAssessed,scoredIndependent,scoredSupported,scoredNotObserved,statusLabel:areaStatus(scoredIndependent,scoredSupported,scoredNotObserved,scoredAssessed,scoredIds.length),notes};
  });
}

export function buildE2Report(input: {
  studentLabel: string;
  ageMonths?: number;
  birthDate?: string;
  assessmentPurpose?: string;
  status: string;
  earlyDevelopment?: EarlyDevelopmentState;
}) {
  const version = input.earlyDevelopment?.version ?? 'E2-v2';
  const responses = input.earlyDevelopment?.responses ?? [];
  const requiredIds = version==='E2-v7'?[...new Set(responses.filter((response)=>response.itemId.startsWith('E7_')).map((response)=>response.itemId))]:e2RequiredItemIds(input.ageMonths, version);
  const byId = new Map(responses.map((response) => [response.itemId, response]));
  const neutralIds=version==='E2-v7'?v7NeutralProbeIds:version==='E2-v6'?v6NeutralProbeIds:version==='E2-v5'?v5NeutralProbeIds:new Set<string>();
  const areaRows = buildRows(areas, itemDomains, requiredIds, byId, neutralIds);
  const academicPrecursors=['E2-v2','E2-v3','E2-v4','E2-v5','E2-v6','E2-v7'].includes(version)?buildRows(precursorAreas,precursorDomains,requiredIds,byId,neutralIds):[];
  const priorities = areaRows.filter((area) => area.evidenceCount > 0 && (area.scoredNotObserved > 0 || area.scoredSupported > area.scoredIndependent)).sort((a, b) => (b.scoredNotObserved * 3 + b.scoredSupported) - (a.scoredNotObserved * 3 + a.scoredSupported)).slice(0, 3).map((area) => `${area.title}: farklı oyun ve günlük yaşam bağlamlarında yeniden örnekle; bağımsız tepkiyi artırmak için önce kısa ipucu, sonra ipucunu azaltma kullan.`);
  if (academicPrecursors.length) {
    priorities.push(...academicPrecursors.filter((area) => area.evidenceCount > 0 && (area.scoredNotObserved > 0 || area.scoredSupported > area.scoredIndependent)).sort((a, b) => (b.scoredNotObserved * 3 + b.scoredSupported) - (a.scoredNotObserved * 3 + a.scoredSupported)).slice(0, 2).map((area) => `${area.title}: aynı düşünme yapısını farklı nesne ve oyunlarda kısa tekrarlarla çalış; modelden bağımsız kullanıma geçişi izle.`));
  }
  if (!priorities.length) priorities.push('Farklı gün, kişi ve oyun bağlamlarında aynı becerilerden ek örnekler toplayarak profilin kararlılığını doğrula.');
  const completedItems = new Set(responses.filter((response) => requiredIds.includes(response.itemId)).map((response) => response.itemId)).size;
  const ageBandLabel=version==='E2-v7'?v7AgeBandLabel(input.ageMonths):version==='E2-v6'?v6AgeBandLabel(input.ageMonths):version==='E2-v1'?'E2-v1 · önceki 36 görevlik rota':(input.ageMonths??24)>=30?'30–35 ay · genişletilmiş rota':'24–29 ay · temel rota';
  const caregiver=['E2-v4','E2-v5','E2-v6','E2-v7'].includes(version)?buildCaregiverV4Report(input.earlyDevelopment?.caregiver):version==='E2-v3'?buildCaregiverReport(input.earlyDevelopment?.caregiver):null;
  const sectionProgress=version==='E2-v7'?buildV7SectionProgress(input.ageMonths,input.earlyDevelopment?.adaptiveProfile,responses,input.earlyDevelopment?.adaptiveSectionsCompleted):version==='E2-v6'?buildV6SectionProgress(input.ageMonths,responses.map((response)=>response.itemId)):[];
  const categoryPerformance=version==='E2-v7'?buildV7CategoryPerformance(responses):[];
  const behaviorSignals=['E2-v6','E2-v7'].includes(version)?{engaged:responses.filter((response)=>response.metrics?.engaged===1).length,avoidance:responses.filter((response)=>response.metrics?.avoidance===1).length,frustration:responses.filter((response)=>response.metrics?.frustration===1).length,fatigue:responses.filter((response)=>response.metrics?.fatigue===1).length}:null;
  return {
    profileCode: 'E2',
    version,
    title:version==='E2-v7'?'CZA 24–36 Ay Adaptif Dijital Bütüncül Değerlendirme Profili':version==='E2-v6'?'CZA 24–36 Ay 8 Bölümlü Bütüncül Değerlendirme Profili':version==='E2-v5'?'CZA 24–36 Ay Pedagojik Etkileşimli Erken Gelişim Profili':version==='E2-v4'?'CZA 24–36 Ay Etkileşimli Erken Gelişim Profili':version==='E2-v3'?'CZA 24–36 Ay Bütüncül Erken Gelişim Profili':version==='E2-v2'?'CZA 24–36 Ay Erken Gelişim ve Akademik Öncül Profili':'CZA 24–36 Ay Erken Gelişim Profili',
    studentLabel: input.studentLabel,
    ageMonths: input.ageMonths ?? null,
    birthDate: input.birthDate ?? null,
    ageBandLabel,
    assessmentPurpose: input.assessmentPurpose ?? 'GENERAL',
    status: input.status,
    completedItems,
    totalItems:version==='E2-v7'?v7TargetTotal(input.ageMonths,input.earlyDevelopment?.adaptiveProfile):requiredIds.length,
    areas: areaRows,
    academicPrecursors,
    caregiver,
    sectionProgress,
    categoryPerformance,
    adaptiveProfile:input.earlyDevelopment?.adaptiveProfile??null,
    behaviorSignals,
    childCompleted:Boolean(input.earlyDevelopment?.childCompletedAt||(!['E2-v3','E2-v4','E2-v5','E2-v6','E2-v7'].includes(version)&&input.earlyDevelopment?.completedAt)),
    recommendations: priorities.slice(0, 5),
    interpretationNote:version==='E2-v7'?'Bu profil 130 soruluk özgün CZA dijital soru havuzundan yaş, dil düzeyi, ilgi, dikkat süresi, önceki kanıt, destek ihtiyacı ve tepki örüntüsüne göre adaptif görev seçer; ayrıca doğal dil/oyun/transfer kanıtını ayrı bölümde doğrular. Kategori yüzdeleri yalnız bu oturumdaki bağımsız performans oranıdır; yaş normu, gelişim yüzdeliği, tanı veya gelişim yaşı değildir. Beş saniyeyi aşan tepki yanlış sayılmaz; yalnız uygulayıcı için ipucu sinyalidir. Cinsiyet zorluk belirleyicisi değildir. Tavan/meslek keşfi gibi ileri görevlerin ortaya çıkmaması risk kanıtı sayılmaz.':version==='E2-v6'?'Bu profil sekiz ayrı bölümde görsel, işitsel, dilsel, bellek, ilişkilendirme, gerçek oyun ve yürütücü işlev kanıtlarını birleştiren CZA eğitimsel/gelişimsel değerlendirme aracıdır. Standardize norm testi, klinik tanı veya gelişim yaşı eşdeğeri değildir. Bölümler ayrı oturumlarda uygulanabilir. Tavan/keşif görevlerinin ortaya çıkmaması risk veya gerilik kanıtı sayılmaz; çocuk performansı, destek düzeyi, davranış tepkisi ve veli beyanı ayrı kanıt olarak korunur.':version==='E2-v5'?'Bu profil CZA eğitimsel/gelişimsel değerlendirme aracıdır; standardize norm testi, klinik tanı veya gelişim yaşı eşdeğeri değildir. E2-v5 24–26, 27–29, 30–32 ve 33–35 aylık dört pedagojik ankraj kullanır. Keşif/tavan görevleri gelişimin üst sınırını örnekler; bu görevlerin ortaya çıkmaması risk, gerilik veya düşük gelişim sonucu üretmez. Ekran görevleri kısa ve yetişkin eşliğindedir; gerçek oyun ve yüz yüze etkileşim ayrı kanıt kaynağı olarak korunur.':version==='E2-v4'?'Bu profil CZA eğitimsel/gelişimsel değerlendirme aracıdır; standardize norm testi, klinik tanı veya gelişim yaşı eşdeğeri değildir. Dokunmatik ekran görevlerinde ilk seçim ve tepki süresi, doğal oyun görevlerinde destek düzeyi, veli görüşmesinde ise ev yaşamına ilişkin ayrı beyan kanıtı kullanılır. Bu üç kaynak birbirinin yerine geçmez.':'Bu profil CZA eğitimsel/gelişimsel gözlem aracıdır; standardize norm testi, klinik tanı veya gelişim yaşı eşdeğeri değildir. Çocuğun doğrudan performansı ile veli/bakımveren beyanı ayrı kanıt kaynaklarıdır. Akademik öncül bölümü matematik/okul başarısı puanı vermez; eşleme, nicelik, kavram, sıra, problem çözme ve öğrenme tepkisi gibi ileriki öğrenmenin temel yapılarını eğitim planlaması için örnekler.',
  };
}

