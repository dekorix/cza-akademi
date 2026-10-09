// Read-only acceptance gate for the staging connection supplied by the
// CZA-STAGING-SECURITY GitHub environment. NEVER select student records,
// mutate data, apply migrations, or log the connection URL.
import { neon } from '@neondatabase/serverless';

const url = process.env.CZA_STAGING_DATABASE_URL;
if (!url) {
  console.error('T5_STAGING_INDEX_READBACK=BLOCKED;REASON=STAGING_SECRET_MISSING');
  process.exit(2);
}
let target;
try { target = new URL(url); } catch {
  console.error('T5_STAGING_INDEX_READBACK=BLOCKED;REASON=INVALID_TARGET_URL');
  process.exit(2);
}
if (!['postgres:', 'postgresql:'].includes(target.protocol) ||
    !target.hostname.endsWith('.neon.tech') ||
    target.pathname !== '/cza_learning' ||
    /(^|[.-])(prod|production)([.-]|$)/i.test(target.hostname)) {
  console.error('T5_STAGING_INDEX_READBACK=BLOCKED;REASON=UNAPPROVED_TARGET');
  process.exit(2);
}

const sql = neon(url);
// Only SELECT from PostgreSQL's catalog and identity functions. No student data.
const rows = await sql`
  SELECT current_database() AS db_name, current_user AS role_name,
    idx.relname AS index_name, tbl.relname AS table_name,
    i.indisunique AS is_unique, i.indisvalid AS is_valid,
    i.indisready AS is_ready, i.indislive AS is_live,
    am.amname AS method, i.indnkeyatts AS key_count,
    i.indnatts AS attribute_count,
    pg_get_indexdef(i.indexrelid, 1, true) AS key_1,
    pg_get_indexdef(i.indexrelid, 2, true) AS key_2,
    pg_get_indexdef(i.indexrelid, 3, true) AS key_3,
    pg_get_indexdef(i.indexrelid, 4, true) AS key_4,
    pg_get_indexdef(i.indexrelid, 5, true) AS key_5,
    pg_get_expr(i.indpred, i.indrelid) AS predicate
  FROM pg_index i
  JOIN pg_class idx ON idx.oid = i.indexrelid
  JOIN pg_namespace ns ON ns.oid = idx.relnamespace
  JOIN pg_class tbl ON tbl.oid = i.indrelid
  JOIN pg_am am ON am.oid = idx.relam
  WHERE ns.nspname = 'public'
    AND idx.relname = 'assessment_sessions_pre_enroll_active_identity_uq'
    AND i.indrelid = 'public.assessment_sessions'::regclass
  LIMIT 1
`;
const row = rows[0];
if (!row) {
  console.error('T5_STAGING_INDEX_READBACK=BLOCKED;REASON=INDEX_MISSING');
  process.exit(2);
}

// Normalize PostgreSQL's unquoted syntax only. JSON object keys and
// literal text including EDUCAT0R_PRE_ENROLLMENT must remain case sensitive.
function normalized(value) {
  return (String(value || '').match(/'(?:''|[^'])*'|[^']+/g) || [])
    .map(token => token.startsWith("'") ? token :
      token.replace(/::text\b/gi, '')
        .replace(/\b(?:IS|NOT|NULL)\b/gi, s => s.toLowerCase())
        .replace(/[()\s]/g, ''))
    .join('');
}
const keys = ['academyId', 'createdByEducatorId', 'candidateId', 'cycleId'];
const checks = [
  row.db_name === 'cza_learning', row.table_name === 'assessment_sessions',
  row.is_unique === true, row.is_valid === true, row.is_ready === true,
  row.is_live === true, row.method === 'btree',
  Number(row.key_count) === 5, Number(row.attribute_count) === 5,
  ...keys.map((key, idx) =>
    normalized(row['key_' + (idx + 1)]) === normalized(`metadata->>'${key}'`)),
  normalized(row.key_5) === 'template_code',
];
const expected = [
  'student_id is null', "status = 'active'",
  "metadata->>'source' = 'EDUCATOR_PRE_ENROLLMENT'",
  "metadata->>'candidateId' is not null",
  "metadata->>'cycleId' is not null",
].map(normalized).sort();
const actual = String(row.predicate || '').split(/\s+AND\s+/i)
  .map(normalized).sort();
checks.push(actual.length === expected.length &&
  actual.every((clause, idx) => clause === expected[idx]));
console.log('T5_STAGING_INDEX_CATALOG_DB=' + row.db_name);
console.log('T5_STAGING_INDEX_CATALOG_ROLE=' + row.role_name);
console.log('T5_STAGING_INDEX_READONLY=YES');
if (!checks.every(Boolean)) {
  console.error('T5_STAGING_INDEX_READBACK=BLOCKED;REASON=INDEX_DEFINITION_MISMATCH');
  process.exit(2);
}
console.log('T5_STAGING_INDEX_READBACK=PASS');
console.log('T5_WORKER_RUNTIME_TARGET_MATCH=NOT_YET_VERIFIED');
