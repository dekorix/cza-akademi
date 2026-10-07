CREATE TABLE IF NOT EXISTS p1_broker_leases (
  lease_id uuid PRIMARY KEY,
  run_key text NOT NULL UNIQUE,
  repository_id bigint NOT NULL,
  workflow_run_id bigint NOT NULL,
  run_attempt integer NOT NULL,
  wal_run_id varchar(26) NOT NULL UNIQUE,
  scopes jsonb NOT NULL,
  status text NOT NULL,
  expires_at timestamptz NOT NULL,
  project_id text,
  project_name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lease_token_sha256 char(64) NOT NULL,
  job_workflow_sha char(40) NOT NULL,
  project_contract jsonb,
  last_error text,
  CHECK (status IN (
    'ACTIVE',
    'EXECUTING',
    'SUCCEEDED',
    'REVOKED',
    'EXPIRED',
    'FAILED'
  )),
  CHECK (jsonb_typeof(scopes) = 'array'),
  CHECK (run_attempt > 0)
);

CREATE INDEX IF NOT EXISTS p1_broker_leases_expiry_idx
  ON p1_broker_leases (expires_at)
  WHERE status NOT IN ('REVOKED', 'EXPIRED', 'FAILED');
