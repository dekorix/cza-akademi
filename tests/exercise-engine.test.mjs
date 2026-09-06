import assert from 'node:assert/strict';
import test from 'node:test';
import {createQuestion, defaultConfig, validateConfig, score} from '../lib/exercise-engine.ts';

let state=73811;
const random=()=>{state=(state*16807)%2147483647;return (state-1)/2147483646;};
test('all generated arithmetic is consistent and non-negative at every step',()=>{
  for(const digits of [1,2,3]) for(const operation of ['add','subtract','mixed']) for(const terms of [2,4,10]) for(let i=0;i<100;i++){
    const q=createQuestion({...defaultConfig,mode:'flash',digits,operation,terms},random);
    assert.equal(q.sequence.length,terms);
    let total=0;for(const term of q.sequence){assert.ok(Number.isInteger(term));assert.ok(Math.abs(term)>=10**(digits-1));assert.ok(Math.abs(term)<=10**digits-1);total+=term;assert.ok(total>=0);}
    assert.equal(q.answer,total);
    if(operation==='add')assert.ok(q.sequence.every(n=>n>0));
    if(operation==='subtract')assert.ok(q.sequence.slice(1).every(n=>n<0));
  }
});
test('soroban questions respect digit range',()=>{for(const mode of ['soroban-read','soroban-write'])for(const digits of [1,2,3])for(let i=0;i<100;i++){const q=createQuestion({...defaultConfig,mode,digits},random);assert.equal(q.sequence.length,1);assert.ok(q.answer>=10**(digits-1)&&q.answer<=10**digits-1);}});
test('finger reading uses the shared canonical 1–2 digit range',()=>{for(const digits of [1,2])for(let i=0;i<100;i++){const q=createQuestion({...defaultConfig,mode:'finger-read',digits,minDigits:digits,maxDigits:digits},random);assert.ok(q.answer>=10**(digits-1)&&q.answer<=Math.min(99,10**digits-1));}});
test('soroban reading supports four through seven rods without allocating the whole number range',()=>{for(const rods of [4,5,6,7]){const q=createQuestion({...defaultConfig,mode:'soroban-read',digits:rods,minDigits:rods,maxDigits:rods,rods,maxValue:10**rods-1},random);assert.ok(q.answer>=10**(rods-1)&&q.answer<10**rods);}});
test('single-digit pool is respected',()=>{for(let i=0;i<100;i++){const q=createQuestion({...defaultConfig,mode:'flash',digits:1,pool:[2,5,7]},random);assert.ok(q.sequence.every(n=>[2,5,7].includes(Math.abs(n))));}});
test('impossible subtraction is rejected instead of producing invalid questions',()=>{assert.throws(()=>createQuestion({...defaultConfig,mode:'flash',digits:1,operation:'subtract',terms:10,pool:[2,3]}));});
test('invalid input is rejected',()=>{for(const values of [{digits:0},{digits:6},{terms:31},{rounds:0},{interval:.05},{interval:NaN},{pool:[]},{pool:[0]},{mode:'unknown'},{operation:'bad'},{minDigits:3,maxDigits:2},{maxValue:0}])assert.throws(()=>validateConfig({...defaultConfig,...values}));});
test('score reports accuracy, timeouts and response speed without invented values',()=>{assert.deepEqual(score([]),{total:0,correct:0,wrong:0,timeout:0,accuracy:0,averageResponseMs:0,fastestCorrectMs:null});assert.deepEqual(score([{correct:true,elapsedMs:900},{correct:false,elapsedMs:1500},{correct:false,timeout:true,elapsedMs:3000}]),{total:3,correct:1,wrong:1,timeout:1,accuracy:33,averageResponseMs:1800,fastestCorrectMs:900});});
