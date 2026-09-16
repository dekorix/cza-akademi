const API_ROOT = 'https://console.neon.tech/api/v2';

export class NeonAdminClient {
  constructor({ adminApiKey, organizationId, fetchImpl = fetch }) {
    if (typeof adminApiKey !== 'string' || adminApiKey.length < 20) throw new Error('NEON_ADMIN_SECRET_REQUIRED');
    if (!/^[a-z0-9-]{1,60}$/.test(organizationId || '')) throw new Error('NEON_ORGANIZATION_ID_INVALID');
    this.adminApiKey = adminApiKey;
    this.organizationId = organizationId;
    this.fetchImpl = fetchImpl;
  }

  async #request(path, init) {
    const response = await this.fetchImpl(`${API_ROOT}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.adminApiKey}`,
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    if (!response.ok) throw new Error(`NEON_ADMIN_API_${response.status}`);
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  async createRunKey({ runId }) {
    const keyName = `cza-p1-${runId}`;
    const result = await this.#request(`/organizations/${this.organizationId}/api_keys`, {
      method: 'POST', body: JSON.stringify({ key_name: keyName }),
    });
    const value = result.api_key || result;
    if (!Number.isSafeInteger(value.id) || typeof value.key !== 'string' || value.key.length < 20) {
      throw new Error('NEON_KEY_RESPONSE_INVALID');
    }
    return { keyId: value.id, apiKey: value.key };
  }

  async revokeRunKey(keyId) {
    if (!Number.isSafeInteger(keyId)) throw new Error('NEON_KEY_ID_INVALID');
    await this.#request(`/organizations/${this.organizationId}/api_keys/${keyId}`, { method: 'DELETE' });
  }
}
