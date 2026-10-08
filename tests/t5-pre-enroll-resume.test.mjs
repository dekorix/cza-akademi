import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const routeSource = fs.readFileSync(
  new URL('../app/api/assessment-special-linked/route.ts', import.meta.url), 'utf8');
const uuid = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const candidate = uuid(11);
const cycle = uuid(12);

function harness({ indexInstalled = true } = {}) {
  const sessions = [];
  const attempts = new Map();
  const users = { educatorA: 'academyA', educatorB: 'academyA', educatorC: 'academyC' };
  let nextId = 100;
  let inserts = 0;
  const sql = async (parts, ...values) => {
    const query = parts.join('?');
    if (/SELECT 1 FROM pg_index/.test(query)) return indexInstalled ? [{ ok: 1 }] : [];
    if (/SELECT academy_id FROM public.users/.test(query)) {
      const academy = users[values[0]];
      return academy ? [{ academy_id: academy }] : [];
    }
    if (/SELECT id FROM public.assessment_sessions/.test(query)) {
      return sessions.filter((s) =>
        s.template_code === values[0] &&
        s.metadata.academyId === values[1] &&
        s.metadata.createdByEducatorId === values[2] &&
        s.metadata.candidateId === values[3] &&
        s.metadata.cycleId === values[4] &&
        s.status === 'active').map(({ id }) => ({ id }));
    }
    if (/FROM public.assessment_sessions a/.test(query)) {
      const s = sessions.find((row) => row.id === values[0]);
      const academy = users[values[1]];
      return s && s.metadata.createdByEducatorId === values[1] &&
        s.metadata.academyId === academy ? [s] : [];
    }
    if (/FROM public.assessment_sessions/.test(query) &&
        /ORDER BY started_at DESC/.test(query)) {
      const [studentId, , , , academyId, candidateId, cycleId, templateCode, educatorId] = values;
      return sessions.filter((s) =>
        !studentId && s.student_id === null &&
        s.template_code === templateCode && s.status === 'active' &&
        s.metadata.academyId === academyId &&
        s.metadata.candidateId === candidateId &&
        s.metadata.cycleId === cycleId &&
        s.metadata.createdByEducatorId === educatorId);
    }
    if (/INSERT INTO public.assessment_sessions/.test(query)) {
      inserts++;
      const metadata = JSON.parse(values.find((v) => typeof v === 'string' && v.startsWith('{')));
      const existing = sessions.find((s) => s.status === 'active' &&
        s.template_code === values[1] &&
        s.metadata.academyId === metadata.academyId &&
        s.metadata.createdByEducatorId === metadata.createdByEducatorId &&
        s.metadata.candidateId === metadata.candidateId &&
        s.metadata.cycleId === metadata.cycleId);
      if (existing) return []; // unique index conflict
      const session = {
        id: uuid(nextId++), student_id: null, template_code: values[1],
        student_label: values[2], status: 'active', current_task_code: null,
        started_at: new Date().toISOString(), completed_at: null, metadata,
      };
      sessions.push(session);
      return [session];
    }
    if (/FROM public.assessment_attempts/.test(query)) return attempts.get(values[0]) || [];
    if (/FROM public.assessment_observations/.test(query)) return [];
    return []; // db() DDL
  };
  const transpiled = ts.transpileModule(routeSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const require = (name) => {
    if (name === '@neondatabase/serverless') return { neon: () => sql };
    if (name === '@/lib/educator-auth') return {
      authenticatedEducator: async (req) =>
        req.headers.get('x-test-educator')
          ? { id: req.headers.get('x-test-educator') } : null,
    };
    if (name === '@/lib/request-guard') return {
      allowRequest: async () => ({ allowed: true }), rateLimited: () => Response.json({}, { status: 429 }),
    };
    if (name === '@/lib/special-assessment') return {
      isSpecialProfileCode: (code) => code === 'SP-DYS',
      specialTemplateCode: () => 'CZA_SPECIAL_V1_DYS',
      sanitizeShortText: (value, limit) => typeof value === 'string' ? value.trim().slice(0, limit) : '',
      SPECIAL_MODULE_CODE: 'SPECIAL', SPECIAL_TEMPLATE_VERSION: 'v1',
    };
    throw new Error('Unexpected dependency: ' + name);
  };
  vm.runInNewContext(transpiled, { exports, require, Response, Request, URL, TextEncoder,
    Date, JSON, Number, String, Error, process: { env: { DATABASE_URL: 'mock' } } });
  const post = async (educator, body) => {
    const req = new Request('https://cza.example/api/assessment-special-linked', {
      method: 'POST', headers: educator ? { 'x-test-educator': educator } : {},
      body: JSON.stringify(body),
    });
    const response = await exports.POST(req);
    return { status: response.status, body: await response.json() };
  };
  const create = (candidateId = candidate, cycleId = cycle, studentLabel = 'Aynı Ad') => ({
    action: 'create', profileCode: 'SP-DYS', candidateId, cycleId, studentLabel,
  });
  return { post, create, sessions, attempts, get inserts() { return inserts; } };
}

test('same candidate, educator, academy and cycle resumes and reload reads central evidence', async () => {
  const h = harness();
  const first = await h.post('educatorA', h.create());
  assert.equal(first.status, 201);
  h.attempts.set(first.body.session.id, [{ task_code: 'DYS-PH01', answer_text: 'al' }]);
  const restarted = await h.post('educatorA', h.create());
  assert.equal(restarted.status, 200);
  assert.equal(restarted.body.resumed, true);
  assert.equal(restarted.body.session.id, first.body.session.id);
  const reload = await h.post('educatorA', { action: 'get', sessionId: first.body.session.id });
  assert.equal(reload.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(reload.body.attempts)),
    [{ task_code: 'DYS-PH01', answer_text: 'al' }]);
});

test('same display name never merges two candidate UUIDs or two cycles', async () => {
  const h = harness();
  const a = await h.post('educatorA', h.create(candidate, cycle, 'Aynı Ad'));
  const b = await h.post('educatorA', h.create(uuid(13), cycle, 'Aynı Ad'));
  const c = await h.post('educatorA', h.create(candidate, uuid(14), 'Aynı Ad'));
  assert.equal(new Set([a.body.session.id, b.body.session.id, c.body.session.id]).size, 3);
});

test('concurrent create has one active session and loser resumes winner', async () => {
  const h = harness();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => h.post('educatorA', h.create())));
  assert.equal(h.sessions.length, 1);
  assert.equal(new Set(results.map((r) => r.body.session.id)).size, 1);
  assert.equal(results.filter((r) => r.body.resumed === false).length, 1);
});

test('unauthenticated, other educator and other academy cannot read candidate session', async () => {
  const h = harness();
  const first = await h.post('educatorA', h.create());
  for (const educator of [null, 'educatorB', 'educatorC']) {
    const result = await h.post(educator,
      { action: 'get', sessionId: first.body.session.id });
    assert.equal(result.status, educator ? 404 : 401);
  }
  const sameAcademyOtherEducator = await h.post('educatorB', h.create());
  assert.notEqual(sameAcademyOtherEducator.body.session.id, first.body.session.id);
  const otherAcademy = await h.post('educatorC', h.create());
  assert.notEqual(otherAcademy.body.session.id, first.body.session.id);
});

test('missing unique index fails closed; invalid candidate identity is rejected', async () => {
  const h = harness({ indexInstalled: false });
  assert.equal((await h.post('educatorA', h.create())).status, 503);
  assert.equal(h.sessions.length, 0);
  assert.equal((await h.post('educatorA', h.create('not-a-uuid'))).status, 400);
});
