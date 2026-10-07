import assert from 'node:assert/strict';
import test from 'node:test';
import { CredentialBroker, BrokerError, brokerConstants } from '../services/p1-credential-broker/broker.mjs';
import { MemoryLeaseStore } from '../services/p1-credential-broker/lease-store.mjs';
import { NeonAdminClient, neonAdminConstants } from '../services/p1-credential-broker/neon-admin-client.mjs';

const organizationId = 'dedicated-staging-org';
const targetName = 'cza-f3-staging-01j8abcdefghjkmnpqrstvwxyz';
const walRunId = '01J8ABCDEFGHJKMNPQRSTVWXYZ';
const currentP0c = 'c'.repeat(64);
const nowMs = Date.parse('2026-09-16T12:00:00Z');
const claims = {
  repository_id: '1359513274',
  run_id: '35070000001',
  run_attempt: '1',
  job_workflow_sha: '1'.repeat(40),
};

const project = (name = targetName, id = 'project-target-1') => ({
  id,
  name,
  org_id: organizationId,
  region_id: 'aws-eu-central-1',
  created_at: '2026-09-16T12:00:01Z',
});
const page = (projects, cursor) => ({
  projects,
  unavailable_project_ids: [],
  ...(cursor ? { pagination: { cursor } } : {}),
});
const exchangeRequest = () => ({
  policy: brokerConstants.POLICY,
  scopes: [...brokerConstants.SCOPES],
  ttlSeconds: 900,
  p0cAttestationSha256: currentP0c,
  walRunId,
});

class MockNeonApi {
  constructor(pages, { listFailureAt = -1, postLosesResponse = false, pagesAfterLostPost = null } = {}) {
    this.pages = pages;
    this.listFailureAt = listFailureAt;
    this.postLosesResponse = postLosesResponse;
    this.pagesAfterLostPost = pagesAfterLostPost;
    this.listCalls = [];
    this.postCount = 0;
    this.createdProject = project();
  }

  fetch = async (input, init = {}) => {
    const url = new URL(input);
    const method = init.method || 'GET';
    if (url.origin !== new URL(neonAdminConstants.API_ROOT).origin) throw new Error('UNEXPECTED_ORIGIN');

    if (url.pathname === '/api/v2/projects' && method === 'GET') {
      const requestedCursor = url.searchParams.get('cursor');
      const callIndex = this.listCalls.length;
      this.listCalls.push(url);
      if (callIndex === this.listFailureAt) return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 });
      let index = 0;
      if (requestedCursor) {
        index = this.pages.findIndex((candidate, candidateIndex) => candidateIndex > 0
          && this.pages[candidateIndex - 1]?.pagination?.cursor === requestedCursor);
      }
      if (index < 0 || !this.pages[index]) return new Response(JSON.stringify({ error: 'cursor' }), { status: 400 });
      return new Response(JSON.stringify(this.pages[index]), { status: 200 });
    }

    if (url.pathname === '/api/v2/projects' && method === 'POST') {
      this.postCount += 1;
      if (this.postLosesResponse && this.postCount === 1) {
        this.pages = this.pagesAfterLostPost;
        throw new Error('SIMULATED_LOST_CREATE_RESPONSE');
      }
      return new Response(JSON.stringify({ project: this.createdProject }), { status: 201 });
    }

    if (url.pathname === `/api/v2/projects/${this.createdProject.id}` && method === 'GET') {
      return new Response(JSON.stringify({ project: this.createdProject }), { status: 200 });
    }
    if (url.pathname === `/api/v2/projects/${this.createdProject.id}/endpoints` && method === 'GET') {
      return new Response(JSON.stringify({ endpoints: [{ type: 'read_write', host: 'ep-staging.eu-central-1.aws.neon.tech' }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ error: 'unexpected' }), { status: 404 });
  };
}

const clientFor = api => new NeonAdminClient({
  stagingApiKey: 'staging-bootstrap-secret-value',
  stagingOrganizationId: organizationId,
  fetchImpl: api.fetch,
});

async function createThroughBroker(api) {
  const neonClient = clientFor(api);
  const leaseStore = new MemoryLeaseStore();
  const broker = new CredentialBroker({
    oidcVerifier: { verify: async () => claims },
    neonClient,
    leaseStore,
    capabilitySecret: 'test-capability-secret-with-at-least-32-bytes',
    currentP0c,
    productionDenylist: ['d'.repeat(64)],
    now: () => nowMs,
  });
  const lease = await broker.exchange({ token: 'valid-oidc', request: exchangeRequest() });
  const create = () => broker.createProject({
    token: 'valid-oidc',
    leaseToken: lease.leaseToken,
    request: { leaseId: lease.leaseId },
  });
  return { api, broker, create, lease, leaseStore };
}

function assertListQuery(url, expectedCursor = null) {
  assert.equal(url.pathname, '/api/v2/projects');
  assert.equal(url.searchParams.get('org_id'), organizationId);
  assert.equal(url.searchParams.get('search'), targetName);
  assert.equal(url.searchParams.get('limit'), '400');
  assert.equal(url.searchParams.get('cursor'), expectedCursor);
}

test('target on page 1, 2, or 3 is adopted only after exhaustive pagination', async t => {
  for (const targetPage of [1, 2, 3]) {
    await t.test(`target page ${targetPage} -> adopt`, async () => {
      const pages = [page([], 'cursor-1'), page([], 'cursor-2'), page([])];
      pages[targetPage - 1].projects.push(project());
      const context = await createThroughBroker(new MockNeonApi(pages));
      const contract = await context.create();
      assert.equal(contract.projectId, 'project-target-1');
      assert.equal(context.api.postCount, 0);
      assert.equal(context.api.listCalls.length, 3);
      assertListQuery(context.api.listCalls[0]);
      assertListQuery(context.api.listCalls[1], 'cursor-1');
      assertListQuery(context.api.listCalls[2], 'cursor-2');
    });
  }
});

test('page 1 empty and page 2 target never creates a project', async () => {
  const context = await createThroughBroker(new MockNeonApi([page([], 'next-page'), page([project()])]));
  assert.equal((await context.create()).projectId, 'project-target-1');
  assert.equal(context.api.postCount, 0);
});

test('same exact name on page 1 and page 2 fails closed after all pages', async () => {
  const api = new MockNeonApi([
    page([project(targetName, 'project-target-1')], 'cursor-1'),
    page([project(targetName, 'project-target-2')], 'cursor-2'),
    page([]),
  ]);
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), error => error instanceof BrokerError && error.code === 'PROJECT_RECONCILIATION_AMBIGUOUS');
  assert.equal(api.listCalls.length, 3);
  assert.equal(api.postCount, 0);
});

test('search partial results are ignored and only the exact deterministic name is adopted', async () => {
  const partial = project(`${targetName}-partial`, 'project-partial-1');
  const prefix = project('cza-f3-staging-01j8abcdefghjkmnpqrstvwxy', 'project-partial-2');
  const api = new MockNeonApi([page([partial, prefix], 'cursor-1'), page([project()])]);
  const matches = await clientFor(api).findProjectsByName(targetName);
  assert.deepEqual(matches.map(value => value.id), ['project-target-1']);
  assert.equal(api.listCalls.length, 2);
});

test('repeated cursor fails closed without create', async () => {
  const api = new MockNeonApi([page([], 'same-cursor'), page([], 'same-cursor')]);
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), /NEON_PROJECT_PAGINATION_CYCLE/);
  assert.equal(api.postCount, 0);
});

test('malformed pagination fails closed without create', async t => {
  for (const pagination of [null, {}, { cursor: 7 }, { cursor: '' }]) {
    await t.test(JSON.stringify(pagination), async () => {
      const api = new MockNeonApi([{ projects: [], unavailable_project_ids: [], pagination }]);
      const context = await createThroughBroker(api);
      await assert.rejects(context.create(), /NEON_PROJECT_PAGINATION_INVALID/);
      assert.equal(api.postCount, 0);
    });
  }
});

test('malformed projects response fails closed without create', async () => {
  const api = new MockNeonApi([{ projects: {}, unavailable_project_ids: [] }]);
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), /NEON_PROJECT_LIST_RESPONSE_INVALID/);
  assert.equal(api.postCount, 0);
});

test('list request failure performs zero create calls', async () => {
  const api = new MockNeonApi([page([])], { listFailureAt: 0 });
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), /NEON_STAGING_API_503/);
  assert.equal(api.postCount, 0);
});

test('incomplete response with unavailable projects fails closed without create', async () => {
  const incomplete = page([]);
  incomplete.unavailable_project_ids = ['project-unavailable-1'];
  const api = new MockNeonApi([incomplete]);
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), /NEON_PROJECT_RECONCILIATION_INCOMPLETE/);
  assert.equal(api.postCount, 0);
});

test('lost POST response is reconciled on a later page and never blindly posted twice', async () => {
  const api = new MockNeonApi([page([])], {
    postLosesResponse: true,
    pagesAfterLostPost: [page([], 'cursor-1'), page([], 'cursor-2'), page([project()])],
  });
  const context = await createThroughBroker(api);
  await assert.rejects(context.create(), /SIMULATED_LOST_CREATE_RESPONSE/);
  const adopted = await context.create();
  assert.equal(adopted.projectId, 'project-target-1');
  assert.equal(api.postCount, 1);
  assert.equal(api.listCalls.length, 4);
});
