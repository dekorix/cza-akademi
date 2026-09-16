import { randomUUID, timingSafeEqual } from 'node:crypto';

const POLICY = 'CZA-P1-NEON-RUNTIME-TRUST-V1';
const SCOPES = Object.freeze(['staging:neon:create', 'staging:neon:inspect', 'staging:neon:delete']);
const PROVIDER_ENDPOINT = 'https://console.neon.tech/api/v2/';
const REQUEST_KEYS = Object.freeze(['p0cAttestationSha256', 'policy', 'scopes', 'ttlSeconds']);

export class BrokerError extends Error {
  constructor(code, status = 403) { super(code); this.code = code; this.status = status; }
}

const exactArray = (actual, expected) => Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
const safeEqual = (left, right) => {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
};

export function validateExchangeRequest(request, currentP0c) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) throw new BrokerError('REQUEST_INVALID', 400);
  if (JSON.stringify(Object.keys(request).sort()) !== JSON.stringify([...REQUEST_KEYS].sort())) throw new BrokerError('REQUEST_FIELDS_INVALID');
  if (request.policy !== POLICY) throw new BrokerError('POLICY_MISMATCH');
  if (!exactArray(request.scopes, SCOPES)) throw new BrokerError('SCOPE_DENIED');
  if (!Number.isInteger(request.ttlSeconds) || request.ttlSeconds < 1 || request.ttlSeconds > 900) throw new BrokerError('TTL_DENIED');
  if (!/^[0-9a-f]{64}$/.test(currentP0c || '') || !safeEqual(request.p0cAttestationSha256, currentP0c)) throw new BrokerError('P0C_MISMATCH');
}

export class CredentialBroker {
  constructor({ oidcVerifier, neonClient, leaseStore, currentP0c, productionDenylist, now = () => Date.now() }) {
    if (!/^[0-9a-f]{64}$/.test(currentP0c || '')) throw new Error('CURRENT_P0C_REQUIRED');
    if (!Array.isArray(productionDenylist) || productionDenylist.length === 0 || productionDenylist.some(value => !/^[0-9a-f]{64}$/.test(value))) {
      throw new Error('PRODUCTION_DENYLIST_REQUIRED');
    }
    this.oidcVerifier = oidcVerifier;
    this.neonClient = neonClient;
    this.leaseStore = leaseStore;
    this.currentP0c = currentP0c;
    this.productionDenylist = [...productionDenylist];
    this.now = now;
  }

  async #claims(token) {
    try { return await this.oidcVerifier.verify(token, this.now()); }
    catch (error) { throw new BrokerError(error.message || 'OIDC_DENIED'); }
  }

  async exchange({ token, request }) {
    const claims = await this.#claims(token);
    validateExchangeRequest(request, this.currentP0c);
    const active = (await this.leaseStore.list()).find(lease => lease.runId === claims.run_id && lease.status === 'ACTIVE');
    if (active) throw new BrokerError('ACTIVE_RUN_LEASE_EXISTS', 409);

    const leaseId = randomUUID();
    const issuedAtMs = this.now();
    const expiresAt = new Date(issuedAtMs + request.ttlSeconds * 1000).toISOString();
    const { keyId, apiKey } = await this.neonClient.createRunKey({ runId: claims.run_id });
    try {
      await this.leaseStore.create({
        schemaVersion: 'CZA-P1-NEON-LEASE-V1', leaseId, keyId, runId: claims.run_id,
        repository: claims.repository, status: 'ACTIVE', issuedAt: new Date(issuedAtMs).toISOString(), expiresAt,
      });
    } catch (error) {
      await this.neonClient.revokeRunKey(keyId).catch(() => {});
      throw error;
    }
    return {
      leaseId,
      credential: {
        expiresAt, neonApiKey: apiKey, p0cAttestationSha256: this.currentP0c,
        productionEndpointSha256Denylist: [...this.productionDenylist],
        providerEndpoints: [PROVIDER_ENDPOINT], scopes: [...SCOPES], targetEnvironment: 'staging',
        targetProjectNamePrefix: 'cza-f3-staging-', ttlSeconds: request.ttlSeconds,
      },
    };
  }

  async revoke({ token, request }) {
    const claims = await this.#claims(token);
    if (!request || JSON.stringify(Object.keys(request).sort()) !== JSON.stringify(['leaseId']) || typeof request.leaseId !== 'string') {
      throw new BrokerError('REVOKE_REQUEST_INVALID', 400);
    }
    const lease = (await this.leaseStore.list()).find(item => item.leaseId === request.leaseId);
    if (!lease || lease.runId !== claims.run_id) throw new BrokerError('LEASE_NOT_FOUND', 404);
    if (lease.status === 'REVOKED' || lease.status === 'EXPIRED_REVOKED') return { leaseId: lease.leaseId, status: lease.status };
    await this.neonClient.revokeRunKey(lease.keyId);
    const updated = await this.leaseStore.update(lease.leaseId, { status: 'REVOKED', revokedAt: new Date(this.now()).toISOString(), revokeReason: 'WORKFLOW_CLEANUP' });
    return { leaseId: updated.leaseId, status: updated.status };
  }

  async sweepExpired() {
    const nowMs = this.now();
    let revoked = 0;
    for (const lease of await this.leaseStore.list()) {
      if (lease.status !== 'ACTIVE' || Date.parse(lease.expiresAt) > nowMs) continue;
      await this.neonClient.revokeRunKey(lease.keyId);
      await this.leaseStore.update(lease.leaseId, { status: 'EXPIRED_REVOKED', revokedAt: new Date(nowMs).toISOString(), revokeReason: 'EXPIRY_SWEEPER' });
      revoked += 1;
    }
    return { revoked };
  }
}

export const brokerConstants = Object.freeze({ POLICY, SCOPES, PROVIDER_ENDPOINT });
