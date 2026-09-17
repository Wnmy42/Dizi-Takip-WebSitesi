import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  getPopularShows,
  getSeasonDetails,
  searchShows,
} from '@/lib/tmdb/client';

function response(status: number, retryAfter?: string) {
  return new Response(
    JSON.stringify({ page: 1, results: [], total_pages: 1, total_results: 0 }),
    {
      status,
      headers: retryAfter ? { 'Retry-After': retryAfter } : undefined,
    },
  );
}

describe('TMDB client URL construction', () => {
  beforeEach(() => {
    process.env.TMDB_READ_ACCESS_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(200)),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete process.env.TMDB_READ_ACCESS_TOKEN;
  });

  it('uses an ampersand when the path already has query parameters', async () => {
    await getPopularShows(2);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/popular?page=2&language=tr-TR',
      expect.objectContaining({ headers: expect.any(Object), signal: expect.any(AbortSignal) }),
    );
  });

  it('uses a question mark when the path has no query parameters', async () => {
    await getSeasonDetails(1399, 1);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/1399/season/1?language=tr-TR',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('normalizes search input before constructing the upstream URL', async () => {
    await searchShows('  Better   Call Saul  ', 2);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/search/tv?query=Better%20Call%20Saul&page=2&include_adult=false&language=tr-TR',
      expect.objectContaining({ next: { revalidate: 60 } }),
    );
  });

  it.each([' ', 'a', 'x'.repeat(101)])('rejects an invalid search before fetch', async (query) => {
    await expect(searchShows(query, 1)).rejects.toThrow(TypeError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('honors Retry-After and retries a 429 response', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(429, '1'))
      .mockResolvedValueOnce(response(200));

    const result = searchShows('Lost', 1);
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toEqual({ page: 1, results: [], total_pages: 1, total_results: 0 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry before a long Retry-After window', async () => {
    vi.mocked(fetch).mockResolvedValue(response(429, '60'));

    await expect(searchShows('Lost', 1)).rejects.toMatchObject({
      kind: 'rate_limited',
      status: 429,
      retryAfterSeconds: 60,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('uses bounded exponential backoff for retryable server failures', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(503))
      .mockResolvedValueOnce(response(502))
      .mockResolvedValueOnce(response(200));

    const result = searchShows('Lost', 1);
    await vi.advanceTimersByTimeAsync(250);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it.each([408, 425])('retries transient HTTP %s responses', async (status) => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(status))
      .mockResolvedValueOnce(response(200));

    const result = searchShows('Lost', 1);
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('retries timed-out requests within the same bounded budget', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch)
      .mockRejectedValueOnce(new DOMException('timed out', 'TimeoutError'))
      .mockResolvedValueOnce(response(200));

    const result = searchShows('Lost', 1);
    await vi.advanceTimersByTimeAsync(250);

    await expect(result).resolves.toBeDefined();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-rate-limit 4xx response', async () => {
    vi.mocked(fetch).mockResolvedValue(response(401));

    await expect(searchShows('Lost', 1)).rejects.toMatchObject({
      name: 'TMDBRequestError',
      kind: 'request',
      status: 401,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fails fast when the server token is missing', async () => {
    delete process.env.TMDB_READ_ACCESS_TOKEN;

    await expect(searchShows('Lost', 1)).rejects.toThrow('TMDB_READ_ACCESS_TOKEN is not set');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns a typed safe error after the TMDB quota retry budget is exhausted', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValue(response(429, '0'));

    const result = searchShows('Lost', 1);
    const rejection = expect(result).rejects.toEqual(expect.objectContaining({
      name: 'TMDBRequestError',
      kind: 'rate_limited',
      status: 429,
      retryAfterSeconds: 0,
    }));
    await vi.runAllTimersAsync();

    await rejection;
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects a malformed successful paginated payload with a typed safe error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(
      JSON.stringify({ results: 'not-an-array' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await expect(searchShows('Lost', 1)).rejects.toMatchObject({
      name: 'TMDBRequestError',
      kind: 'invalid_response',
      status: 200,
    });
  });
});
