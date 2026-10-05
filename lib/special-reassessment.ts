import type { SpecialLearningProfile, SpecialLearningStatus } from './special-learning-profile';
import { specialStatusForScore } from './special-learning-profile';
import type { SpecialEducationProgramDraft } from './special-education-program';

export type ReassessmentVerdict='MATCH'|'PARTIAL'|'DIFFERENT'|'NO_RESPONSE';
export type ReassessmentSupport='INDEPENDENT'|'VERBAL_PROMPT'|'VISUAL_PROMPT'|'MODELED'|'PHYSICAL_ASSIST';

export type ReassessmentProbe={
  verdict:ReassessmentVerdict;
  support:ReassessmentSupport;
  flags:string[];
};

export type ReassessmentAreaInput={
  key:string;
  label:string;
  probes:ReassessmentProbe[];
};

export type ReassessmentAreaComparison={
  key:string;
  label:string;
  baselineScore:number|null;
  afterScore:number|null;
  baselineStatus:SpecialLearningStatus;
  afterStatus:SpecialLearningStatus;
  baselineIndependentRatio:number|null;
  afterIndependentRatio:number|null;
  delta:number|null;
  outcome:'IMPROVED'|'PARTIAL_IMPROVEMENT'|'STABLE'|'PERSISTENT_PRIORITY'|'INSUFFICIENT';
  nextStep:string;
  recurringFlags:string[];
};

export type SpecialReassessmentComparison={
  baselineSessionId:string;
  programId:string;
  profileCode:string;
  profileLabel:string;
  overallOutcome:'IMPROVED'|'MIXED'|'PERSISTENT_PRIORITY'|'INSUFFICIENT';
  areas:ReassessmentAreaComparison[];
  nextDecision:'CLOSE_OR_MAINTAIN'|'CONTINUE_TARGETED_SUPPORT'|'NEW_PROGRAM_REVIEW'|'EXPERT_REVIEW_CONSIDER'|'COLLECT_MORE_EVIDENCE';
  note:string;
};

function verdictPoints(verdict:ReassessmentVerdict){
  if(verdict==='MATCH') return 0;
  if(verdict==='PARTIAL') return 1;
  return 2;
}
function supportPoints(support:ReassessmentSupport){
  if(support==='INDEPENDENT') return 0;
  if(support==='VERBAL_PROMPT'||support==='VISUAL_PROMPT') return .5;
  return 1;
}
function afterScore(probes:ReassessmentProbe[]){
  if(!probes.length) return null;
  return probes.reduce((sum,p)=>sum+verdictPoints(p.verdict)+supportPoints(p.support),0)/probes.length;
}
function independentRatio(probes:ReassessmentProbe[]){
  if(!probes.length) return null;
  return probes.filter(p=>p.support==='INDEPENDENT').length/probes.length;
}
function outcomeFor(baseline:number|null, after:number|null, afterStatus:SpecialLearningStatus){
  if(baseline==null||after==null) return 'INSUFFICIENT' as const;
  const delta=baseline-after;
  if(afterStatus==='EXPERT_REVIEW'||afterStatus==='PRIORITY'){
    if(delta>=.45) return 'PARTIAL_IMPROVEMENT' as const;
    return 'PERSISTENT_PRIORITY' as const;
  }
  if(delta>=.45) return 'IMPROVED' as const;
  if(delta>=.15) return 'PARTIAL_IMPROVEMENT' as const;
  return 'STABLE' as const;
}

export function buildSpecialReassessmentPlan(
  profile:SpecialLearningProfile,
  program:{id:string;plan:SpecialEducationProgramDraft},
){
  const selected=new Set(program.plan.selectedPriorityKeys);
  const areas=profile.domains
    .filter(domain=>selected.has(domain.key))
    .map(domain=>({
      key:domain.key,
      label:domain.label,
      baselineScore:domain.score,
      baselineStatus:domain.status,
      baselineIndependentRatio:domain.evidenceCount?domain.independentCount/domain.evidenceCount:null,
      probeCount:3,
      instruction:'Aynı soruları tekrar etme. Aynı beceriyi ölçen, daha önce kullanılmamış 3 yeni örnek uygula. İlk yanıtı ve yardım düzeyini ayrı kaydet.',
    }));
  return {
    baselineSessionId:profile.sessionId,
    programId:program.id,
    profileCode:profile.profileCode,
    profileLabel:profile.profileLabel,
    areas,
    note:'Yeniden ölçüm ezber tekrarı değildir. Aynı becerinin yeni örneklerde bağımsız kullanımını karşılaştırır.',
  };
}

export function compareSpecialReassessment(
  profile:SpecialLearningProfile,
  program:{id:string;plan:SpecialEducationProgramDraft},
  inputs:ReassessmentAreaInput[],
):SpecialReassessmentComparison{
  const inputByKey=new Map(inputs.map(item=>[item.key,item]));
  const selected=new Set(program.plan.selectedPriorityKeys);

  const areas:ReassessmentAreaComparison[]=profile.domains
    .filter(domain=>selected.has(domain.key))
    .map(domain=>{
      const input=inputByKey.get(domain.key);
      const probes=input?.probes?.slice(0,3)||[];
      const score=afterScore(probes);
      const status=specialStatusForScore(score,probes.length);
      const delta=domain.score==null||score==null?null:domain.score-score;
      const outcome=outcomeFor(domain.score,score,status);
      const flags=[...new Set(probes.flatMap(p=>p.flags||[]))].slice(0,5);
      let nextStep='Aynı beceriyi farklı görevlerde koruyarak izle.';
      if(outcome==='IMPROVED') nextStep='Hedefi bakım düzeyine indir; kazanımı farklı görevlerde genelle.';
      if(outcome==='PARTIAL_IMPROVEMENT') nextStep='Hedefli desteği kısa süre daha sürdür; yardım düzeyini azaltarak tekrar ölç.';
      if(outcome==='PERSISTENT_PRIORITY') nextStep='Beceri hâlâ öncelikli. Yeni program kararını eğitimci gözden geçirsin; kalıcı işlevsel güçlük geniş örüntüde sürüyorsa yetkili uzman değerlendirmesi düşünülebilir.';
      if(outcome==='INSUFFICIENT') nextStep='Karar için yeterli yeni kanıt yok; ek yeni örnek topla.';
      return {
        key:domain.key,
        label:domain.label,
        baselineScore:domain.score,
        afterScore:score,
        baselineStatus:domain.status,
        afterStatus:status,
        baselineIndependentRatio:domain.evidenceCount?domain.independentCount/domain.evidenceCount:null,
        afterIndependentRatio:independentRatio(probes),
        delta,
        outcome,
        nextStep,
        recurringFlags:flags,
      };
    });

  const valid=areas.filter(a=>a.outcome!=='INSUFFICIENT');
  const persistent=valid.filter(a=>a.outcome==='PERSISTENT_PRIORITY').length;
  const improved=valid.filter(a=>a.outcome==='IMPROVED').length;
  const partial=valid.filter(a=>a.outcome==='PARTIAL_IMPROVEMENT').length;
  let overallOutcome:SpecialReassessmentComparison['overallOutcome']='INSUFFICIENT';
  let nextDecision:SpecialReassessmentComparison['nextDecision']='COLLECT_MORE_EVIDENCE';
  if(valid.length){
    overallOutcome=persistent>=Math.max(1,Math.ceil(valid.length/2))
      ?'PERSISTENT_PRIORITY'
      : improved===valid.length
        ?'IMPROVED'
        :'MIXED';
    nextDecision=overallOutcome==='IMPROVED'
      ?'CLOSE_OR_MAINTAIN'
      : overallOutcome==='PERSISTENT_PRIORITY'
        ? (persistent>=2?'EXPERT_REVIEW_CONSIDER':'NEW_PROGRAM_REVIEW')
        : (partial||persistent?'CONTINUE_TARGETED_SUPPORT':'NEW_PROGRAM_REVIEW');
  }

  return {
    baselineSessionId:profile.sessionId,
    programId:program.id,
    profileCode:profile.profileCode,
    profileLabel:profile.profileLabel,
    overallOutcome,
    areas,
    nextDecision,
    note:'Bu karşılaştırma eğitimsel ilerlemeyi izler; klinik tanı koymaz. Karar yalnız başlangıç ve yeniden ölçüm kanıtlarının birlikte okunmasına dayanır.',
  };
}
