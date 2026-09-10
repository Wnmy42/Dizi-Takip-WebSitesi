import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPopularShows, getSeasonDetails } from '@/lib/tmdb/client';

describe('TMDB client URL construction', () => {
  beforeEach(() => {
    process.env.TMDB_READ_ACCESS_TOKEN = 'test-token';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ page: 1, results: [], total_pages: 1, total_results: 0 }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TMDB_READ_ACCESS_TOKEN;
  });

  it('uses an ampersand when the path already has query parameters', async () => {
    await getPopularShows(2);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/popular?page=2&language=tr-TR',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('uses a question mark when the path has no query parameters', async () => {
    await getSeasonDetails(1399, 1);

    expect(fetch).toHaveBeenCalledWith(
      'https://api.themoviedb.org/3/tv/1399/season/1?language=tr-TR',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
