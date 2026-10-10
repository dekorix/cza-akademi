import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const fixture = JSON.parse(fs.readFileSync(process.env.CZA_QA_FIXTURE_FILE));
const base =
    'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev',
  out = process.env.CZA_QA_EVIDENCE_DIR || 'docs/evidence/issue-82-sp-dys';
fs.mkdirSync(out, { recursive: true });
const proof = { profile: 'SP-DYS', tests: [], passed: false };
let cookie = '';
async function post(path, body, options = {}) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: {
      origin: base,
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...options.headers,
    },
    body: JSON.stringify(body),
  });
  return {
    status: r.status,
    body: await r.json(),
    setCookie: r.headers.get('set-cookie'),
  };
}
function check(name, ok, evidence = {}) {
  proof.tests.push({ name, passed: !!ok, evidence });
  assert.ok(ok, name);
}
try {
  proof.target = {
    project: 'patient-firefly-51111834',
    branch: 'br-withered-queen-b15ltb40',
    database: 'cza_t5_synthetic',
    readback: 'connector SQL performed separately',
  };
  const bad = await post('/api/educator-auth', {
    action: 'login',
    email: fixture.email,
    password: randomUUID(),
  });
  check('wrong password denied', bad.status === 401, { status: bad.status });
  const login = await post('/api/educator-auth', {
    action: 'login',
    email: fixture.email,
    password: fixture.password,
  });
  assert.equal(login.status, 200);
  cookie = login.setCookie.split(';')[0];
  check(
    'real synthetic educator login and secure bounded cookie',
    login.status === 200 &&
      /HttpOnly/i.test(login.setCookie) &&
      /Secure/i.test(login.setCookie) &&
      /SameSite=Strict/i.test(login.setCookie) &&
      /Max-Age=\d+/.test(login.setCookie),
    { status: login.status, secure: true, httpOnly: true, sameSite: 'Strict' },
  );
  const me = await post('/api/educator-auth', { action: 'me' });
  check(
    'canonical educator and tenant',
    me.status === 200 &&
      me.body.user.id === fixture.authId &&
      me.body.user.academyId === fixture.academyId,
    { status: me.status },
  );
  const candidateId = randomUUID(),
    cycleId = randomUUID(),
    body = {
      action: 'create',
      profileCode: 'SP-DYS',
      candidateId,
      cycleId,
      studentLabel: 'QA Synthetic SP-DYS Issue82',
    };
  const created = await post('/api/assessment-special-linked', body);
  assert.equal(created.status, 201);
  const sessionId = created.body.session.id;
  proof.identity = { candidateId, cycleId, sessionId };
  check(
    'SP-DYS candidate creation',
    created.body.session.template_code === 'CZA_SPECIAL_V1_DYS' &&
      created.body.session.student_id === null,
    { status: created.status, sessionId, studentId: null },
  );
  const attempt = await post('/api/assessment-special-linked', {
    action: 'attempt',
    sessionId,
    taskCode: 'DYS-PH01',
    answerText: 'al',
    verdict: 'MATCH',
    supportLevel: 'INDEPENDENT',
    responseLatencyMs: 1500,
    note: 'Synthetic QA first response',
    observation: {
      supportLevel: 'INDEPENDENT',
      note: 'Synthetic API QA first response',
    },
    rawEvidence: {
      response: 'al',
      verdict: 'MATCH',
      support: 'INDEPENDENT',
      note: 'Synthetic API QA first response',
    },
  });
  check('first answer persisted', attempt.status === 200, {
    status: attempt.status,
  });
  const got = await post('/api/assessment-special-linked', {
    action: 'get',
    sessionId,
  });
  check(
    'reload API returns same identity and response',
    got.status === 200 &&
      got.body.session.metadata.candidateId === candidateId &&
      got.body.session.metadata.cycleId === cycleId &&
      got.body.attempts.length === 1,
    { status: got.status, attempts: got.body.attempts.length },
  );
  const renamed = await post('/api/assessment-special-linked', {
    ...body,
    studentLabel: 'QA Synthetic SP-DYS Corrected Name',
  });
  check(
    'display-name correction preserves identity',
    renamed.status === 200 &&
      renamed.body.resumed &&
      renamed.body.session.id === sessionId,
    { status: renamed.status, sessionId: renamed.body.session.id },
  );
  const both = await Promise.all([
    post('/api/assessment-special-linked', body),
    post('/api/assessment-special-linked', body),
  ]);
  check(
    'concurrent create resumes one active session',
    both.every((x) => x.status === 200 && x.body.session.id === sessionId),
    { statuses: both.map((x) => x.status) },
  );
  const raceCandidateId = randomUUID(),
    raceCycleId = randomUUID();
  const raced = await Promise.all([
    post('/api/assessment-special-linked', {
      ...body,
      candidateId: raceCandidateId,
      cycleId: raceCycleId,
    }),
    post('/api/assessment-special-linked', {
      ...body,
      candidateId: raceCandidateId,
      cycleId: raceCycleId,
    }),
  ]);
  proof.concurrentFirstCreate = {
    candidateId: raceCandidateId,
    cycleId: raceCycleId,
    sessionId: raced[0].body.session?.id,
    statuses: raced.map((x) => x.status),
  };
  check(
    'two simultaneous first creates produce one session',
    raced.some((x) => x.status === 201) &&
      raced.every((x) => [200, 201].includes(x.status)) &&
      raced[0].body.session?.id === raced[1].body.session?.id,
    proof.concurrentFirstCreate,
  );
  for (const [name, headers, status] of [
    ['foreign origin', { origin: 'https://foreign.invalid' }, 403],
    ['forged educator', { 'x-educator-id': fixture.authId }, 403],
  ]) {
    const r = await post('/api/educator-auth', { action: 'me' }, { headers });
    check(name + ' rejected', r.status === status, { status: r.status });
  }
  const logout = await post('/api/educator-auth', { action: 'logout' });
  check(
    'provider logout and cookie clearing',
    logout.status === 200 &&
      logout.body.revoked &&
      /Max-Age=0/.test(logout.setCookie),
    { status: logout.status },
  );
  const revoked = await post('/api/educator-auth', { action: 'me' });
  check('revoked session rejected', revoked.status === 401, {
    status: revoked.status,
  });
  cookie = '';
  const noSession = await post('/api/assessment-special-linked', {
    action: 'get',
    sessionId,
  });
  check('unauthenticated central endpoint denied', noSession.status === 401, {
    status: noSession.status,
  });
  proof.passed = true;
} catch (e) {
  proof.failure = e.message;
  process.exitCode = 1;
} finally {
  fs.writeFileSync(out + '/api-neon.json', JSON.stringify(proof, null, 2));
  console.log(
    JSON.stringify({
      passed: proof.passed,
      tests: proof.tests.map(({ name, passed }) => ({ name, passed })),
      failure: proof.failure,
    }),
  );
}
