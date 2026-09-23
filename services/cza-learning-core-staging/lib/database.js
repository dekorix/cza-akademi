import { neon } from '@neondatabase/serverless';
import { stagingDatabaseConfig } from './config.js';

export function createStagingCoreDatabase(environment = process.env) {
  const { databaseUrl } = stagingDatabaseConfig(environment);
  const sql = neon(databaseUrl);
  return {
    async login(input, userAgent) {
      const rows = await sql`SELECT public.cza_student_login(${input.username}, ${input.pin}, ${userAgent}) AS result`;
      return rows[0]?.result ?? null;
    },
    async me(input) {
      const rows = await sql`SELECT public.cza_student_dashboard(${input.sessionToken}) AS result`;
      return rows[0]?.result ?? null;
    },
    async start(input) {
      const rows = await sql`SELECT public.cza_student_start_training(
        ${input.sessionToken}, ${input.moduleCode}, ${input.source}::public.work_source,
        ${input.clientSessionId}::uuid, ${input.recipeId}::uuid, ${input.settings}::jsonb
      ) AS result`;
      return rows[0]?.result ?? null;
    },
    async attempt(input) {
      const rows = await sql`SELECT public.cza_student_record_attempt(
        ${input.sessionToken}, ${input.sessionId}::uuid, ${input.payload}::jsonb
      ) AS result`;
      return rows[0]?.result ?? null;
    },
    async interaction(input) {
      const rows = await sql`SELECT public.cza_student_record_interaction(
        ${input.sessionToken}, ${input.sessionId}::uuid, ${input.clientEventId}::uuid,
        ${input.questionIndex}, ${input.sequenceNo}, ${input.eventType}, ${input.screenArea},
        ${null}::text, ${null}::boolean, ${null}::boolean, ${input.elapsedMs}, ${input.payload}::jsonb
      ) AS result`;
      return rows[0]?.result ?? null;
    },
    async finish(input) {
      const rows = await sql`SELECT public.cza_student_finish_training(
        ${input.sessionToken}, ${input.sessionId}::uuid
      ) AS result`;
      return rows[0]?.result ?? null;
    },
  };
}
