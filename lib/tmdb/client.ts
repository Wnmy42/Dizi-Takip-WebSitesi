import 'server-only';

import type {
  TMDBPaginatedResponse,
  TMDBSeasonDetail,
  TMDBShow,
} from './types';
import { parseSearchPage, parseSearchQuery } from '@/lib/search/query';

const BASE_URL = 'https://api.themoviedb.org/3';
export { getBackdropUrl, getPosterUrl, TMDB_IMAGE_BASE } from './images';
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 250;
const MAX_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_AFTER_SECONDS = 300;
const REQUEST_TIMEOUT_MS = 8_000;

export class TMDBRequestError extends Error {
  constructor(
    public readonly kind: 'rate_limited' | 'upstream' | 'request' | 'network' | 'invalid_response',
    public readonly status: number | null,
    public readonly retryAfterSeconds: number | null = null,
  ) {
    super('TMDB request failed');
    this.name = 'TMDBRequestError';
  }
}

function getHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(MAX_RETRY_AFTER_SECONDS, Math.ceil(seconds));
  }

  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.min(MAX_RETRY_AFTER_SECONDS, Math.max(0, Math.ceil((date - Date.now()) / 1000)));
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function retryDelayMs(attempt: number, retryAfterSeconds: number | null): number {
  const exponential = BASE_RETRY_DELAY_MS * (2 ** attempt);
  const requested = retryAfterSeconds === null ? exponential : retryAfterSeconds * 1000;
  return Math.min(requested, MAX_RETRY_DELAY_MS);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function tmdbFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `${BASE_URL}${path}${separator}language=tr-TR`;
  const headers = getHeaders();

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        headers,
        next: { revalidate },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(retryDelayMs(attempt, null));
        continue;
      }
      throw new TMDBRequestError('network', null);
    }

    if (response.ok) {
      try {
        return await response.json() as T;
      } catch {
        throw new TMDBRequestError('invalid_response', response.status);
      }
    }

    const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
    if (shouldRetry(response.status) && attempt < MAX_ATTEMPTS - 1) {
      if (retryAfterSeconds !== null && retryAfterSeconds * 1000 > MAX_RETRY_DELAY_MS) {
        if (response.status === 429) {
          throw new TMDBRequestError('rate_limited', response.status, retryAfterSeconds);
        }
        throw new TMDBRequestError('upstream', response.status, retryAfterSeconds);
      }
      await sleep(retryDelayMs(attempt, retryAfterSeconds));
      continue;
    }

    if (response.status === 429) {
      throw new TMDBRequestError('rate_limited', response.status, retryAfterSeconds);
    }
    if (response.status >= 500) {
      throw new TMDBRequestError('upstream', response.status);
    }
    throw new TMDBRequestError('request', response.status);
  }

  throw new TMDBRequestError('network', null);
}

function isPaginatedResponse<T>(value: unknown): value is TMDBPaginatedResponse<T> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<TMDBPaginatedResponse<T>>;
  return Number.isInteger(candidate.page)
    && Array.isArray(candidate.results)
    && Number.isInteger(candidate.total_pages)
    && Number.isInteger(candidate.total_results);
}

async function tmdbPaginatedFetch<T>(path: string, revalidate = 3600): Promise<TMDBPaginatedResponse<T>> {
  const data = await tmdbFetch<unknown>(path, revalidate);
  if (!isPaginatedResponse<T>(data)) {
    throw new TMDBRequestError('invalid_response', 200);
  }
  return data;
}

export async function getTrendingShows(): Promise<TMDBPaginatedResponse<TMDBShow>> {
  return tmdbPaginatedFetch('/trending/tv/week?page=1');
}

export async function getPopularShows(page = 1): Promise<TMDBPaginatedResponse<TMDBShow>> {
  return tmdbPaginatedFetch(`/tv/popular?page=${page}`);
}

export async function searchShows(query: string, page = 1): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const parsedQuery = parseSearchQuery(query);
  const parsedPage = parseSearchPage(page);
  if (!parsedQuery.ok || parsedPage === null) {
    throw new TypeError('Invalid TMDB search request');
  }

  return tmdbPaginatedFetch(
    `/search/tv?query=${encodeURIComponent(parsedQuery.query)}&page=${parsedPage}&include_adult=false`,
    60 // arama sonuçları 1 dakika önbelleklenir
  );
}

export async function getShowDetails(id: number): Promise<TMDBShow> {
  return tmdbFetch(`/tv/${id}?append_to_response=seasons`);
}

export async function getSeasonDetails(showId: number, seasonNumber: number): Promise<TMDBSeasonDetail> {
  return tmdbFetch(`/tv/${showId}/season/${seasonNumber}`);
}
