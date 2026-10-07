import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = fs.readFileSync(
  new URL(
    '../db/migrations/20260927_f3a_educator_role_enum_v1.sql',
    import.meta.url,
  ),
  'utf8',
);

test('educator enum addition commits before use, preserves legacy roles and reapplies safely', async () => {
  const db = new PGlite();
  const labels = async () =>
    (
      await db.query(`
    SELECT enumlabel FROM pg_enum
    WHERE enumtypid = 'public.app_role'::regtype ORDER BY enumsortorder
  `)
    ).rows.map((row) => row.enumlabel);
  try {
    // Synthetic local fixture only; the migration creates no table or column.
    await db.exec(`
      BEGIN;
      CREATE TYPE public.app_role AS ENUM ('admin','teacher','student','parent');
      CREATE TABLE public.users (id integer PRIMARY KEY, role public.app_role NOT NULL);
      INSERT INTO public.users VALUES (1,'admin'),(2,'teacher'),(3,'student'),(4,'parent');
      COMMIT;
    `);
    const before = (await db.query('SELECT * FROM public.users ORDER BY id'))
      .rows;
    assert.deepEqual(await labels(), ['admin', 'teacher', 'student', 'parent']);
    await assert.rejects(
      db.query("INSERT INTO public.users VALUES (5,'educator')"),
      (error) => error.code === '22P02',
    );

    await db.exec('BEGIN');
    await db.exec(migration);
    await db.exec('COMMIT');
    assert.deepEqual(await labels(), [
      'admin',
      'teacher',
      'student',
      'parent',
      'educator',
    ]);
    await db.query("INSERT INTO public.users VALUES (5,'educator')");
    assert.deepEqual(
      (await db.query('SELECT * FROM public.users WHERE id=5')).rows,
      [{ id: 5, role: 'educator' }],
    );
    assert.deepEqual(
      (await db.query('SELECT * FROM public.users WHERE id<5 ORDER BY id'))
        .rows,
      before,
    );

    await db.exec('BEGIN');
    await db.exec(migration);
    await db.exec('COMMIT');
    assert.deepEqual(await labels(), [
      'admin',
      'teacher',
      'student',
      'parent',
      'educator',
    ]);
    assert.deepEqual(
      (await db.query('SELECT * FROM public.users ORDER BY id')).rows,
      [...before, { id: 5, role: 'educator' }],
    );
  } finally {
    await db.close();
  }
});
