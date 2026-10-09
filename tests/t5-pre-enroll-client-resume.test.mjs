import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(
  new URL('../cza-degerlendirme/central-special-sync.js', import.meta.url), 'utf8');
const instrumented = source.replace(
  /  ensureCentralState\(\);\s*applyBootstrapProfile\(\);\s*loadStudents\(false\)\.then\(function \(\) \{[\s\S]*?\}\);\s*\}\)\(\);\s*$/,
  '  globalThis.t5 = { createCentralSession, resumeCentralTask, ensureCentralState, setConnected: () => { centralMode = "connected"; } };\n})();');
assert.notEqual(instrumented, source);

function client() {
  const state = { screen: 'dyslexia-intake', dysEvidence: {}, dysLsEvidence: {},
    dysAdvancedEvidence: {}, specialGenericEvidence: {} };
  const values = { name: 'Yazım Hatası', grade: '2. sınıf',
    readingStage: 'Hece birleştiriyor', birth: '', concerns: '' };
  const requests = [];
  let nextId = 1;
  let renderCount = 0;
  const centralSessions = new Map();
  const document = {
    getElementById: (id) => id in values ? { value: values[id] } : null,
  };
  const context = {
    state, document, window: { location: { search: '' } },
    URLSearchParams, Date, String, Number, Object, Array,
    crypto: { randomUUID: () => '00000000-0000-4000-8000-' +
      String(nextId++).padStart(12, '0') },
    fetch: async (_url, options) => {
      const payload = JSON.parse(options.body);
      requests.push(payload);
      const key = payload.candidateId + ':' + payload.cycleId;
      const resumed = centralSessions.has(key);
      if (!resumed) centralSessions.set(key, 'session-' + (centralSessions.size + 1));
      return { ok: true, json: async () => ({
        ok: true, resumed,
        session: { id: centralSessions.get(key) }, student: { name: payload.studentLabel },
        attempts: resumed ? [{
          task_code: 'DYS-PH01', answer_text: 'al',
          answer_payload: { verdict: 'MATCH', supportLevel: 'INDEPENDENT' },
        }] : [],
        observations: resumed ? [{
          task_code: 'DYS-PH01', educator_note: 'Sentetik',
        }] : [],
      }) };
    },
    saveState: () => {}, render: () => { renderCount++; },
    dyslexiaTasks: [{ id: 'DYS-PH01' }, { id: 'DYS-PH02' }],
    setTimeout, console,
  };
  vm.runInNewContext(instrumented, context);
  context.t5.ensureCentralState();
  return { context, state, values, requests, get renderCount() { return renderCount; } };
}

test('correcting visible name keeps candidate/cycle/session and resumes first incomplete task', async () => {
  const h = client();
  h.context.t5.setConnected();
  await h.context.t5.createCentralSession(true);
  const candidateId = h.state.centralCandidateId;
  const cycleId = h.state.centralCycleId;
  h.values.name = 'Düzeltilmiş Ad';
  const resumed = await h.context.t5.createCentralSession(true);
  assert.equal(resumed.resumed, true);
  assert.equal(h.state.centralCandidateId, candidateId);
  assert.equal(h.state.centralCycleId, cycleId);
  assert.equal(h.state.centralSessionId, 'session-1');
  assert.equal(h.requests[1].candidateId, candidateId);
  assert.equal(h.requests[1].cycleId, cycleId);
  assert.equal(h.state.dysEvidence['DYS-PH01'].response, 'al');
  h.context.t5.resumeCentralTask(true);
  assert.equal(h.state.dysTaskIndex, 1);
  assert.equal(h.state.screen, 'dyslexia-task');
  assert.ok(h.renderCount > 0);
});

test('new candidate identity cannot retain prior central evidence', async () => {
  const h = client();
  h.context.t5.setConnected();
  await h.context.t5.createCentralSession(true);
  h.state.centralCandidateId = '';
  h.state.centralCycleId = '';
  h.state.centralSessionId = '';
  h.state.dysEvidence['DYS-PH01'] = { verdict: 'MATCH', support: 'INDEPENDENT' };
  await h.context.t5.createCentralSession(true);
  assert.notEqual(h.requests[0].candidateId, h.requests[1].candidateId);
  assert.notEqual(h.requests[0].cycleId, h.requests[1].cycleId);
  assert.equal(h.state.dysEvidence['DYS-PH01'], undefined);
  assert.equal(h.state.centralSessionId, 'session-2');
});
