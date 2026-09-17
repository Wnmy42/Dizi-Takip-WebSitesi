import { beforeEach, describe, expect, it, vi } from 'vitest';

const { consumeSearchRateLimit, searchShows } = vi.hoisted(() => ({
  consumeSearchRateLimit: vi.fn(),
  searchShows: vi.fn(),
}));

vi.mock('@/lib/search/rate-limit', () => ({ consumeSearchRateLimit }));
vi.mock('@/lib/tmdb/client', () => {
  class TMDBRequestError extends Error {
    constructor(
      public readonly kind: 'rate_limited' | 'upstream' | 'request' | 'network',
      public readonly status: number | null,
      public readonly retryAfterSeconds: number | null = null,
    ) {
      super('safe mocked error');
    }
  }

  return { searchShows, TMDBRequestError };
});

import { POST } from '@/app/api/search/route';
import { TMDBRequestError } from '@/lib/tmdb/client';

function request(body: unknown, headers?: HeadersInit) {
  return new Request('http://localhost/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('public TV search route', () => {
  beforeEach(() => {
    consumeSearchRateLimit.mockResolvedValue({ status: 'allowed' });
    searchShows.mockResolvedValue({ page: 1, results: [], total_pages: 0, total_results: 0 });
  });

  it('rejects invalid JSON before consuming quota', async () => {
    const response = await POST(new Request('http://localhost/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not-json',
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
    expect(consumeSearchRateLimit).not.toHaveBeenCalled();
  });

  it.each([null, [], 'Lost'])('rejects a non-object JSON body %j', async (body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe('invalid_request');
    expect(consumeSearchRateLimit).not.toHaveBeenCalled();
  });

  it('rejects an oversized body before parsing or consuming quota', async () => {
    const response = await POST(new Request('http://localhost/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'x'.repeat(3_000), page: 1 }),
    }));

    expect(response.status).toBe(413);
    expect((await response.json()).code).toBe('request_too_large');
    expect(consumeSearchRateLimit).not.toHaveBeenCalled();
  });

  it.each([
    [{ query: ' ', page: 1 }, 'Aramak için bir dizi adı yazın.'],
    [{ query: 'a', page: 1 }, 'Arama en az 2 karakter olmalı.'],
    [{ query: 'x'.repeat(101), page: 1 }, 'Arama en fazla 100 karakter olabilir.'],
    [{ query: 'Lost', page: 0 }, 'Geçersiz arama sayfası.'],
  ])('rejects invalid input before consuming quota', async (body, message) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe(message);
    expect(consumeSearchRateLimit).not.toHaveBeenCalled();
    expect(searchShows).not.toHaveBeenCalled();
  });

  it('normalizes the query and searches after the durable limit allows it', async () => {
    const response = await POST(request(
      { query: '  Better   Call Saul ', page: 2 },
      { 'x-forwarded-for': '203.0.113.7' },
    ));

    expect(response.status).toBe(200);
    expect(consumeSearchRateLimit).toHaveBeenCalledWith(expect.any(Headers));
    expect(searchShows).toHaveBeenCalledWith('Better Call Saul', 2);
  });

  it('returns a controlled 429 and Retry-After without calling TMDB', async () => {
    consumeSearchRateLimit.mockResolvedValue({ status: 'denied', retryAfterSeconds: 37 });

    const response = await POST(request({ query: 'Lost', page: 1 }));

    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('37');
    await expect(response.json()).resolves.toEqual({
      error: 'Çok fazla arama yaptınız. Lütfen biraz sonra tekrar deneyin.',
      code: 'rate_limited',
      retryAfterSeconds: 37,
    });
    expect(searchShows).not.toHaveBeenCalled();
  });

  it('fails closed with a stable response when the limiter is unavailable', async () => {
    consumeSearchRateLimit.mockResolvedValue({ status: 'unavailable' });

    const response = await POST(request({ query: 'Lost', page: 1 }));

    expect(response.status).toBe(503);
    expect((await response.json()).error).toBe('Arama şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.');
    expect(searchShows).not.toHaveBeenCalled();
  });

  it('maps an exhausted TMDB quota to a safe retryable response', async () => {
    searchShows.mockRejectedValue(new TMDBRequestError('rate_limited', 429, 23));

    const response = await POST(request({ query: 'Lost', page: 1 }));

    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('23');
    await expect(response.json()).resolves.toEqual({
      error: 'Dizi servisi şu anda yoğun. Lütfen biraz sonra tekrar deneyin.',
      code: 'upstream_rate_limited',
      retryAfterSeconds: 23,
    });
  });

  it('caps an untrusted upstream Retry-After value', async () => {
    searchShows.mockRejectedValue(new TMDBRequestError('rate_limited', 429, 99_999));

    const response = await POST(request({ query: 'Lost', page: 1 }));

    expect(response.headers.get('retry-after')).toBe('300');
    expect((await response.json()).retryAfterSeconds).toBe(300);
  });

  it('does not leak unexpected upstream error details', async () => {
    searchShows.mockRejectedValue(new Error('token=/secret and upstream path'));

    const response = await POST(request({ query: 'Lost', page: 1 }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload.error).toBe('Arama şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.');
    expect(JSON.stringify(payload)).not.toContain('secret');
  });
});
