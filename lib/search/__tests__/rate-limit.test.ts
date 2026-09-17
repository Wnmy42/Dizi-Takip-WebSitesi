import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClient, rpc } = vi.hoisted(() => ({
  createClient: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

import {
  consumeSearchRateLimit,
  createSearchFingerprint,
  SEARCH_RATE_LIMIT,
  SEARCH_RATE_WINDOW_SECONDS,
} from '@/lib/search/rate-limit';

describe('durable search rate limiter', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-secret';
    createClient.mockReturnValue({ rpc });
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.VERCEL;
  });

  it('creates a stable HMAC without retaining the raw client address', () => {
    process.env.VERCEL = '1';
    const headers = new Headers({ 'x-vercel-forwarded-for': '203.0.113.42, 10.0.0.1' });
    const fingerprint = createSearchFingerprint(headers, 'secret');

    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint).not.toContain('203.0.113.42');
    expect(createSearchFingerprint(headers, 'secret')).toBe(fingerprint);
    expect(createSearchFingerprint(headers, 'other-secret')).not.toBe(fingerprint);
  });

  it('prefers the Vercel-owned header and ignores spoofable generic forwarding off Vercel', () => {
    process.env.VERCEL = '1';
    const trusted = createSearchFingerprint(new Headers({
      'x-vercel-forwarded-for': '203.0.113.8',
      'x-forwarded-for': '198.51.100.99',
    }), 'secret');
    const expected = createSearchFingerprint(
      new Headers({ 'x-vercel-forwarded-for': '203.0.113.8' }),
      'secret',
    );
    delete process.env.VERCEL;
    const genericOnly = createSearchFingerprint(
      new Headers({ 'x-forwarded-for': '198.51.100.99' }),
      'secret',
    );
    const unknown = createSearchFingerprint(new Headers(), 'secret');

    expect(trusted).toBe(expected);
    expect(genericOnly).toBe(unknown);

    process.env.VERCEL = '1';
    expect(createSearchFingerprint(
      new Headers({ 'x-forwarded-for': '198.51.100.99' }),
      'secret',
    )).not.toBe(unknown);
  });

  it('calls the atomic RPC with bounded server-controlled settings', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: true, retry_after_seconds: 0 }], error: null });

    await expect(consumeSearchRateLimit(new Headers({ 'x-real-ip': '203.0.113.9' })))
      .resolves.toEqual({ status: 'allowed' });

    expect(rpc).toHaveBeenCalledWith('consume_search_rate_limit', {
      p_fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
      p_limit: SEARCH_RATE_LIMIT,
      p_window_seconds: SEARCH_RATE_WINDOW_SECONDS,
    });
    expect(createClient).toHaveBeenCalledWith(
      'https://example.supabase.co',
      'server-secret',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
  });

  it('returns a safe denied result with a rounded retry delay', async () => {
    rpc.mockResolvedValue({ data: [{ allowed: false, retry_after_seconds: 12.2 }], error: null });

    await expect(consumeSearchRateLimit(new Headers()))
      .resolves.toEqual({ status: 'denied', retryAfterSeconds: 13 });
  });

  it.each([
    { data: null, error: { message: 'secret database detail' } },
    { data: [], error: null },
    { data: [{ allowed: 'yes', retry_after_seconds: 0 }], error: null },
  ])('fails closed when the limiter is unavailable or malformed', async (result) => {
    rpc.mockResolvedValue(result);
    await expect(consumeSearchRateLimit(new Headers())).resolves.toEqual({ status: 'unavailable' });
  });

  it('fails closed before creating a client when server configuration is missing', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(consumeSearchRateLimit(new Headers())).resolves.toEqual({ status: 'unavailable' });
    expect(createClient).not.toHaveBeenCalled();
  });
});
