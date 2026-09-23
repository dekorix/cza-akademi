const EXPECTED_PROJECT = 'hidden-glade-66748043';
const EXPECTED_BRANCH = 'br-ancient-bread-b2puable';
const EXPECTED_DATABASE = 'cza_learning';

export class StagingCoreConfigurationError extends Error {
  constructor() {
    super('staging_core_configuration_unavailable');
    this.name = 'StagingCoreConfigurationError';
  }
}

export function stagingDatabaseConfig(environment = process.env) {
  const databaseUrl = environment.DATABASE_URL?.trim();
  if (
    !databaseUrl ||
    environment.CZA_NEON_PROJECT_ID !== EXPECTED_PROJECT ||
    environment.CZA_NEON_BRANCH_ID !== EXPECTED_BRANCH ||
    environment.CZA_NEON_DATABASE !== EXPECTED_DATABASE
  ) {
    throw new StagingCoreConfigurationError();
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new StagingCoreConfigurationError();
  }
  if (
    url.protocol !== 'postgres:' &&
    url.protocol !== 'postgresql:'
  ) {
    throw new StagingCoreConfigurationError();
  }
  if (
    !url.hostname.endsWith('.neon.tech') ||
    decodeURIComponent(url.pathname.slice(1)) !== EXPECTED_DATABASE ||
    !url.username ||
    !url.password
  ) {
    throw new StagingCoreConfigurationError();
  }

  return { databaseUrl };
}

export const stagingDatabaseIdentity = Object.freeze({
  projectId: EXPECTED_PROJECT,
  branchId: EXPECTED_BRANCH,
  database: EXPECTED_DATABASE,
});
