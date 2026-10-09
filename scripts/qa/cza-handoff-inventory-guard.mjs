// Read-only source inventory and handoff regression guard.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
export const REQUIRED_INTAKE = Object.freeze(['E0','E1','E2','E3','E4','E5','P1','P2','P3','P4','P5','P6','P7','P8','P9','P10']);
export const REQUIRED_SPECIAL = Object.freeze(['SP-DYS','SP-SLD','SP-DYSC','SP-DYSG','SP-ASD','SP-LANG','SP-ATTN','SP-DELAY','SP-COG','SP-MIX']);
export const REQUIRED_P2_SECTIONS = Object.freeze(Array.from({length:23},(_,i)=>'P2-'+String(i+1).padStart(2,'0')));
export const REQUIRED_SKILLS = Object.freeze(Array.from({length:14},(_,i)=>'CZA-S'+String(i+1).padStart(2,'0')));

function literalArray(source,name) {
  const found = source.match(new RegExp('export const '+name+'\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const'));
  if (!found) return null;
  return [...found[1].matchAll(/'([A-Za-z0-9-]+)'/g)].map(x=>x[1]);
}
function exactSet(actual,required,label,errors) {
  if (!actual) { errors.push('Missing array: '+label); return; }
  const dup=actual.filter((x,i)=>actual.indexOf(x)!==i);
  if (dup.length) errors.push(label+' duplicate: '+dup.join(','));
  const missing=required.filter(x=>!actual.includes(x));
  const added=actual.filter(x=>!required.includes(x));
  if (missing.length) errors.push(label+' MISSING: '+missing.join(','));
  if (added.length) errors.push(label+' ADDED (requires inventory revision): '+added.join(','));
}
export function auditCzaSourceInventory({bridge,p2,skills,protocol,decisionLedger,inventory}){
  const errors=[];
  const intake=literalArray(bridge,'INTAKE_PROFILE_CODES');
  const special=literalArray(bridge,'SPECIAL_BRIDGE_PROFILE_CODES');
  exactSet(intake,REQUIRED_INTAKE,'intake',errors);
  exactSet(special,REQUIRED_SPECIAL,'special',errors);
  const p2sections=[...p2.matchAll(/\bid:'(P2-\d{2})'[^\n]*?\bminTasks:(\d+),\s*maxTasks:(\d+)/g)];
  exactSet(p2sections.map(x=>x[1]),REQUIRED_P2_SECTIONS,'P2 sections',errors);
  let min=0,max=0;
  for(const section of p2sections){ min+=Number(section[2]);max+=Number(section[3]);if(Number(section[2])<1||Number(section[2])>Number(section[3]))errors.push('Invalid P2 bounds '+section[1]); }
  if(min!==226||max!==239)errors.push('P2 task-bound checksum changed: '+min+'/'+max+'; review old/new evidence before acceptance');
  const skillsFound=[...skills.matchAll(/\*\*(CZA-S\d{2})\s+—/g)].map(x=>x[1]);
  exactSet(skillsFound,REQUIRED_SKILLS,'skills',errors);
  for(const code of REQUIRED_INTAKE){
    const rule=new RegExp('^\\s{2}'+code+':\\{[^\\n]*\\bstatus:\\x27(PLANNED|CENTRAL_READY|SOURCE_REFERENCE_ONLY)\\x27', 'm');
    if(!rule.test(bridge))errors.push('Missing valid source readiness status '+code);
  }
  if(!/\bP2:\{[^\n]*status:'SOURCE_REFERENCE_ONLY'/.test(bridge))
    errors.push('P2 source-only safety baseline changed; evidence and governance decision required');
  if(!/ONAYLI YÖNETİM STANDARDI/.test(protocol))errors.push('Missing approved governance protocol');
  if(!/CZA-K-001/.test(decisionLedger))errors.push('Missing initial decision checkpoint');
  if(!/P2-23\b|23 bölüm/.test(inventory))errors.push('Missing P2 inventory evidence');
  const stats={intake:intake?.length??0,special:special?.length??0,p2Sections:p2sections.length,p2Min:min,p2Max:max,skills:skillsFound.length};
  return {pass:errors.length===0,errors,stats,kind:'SOURCE_INVENTORY_ONLY_NOT_STAGING_ACCEPTANCE'};
}
function source(path){return readFileSync(resolve(path),'utf8')}
export function runCzaSourceInventory(root){
  return auditCzaSourceInventory({
    bridge:source(resolve(root,'lib/assessment-bridge.ts')),
    p2:source(resolve(root,'lib/p2-full-assessment-contract.ts')),
    skills:source(resolve(root,'docs/CZA_14_Beceri_v1.md')),
    protocol:source(resolve(root,'docs/CZA_KONTROL_PROTOKOLU.md')),
    decisionLedger:source(resolve(root,'docs/CZA_KARAR_DEFTERI.md')),
    inventory:source(resolve(root,'docs/CZA_DEGERLENDIRME_KAYNAK_ENVANTERI_20261009.md')),
  });
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const result=runCzaSourceInventory(resolve(process.cwd()));console.log(JSON.stringify(result,null,2));if(!result.pass)process.exitCode=1;}
  catch(e){console.error('SOURCE_HANDOFF_BLOCKED: '+e.message);process.exitCode=1;}
}
