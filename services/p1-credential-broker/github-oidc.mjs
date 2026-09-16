import { createPublicKey, verify } from 'node:crypto';
import { verifyP1NeonRuntimeClaims } from '../../security/faz3/oidc/p1-neon-runtime-trust.mjs';

const EXPECTED_ALGORITHM = 'RS256';

const decodePart = value => JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));

export class GithubOidcVerifier {
  constructor({ policy, fetchImpl = fetch, cacheTtlMs = 5 * 60 * 1000 }) {
    this.policy = policy;
    this.fetchImpl = fetchImpl;
    this.cacheTtlMs = cacheTtlMs;
    this.cached = null;
  }

  async #keys(nowMs) {
    if (this.cached && this.cached.expiresAt > nowMs) return this.cached.keys;
    const issuer = new URL(this.policy.issuer);
    if (issuer.protocol !== 'https:') throw new Error('OIDC_ISSUER_INVALID');
    const discoveryResponse = await this.fetchImpl(new URL('/.well-known/openid-configuration', issuer));
    if (!discoveryResponse.ok) throw new Error('OIDC_DISCOVERY_UNAVAILABLE');
    const discovery = await discoveryResponse.json();
    if (discovery.issuer !== this.policy.issuer) throw new Error('OIDC_DISCOVERY_ISSUER_MISMATCH');
    const jwksUrl = new URL(discovery.jwks_uri);
    if (jwksUrl.protocol !== 'https:' || jwksUrl.origin !== issuer.origin) throw new Error('OIDC_JWKS_URI_INVALID');
    const keysResponse = await this.fetchImpl(jwksUrl);
    if (!keysResponse.ok) throw new Error('OIDC_JWKS_UNAVAILABLE');
    const jwks = await keysResponse.json();
    if (!Array.isArray(jwks.keys)) throw new Error('OIDC_JWKS_INVALID');
    this.cached = { keys: jwks.keys, expiresAt: nowMs + this.cacheTtlMs };
    return jwks.keys;
  }

  async verify(token, nowMs = Date.now()) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('OIDC_TOKEN_INVALID');
    let header;
    let claims;
    try { header = decodePart(parts[0]); claims = decodePart(parts[1]); }
    catch { throw new Error('OIDC_TOKEN_INVALID'); }
    if (header.alg !== EXPECTED_ALGORITHM || typeof header.kid !== 'string') throw new Error('OIDC_ALGORITHM_DENIED');
    const jwk = (await this.#keys(nowMs)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.use || key.use === 'sig'));
    if (!jwk) throw new Error('OIDC_SIGNING_KEY_NOT_FOUND');
    const signatureValid = verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
    if (!signatureValid) throw new Error('OIDC_SIGNATURE_INVALID');
    const nowSeconds = Math.floor(nowMs / 1000);
    if (!Number.isInteger(claims.iat) || !Number.isInteger(claims.exp) || claims.iat > nowSeconds + 30 || claims.exp <= nowSeconds || claims.exp - claims.iat > 600) {
      throw new Error('OIDC_TIME_INVALID');
    }
    if (claims.nbf !== undefined && (!Number.isInteger(claims.nbf) || claims.nbf > nowSeconds + 30)) throw new Error('OIDC_TIME_INVALID');
    if (!verifyP1NeonRuntimeClaims(claims, this.policy)) throw new Error('OIDC_CLAIM_MISMATCH');
    if (!/^[1-9][0-9]*$/.test(claims.run_id || '')) throw new Error('OIDC_RUN_ID_INVALID');
    return claims;
  }
}
