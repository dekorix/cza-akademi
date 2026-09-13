(function(root){
  'use strict';
  const ENGINE=root.E3_ENGINE;if(!ENGINE)throw new Error('E3_ENGINE must load first');
  const STORAGE='cza-e3-v4-session';
  const VERSION='E3-v4';
  const uid=()=>root.crypto?.randomUUID?.()||`e3-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const runtime=()=>({startedAt:null,firstResponseAt:null,touches:0,choice:null,firstMatch:null});
  const fresh=()=>({version:VERSION,screen:'home',student:{name:'',birth:'',age:null,language:'Türkçe',purpose:'GENERAL',assessor:''},activeDomain:null,currentTaskId:null,evidence:{},caregiver:{},taskRuntime:runtime(),ui:{focus:false},session:{id:uid(),startedAt:null,lastSavedAt:null}});
  let state=load();
  function clone(v){return JSON.parse(JSON.stringify(v))}
  function load(){try{const raw=root.localStorage?.getItem(STORAGE);if(!raw)return fresh();const parsed=JSON.parse(raw),base=fresh();return {...base,...parsed,student:{...base.student,...parsed.student},taskRuntime:{...base.taskRuntime,...parsed.taskRuntime},ui:{...base.ui,...parsed.ui},session:{...base.session,...parsed.session}}}catch{return fresh()}}
  function save(){state.session.lastSavedAt=new Date().toISOString();root.localStorage?.setItem(STORAGE,JSON.stringify(state));return snapshot()}
  function snapshot(){return clone(state)}
  function reset(){state=fresh();save();return snapshot()}
  function months(value){if(!value)return null;const birth=new Date(`${value}T12:00:00`),now=new Date();let m=(now.getFullYear()-birth.getFullYear())*12+now.getMonth()-birth.getMonth();if(now.getDate()<birth.getDate())m--;return m}
  function configureStudent(input){const age=months(input.birth);if(!ENGINE.ageBand(age))return {ok:false,error:'E3 için yaş 36–47 tamamlanmış ay aralığında olmalı.'};if(!String(input.name||'').trim())return {ok:false,error:'Öğrenci adı gerekli.'};if(!String(input.assessor||'').trim())return {ok:false,error:'Değerlendiren eğitimci gerekli.'};state.student={name:String(input.name).trim(),birth:input.birth,age,language:String(input.language||'Türkçe').trim()||'Türkçe',purpose:input.purpose||'GENERAL',assessor:String(input.assessor).trim()};state.session.startedAt=state.session.startedAt||new Date().toISOString();state.screen='dashboard';save();return {ok:true,state:snapshot()}}
  function setScreen(screen){state.screen=screen;save()}
  function setFocus(value){state.ui.focus=!!value;save()}
  function startDomain(domainId){state.activeDomain=domainId;const next=ENGINE.selectNext(domainId,state.student.age,state.evidence);if(!next)return null;beginTask(next.id);return next}
  function beginTask(taskId){const task=ENGINE.taskById(taskId);if(!task)throw new Error(`Unknown task ${taskId}`);state.currentTaskId=taskId;state.taskRuntime={...runtime(),startedAt:Date.now()};state.screen='task';save();return task}
  function markResponse(){if(!state.taskRuntime.firstResponseAt)state.taskRuntime.firstResponseAt=Date.now();save();return clone(state.taskRuntime)}
  function recordChoice(choice,correct){state.taskRuntime.touches=(state.taskRuntime.touches||0)+1;if(state.taskRuntime.choice===null){state.taskRuntime.choice=choice;state.taskRuntime.firstMatch=!!correct;markResponse()}else save();return clone(state.taskRuntime)}
  function commitTask({support,flags=[],note='',neutral=false}={}){const task=ENGINE.taskById(state.currentTaskId);if(!task)throw new Error('No active task');const chosen=neutral?'NOT_ASSESSED':support;if(!chosen)return {ok:false,error:'Yardım / bağımsızlık düzeyi seçilmeli.'};const latency=state.taskRuntime.startedAt&&state.taskRuntime.firstResponseAt?Math.max(0,state.taskRuntime.firstResponseAt-state.taskRuntime.startedAt):null;const ev=ENGINE.createEvidence(task.id,{support:chosen,firstMatch:state.taskRuntime.firstMatch,latencyMs:latency,touches:state.taskRuntime.touches,flags,note:String(note||'').trim(),response:state.taskRuntime.choice,neutral});state.evidence[task.id]=ev;const next=ENGINE.selectNext(state.activeDomain,state.student.age,state.evidence);if(next)beginTask(next.id);else{state.currentTaskId=null;state.screen='dashboard';save()}return {ok:true,evidence:ev,next}}
  function setCaregiver(id,value){state.caregiver[id]=value;save()}
  function progress(){return ENGINE.sessionProgress(state.student.age,state.evidence)}
  function exportRecord(){return {version:VERSION,student:clone(state.student),session:clone(state.session),evidence:clone(state.evidence),caregiver:clone(state.caregiver),progress:progress()}}
  const api={VERSION,STORAGE,state:()=>state,snapshot,save,reset,months,configureStudent,setScreen,setFocus,startDomain,beginTask,markResponse,recordChoice,commitTask,setCaregiver,progress,exportRecord};
  root.E3_SESSION=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
