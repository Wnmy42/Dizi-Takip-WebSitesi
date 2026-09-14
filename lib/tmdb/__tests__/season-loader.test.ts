import { describe, expect, it, vi } from 'vitest';
import { SeasonDetailsLoader } from '@/lib/tmdb/season-loader';
import type { TMDBSeasonDetail } from '@/lib/tmdb/types';

function seasonDetail(
  showMarker: number,
  seasonNumber: number,
  episodeCount = 1,
): TMDBSeasonDetail {
  return {
    id: showMarker * 100 + seasonNumber,
    season_number: seasonNumber,
    name: `Sezon ${seasonNumber}`,
    overview: '',
    episodes: Array.from({ length: episodeCount }, (_, index) => ({
      id: showMarker * 1000 + index,
      episode_number: index + 1,
      name: `Bölüm ${index + 1}`,
      overview: '',
      air_date: null,
      still_path: null,
      runtime: null,
      season_number: seasonNumber,
    })),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('SeasonDetailsLoader', () => {
  it('does not request a season until one is opened', () => {
    const fetchSeason = vi.fn();

    new SeasonDetailsLoader(fetchSeason);

    expect(fetchSeason).not.toHaveBeenCalled();
  });

  it('requests only the selected season', async () => {
    const fetchSeason = vi.fn().mockResolvedValue(jsonResponse(seasonDetail(1399, 2)));
    const loader = new SeasonDetailsLoader(fetchSeason);

    await loader.load(1399, 2);

    expect(fetchSeason).toHaveBeenCalledOnce();
    expect(fetchSeason).toHaveBeenCalledWith('/api/shows/1399/seasons/2', { method: 'GET' });
  });

  it('deduplicates an in-flight request and reuses the successful result', async () => {
    let resolveRequest!: (response: Response) => void;
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    const fetchSeason = vi.fn().mockReturnValue(pendingResponse);
    const loader = new SeasonDetailsLoader(fetchSeason);

    const first = loader.load(1399, 3);
    const second = loader.load(1399, 3);

    expect(second).toBe(first);
    expect(fetchSeason).toHaveBeenCalledOnce();

    const detail = seasonDetail(1399, 3, 0);
    resolveRequest(jsonResponse(detail));
    const loaded = await first;
    expect(loaded).toEqual(detail);
    await expect(loader.load(1399, 3)).resolves.toBe(loaded);
    expect(fetchSeason).toHaveBeenCalledOnce();
  });

  it('keeps cache entries isolated by show as well as season', async () => {
    const fetchSeason = vi.fn((input: RequestInfo | URL) => {
      const showId = String(input).includes('/200/') ? 200 : 100;
      return Promise.resolve(jsonResponse(seasonDetail(showId, 1)));
    });
    const loader = new SeasonDetailsLoader(fetchSeason);

    const firstShow = await loader.load(100, 1);
    const secondShow = await loader.load(200, 1);

    expect(firstShow.id).not.toBe(secondShow.id);
    expect(fetchSeason).toHaveBeenCalledTimes(2);
  });

  it('does not cache failures so an explicit retry can succeed', async () => {
    const detail = seasonDetail(1399, 1);
    const fetchSeason = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'TMDB geçici olarak kullanılamıyor.' }, 502))
      .mockResolvedValueOnce(jsonResponse(detail));
    const loader = new SeasonDetailsLoader(fetchSeason);

    await expect(loader.load(1399, 1)).rejects.toThrow('TMDB geçici olarak kullanılamıyor.');
    await expect(loader.load(1399, 1)).resolves.toEqual(detail);
    expect(fetchSeason).toHaveBeenCalledTimes(2);
  });

  it('uses a stable message for network and malformed response failures', async () => {
    const fetchSeason = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch https://upstream.example'))
      .mockResolvedValueOnce(new Response('<html>not json</html>', { status: 502 }));
    const loader = new SeasonDetailsLoader(fetchSeason);

    await expect(loader.load(1399, 1)).rejects.toThrow('Sezon bölümleri yüklenemedi.');
    await expect(loader.load(1399, 1)).rejects.toThrow('Sezon bölümleri yüklenemedi.');
  });
});
