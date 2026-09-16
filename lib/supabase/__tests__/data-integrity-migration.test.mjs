import { it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const baseline = readFileSync(new URL('./fixtures/before-favorites.sql', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../../supabase/migrations/20260916230000_add_data_integrity_checks.sql', import.meta.url),
  'utf8',
);

const auth = `CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`;

const userId = '11111111-1111-4111-8111-111111111111';
const showId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

it('adds the data integrity checks idempotently while preserving valid zero totals', async () => {
  const db = new PGlite();
  try {
    await db.exec(auth + baseline);
    await db.exec(`
      INSERT INTO auth.users VALUES ('${userId}');
      INSERT INTO user_shows (id, user_id, tmdb_show_id, title, total_episodes)
      VALUES ('${showId}', '${userId}', 1399, 'Game of Thrones', 0);
      INSERT INTO user_episodes (user_show_id, season_number, episode_number)
      VALUES ('${showId}', 1, 1);
    `);

    await db.exec(migration);
    await db.exec(migration);

    const constraints = await db.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid IN ('public.user_shows'::regclass, 'public.user_episodes'::regclass)
        AND conname IN (
          'user_shows_tmdb_show_id_positive',
          'user_shows_title_valid',
          'user_shows_poster_path_valid',
          'user_shows_total_episodes_nonnegative',
          'user_episodes_season_number_positive',
          'user_episodes_episode_number_positive'
        )
      ORDER BY conname;
    `);
    assert.equal(constraints.rows.length, 6);
    assert.equal(
      (await db.query(`SELECT total_episodes FROM user_shows WHERE id = '${showId}'`)).rows[0].total_episodes,
      0,
    );

    const invalidStatements = [
      `UPDATE user_shows SET tmdb_show_id = 0 WHERE id = '${showId}'`,
      `UPDATE user_shows SET title = '   ' WHERE id = '${showId}'`,
      `UPDATE user_shows SET title = '${'x'.repeat(201)}' WHERE id = '${showId}'`,
      `UPDATE user_shows SET poster_path = '' WHERE id = '${showId}'`,
      `UPDATE user_shows SET poster_path = '${'x'.repeat(501)}' WHERE id = '${showId}'`,
      `UPDATE user_shows SET total_episodes = -1 WHERE id = '${showId}'`,
      `UPDATE user_episodes SET season_number = 0 WHERE user_show_id = '${showId}'`,
      `UPDATE user_episodes SET episode_number = 0 WHERE user_show_id = '${showId}'`,
    ];

    for (const statement of invalidStatements) {
      await assert.rejects(db.exec(statement), (error) => error.code === '23514');
    }
  } finally {
    await db.close();
  }
}, 30000);

it('fails atomically when existing rows violate a new invariant', async () => {
  const db = new PGlite();
  try {
    await db.exec(auth + baseline);
    await db.exec(`
      INSERT INTO auth.users VALUES ('${userId}');
      INSERT INTO user_shows (id, user_id, tmdb_show_id, title, total_episodes)
      VALUES ('${showId}', '${userId}', 0, 'Invalid legacy row', 1);
    `);

    await assert.rejects(db.exec(migration), (error) => error.code === '23514');
    await db.exec('ROLLBACK');

    const addedConstraints = await db.query(`
      SELECT count(*)::int AS count
      FROM pg_constraint
      WHERE conrelid IN ('public.user_shows'::regclass, 'public.user_episodes'::regclass)
        AND conname IN (
          'user_shows_tmdb_show_id_positive',
          'user_shows_title_valid',
          'user_shows_poster_path_valid',
          'user_shows_total_episodes_nonnegative',
          'user_episodes_season_number_positive',
          'user_episodes_episode_number_positive'
        );
    `);
    assert.equal(addedConstraints.rows[0].count, 0);
    assert.equal(
      (await db.query(`SELECT tmdb_show_id FROM user_shows WHERE id = '${showId}'`)).rows[0].tmdb_show_id,
      0,
    );
  } finally {
    await db.close();
  }
}, 30000);
