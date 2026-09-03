import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons, applyBeadAction, canChangeDirectly, evaluateLessonAnswer, validateLessonRecord, lessonSummary, guidanceForMove } from '../lib/soroban-curriculum.ts';

const movesFor = task => task.steps.map(s=>({...s.action,before:s.before,after:s.after}));
const recordFor = lesson => ({id:'test-record',lessonId:lesson.id,at:'2026-09-03T08:00:00Z',guidedCorrections:0,answers:lesson.practice.map(t=>evaluateLessonAnswer(t,t.target,movesFor(t),false))});

test('all 8 lessons and 57 authored tasks replay legal beads to their intended targets',()=>{
  assert.equal(lessons.length,8);
  let count=0;
  for(const lesson of lessons){
    assert.equal(lesson.practice.length,5);
    for(const task of [...lesson.examples,...lesson.practice]){
      count++;
      let value=task.start;
      for(const s of task.steps){
        assert.equal(s.before,value);
        assert.notEqual(s.before,s.after);
        value=applyBeadAction(value,task.digits,s.action);
        assert.equal(value,s.after);
        assert.ok(value>=0&&value<10**task.digits);
      }
      assert.equal(value,task.target);
      const evaluated=evaluateLessonAnswer(task,task.target,movesFor(task),false);
      assert.equal(evaluated.correct,true);
      assert.equal(evaluated.routeMatch,true);
    }
  }
  assert.equal(count,57);
});

test('every legal bead click preserves all other columns for 0..999',()=>{
  for(let value=0;value<1000;value++)for(const place of [1,10,100])for(const deck of ['upper','lower'])for(let bead=0;bead<(deck==='upper'?1:4);bead++){
    const after=applyBeadAction(value,3,{place,deck,bead});
    assert.ok(after>=0&&after<1000);
    for(const other of [1,10,100].filter(p=>p!==place))assert.equal(Math.floor(value/other)%10,Math.floor(after/other)%10);
    if(deck==='upper')assert.equal(Math.abs(after-value),5*place);
  }
});

test('invalid bead states and direct/exchange boundaries are rejected',()=>{
  const valid={place:1,deck:'upper',bead:0};
  for(const value of [-1,1000,1.5,NaN,Infinity])assert.throws(()=>applyBeadAction(value,3,valid));
  for(const action of [{...valid,place:2},{...valid,place:1000},{...valid,bead:1},{...valid,deck:'fake'},{...valid,deck:'lower',bead:4}])assert.throws(()=>applyBeadAction(0,3,action));
  assert.throws(()=>applyBeadAction(0,1,{...valid,place:10}));
  assert.equal(canChangeDirectly(2,8),true);
  assert.equal(canChangeDirectly(4,7),false);
  assert.equal(canChangeDirectly(7,4),false);
  assert.equal(canChangeDirectly(8,2),true);
});

test('five/ten lessons use targeted exchanges, not unrelated random arithmetic',()=>{
  for(const lesson of lessons.filter(l=>l.id.startsWith('five')||l.id.startsWith('ten')))for(const t of [...lesson.examples,...lesson.practice]){
    const sign=lesson.id.endsWith('subtract')?-1:1;
    const base=lesson.id.startsWith('five')?5:10;
    assert.equal(t.steps[0].after-t.start,sign*base);
    assert.equal(t.steps[0].action.place,base===10?10:1);
    assert.equal(Math.sign(t.target-t.start),sign);
    if(base===5)assert.equal(canChangeDirectly(t.start,t.target),false);
    else assert.notEqual(Math.floor(t.start/10),Math.floor(t.target/10));
  }
});

test('an alternative correct route is not marked wrong',()=>{
  const t=lessons[0].practice[1]; // form 6; use lower then upper instead of upper then lower
  const actions=[{place:1,deck:'lower',bead:0},{place:1,deck:'upper',bead:0}];
  let value=t.start;
  const moves=actions.map(action=>{const before=value;value=applyBeadAction(value,t.digits,action);return {...action,before,after:value};});
  const result=evaluateLessonAnswer(t,6,moves,false);
  assert.equal(result.correct,true);assert.equal(result.routeMatch,false);
  assert.equal(evaluateLessonAnswer(t,6,[],false).correct,false);
  assert.equal(evaluateLessonAnswer(t,5,moves,false).correct,false);
});

test('records validate complete question order, raw traces and derived metrics',()=>{
  for(const lesson of lessons){
    const record=recordFor(lesson);
    assert.equal(validateLessonRecord(record),true);
    assert.deepEqual(lessonSummary(record),{total:5,correct:5,withoutHint:5,matchingRoutes:5});
    const hinted=structuredClone(record);hinted.answers[0].hintUsed=true;
    assert.equal(lessonSummary(hinted).withoutHint,4);
    assert.equal(validateLessonRecord({...record,answers:record.answers.slice(1)}),false);
    const changed=structuredClone(record);changed.answers[0].moves[0].after=9999;
    assert.equal(validateLessonRecord(changed),false);
    const wrongFlag=structuredClone(record);wrongFlag.answers[0].correct=false;
    assert.equal(validateLessonRecord(wrongFlag),false);
  }
  for(const value of [null,{},[],{lessonId:'beads'}, {...recordFor(lessons[0]),at:'not-a-date'}])assert.equal(validateLessonRecord(value),false);
});

test('guidance distinguishes column, deck and movement errors',()=>{
  const expected=lessons[4].examples[0].steps[0];
  assert.match(guidanceForMove(expected,{before:4,after:14,place:10,deck:'lower',bead:0}),/basamağında/);
  assert.match(guidanceForMove(expected,{before:4,after:3,place:1,deck:'lower',bead:3}),/üstteki/);
  assert.match(guidanceForMove(expected,{before:4,after:4,place:1,deck:'upper',bead:0}),/hareket yönünü/);
});
