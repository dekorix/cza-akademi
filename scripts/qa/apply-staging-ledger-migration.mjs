import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';

const url = process.env.CZA_STAGING_DATABASE_URL || '';
if (!url) {
  console.error('STAGING_SCHEMA_BOOTSTRAP=BLOCKED');
  console.error('REASON=CZA_STAGING_DATABASE_URL_MISSING');
  process.exit(2);
}

let parsed;
try {
  parsed = new URL(url);
} catch {
  console.error('STAGING_SCHEMA_BOOTSTRAP=BLOCKED');
  console.error('REASON=INVALID_STAGING_DATABASE_URL');
  process.exit(2);
}

const host = parsed.hostname.toLowerCase();
if (
  !host.endsWith('.neon.tech') ||
  parsed.pathname !== '/cza_learning' ||
  /(^|[.-])(prod|production)([.-]|$)/.test(host)
) {
  console.error('STAGING_SCHEMA_BOOTSTRAP=BLOCKED');
  console.error('REASON=UNSAFE_DATABASE_TARGET');
  process.exit(2);
}

function splitSql(source) {
  const statements = [];
  let current = '';
  let i = 0;
  let single = false;
  let double = false;
  let lineComment = false;
  let blockComment = false;
  let dollarTag = null;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      current += ch;
      if (ch === '\n') lineComment = false;
      i += 1;
      continue;
    }

    if (blockComment) {
      current += ch;
      if (ch === '*' && next === '/') {
        current += next;
        i += 2;
        blockComment = false;
      } else {
        i += 1;
      }
      continue;
    }

    if (dollarTag) {
      if (source.startsWith(dollarTag, i)) {
        current += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
      } else {
        current += ch;
        i += 1;
      }
      continue;
    }

    if (single) {
      current += ch;
      if (ch === "'" && next === "'") {
        current += next;
        i += 2;
      } else {
        if (ch === "'") single = false;
        i += 1;
      }
      continue;
    }

    if (double) {
      current += ch;
      if (ch === '"' && next === '"') {
        current += next;
        i += 2;
      } else {
        if (ch === '"') double = false;
        i += 1;
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      current += ch + next;
      i += 2;
      lineComment = true;
      continue;
    }

    if (ch === '/' && next === '*') {
      current += ch + next;
      i += 2;
      blockComment = true;
      continue;
    }

    if (ch === "'") {
      current += ch;
      single = true;
      i += 1;
      continue;
    }

    if (ch === '"') {
      current += ch;
      double = true;
      i += 1;
      continue;
    }

    if (ch === '$') {
      const match = source.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }

    if (ch === ';') {
      if (current.trim()) statements.push(current.trim());
      current = '';
      i += 1;
      continue;
    }

    current += ch;
    i += 1;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function semantic(statement) {
  return statement
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .trim()
    .toUpperCase();
}

const sql = neon(url);

try {
  const preflight = await sql`
    SELECT
      (to_regclass('public.learning_records') IS NOT NULL) AS learning_records,
      (to_regclass('public.learning_evidence') IS NOT NULL) AS learning_evidence
  `;
  const basePresent = preflight[0]?.learning_records === true && preflight[0]?.learning_evidence === true;

  const migrationFiles = [
    ...(!basePresent ? ['../../db/migrations/20260913_canonical_learning_ledger_v1.sql'] : []),
    '../../db/migrations/20261005_canonical_learning_student_session_binding_v1.sql',
  ];

  const compatibilityDrops = [
    ...(!basePresent ? [`
      DROP FUNCTION IF EXISTS public.cza_student_record_learning(
        uuid,uuid,uuid,uuid,text,text,text,text,text,text,
        timestamptz,timestamptz,text,jsonb,jsonb,jsonb
      )
    `] : []),
    `
      DROP FUNCTION IF EXISTS public.cza_student_record_learning(
        uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,
        timestamptz,timestamptz,text,jsonb,jsonb,jsonb
      )
    `,
  ];

  const statements = [
    ...compatibilityDrops,
    ...migrationFiles.flatMap(relativePath => {
    const migration = fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
      return splitSql(migration).filter(statement => {
        const normalized = semantic(statement);
        return normalized !== 'BEGIN' && normalized !== 'COMMIT';
      });
    }),
  ];

  if (!statements.length) {
    throw new Error('MIGRATION_EMPTY');
  }

  console.log('BASE_LEDGER_PRESENT=' + basePresent);
  await sql.transaction(statements.map(statement => sql.query(statement)));

  const rows = await sql`
    SELECT
      (to_regclass('public.learning_records') IS NOT NULL) AS learning_records,
      (to_regclass('public.learning_evidence') IS NOT NULL) AS learning_evidence,
      (to_regprocedure(
        'public.cza_student_record_learning(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,text,timestamptz,timestamptz,text,jsonb,jsonb,jsonb)'
      ) IS NOT NULL) AS record_function
  `;

  const check = rows[0] || {};
  if (!check.learning_records || !check.learning_evidence || !check.record_function) {
    throw new Error('canonical_ledger_verify_failed');
  }

  const hostHash = crypto.createHash('sha256').update(host).digest('hex');
  console.log('STAGING_SCHEMA_BOOTSTRAP=PASS');
  console.log('STAGING_SCHEMA_VERIFY=PASS');
  console.log('STATEMENT_COUNT=' + statements.length);
  console.log('HOST_SHA256=' + hostHash);
} catch (error) {
  console.error('STAGING_SCHEMA_BOOTSTRAP=FAIL');
  console.error('ERROR=' + (error instanceof Error ? error.message : String(error)));
  process.exit(1);
}
