// Scan the new publication delta. Inherited checkpoints are never rewritten.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.argv[2];if(!/^[0-9a-f]{40}$/.test(base||''))throw Error('Exact base SHA required');
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const statuses=git('diff','--name-status',base).trim().split('\n').filter(Boolean);
const forbidden=[/https?:\/\/[^\s"'<>]*(?:workers\.dev|neon\.tech|neonauth)/i,/\bpostgres(?:ql)?:\/\//i,/\bbr-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+\b/i,/\b[a-z]+-[a-z]+-\d{8}\b/i,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/\b(?:ghp_|sk_live_)[A-Za-z0-9]{16,}/,/\b(?!60000000-0000-4000-8000-)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i];
let count=0;const hits=[];
for(const line of statuses){const[status,file]=line.split('\t');if(status==='D')continue;
 const data=status==='A'?fs.readFileSync(file,'utf8'):git('diff','--unified=0',base,'--',file).split('\n').filter(s=>s.startsWith('+')&&!s.startsWith('+++')).map(s=>s.slice(1)).join('\n');
 // This scanner contains detection strings by design; runtime values are never printed.
 if(forbidden.some(pattern=>pattern.test(data)))hits.push(file);count++;
}
if(hits.length){console.error(JSON.stringify({status:'STOP',files:hits}));process.exit(1);}
console.log(JSON.stringify({status:'PASS',newDeltaFiles:count,base,rawValuesPrinted:false}));
