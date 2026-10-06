import { createHash } from 'node:crypto';
import postgres from 'postgres';

const NETWORK_AUDIT_MARKER = Symbol.for('cza.postgresNetworkAuditInstalled');

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing-environment:${name}`);
  return value;
}

if (globalThis[NETWORK_AUDIT_MARKER] !== true) {
  throw new Error('network-guard-not-installed');
}

const connectionString = requiredEnvironment('DATABASE_URL');
const expectedHostSha256 = requiredEnvironment(
  'CZA_ALLOWED_POSTGRES_HOST_SHA256',
);
const databaseUrl = new URL(connectionString);
const actualHostSha256 = createHash('sha256')
  .update(databaseUrl.hostname.toLowerCase())
  .digest('hex');
if (
  expectedHostSha256 !== actualHostSha256 ||
  databaseUrl.hostname.toLowerCase().includes('-pooler.')
) {
  throw new Error('temporary-database-host-invalid');
}

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  idle_timeout: 5,
});

try {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS public.trusted_proxy_nonces (
      nonce_hash text PRIMARY KEY CHECK (nonce_hash ~ '^[0-9a-f]{64}$'),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK (expires_at > created_at)
    );

    CREATE INDEX IF NOT EXISTS idx_trusted_proxy_nonces_expiry
      ON public.trusted_proxy_nonces(expires_at);

    CREATE OR REPLACE FUNCTION public.cza_consume_trusted_proxy_nonce(
      p_nonce_hash text,
      p_expires_at timestamptz
    )
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public, pg_temp
    AS $$
    DECLARE
      v_now timestamptz := clock_timestamp();
      v_inserted boolean;
    BEGIN
      IF p_nonce_hash !~ '^[0-9a-f]{64}$'
         OR p_expires_at <= v_now
         OR p_expires_at > v_now + interval '5 minutes' THEN
        RAISE EXCEPTION 'CZA_PROXY_NONCE_INVALID' USING ERRCODE = '22023';
      END IF;

      WITH expired AS (
        SELECT nonces.ctid
        FROM public.trusted_proxy_nonces AS nonces
        WHERE nonces.expires_at <= v_now
        ORDER BY nonces.expires_at
        LIMIT 1000
        FOR UPDATE SKIP LOCKED
      )
      DELETE FROM public.trusted_proxy_nonces AS nonces
      USING expired
      WHERE nonces.ctid = expired.ctid;

      INSERT INTO public.trusted_proxy_nonces (nonce_hash, expires_at)
      VALUES (p_nonce_hash, p_expires_at)
      ON CONFLICT (nonce_hash) DO NOTHING
      RETURNING true INTO v_inserted;

      RETURN COALESCE(v_inserted, false);
    END;
    $$;
  `);
  await sql`TRUNCATE TABLE public.trusted_proxy_nonces`;

  const probeNonce = createHash('sha256')
    .update(`cza-proxy-e2e-${Date.now()}`)
    .digest('hex');
  const first = await sql`
    SELECT public.cza_consume_trusted_proxy_nonce(
      ${probeNonce},
      now() + interval '2 minutes'
    ) AS consumed
  `;
  const replay = await sql`
    SELECT public.cza_consume_trusted_proxy_nonce(
      ${probeNonce},
      now() + interval '2 minutes'
    ) AS consumed
  `;
  if (first[0]?.consumed !== true || replay[0]?.consumed !== false) {
    throw new Error('nonce-store-behavior-invalid');
  }
  process.stdout.write(
    `${JSON.stringify({
      prepared: true,
      connectionMode: 'direct-unpooled',
      replayRejected: true,
      temporaryHostSha256: actualHostSha256,
    })}\n`,
  );
} finally {
  await sql.end({ timeout: 5 });
}
