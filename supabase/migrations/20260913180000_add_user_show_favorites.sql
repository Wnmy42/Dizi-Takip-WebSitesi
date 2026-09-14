-- Add personal favorites without changing the established view column order.
-- Keeping the prior columns explicit lets CREATE OR REPLACE append is_favorite
-- after the computed progress columns even though the table column is appended
-- before them by ALTER TABLE.

BEGIN;

ALTER TABLE public.user_shows
  ADD COLUMN IF NOT EXISTS is_favorite boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.user_shows_with_progress
WITH (security_invoker = true) AS
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
FROM public.user_shows s
LEFT JOIN public.user_episodes e ON e.user_show_id = s.id
GROUP BY s.id;

COMMIT;
