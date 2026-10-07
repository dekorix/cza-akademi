import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('disposable proxy fixture has a canonical educator and durable single-use nonces', async () => {
  const source = readFileSync(new URL('../scripts/prepare-educator-proxy-nonce-store.mjs', import.meta.url), 'utf8');
  const sql = source.split('await sql.unsafe(`')[1].split('`);')[0];
  const db = new PGlite();
  try {
    // The PostgreSQL CI suite drops its fixture schema before proxy acceptance.
    await db.exec(sql);
    await db.exec(sql);
    const users = (await db.query("SELECT id,academy_id,auth_user_id FROM public.users WHERE is_active AND role='educator'")).rows;
    assert.equal(users.length, 1);
    assert.equal(users[0].auth_user_id, '47c90485-e057-4ebe-a25c-9d7f236c5bd6');
    assert.ok(users[0].academy_id);
    const claim = () => db.query("SELECT public.cza_consume_trusted_proxy_nonce($1,clock_timestamp()+interval '1 minute') consumed", ['b'.repeat(64)]);
    assert.equal((await claim()).rows[0].consumed, true);
    assert.equal((await claim()).rows[0].consumed, false);
  } finally { await db.close(); }
});
