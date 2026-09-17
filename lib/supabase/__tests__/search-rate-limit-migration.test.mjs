import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const migration = readFileSync(
  root + '/supabase/migrations/20260916235500_add_search_rate_limit.sql',
  'utf8',
);
const fingerprint = 'a'.repeat(64);

it('atomically enforces the shared window and keeps raw identifiers out of storage', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
    await db.exec(migration);
    await db.exec(migration);

    const call = () => db.query(
      `SELECT * FROM consume_search_rate_limit('${fingerprint}', 2, 60)`,
    ).then((result) => result.rows[0]);

    const first = await call();
    const second = await call();
    const denied = await call();

    assert.deepEqual(first, { allowed: true, retry_after_seconds: 0 });
    assert.deepEqual(second, { allowed: true, retry_after_seconds: 0 });
    assert.equal(denied.allowed, false);
    assert.equal(denied.retry_after_seconds >= 1, true);

    const stored = await db.query('SELECT fingerprint, request_count FROM search_rate_limits');
    assert.deepEqual(stored.rows, [{ fingerprint, request_count: 3 }]);
    assert.equal(JSON.stringify(stored.rows).includes('203.0.113.'), false);

    await db.exec("UPDATE search_rate_limits SET window_started_at = now() - interval '2 minutes'");
    assert.deepEqual(await call(), { allowed: true, retry_after_seconds: 0 });

    const concurrentFingerprint = 'b'.repeat(64);
    const concurrent = await Promise.all(Array.from({ length: 12 }, () => db.query(
      `SELECT * FROM consume_search_rate_limit('${concurrentFingerprint}', 5, 60)`,
    ).then((result) => result.rows[0])));
    assert.equal(concurrent.filter((result) => result.allowed).length, 5);
    assert.equal(concurrent.filter((result) => !result.allowed).length, 7);
    assert.equal(
      (await db.query(`SELECT request_count FROM search_rate_limits WHERE fingerprint = '${concurrentFingerprint}'`)).rows[0].request_count,
      12,
    );

    const security = await db.query(`
      SELECT
        c.relrowsecurity,
        has_table_privilege('anon', 'search_rate_limits', 'SELECT') AS anon_select,
        has_function_privilege('anon', 'consume_search_rate_limit(text,integer,integer)', 'EXECUTE') AS anon_execute,
        has_function_privilege('service_role', 'consume_search_rate_limit(text,integer,integer)', 'EXECUTE') AS service_execute
      FROM pg_class c
      WHERE c.oid = 'search_rate_limits'::regclass
    `);
    assert.deepEqual(security.rows[0], {
      relrowsecurity: true,
      anon_select: false,
      anon_execute: false,
      service_execute: true,
    });
  } finally {
    await db.close();
  }
}, 30_000);

it('rejects malformed or unsafe function parameters', async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;');
    await db.exec(migration);

    for (const statement of [
      "SELECT * FROM consume_search_rate_limit('raw-ip', 10, 60)",
      `SELECT * FROM consume_search_rate_limit('${fingerprint}', 0, 60)`,
      `SELECT * FROM consume_search_rate_limit('${fingerprint}', 10, 0)`,
    ]) {
      await assert.rejects(db.query(statement), (error) => error.code === '22023');
    }
  } finally {
    await db.close();
  }
}, 30_000);
