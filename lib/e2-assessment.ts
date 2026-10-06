import { V7_SECTIONS, V7_TASK_MAP, V7_TASKS, type V7SectionId, type V7Task } from './e2-question-bank';
import {
  buildV7CategoryPerformance,
  buildV7SectionProgress,
  normalizeV7AdaptiveProfile,
  v7AgeBandLabel,
  v7IsNeutral,
  v7TargetForSection,
  v7TargetTotal,
  type EarlyDevelopmentRating,
  type EarlyDevelopmentResponse,
  type V7AdaptiveProfile,
} from './e2-adaptive';

export const E2_TEMPLATE_CODE='CZA_E2_V7';
export const E2_TASK_BANK_VERSION='E2-v7-central-1';
export const E2_REPORT_VERSION='E2-report-v7-central-1';
export const E2_PROFILE_CODE='E2';

export type E2Evidence=EarlyDevelopmentResponse;

export const E2_SUPPORT_TO_NUMBER:Record<EarlyDevelopmentRating,number>={
  independent:0,
  prompted:1,
  verbal_prompt:1,
  visual_prompt:2,
  modeled:3,
  physical_assist:4,
  not_observed:5,
  not_assessed:5,
};

export function e2CompletedMonths(birthDate:string,now=new Date()){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if(!match) throw new Error('invalid_birth_date');
  const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]);
  const born=new Date(Date.UTC(year,month-1,day));
  if(born.getUTCFullYear()!==year||born.getUTCMonth()!==month-1||born.getUTCDate()!==day) throw new Error('invalid_birth_date');
  const today=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  if(born>today) throw new Error('invalid_birth_date');
  let months=(today.getUTCFullYear()-year)*12+(today.getUTCMonth()-(month-1));
  if(today.getUTCDate()<day) months-=1;
  return months;
}

export function e2AgeBandForAge(ageMonths:number){
  if(!Number.isInteger(ageMonths)||ageMonths<24||ageMonths>35) throw new Error('e2_age_out_of_range');
  return v7AgeBandLabel(ageMonths);
}

export function validE2Rating(value:unknown):EarlyDevelopmentRating{
  const allowed:EarlyDevelopmentRating[]=[
    'independent','prompted','verbal_prompt','visual_prompt','modeled','physical_assist','not_observed','not_assessed',
  ];
  return allowed.includes(value as EarlyDevelopmentRating)?value as EarlyDevelopmentRating:'not_assessed';
}

export function e2NormalizeAdaptiveProfile(value:unknown,previous?:Record<string,number>){
  return normalizeV7AdaptiveProfile(value,previous);
}

function sectionPrefix(section:V7SectionId){return 'E7_'+section+'_';}
function taskOf(id:string){return V7_TASK_MAP.get(id);}

function categoryStats(section:V7SectionId,responses:E2Evidence[]){
  const values=responses.filter(r=>r.itemId.startsWith(sectionPrefix(section))&&r.rating!=='not_assessed'&&taskOf(r.itemId)?.tier!=='ceiling');
  const independent=values.filter(r=>r.rating==='independent').length;
  const supported=values.filter(r=>['prompted','verbal_prompt','visual_prompt','modeled','physical_assist'].includes(r.rating)).length;
  const notObserved=values.filter(r=>r.rating==='not_observed').length;
  const assessed=independent+supported+notObserved;
  return{assessed,independent,supported,notObserved,rate:assessed?Math.round(independent/assessed*100):null};
}

function desiredDifficulty(section:V7SectionId,age:number,profile:V7AdaptiveProfile,responses:E2Evidence[]){
  let d=age<=27?1:age<=30?2:3;
  if((section==='REL'||section==='PRO')&&profile.languageLevel==='single_word') d=Math.max(1,d-1);
  if((section==='REL'||section==='PRO')&&profile.languageLevel==='short_sentence'&&age>=33) d+=1;
  const previous=profile.previousCategoryPerformance?.[section];
  if(typeof previous==='number'){if(previous>=80)d+=1;else if(previous<50)d-=1;}
  const values=responses.filter(r=>r.itemId.startsWith(sectionPrefix(section))&&r.rating!=='not_assessed');
  const last3=values.slice(-3);
  if(last3.length===3&&last3.every(r=>r.rating==='independent'&&r.metrics?.firstCorrect!==0)) d+=1;
  const last2=values.slice(-2);
  if(last2.length===2&&last2.every(r=>r.rating!=='independent')) d-=1;
  const stats=categoryStats(section,responses);
  if(stats.assessed>=5&&stats.rate!=null){if(stats.rate>=80)d+=1;else if(stats.rate<50)d-=1;}
  const cap=age>=33?4:age>=30?3:age>=27?2:1;
  return Math.max(1,Math.min(cap,d));
}

export function e2NextAdaptiveTask(section:V7SectionId,age:number,profile:V7AdaptiveProfile,responses:E2Evidence[]):V7Task|null{
  const done=new Set(responses.map(r=>r.itemId));
  const desired=desiredDifficulty(section,age,profile,responses);
  const history=responses
    .filter(r=>r.itemId.startsWith(sectionPrefix(section)))
    .map(r=>taskOf(r.itemId))
    .filter((task):task is V7Task=>Boolean(task));
  const repeatedType=history.length>=2&&history.at(-1)?.type===history.at(-2)?.type?history.at(-1)?.type:'';
  const pool=V7_TASKS.filter(task=>task.section===section&&task.minAge<=age&&!done.has(task.id));
  let candidates=pool;
  if(repeatedType){
    const diverse=pool.filter(task=>task.type!==repeatedType);
    if(diverse.length)candidates=diverse;
  }
  const interests=new Set(profile.interests);
  candidates.sort((a,b)=>
    Math.abs(a.difficulty-desired)-Math.abs(b.difficulty-desired)
    +(interests.has(b.theme as V7AdaptiveProfile['interests'][number])?-.5:0)
    -(interests.has(a.theme as V7AdaptiveProfile['interests'][number])?-.5:0)
  );
  return candidates[0]||null;
}

export function e2FirstIncompleteSection(completed:string[]):V7SectionId|null{
  const done=new Set(completed);
  return V7_SECTIONS.find(section=>!done.has(section.id))?.id??null;
}

export function e2Advance(input:{
  ageMonths:number;
  profile:V7AdaptiveProfile;
  responses:E2Evidence[];
  completedSections:string[];
  currentSection:V7SectionId;
}){
  const count=new Set(input.responses.filter(r=>r.itemId.startsWith(sectionPrefix(input.currentSection))).map(r=>r.itemId)).size;
  const target=v7TargetForSection(input.ageMonths,input.profile,input.currentSection);
  const completed=new Set(input.completedSections);
  if(target>0&&count>=target) completed.add(input.currentSection);

  let section:V7SectionId|null=completed.has(input.currentSection)
    ? e2FirstIncompleteSection([...completed])
    : input.currentSection;
  let task:V7Task|null=null;

  while(section){
    task=e2NextAdaptiveTask(section,input.ageMonths,input.profile,input.responses);
    if(task)break;
    completed.add(section);
    section=e2FirstIncompleteSection([...completed]);
  }

  return{
    completedSections:[...completed],
    nextSection:section,
    nextTask:task,
    childPhaseComplete:section==null,
    sectionProgress:buildV7SectionProgress(input.ageMonths,input.profile,input.responses,[...completed]),
  };
}

export function e2Summary(ageMonths:number,profile:V7AdaptiveProfile,responses:E2Evidence[],completedSections:string[]){
  return{
    profileCode:E2_PROFILE_CODE,
    version:'E2-v7',
    taskBankVersion:E2_TASK_BANK_VERSION,
    reportVersion:E2_REPORT_VERSION,
    ageMonths,
    ageBand:v7AgeBandLabel(ageMonths),
    targetTotal:v7TargetTotal(ageMonths,profile),
    completedItems:new Set(responses.map(r=>r.itemId)).size,
    sectionProgress:buildV7SectionProgress(ageMonths,profile,responses,completedSections),
    categoryPerformance:buildV7CategoryPerformance(responses),
    neutralEvidence:responses.filter(r=>v7IsNeutral(r.itemId)).map(r=>r.itemId),
    diagnosticUse:false,
  };
}
