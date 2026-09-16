const clone = value => value === null || value === undefined ? value : structuredClone(value);

export class MemoryLeaseStore {
  constructor() {
    this.leases = new Map();
    this.runKeys = new Map();
    this.walRunIds = new Map();
    this.projectNames = new Map();
    this.locks = new Map();
  }

  async withRunLock(runKey, callback) {
    const previous = this.locks.get(runKey) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    const tail = previous.then(() => current);
    this.locks.set(runKey, tail);
    await previous;
    try { return await callback(); }
    finally {
      release();
      if (this.locks.get(runKey) === tail) this.locks.delete(runKey);
    }
  }

  async reserveLease(candidate) {
    const existingId = this.runKeys.get(candidate.runKey);
    if (existingId) return clone(this.leases.get(existingId));
    if (this.leases.has(candidate.leaseId)) throw new Error('LEASE_ID_COLLISION');
    if (this.walRunIds.has(candidate.walRunId)) throw new Error('WAL_RUN_ID_COLLISION');
    if (this.projectNames.has(candidate.projectName)) throw new Error('PROJECT_NAME_COLLISION');
    const lease = clone(candidate);
    this.leases.set(lease.leaseId, lease);
    this.runKeys.set(lease.runKey, lease.leaseId);
    this.walRunIds.set(lease.walRunId, lease.leaseId);
    this.projectNames.set(lease.projectName, lease.leaseId);
    return clone(lease);
  }

  async getLease(leaseId) { return clone(this.leases.get(leaseId) || null); }

  async setExecuting(leaseId, now) {
    const lease = this.leases.get(leaseId);
    if (!lease) return null;
    if (['ACTIVE', 'EXECUTING'].includes(lease.status)) Object.assign(lease, { status: 'EXECUTING', updatedAt: now });
    return clone(lease);
  }

  async setSucceeded(leaseId, { projectId, projectContract, now }) {
    const lease = this.leases.get(leaseId);
    if (!lease || lease.status !== 'EXECUTING') return null;
    Object.assign(lease, { status: 'SUCCEEDED', projectId, projectContract: clone(projectContract), updatedAt: now });
    return clone(lease);
  }

  async setFailed(leaseId, { code, now }) {
    const lease = this.leases.get(leaseId);
    if (!lease) return null;
    Object.assign(lease, { status: 'FAILED', lastError: code, updatedAt: now });
    return clone(lease);
  }

  async revoke(leaseId, now) {
    const lease = this.leases.get(leaseId);
    if (!lease) return null;
    if (['ACTIVE', 'EXECUTING', 'SUCCEEDED'].includes(lease.status)) Object.assign(lease, { status: 'REVOKED', updatedAt: now });
    return clone(lease);
  }

  async expireLeases(now) {
    let expired = 0;
    for (const lease of this.leases.values()) {
      if (!['REVOKED', 'EXPIRED', 'FAILED'].includes(lease.status) && Date.parse(lease.expiresAt) <= Date.parse(now)) {
        Object.assign(lease, { status: 'EXPIRED', updatedAt: now });
        expired += 1;
      }
    }
    return expired;
  }

  async list() { return [...this.leases.values()].map(clone); }
  async health() { return true; }
}

const rowToLease = row => row && ({
  leaseId: row.lease_id,
  runKey: row.run_key,
  repositoryId: String(row.repository_id),
  workflowRunId: String(row.workflow_run_id),
  runAttempt: Number(row.run_attempt),
  walRunId: row.wal_run_id,
  scopes: row.scopes,
  status: row.status,
  expiresAt: new Date(row.expires_at).toISOString(),
  projectId: row.project_id,
  projectName: row.project_name,
  projectContract: row.project_contract,
  leaseTokenSha256: row.lease_token_sha256,
  jobWorkflowSha: row.job_workflow_sha,
  lastError: row.last_error,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

export class PostgresLeaseStore {
  constructor(sql) {
    if (typeof sql !== 'function' || typeof sql.begin !== 'function' || typeof sql.reserve !== 'function') throw new Error('BROKER_DATABASE_REQUIRED');
    this.sql = sql;
  }

  async migrate(migrationSql) {
    if (typeof migrationSql !== 'string' || !migrationSql.includes('CREATE TABLE IF NOT EXISTS p1_broker_leases')) throw new Error('BROKER_MIGRATION_INVALID');
    await this.sql.unsafe(migrationSql);
  }

  async withRunLock(runKey, callback) {
    const connection = await this.sql.reserve();
    try {
      await connection`SELECT pg_advisory_lock(hashtextextended(${runKey}, 0))`;
      try { return await callback(); }
      finally { await connection`SELECT pg_advisory_unlock(hashtextextended(${runKey}, 0))`; }
    } finally { connection.release(); }
  }

  async reserveLease(candidate) {
    return this.sql.begin(async sql => {
      await sql`
        INSERT INTO p1_broker_leases (
          lease_id, run_key, repository_id, workflow_run_id, run_attempt, wal_run_id,
          scopes, status, expires_at, project_name, lease_token_sha256, job_workflow_sha
        ) VALUES (
          ${candidate.leaseId}, ${candidate.runKey}, ${candidate.repositoryId}, ${candidate.workflowRunId},
          ${candidate.runAttempt}, ${candidate.walRunId}, ${sql.json(candidate.scopes)}, 'ACTIVE',
          ${candidate.expiresAt}, ${candidate.projectName}, ${candidate.leaseTokenSha256}, ${candidate.jobWorkflowSha}
        ) ON CONFLICT (run_key) DO NOTHING
      `;
      const rows = await sql`SELECT * FROM p1_broker_leases WHERE run_key = ${candidate.runKey} FOR UPDATE`;
      if (rows.length !== 1) throw new Error('LEASE_RESERVATION_FAILED');
      return rowToLease(rows[0]);
    });
  }

  async getLease(leaseId) {
    const rows = await this.sql`SELECT * FROM p1_broker_leases WHERE lease_id = ${leaseId}`;
    return rowToLease(rows[0]);
  }

  async setExecuting(leaseId, now) {
    const rows = await this.sql`
      UPDATE p1_broker_leases SET status = 'EXECUTING', updated_at = ${now}
      WHERE lease_id = ${leaseId} AND status IN ('ACTIVE', 'EXECUTING') RETURNING *
    `;
    return rowToLease(rows[0]) || this.getLease(leaseId);
  }

  async setSucceeded(leaseId, { projectId, projectContract, now }) {
    const rows = await this.sql`
      UPDATE p1_broker_leases
      SET status = 'SUCCEEDED', project_id = ${projectId}, project_contract = ${this.sql.json(projectContract)}, updated_at = ${now}
      WHERE lease_id = ${leaseId} AND status = 'EXECUTING' RETURNING *
    `;
    return rowToLease(rows[0]);
  }

  async setFailed(leaseId, { code, now }) {
    const rows = await this.sql`
      UPDATE p1_broker_leases SET status = 'FAILED', last_error = ${code}, updated_at = ${now}
      WHERE lease_id = ${leaseId} RETURNING *
    `;
    return rowToLease(rows[0]);
  }

  async revoke(leaseId, now) {
    const rows = await this.sql`
      UPDATE p1_broker_leases SET status = 'REVOKED', updated_at = ${now}
      WHERE lease_id = ${leaseId} AND status IN ('ACTIVE', 'EXECUTING', 'SUCCEEDED') RETURNING *
    `;
    return rowToLease(rows[0]) || this.getLease(leaseId);
  }

  async expireLeases(now) {
    const rows = await this.sql`
      UPDATE p1_broker_leases SET status = 'EXPIRED', updated_at = ${now}
      WHERE expires_at <= ${now} AND status NOT IN ('REVOKED', 'EXPIRED', 'FAILED') RETURNING lease_id
    `;
    return rows.length;
  }

  async list() { return (await this.sql`SELECT * FROM p1_broker_leases ORDER BY created_at`).map(rowToLease); }
  async health() { await this.sql`SELECT 1`; return true; }
}
