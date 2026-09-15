#!/usr/bin/env node
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';

const options = Object.fromEntries(process.argv.slice(2).map(value => value.split('=', 2)));
const urlFile = options['--url-file'];
const sqlFile = options['--sql-file'] || 'infra/staging/modules/postgres-security/001_security_state.sql';
if (!urlFile) throw new Error('MIGRATOR_URL_FILE_REQUIRED');
const url = (await readFile(urlFile, 'utf8')).trim();
const parsed = new URL(url);
if (parsed.protocol !== 'postgresql:' || !parsed.hostname || !parsed.username || !parsed.password) throw new Error('MIGRATOR_URL_INVALID');
const source = await readFile(sqlFile, 'utf8');
const client = postgres(url, { max: 1, prepare: false, idle_timeout: 2, connect_timeout: 5 });
try {
  await client.unsafe(source);
  const rows = await client`SELECT to_regprocedure('public.cza_faz3_consume_nonce(text,uuid,text,timestamptz)') IS NOT NULL AS installed`;
  if (rows[0]?.installed !== true) throw new Error('SECURITY_SQL_NOT_INSTALLED');
} finally { await client.end({ timeout: 2 }); }
process.stdout.write('{"result":"PASS","securitySqlInstalled":true}\n');
