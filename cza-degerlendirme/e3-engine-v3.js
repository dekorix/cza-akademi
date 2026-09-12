(function(root){
  'use strict';
  const bank=()=>root.E3_BANK;
  const SUPPORT={INDEPENDENT:4,VERBAL_PROMPT:3,VISUAL_PROMPT:2,MODELED:1,PHYSICAL_ASSIST:0,NOT_OBSERVED:null,NOT_ASSESSED:null};
  const SUPPORT_LABELS={INDEPENDENT:'Bağımsız',VERBAL_PROMPT:'Sözel ipucu',VISUAL_PROMPT:'Görsel / jest ipucu',MODELED:'Model gösterimi',PHYSICAL_ASSIST:'Fiziksel yardım',NOT_OBSERVED:'Gözlenmedi',NOT_ASSESSED:'Değerlendirilemedi'};
  const OBS_FLAGS=['SELF_CORRECTED','SPONTANEOUS_EXPLANATION','SUSTAINED_ENGAGEMENT','DISTRACTED','AVOIDANT','FATIGUED','NEEDED_REPETITION','STRATEGY_SHIFT'];
  const BAND=[
    {min:36,max:38,label:'36–38 ay',tier:1,base:6,maxTasks:9},
    {min:39,max:41,label:'39–41 ay',tier:2,base:7,maxTasks:10},
    {min:42,max:44,label:'42–44 ay',tier:3,base:8,maxTasks:11},
    {min:45,max:47,label:'45–47 ay',tier:4,base:9,maxTasks:11}
  ];

  function ageBand(age){return BAND.find(b=>age>=b.min&&age<=b.max)||null}
  function domainById(id){return bank().domains.find(d=>d.id===id)||null}
  function taskById(id){return bank().allTasks.find(t=>t.id===id)||null}
  function eligible(domainId,age){const d=domainById(domainId);return d?d.tasks.filter(t=>t.minAge<=age):[]}
  function completedEvidence(domainId,evidence={}){return Object.values(evidence).filter(Boolean).filter(e=>taskById(e.taskId)?.id.startsWith(domainId))}

  function classifyEvidence(ev){
    if(!ev)return 'missing';
    const task=taskById(ev.taskId);
    if(task?.neutral||ev.neutral||['NOT_OBSERVED','NOT_ASSESSED'].includes(ev.support))return 'neutral';
    const support=SUPPORT[ev.support];
    if(support===null||support===undefined)return 'neutral';
    const accuracyKnown=typeof ev.firstMatch==='boolean';
    if(support===4&&(!accuracyKnown||ev.firstMatch===true))return 'strong';
    if((support>=2&&(!accuracyKnown||ev.firstMatch!==false))||ev.flags?.includes('SELF_CORRECTED'))return 'emerging';
    return 'supported';
  }

  function facetCoverage(domainId,evidence={}){
    const d=domainById(domainId);if(!d)return {covered:0,total:0,ratio:0,facets:{}};
    const map=Object.fromEntries(d.facets.map(f=>[f,0]));
    completedEvidence(domainId,evidence).forEach(ev=>{
      if(classifyEvidence(ev)==='neutral')return;
      const t=taskById(ev.taskId);(t?.facets||[]).forEach(f=>{if(f in map)map[f]++});
    });
    const covered=Object.values(map).filter(v=>v>0).length;
    return {covered,total:d.facets.length,ratio:d.facets.length?covered/d.facets.length:0,facets:map};
  }

  function evidenceStats(domainId,evidence={}){
    const rows=completedEvidence(domainId,evidence).map(ev=>({...ev,classification:classifyEvidence(ev)}));
    const decisive=rows.filter(r=>!['neutral','missing'].includes(r.classification));
    const count=k=>decisive.filter(r=>r.classification===k).length;
    const strong=count('strong'),emerging=count('emerging'),supported=count('supported');
    const n=decisive.length;
    return {rows,decisive:n,strong,emerging,supported,strongRate:n?strong/n:0,supportRate:n?supported/n:0,emergingRate:n?emerging/n:0};
  }

  function roleRank(role,mode){
    const maps={anchor:{anchor:0,discriminator:1,transfer:2,ceiling:3},support:{discriminator:0,anchor:1,transfer:2,ceiling:3},transfer:{transfer:0,discriminator:1,anchor:2,ceiling:3}};
    return (maps[mode]||maps.anchor)[role]??9;
  }

  function candidateScore(task,domainId,evidence,mode,age){
    const coverage=facetCoverage(domainId,evidence);
    const uncovered=(task.facets||[]).filter(f=>(coverage.facets[f]||0)===0).length;
    const sparse=(task.facets||[]).reduce((s,f)=>s+Math.max(0,2-(coverage.facets[f]||0)),0);
    const ageTier=ageBand(age)?.tier||1;
    const tierDistance=Math.abs((task.tier||1)-ageTier);
    return roleRank(task.role,mode)*100+tierDistance*12-uncovered*18-sparse*4+(task.neutral?60:0);
  }

  function selectNext(domainId,age,evidence={}){
    const band=ageBand(age);if(!band)return null;
    const d=domainById(domainId);if(!d)return null;
    const done=new Set(completedEvidence(domainId,evidence).map(e=>e.taskId));
    const candidates=eligible(domainId,age).filter(t=>!done.has(t.id));
    if(!candidates.length)return null;
    const stats=evidenceStats(domainId,evidence);const coverage=facetCoverage(domainId,evidence);
    const completed=stats.rows.length;
    if(completed>=band.maxTasks)return null;

    let mode='anchor';
    if(stats.decisive>=3&&stats.supportRate>=0.45)mode='support';
    else if(stats.decisive>=4&&stats.strongRate>=0.65)mode='transfer';

    const stableStrong=stats.decisive>=band.base&&stats.strongRate>=0.68;
    const stableSupport=stats.decisive>=band.base&&stats.supportRate>=0.50;
    const adequateCoverage=coverage.ratio>=0.66;
    if(completed>=band.base&&adequateCoverage&&(stableStrong||stableSupport)){
      if(stableStrong&&age>=45){
        const ceiling=candidates.filter(t=>t.role==='ceiling').sort((a,b)=>candidateScore(a,domainId,evidence,'transfer',age)-candidateScore(b,domainId,evidence,'transfer',age))[0];
        if(ceiling&&completed<band.maxTasks)return ceiling;
      }
      return null;
    }

    const filtered=candidates.filter(t=>!(t.role==='ceiling'&&age<45));
    return filtered.sort((a,b)=>candidateScore(a,domainId,evidence,mode,age)-candidateScore(b,domainId,evidence,mode,age))[0]||null;
  }

  function recommendedRoute(domainId,age,evidence={}){
    const virtual={...evidence};const route=[];let guard=0;
    while(guard++<20){
      const next=selectNext(domainId,age,virtual);if(!next)break;
      route.push(next);
      virtual[next.id]={taskId:next.id,support:'INDEPENDENT',firstMatch:next.scoring==='accuracy'?true:null,flags:[],neutral:!!next.neutral,synthetic:true};
    }
    return route;
  }

  function domainSummary(domainId,evidence={}){
    const stats=evidenceStats(domainId,evidence);const coverage=facetCoverage(domainId,evidence);
    let status='Kanıt yetersiz',code='INSUFFICIENT';
    if(stats.decisive>=4&&coverage.ratio>=0.5){
      if(stats.strongRate>=0.68){status='Göreli güçlü kanıt';code='RELATIVE_STRENGTH'}
      else if(stats.supportRate>=0.5){status='Yakın destekle izlenecek';code='WATCH_WITH_SUPPORT'}
      else {status='Gelişen / karışık profil';code='DEVELOPING_MIXED'}
    }
    return {domainId,status,code,coverage,stats,completed:stats.rows.length};
  }

  function sessionProgress(age,evidence={}){
    const rows=bank().domains.map(d=>({domain:d,...domainSummary(d.id,evidence)}));
    const complete=rows.filter(r=>selectNext(r.domain.id,age,evidence)===null&&r.completed>0).length;
    return {domains:rows,complete,total:rows.length,percent:Math.round((complete/rows.length)*100)};
  }

  function createEvidence(taskId,{support='INDEPENDENT',firstMatch=null,latencyMs=null,touches=0,flags=[],note='',response=null,neutral=false}={}){
    const t=taskById(taskId);if(!t)throw new Error(`Unknown task: ${taskId}`);
    return {taskId,domainId:t.id.slice(0,2),support,firstMatch,latencyMs,touches,flags:flags.filter(f=>OBS_FLAGS.includes(f)),note,response,neutral:neutral||!!t.neutral,recordedAt:new Date().toISOString()};
  }

  function validateSession(age,evidence={}){
    const errors=[];if(!ageBand(age))errors.push('E3 age must be 36–47 completed months.');
    Object.values(evidence).forEach(ev=>{
      if(!taskById(ev.taskId))errors.push(`Unknown task ${ev.taskId}`);
      if(!(ev.support in SUPPORT))errors.push(`Invalid support ${ev.support}`);
    });
    return {valid:errors.length===0,errors};
  }

  const api={SUPPORT,SUPPORT_LABELS,OBS_FLAGS,BAND,ageBand,domainById,taskById,eligible,classifyEvidence,facetCoverage,evidenceStats,selectNext,recommendedRoute,domainSummary,sessionProgress,createEvidence,validateSession};
  root.E3_ENGINE=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
