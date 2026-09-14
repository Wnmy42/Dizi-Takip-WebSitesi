import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSeasonDetails } = vi.hoisted(() => ({
  getSeasonDetails: vi.fn(),
}));

vi.mock('@/lib/tmdb/client', () => ({ getSeasonDetails }));

import { GET } from '@/app/api/shows/[id]/seasons/[seasonNumber]/route';

function context(id: string, seasonNumber: string) {
  return { params: Promise.resolve({ id, seasonNumber }) };
}

describe('season detail route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['abc', '1'],
    ['1399', '0'],
    ['1399', '-1'],
    ['1.5', '2'],
    [String(Number.MAX_SAFE_INTEGER + 1), '1'],
  ])('rejects invalid boundary values (%s, %s)', async (showId, seasonNumber) => {
    const response = await GET(new Request('http://localhost'), context(showId, seasonNumber));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Geçersiz dizi veya sezon numarası.',
    });
    expect(getSeasonDetails).not.toHaveBeenCalled();
  });

  it('loads a validated season through the server-only TMDB client', async () => {
    const season = {
      id: 10,
      season_number: 2,
      name: 'Sezon 2',
      overview: '',
      episodes: [],
    };
    getSeasonDetails.mockResolvedValue(season);

    const response = await GET(new Request('http://localhost'), context('1399', '2'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(season);
    expect(getSeasonDetails).toHaveBeenCalledWith(1399, 2);
  });

  it('returns a stable public error when TMDB fails', async () => {
    getSeasonDetails.mockRejectedValue(new Error('token and upstream details'));

    const response = await GET(new Request('http://localhost'), context('1399', '1'));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'Sezon bölümleri yüklenemedi.' });
  });
});
