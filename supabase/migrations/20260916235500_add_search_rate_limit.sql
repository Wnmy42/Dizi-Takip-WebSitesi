-- Shared, atomic public-search rate limiting for multi-instance deployments.
-- The application stores only an HMAC fingerprint; raw client IPs never reach this table.

BEGIN;

CREATE TABLE IF NOT EXISTS public.search_rate_limits (
  fingerprint text PRIMARY KEY
    CONSTRAINT search_rate_limits_fingerprint_valid
    CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL
    CONSTRAINT search_rate_limits_request_count_positive
    CHECK (request_count > 0)
);

ALTER TABLE public.search_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.search_rate_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_search_rate_limit(
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

  -- Keep the table bounded without a scheduler. This runs for roughly 1% of calls
  -- and removes at most 100 fingerprints that have been inactive for a day.
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

REVOKE ALL ON FUNCTION public.consume_search_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_search_rate_limit(text, integer, integer) TO service_role;

COMMIT;
