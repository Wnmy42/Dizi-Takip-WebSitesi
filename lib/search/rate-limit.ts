import 'server-only';

import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const SEARCH_RATE_LIMIT = 10;
export const SEARCH_RATE_WINDOW_SECONDS = 60;

export type SearchRateLimitResult =
  | { status: 'allowed' }
  | { status: 'denied'; retryAfterSeconds: number }
  | { status: 'unavailable' };

function getClientAddress(headers: Headers): string {
  // Forwarding headers are caller-controlled outside a trusted proxy. Read them
  // only when Vercel identifies the runtime, and prefer its dedicated header.
  if (process.env.VERCEL === '1') {
    const vercelForwarded = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim();
    if (vercelForwarded) return vercelForwarded;

    const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (forwarded) return forwarded;

    const realIp = headers.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  }

  return 'unknown';
}

export function createSearchFingerprint(headers: Headers, secret: string): string {
  const address = getClientAddress(headers).slice(0, 128);
  return createHmac('sha256', secret)
    .update(`bingetrack-search-rate-limit:v1\0${address}`)
    .digest('hex');
}

export async function consumeSearchRateLimit(headers: Headers): Promise<SearchRateLimitResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return { status: 'unavailable' };

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const fingerprint = createSearchFingerprint(headers, serviceRoleKey);

  const { data, error } = await supabase.rpc('consume_search_rate_limit', {
    p_fingerprint: fingerprint,
    p_limit: SEARCH_RATE_LIMIT,
    p_window_seconds: SEARCH_RATE_WINDOW_SECONDS,
  });

  if (error || !Array.isArray(data) || data.length !== 1) {
    return { status: 'unavailable' };
  }

  const row = data[0] as { allowed?: unknown; retry_after_seconds?: unknown };
  if (typeof row.allowed !== 'boolean' || typeof row.retry_after_seconds !== 'number') {
    return { status: 'unavailable' };
  }

  if (row.allowed) return { status: 'allowed' };

  return {
    status: 'denied',
    retryAfterSeconds: Math.max(1, Math.ceil(row.retry_after_seconds)),
  };
}
