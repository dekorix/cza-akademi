const API_ROOT = 'https://console.neon.tech/api/v2';
const PROJECT_NAME = /^cza-f3-staging-[0-9a-hjkmnp-tv-z]{26}$/;

export class NeonAdminClient {
  constructor({ stagingApiKey, stagingOrganizationId, region = 'aws-eu-central-1', fetchImpl = fetch }) {
    if (typeof stagingApiKey !== 'string' || stagingApiKey.length < 20) throw new Error('STAGING_NEON_SECRET_REQUIRED');
    if (!/^[a-z0-9-]{1,60}$/.test(stagingOrganizationId || '')) throw new Error('STAGING_NEON_ORGANIZATION_ID_INVALID');
    if (!/^aws-[a-z]+-[a-z]+-[1-9]$/.test(region)) throw new Error('STAGING_NEON_REGION_INVALID');
    this.stagingApiKey = stagingApiKey;
    this.organizationId = stagingOrganizationId;
    this.region = region;
    this.fetchImpl = fetchImpl;
  }

  async #request(path, init) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.includes('://')) throw new Error('NEON_API_PATH_INVALID');
    const response = await this.fetchImpl(`${API_ROOT}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.stagingApiKey}`,
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
      },
    });
    if (!response.ok) throw new Error(`NEON_STAGING_API_${response.status}`);
    if (response.status === 204) return {};
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  #assertProject(project) {
    if (!project || typeof project.id !== 'string' || !PROJECT_NAME.test(project.name || '')) throw new Error('NEON_PROJECT_RESPONSE_INVALID');
    if (project.org_id !== this.organizationId) throw new Error('NEON_ORGANIZATION_BOUNDARY_VIOLATION');
    return project;
  }

  async findProjectsByName(name) {
    if (!PROJECT_NAME.test(name || '')) throw new Error('NEON_PROJECT_NAME_INVALID');
    const query = new URLSearchParams({ org_id: this.organizationId, limit: '400' });
    const result = await this.#request(`/projects?${query}`, { method: 'GET' });
    const projects = Array.isArray(result.projects) ? result.projects : [];
    return projects.filter(project => project.name === name).map(project => this.#assertProject(project));
  }

  async createProject({ name }) {
    if (!PROJECT_NAME.test(name || '')) throw new Error('NEON_PROJECT_NAME_INVALID');
    const result = await this.#request('/projects', {
      method: 'POST',
      body: JSON.stringify({
        project: { name, org_id: this.organizationId, region_id: this.region, pg_version: 17 },
      }),
    });
    return this.#assertProject(result.project);
  }

  async inspectProject(projectId) {
    if (!/^[a-z0-9-]{1,64}$/.test(projectId || '')) throw new Error('NEON_PROJECT_ID_INVALID');
    const [projectResult, endpointResult] = await Promise.all([
      this.#request(`/projects/${projectId}`, { method: 'GET' }),
      this.#request(`/projects/${projectId}/endpoints`, { method: 'GET' }),
    ]);
    const project = this.#assertProject(projectResult.project);
    const endpoint = (endpointResult.endpoints || []).find(item => item.type === 'read_write') || (endpointResult.endpoints || [])[0];
    const host = String(endpoint?.host || '').toLowerCase();
    if (!host || !/^[a-z0-9.-]+$/.test(host)) throw new Error('NEON_ENDPOINT_RESPONSE_INVALID');
    const labels = host.split('.');
    const pooled = `${labels[0]}-pooler.${labels.slice(1).join('.')}`;
    return {
      leaseProjectId: null,
      projectId: project.id,
      projectName: project.name,
      region: project.region_id || this.region,
      pooledEndpoint: pooled,
      unpooledEndpoint: host,
      migrationEndpoint: host,
      createdAt: project.created_at,
      targetEnvironment: 'staging',
    };
  }

  async deleteProject(projectId) {
    if (!/^[a-z0-9-]{1,64}$/.test(projectId || '')) throw new Error('NEON_PROJECT_ID_INVALID');
    const project = this.#assertProject((await this.#request(`/projects/${projectId}`, { method: 'GET' })).project);
    await this.#request(`/projects/${projectId}`, { method: 'DELETE' });
  }
}

export const neonAdminConstants = Object.freeze({ API_ROOT });
