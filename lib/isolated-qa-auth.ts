import { neon } from '@neondatabase/serverless';

// Explicit QA mode cannot authorize a staging/production hostname or database.
export const QA_EDUCATOR_ORIGIN = 'https://cza-v01-isolated-synthetic-20261010.cza-staging-habip.workers.dev';
export const QA_NEON_AUTH = 'https://ep-polished-pine-b1r2qmye.neonauth.c-5.eu-central-1.aws.neon.tech/cza_t5_synthetic/auth';
export const isolatedQaEnabled = () => process.env.CZA_EDUCATOR_AUTH_MODE === 'neon-qa';
const stages = new WeakMap<Request, string>();
export function qaAuthStage(request: Request, stage?: string) {
  if (!isolatedQaEnabled()) return undefined;
  if (stage) stages.set(request, stage);
  return stages.get(request);
}

export async function isolatedQaDatabaseAllowed() {
  if (!isolatedQaEnabled()) return true;
  if (!process.env.DATABASE_URL) return false;
  const [row] = await neon(process.env.DATABASE_URL)`SELECT current_setting('neon.project_id',true) AS project,current_setting('neon.branch_id',true) AS branch`;
  return row?.project === 'patient-firefly-51111834' && row?.branch === 'br-withered-queen-b15ltb40';
}
