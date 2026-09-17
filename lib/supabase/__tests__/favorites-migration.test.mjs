import { it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = readFileSync(new URL('./fixtures/before-favorites.sql', import.meta.url), 'utf8');
const migrationFolder = root + '/supabase/migrations';
const migration = readdirSync(migrationFolder).filter(x => x === '20260913180000_add_user_show_favorites.sql').map(x => readFileSync(migrationFolder + '/' + x, 'utf8')).join('\n');
const bootstrap = readFileSync(root + '/supabase-migrations.sql', 'utf8');
const auth = `CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;`;
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const showA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const showB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const policies = db => db.query('SELECT policyname, cmd, qual, with_check FROM pg_policies ORDER BY policyname').then(r => r.rows);
const cols = db => db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'user_shows_with_progress' ORDER BY ordinal_position").then(r => r.rows.map(x => x.column_name));
it('preserves data, view compatibility and owner isolation across repeated upgrades', async () => {
const db = new PGlite();
try {
 await db.exec(auth + baseline);
 await db.exec(`INSERT INTO auth.users VALUES ('${userA}'), ('${userB}');
 INSERT INTO user_shows (id,user_id,tmdb_show_id,title,total_episodes,rating,status) VALUES
 ('${showA}','${userA}',100,'A',4,8,'watching'), ('${showB}','${userB}',200,'B',2,10,'completed');
 INSERT INTO user_episodes(user_show_id,season_number,episode_number) VALUES ('${showA}',1,1);
 GRANT USAGE ON SCHEMA public, auth TO authenticated;
 GRANT SELECT, INSERT, UPDATE, DELETE ON user_shows, user_episodes TO authenticated;
 GRANT SELECT ON user_shows_with_progress TO authenticated;
 CREATE VIEW dependent_progress AS SELECT id, progress_percentage FROM user_shows_with_progress;`);
 const previousPolicies = await policies(db);
 const previousCols = await cols(db);
 await db.exec(migration);
 await db.exec(migration);
 assert.deepEqual(await policies(db), previousPolicies);
 assert.deepEqual(await cols(db), [...previousCols, 'is_favorite']);
 assert.equal((await db.query("SELECT reloptions FROM pg_class WHERE relname='user_shows_with_progress'")).rows[0].reloptions.includes('security_invoker=true'), true);
 assert.deepEqual((await db.query('SELECT rating,is_favorite,watched_episodes,progress_percentage FROM user_shows_with_progress ORDER BY tmdb_show_id')).rows,
 [{rating:8,is_favorite:false,watched_episodes:1,progress_percentage:25},{rating:10,is_favorite:false,watched_episodes:0,progress_percentage:0}]);
 await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${userA}',false);`);
 assert.equal((await db.query('SELECT * FROM user_shows_with_progress')).rows.length,1);
 assert.equal((await db.query(`UPDATE user_shows SET is_favorite=true WHERE id='${showB}' RETURNING id`)).rows.length,0);
 assert.equal((await db.query(`UPDATE user_shows SET is_favorite=true WHERE id='${showA}' RETURNING rating`)).rows[0].rating,8);
 for (const invalid of [0,11]) await assert.rejects(db.exec(`UPDATE user_shows SET rating=${invalid} WHERE id='${showA}'`),e => e.code === '23514');
 await db.exec(`UPDATE user_shows SET rating=1 WHERE id='${showA}'; UPDATE user_shows SET rating=10 WHERE id='${showA}'; UPDATE user_shows SET rating=NULL WHERE id='${showA}';`);
 assert.equal((await db.query(`SELECT is_favorite FROM user_shows WHERE id='${showA}'`)).rows[0].is_favorite,true);
 await db.exec(`SELECT set_config('request.jwt.claim.sub','${userB}',false);`);
 assert.equal((await db.query('SELECT * FROM user_shows_with_progress')).rows[0].tmdb_show_id,200);
 assert.equal((await db.query(`UPDATE user_shows SET rating=3 WHERE id='${showA}' RETURNING id`)).rows.length,0);
 await db.exec('RESET ROLE');
 assert.equal((await db.query('SELECT * FROM dependent_progress')).rows.length,2);

} finally { await db.close(); }
}, 30000);
it('supports the fresh bootstrap followed by the additive migration', async () => {
const fresh = new PGlite();
try { await fresh.exec(auth + bootstrap); await fresh.exec(migration);  }
finally { await fresh.close(); }
}, 30000);
