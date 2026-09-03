import type {
  TMDBPaginatedResponse,
  TMDBSeasonDetail,
  TMDBShow,
} from './types';

const BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function getHeaders(): HeadersInit {
  const token = process.env.TMDB_READ_ACCESS_TOKEN;
  if (!token) throw new Error('TMDB_READ_ACCESS_TOKEN is not set');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function tmdbFetch<T>(path: string, revalidate = 3600): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}&language=tr-TR`, {
    headers: getHeaders(),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`TMDB error: ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function getTrendingShows(): Promise<TMDBPaginatedResponse<TMDBShow>> {
  return tmdbFetch('/trending/tv/week?page=1');
}

export async function getPopularShows(page = 1): Promise<TMDBPaginatedResponse<TMDBShow>> {
  return tmdbFetch(`/tv/popular?page=${page}`);
}

export async function searchShows(query: string, page = 1): Promise<TMDBPaginatedResponse<TMDBShow>> {
  return tmdbFetch(
    `/search/tv?query=${encodeURIComponent(query)}&page=${page}&include_adult=false`,
    60 // arama sonuçları 1 dakika önbelleklenir
  );
}

export async function getShowDetails(id: number): Promise<TMDBShow> {
  return tmdbFetch(`/tv/${id}?append_to_response=seasons`);
}

export async function getSeasonDetails(showId: number, seasonNumber: number): Promise<TMDBSeasonDetail> {
  return tmdbFetch(`/tv/${showId}/season/${seasonNumber}?`);
}

export function getPosterUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342'): string {
  if (!path) return '/placeholder-poster.svg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(path: string | null, size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280'): string {
  if (!path) return '/placeholder-backdrop.svg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
