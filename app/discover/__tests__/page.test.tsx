import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const {
  createClient,
  getPopularShows,
  getTrendingShows,
  searchResults,
  searchBar,
} = vi.hoisted(() => ({
  createClient: vi.fn(),
  getPopularShows: vi.fn(),
  getTrendingShows: vi.fn(),
  searchResults: vi.fn<(props: unknown) => null>(() => null),
  searchBar: vi.fn<(props: unknown) => null>(() => null),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/tmdb/client', () => ({
  getPopularShows,
  getTrendingShows,
  getPosterUrl: () => '/poster.png',
}));
vi.mock('@/components/search-results', () => ({ SearchResults: searchResults }));
vi.mock('@/components/search-bar', () => ({ SearchBar: searchBar }));
vi.mock('@/components/show-card', () => ({ ShowCard: () => null }));
vi.mock('@/components/progress-bar', () => ({ ProgressBar: () => null }));
vi.mock('next/image', () => ({ default: () => null }));

import DiscoverPage from '@/app/discover/page';

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  });
});

it('passes a normalized, bounded query to the protected client search flow', async () => {
  await DiscoverPage({
    searchParams: Promise.resolve({ q: '  Better   Call Saul  ', page: '2' }),
  });

  expect(searchResults).not.toHaveBeenCalled();

  const markup = renderToStaticMarkup(await DiscoverPage({
    searchParams: Promise.resolve({ q: '  Better   Call Saul  ', page: '2' }),
  }));

  expect(markup).toContain('&quot;Better Call Saul&quot; için sonuçlar');
  expect(searchResults).toHaveBeenCalledWith({ query: 'Better Call Saul', page: 2 }, undefined);
  expect(searchBar).toHaveBeenCalledWith({ defaultValue: '  Better   Call Saul  ' }, undefined);
  expect(getPopularShows).not.toHaveBeenCalled();
  expect(getTrendingShows).not.toHaveBeenCalled();
});

it('renders a controlled validation message without loading discovery feeds', async () => {
  const markup = renderToStaticMarkup(await DiscoverPage({
    searchParams: Promise.resolve({ q: 'a', page: '1' }),
  }));

  expect(markup).toContain('Arama en az 2 karakter olmalı.');
  expect(searchResults).not.toHaveBeenCalled();
  expect(getPopularShows).not.toHaveBeenCalled();
  expect(getTrendingShows).not.toHaveBeenCalled();
});
