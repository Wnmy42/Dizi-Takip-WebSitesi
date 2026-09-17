export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export function getPosterUrl(
  path: string | null,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w342',
): string {
  if (!path) return '/placeholder-poster.svg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(
  path: string | null,
  size: 'w300' | 'w780' | 'w1280' | 'original' = 'w1280',
): string {
  if (!path) return '/placeholder-backdrop.svg';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
