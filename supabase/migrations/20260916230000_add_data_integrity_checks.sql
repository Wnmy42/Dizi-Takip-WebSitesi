-- Add database-level guards matching the Server Action validation boundary.
-- total_episodes keeps zero as the existing "unknown/not announced" sentinel.

BEGIN;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shows_tmdb_show_id_positive'
      AND conrelid = 'public.user_shows'::regclass
  ) THEN
    ALTER TABLE public.user_shows
      ADD CONSTRAINT user_shows_tmdb_show_id_positive CHECK (tmdb_show_id > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shows_title_valid'
      AND conrelid = 'public.user_shows'::regclass
  ) THEN
    ALTER TABLE public.user_shows
      ADD CONSTRAINT user_shows_title_valid
      CHECK (char_length(btrim(title)) BETWEEN 1 AND 200);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shows_poster_path_valid'
      AND conrelid = 'public.user_shows'::regclass
  ) THEN
    ALTER TABLE public.user_shows
      ADD CONSTRAINT user_shows_poster_path_valid
      CHECK (poster_path IS NULL OR char_length(btrim(poster_path)) BETWEEN 1 AND 500);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_shows_total_episodes_nonnegative'
      AND conrelid = 'public.user_shows'::regclass
  ) THEN
    ALTER TABLE public.user_shows
      ADD CONSTRAINT user_shows_total_episodes_nonnegative CHECK (total_episodes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_episodes_season_number_positive'
      AND conrelid = 'public.user_episodes'::regclass
  ) THEN
    ALTER TABLE public.user_episodes
      ADD CONSTRAINT user_episodes_season_number_positive CHECK (season_number > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_episodes_episode_number_positive'
      AND conrelid = 'public.user_episodes'::regclass
  ) THEN
    ALTER TABLE public.user_episodes
      ADD CONSTRAINT user_episodes_episode_number_positive CHECK (episode_number > 0);
  END IF;
END
$migration$;

COMMIT;
