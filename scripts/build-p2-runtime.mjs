import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,rmSync} from 'node:fs';
execFileSync('npm',['ci','--prefix','apps/p2-runtime','--ignore-scripts','--cache','/tmp/cza-p2-npm-cache'],{stdio:'inherit'});
execFileSync('npm',['run','build','--prefix','apps/p2-runtime'],{stdio:'inherit'});
rmSync('public/p2-runtime',{recursive:true,force:true});mkdirSync('public/p2-runtime',{recursive:true});
cpSync('apps/p2-runtime/dist','public/p2-runtime',{recursive:true});
