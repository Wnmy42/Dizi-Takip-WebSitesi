import type { TMDBSeasonDetail } from '@/lib/tmdb/types';

type FetchSeason = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const LOAD_ERROR_MESSAGE = 'Sezon bölümleri yüklenemedi.';

class SeasonDetailsLoadError extends Error {}

function seasonKey(showId: number, seasonNumber: number): string {
  return `${showId}:${seasonNumber}`;
}

function isSeasonDetail(value: unknown): value is TMDBSeasonDetail {
  if (!value || typeof value !== 'object') return false;

  const season = value as Partial<TMDBSeasonDetail>;
  return (
    typeof season.id === 'number'
    && typeof season.season_number === 'number'
    && typeof season.name === 'string'
    && (typeof season.overview === 'string' || season.overview === null || season.overview === undefined)
    && Array.isArray(season.episodes)
  );
}

function getErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}

export class SeasonDetailsLoader {
  private readonly successful = new Map<string, TMDBSeasonDetail>();
  private readonly inFlight = new Map<string, Promise<TMDBSeasonDetail>>();

  constructor(private readonly fetchSeason: FetchSeason = fetch) {}

  load(showId: number, seasonNumber: number): Promise<TMDBSeasonDetail> {
    const key = seasonKey(showId, seasonNumber);
    const cached = this.successful.get(key);
    if (cached) return Promise.resolve(cached);

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const request = this.fetchSeason(`/api/shows/${showId}/seasons/${seasonNumber}`, {
      method: 'GET',
    })
      .then(async (response) => {
        const body: unknown = await response.json();

        if (!response.ok) {
          throw new SeasonDetailsLoadError(getErrorMessage(body) ?? LOAD_ERROR_MESSAGE);
        }

        if (!isSeasonDetail(body)) {
          throw new SeasonDetailsLoadError('Sezon verisi beklenen biçimde değil.');
        }

        this.successful.set(key, body);
        return body;
      })
      .catch((error: unknown) => {
        if (error instanceof SeasonDetailsLoadError) throw error;
        throw new SeasonDetailsLoadError(LOAD_ERROR_MESSAGE);
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, request);
    return request;
  }
}
