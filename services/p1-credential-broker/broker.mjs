import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const POLICY = 'CZA-P1-NEON-RUNTIME-TRUST-V1';
const SCOPES = Object.freeze(['staging:neon:create', 'staging:neon:inspect', 'staging:neon:delete']);
const REQUEST_KEYS = Object.freeze(['p0cAttestationSha256', 'policy', 'scopes', 'ttlSeconds', 'walRunId']);
const TERMINAL = new Set(['REVOKED', 'EXPIRED', 'FAILED']);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class BrokerError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const exactArray = (actual, expected) => Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};
const iso = value => new Date(value).toISOString();

export function validateExchangeRequest(request, currentP0c) {
  if (!exactKeys(request, REQUEST_KEYS)) throw new BrokerError('REQUEST_FIELDS_INVALID', 400);
  if (request.policy !== POLICY) throw new BrokerError('POLICY_MISMATCH');
  if (!exactArray(request.scopes, SCOPES)) throw new BrokerError('SCOPE_DENIED');
  if (!Number.isInteger(request.ttlSeconds) || request.ttlSeconds < 1 || request.ttlSeconds > 900) throw new BrokerError('TTL_DENIED');
  if (!ULID.test(request.walRunId || '')) throw new BrokerError('WAL_RUN_ID_INVALID', 400);
  if (!/^[0-9a-f]{64}$/.test(currentP0c || '') || !safeEqual(request.p0cAttestationSha256, currentP0c)) throw new BrokerError('P0C_MISMATCH');
}

export class CredentialBroker {
  constructor({ oidcVerifier, neonClient, leaseStore, capabilitySecret, currentP0c, productionDenylist, now = () => Date.now() }) {
    if (!/^[0-9a-f]{64}$/.test(currentP0c || '')) throw new Error('CURRENT_P0C_REQUIRED');
    if (typeof capabilitySecret !== 'string' || Buffer.byteLength(capabilitySecret) < 32) throw new Error('CAPABILITY_SECRET_REQUIRED');
    if (!Array.isArray(productionDenylist) || productionDenylist.length === 0 || productionDenylist.some(value => !/^[0-9a-f]{64}$/.test(value))) {
      throw new Error('PRODUCTION_DENYLIST_REQUIRED');
    }
    this.oidcVerifier = oidcVerifier;
    this.neonClient = neonClient;
    this.leaseStore = leaseStore;
    this.capabilitySecret = capabilitySecret;
    this.currentP0c = currentP0c;
    this.productionDenylist = [...productionDenylist];
    this.now = now;
  }

  async #claims(token) {
    try { return await this.oidcVerifier.verify(token, this.now()); }
    catch (error) { throw new BrokerError(error.message || 'OIDC_DENIED'); }
  }

  #leaseToken(lease) {
    const binding = [lease.leaseId, lease.runKey, lease.expiresAt, lease.jobWorkflowSha].join('\n');
    return `cza_p1_${createHmac('sha256', this.capabilitySecret).update(binding).digest('base64url')}`;
  }

  #leaseTokenHash(token) { return createHash('sha256').update(String(token || '')).digest('hex'); }

  #assertIdentity(lease, claims) {
    if (lease.repositoryId !== String(claims.repository_id)
      || lease.workflowRunId !== String(claims.run_id)
      || lease.runAttempt !== Number(claims.run_attempt)
      || lease.jobWorkflowSha !== claims.job_workflow_sha) throw new BrokerError('LEASE_IDENTITY_MISMATCH');
  }

  #assertUsable(lease, claims, leaseToken, scope) {
    if (!lease) throw new BrokerError('LEASE_NOT_FOUND', 404);
    this.#assertIdentity(lease, claims);
    if (!safeEqual(this.#leaseTokenHash(leaseToken), lease.leaseTokenSha256)) throw new BrokerError('LEASE_TOKEN_INVALID', 401);
    if (Date.parse(lease.expiresAt) <= this.now()) throw new BrokerError('LEASE_EXPIRED', 401);
    if (TERMINAL.has(lease.status)) throw new BrokerError(`LEASE_${lease.status}`, 403);
    if (!lease.scopes.includes(scope)) throw new BrokerError('SCOPE_DENIED');
  }

  #assertContract(contract, lease) {
    if (!contract || typeof contract !== 'object' || contract.projectName !== lease.projectName || contract.projectId !== lease.projectId && lease.projectId) {
      throw new BrokerError('NEON_PROJECT_CONTRACT_INVALID', 503);
    }
    if (contract.targetEnvironment !== 'staging' || contract.region !== this.neonClient.region) throw new BrokerError('NEON_STAGING_BOUNDARY_INVALID', 503);
    for (const key of ['pooledEndpoint', 'unpooledEndpoint', 'migrationEndpoint']) {
      const host = String(contract[key] || '').toLowerCase();
      const digest = createHash('sha256').update(host).digest('hex');
      if (!host || /(^|[.-])(prod|production)([.-]|$)/.test(host) || this.productionDenylist.includes(digest)) {
        throw new BrokerError('PRODUCTION_ENDPOINT_REJECTED', 503);
      }
    }
    return contract;
  }

  async exchange({ token, request }) {
    const claims = await this.#claims(token);
    validateExchangeRequest(request, this.currentP0c);
    if (!/^[1-9][0-9]*$/.test(claims.run_attempt || '')) throw new BrokerError('OIDC_RUN_ATTEMPT_INVALID');
    const runKey = `${claims.repository_id}:${claims.run_id}:${claims.run_attempt}:${request.walRunId}`;
    return this.leaseStore.withRunLock(runKey, async () => {
      const issuedAtMs = this.now();
      const candidate = {
        leaseId: randomUUID(),
        runKey,
        repositoryId: String(claims.repository_id),
        workflowRunId: String(claims.run_id),
        runAttempt: Number(claims.run_attempt),
        walRunId: request.walRunId,
        scopes: [...SCOPES],
        status: 'ACTIVE',
        expiresAt: new Date(issuedAtMs + request.ttlSeconds * 1000).toISOString(),
        projectId: null,
        projectName: `cza-f3-staging-${request.walRunId.toLowerCase()}`,
        projectContract: null,
        jobWorkflowSha: claims.job_workflow_sha,
        createdAt: iso(issuedAtMs),
        updatedAt: iso(issuedAtMs),
      };
      const tokenValue = this.#leaseToken(candidate);
      candidate.leaseTokenSha256 = this.#leaseTokenHash(tokenValue);
      const lease = await this.leaseStore.reserveLease(candidate);
      this.#assertIdentity(lease, claims);
      if (TERMINAL.has(lease.status) || Date.parse(lease.expiresAt) <= issuedAtMs) throw new BrokerError('RUN_LEASE_NOT_ACTIVE', 409);
      const leaseToken = this.#leaseToken(lease);
      if (!safeEqual(this.#leaseTokenHash(leaseToken), lease.leaseTokenSha256)) throw new BrokerError('LEASE_SECRET_ROTATED', 409);
      return { leaseId: lease.leaseId, leaseToken, expiresAt: lease.expiresAt, scopes: [...lease.scopes], targetEnvironment: 'staging' };
    });
  }

  async createProject({ token, leaseToken, request }) {
    const claims = await this.#claims(token);
    if (!exactKeys(request, ['leaseId']) || !UUID.test(request.leaseId || '')) throw new BrokerError('CREATE_REQUEST_INVALID', 400);
    const initial = await this.leaseStore.getLease(request.leaseId);
    if (!initial) throw new BrokerError('LEASE_NOT_FOUND', 404);
    return this.leaseStore.withRunLock(initial.runKey, async () => {
      let lease = await this.leaseStore.getLease(request.leaseId);
      this.#assertUsable(lease, claims, leaseToken, 'staging:neon:create');
      if (lease.status === 'SUCCEEDED') return { ...this.#assertContract(lease.projectContract, lease), leaseProjectId: lease.leaseId };
      lease = await this.leaseStore.setExecuting(lease.leaseId, iso(this.now()));
      if (!lease || lease.status !== 'EXECUTING') throw new BrokerError('LEASE_EXECUTION_DENIED', 409);
      try {
        const matches = await this.neonClient.findProjectsByName(lease.projectName);
        if (!Array.isArray(matches) || matches.length > 1) throw new BrokerError('PROJECT_RECONCILIATION_AMBIGUOUS', 409);
        const project = matches.length === 1 ? matches[0] : await this.neonClient.createProject({ name: lease.projectName });
        const contract = {
          ...this.#assertContract(await this.neonClient.inspectProject(project.id), { ...lease, projectId: project.id }),
          leaseProjectId: lease.leaseId,
        };
        const succeeded = await this.leaseStore.setSucceeded(lease.leaseId, {
          projectId: project.id, projectContract: contract, now: iso(this.now()),
        });
        if (!succeeded) throw new Error('LEASE_RESULT_PERSIST_FAILED');
        return contract;
      } catch (error) {
        if (error instanceof BrokerError && error.code === 'PROJECT_RECONCILIATION_AMBIGUOUS') {
          await this.leaseStore.setFailed(lease.leaseId, { code: error.code, now: iso(this.now()) });
        }
        throw error;
      }
    });
  }

  async inspectProject({ token, leaseToken, leaseProjectId }) {
    const claims = await this.#claims(token);
    if (!UUID.test(leaseProjectId || '')) throw new BrokerError('LEASE_PROJECT_ID_INVALID', 400);
    const lease = await this.leaseStore.getLease(leaseProjectId);
    this.#assertUsable(lease, claims, leaseToken, 'staging:neon:inspect');
    if (!lease.projectId || lease.status !== 'SUCCEEDED') throw new BrokerError('PROJECT_NOT_READY', 409);
    return { ...this.#assertContract(await this.neonClient.inspectProject(lease.projectId), lease), leaseProjectId: lease.leaseId };
  }

  async deleteProject({ token, leaseToken, leaseProjectId }) {
    const claims = await this.#claims(token);
    if (!UUID.test(leaseProjectId || '')) throw new BrokerError('LEASE_PROJECT_ID_INVALID', 400);
    const initial = await this.leaseStore.getLease(leaseProjectId);
    if (!initial) throw new BrokerError('LEASE_NOT_FOUND', 404);
    return this.leaseStore.withRunLock(initial.runKey, async () => {
      const lease = await this.leaseStore.getLease(leaseProjectId);
      this.#assertUsable(lease, claims, leaseToken, 'staging:neon:delete');
      if (!lease.projectId) throw new BrokerError('PROJECT_NOT_READY', 409);
      await this.neonClient.deleteProject(lease.projectId);
      const revoked = await this.leaseStore.revoke(lease.leaseId, iso(this.now()));
      if (!revoked || revoked.status !== 'REVOKED') throw new BrokerError('LEASE_REVOKE_FAILED', 503);
      return { leaseProjectId: lease.leaseId, status: 'DELETED' };
    });
  }

  async revoke({ token, leaseToken, request }) {
    const claims = await this.#claims(token);
    if (!exactKeys(request, ['leaseId']) || !UUID.test(request.leaseId || '')) throw new BrokerError('REVOKE_REQUEST_INVALID', 400);
    const lease = await this.leaseStore.getLease(request.leaseId);
    this.#assertUsable(lease, claims, leaseToken, 'staging:neon:inspect');
    const updated = await this.leaseStore.revoke(lease.leaseId, iso(this.now()));
    if (!updated || updated.status !== 'REVOKED') throw new BrokerError('LEASE_REVOKE_FAILED', 503);
    return { leaseId: updated.leaseId, status: updated.status };
  }

  async sweepExpired() { return { expired: await this.leaseStore.expireLeases(iso(this.now())) }; }
  async health() { await this.leaseStore.health(); return { status: 'ok', database: 'ready' }; }
}

export const brokerConstants = Object.freeze({ POLICY, SCOPES });
