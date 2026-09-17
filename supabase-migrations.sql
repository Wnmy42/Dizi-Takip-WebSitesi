-- BingeTrack Supabase Migration
-- Supabase dashboard > SQL Editor'da çalıştır

-- 1. show_status enum
CREATE TYPE show_status AS ENUM ('watching', 'plan_to_watch', 'completed', 'dropped');

-- 2. user_shows tablosu
CREATE TABLE user_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tmdb_show_id integer NOT NULL CONSTRAINT user_shows_tmdb_show_id_positive CHECK (tmdb_show_id > 0),
  title text NOT NULL CONSTRAINT user_shows_title_valid CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  poster_path text CONSTRAINT user_shows_poster_path_valid CHECK (poster_path IS NULL OR char_length(btrim(poster_path)) BETWEEN 1 AND 500),
  total_episodes integer NOT NULL DEFAULT 0 CONSTRAINT user_shows_total_episodes_nonnegative CHECK (total_episodes >= 0),
  status show_status NOT NULL DEFAULT 'plan_to_watch',
  rating smallint CHECK (rating >= 1 AND rating <= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_favorite boolean NOT NULL DEFAULT false,
  UNIQUE(user_id, tmdb_show_id)
);

-- 3. user_episodes tablosu
CREATE TABLE user_episodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_show_id uuid NOT NULL REFERENCES user_shows(id) ON DELETE CASCADE,
  season_number integer NOT NULL CONSTRAINT user_episodes_season_number_positive CHECK (season_number > 0),
  episode_number integer NOT NULL CONSTRAINT user_episodes_episode_number_positive CHECK (episode_number > 0),
  watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_show_id, season_number, episode_number)
);

-- 4. updated_at otomatik güncelleme trigger’ı
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_shows_updated_at
  BEFORE UPDATE ON user_shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. RLS aktif et
ALTER TABLE user_shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_episodes ENABLE ROW LEVEL SECURITY;

-- 6. user_shows RLS politikaları
CREATE POLICY "user_shows_select" ON user_shows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_shows_insert" ON user_shows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_shows_update" ON user_shows
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_shows_delete" ON user_shows
  FOR DELETE USING (auth.uid() = user_id);

-- 7. user_episodes RLS politikaları
CREATE POLICY "user_episodes_select" ON user_episodes
  FOR SELECT USING (
    user_show_id IN (SELECT id FROM user_shows WHERE user_id = auth.uid())
  );

CREATE POLICY "user_episodes_insert" ON user_episodes
  FOR INSERT WITH CHECK (
    user_show_id IN (SELECT id FROM user_shows WHERE user_id = auth.uid())
  );

CREATE POLICY "user_episodes_delete" ON user_episodes
  FOR DELETE USING (
    user_show_id IN (SELECT id FROM user_shows WHERE user_id = auth.uid())
  );

-- 8. İzleme istatistiği view’ı
CREATE OR REPLACE VIEW user_shows_with_progress WITH (security_invoker = true) AS
SELECT
  s.id,
  s.user_id,
  s.tmdb_show_id,
  s.title,
  s.poster_path,
  s.total_episodes,
  s.status,
  s.rating,
  s.created_at,
  s.updated_at,
  COUNT(e.id)::integer AS watched_episodes,
  CASE
    WHEN s.total_episodes = 0 THEN 0
    ELSE ROUND((COUNT(e.id)::numeric / s.total_episodes) * 100)::integer
  END AS progress_percentage,
  s.is_favorite
FROM user_shows s
LEFT JOIN user_episodes e ON e.user_show_id = s.id
GROUP BY s.id;

-- 9. Public arama rate limit'i (yalnız service role RPC erişimi)
-- İstemci IP'si bu tabloya yazılmaz; uygulama HMAC parmak izi gönderir.
CREATE TABLE search_rate_limits (
  fingerprint text PRIMARY KEY
    CONSTRAINT search_rate_limits_fingerprint_valid
    CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL
    CONSTRAINT search_rate_limits_request_count_positive
    CHECK (request_count > 0)
);

ALTER TABLE search_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE search_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION consume_search_rate_limit(
  p_fingerprint text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (allowed boolean, retry_after_seconds integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window timestamptz;
  v_count integer;
  v_window_length interval;
BEGIN
  IF p_fingerprint !~ '^[0-9a-f]{64}$'
    OR p_limit < 1 OR p_limit > 1000
    OR p_window_seconds < 1 OR p_window_seconds > 86400
  THEN
    RAISE EXCEPTION 'invalid search rate limit input' USING ERRCODE = '22023';
  END IF;

  v_window_length := make_interval(secs => p_window_seconds);

  INSERT INTO public.search_rate_limits AS limits (
    fingerprint,
    window_started_at,
    request_count
  )
  VALUES (p_fingerprint, v_now, 1)
  ON CONFLICT (fingerprint) DO UPDATE
  SET
    window_started_at = CASE
      WHEN limits.window_started_at <= v_now - v_window_length THEN v_now
      ELSE limits.window_started_at
    END,
    request_count = CASE
      WHEN limits.window_started_at <= v_now - v_window_length THEN 1
      ELSE limits.request_count + 1
    END
  RETURNING window_started_at, request_count
  INTO v_window, v_count;

  allowed := v_count <= p_limit;
  retry_after_seconds := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_window + v_window_length - v_now)))::integer
    )
  END;

  IF random() < 0.01 THEN
    DELETE FROM public.search_rate_limits
    WHERE fingerprint IN (
      SELECT stale.fingerprint
      FROM public.search_rate_limits AS stale
      WHERE stale.window_started_at < v_now - interval '1 day'
      ORDER BY stale.window_started_at
      LIMIT 100
    );
  END IF;

  RETURN NEXT;
END;
$function$;

REVOKE ALL ON FUNCTION consume_search_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_search_rate_limit(text, integer, integer) TO service_role;
