import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const {
  getShowDetails,
  getSeasonDetails,
  createClient,
  accordion,
  personalControls,
  addShowButton,
} = vi.hoisted(() => ({
  getShowDetails: vi.fn(), getSeasonDetails: vi.fn(), createClient: vi.fn(),
  accordion: vi.fn<(props: unknown) => null>(() => null),
  personalControls: vi.fn<(props: unknown) => null>(() => null),
  addShowButton: vi.fn<(props: unknown) => null>(() => null),
}));

vi.mock('@/lib/tmdb/client', () => ({
  getShowDetails, getSeasonDetails,
  getBackdropUrl: () => '/backdrop.png', getPosterUrl: () => '/poster.png',
}));
vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/components/season-accordion', () => ({ SeasonAccordion: accordion }));
vi.mock('@/components/personal-show-controls', () => ({ PersonalShowControls: personalControls }));
vi.mock('@/components/add-show-button', () => ({ AddShowButton: addShowButton }));
vi.mock('next/image', () => ({ default: () => null }));

import ShowDetailPage from '@/app/shows/[id]/page';

beforeEach(() => vi.clearAllMocks());

it('loads summaries and current tracking once, without fetching any season episodes', async () => {
  const summary = { id: 101, season_number: 1, name: 'Sezon 1', episode_count: 8,
    overview: '', air_date: null, poster_path: null };
  getShowDetails.mockResolvedValue({ id: 1399, name: 'Dizi', overview: '',
    backdrop_path: null, poster_path: null, vote_average: 8, first_air_date: '',
    seasons: [{ ...summary, id: 100, season_number: 0 }, summary] });
  const showQuery = { select: vi.fn(), eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: {
      id: 'owned-show', total_episodes: 8, rating: 9, is_favorite: true,
    } }) };
  showQuery.select.mockReturnValue(showQuery);
  showQuery.eq.mockReturnValue(showQuery);
  const episodeQuery = { select: vi.fn(), eq: vi.fn().mockResolvedValue({
    data: [{ season_number: 1, episode_number: 2 }],
  }) };
  episodeQuery.select.mockReturnValue(episodeQuery);
  const from = vi.fn((table: string) => table === 'user_shows' ? showQuery : episodeQuery);
  createClient.mockResolvedValue({ from,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
  });

  renderToStaticMarkup(await ShowDetailPage({ params: Promise.resolve({ id: '1399' }) }));

  expect(getShowDetails).toHaveBeenCalledExactlyOnceWith(1399);
  expect(getSeasonDetails).not.toHaveBeenCalled();
  expect(from.mock.calls).toEqual([['user_shows'], ['user_episodes']]);
  expect(showQuery.eq).toHaveBeenCalledWith('user_id', 'user-id');
  expect(showQuery.select).toHaveBeenCalledWith('id, total_episodes, rating, is_favorite');
  expect(episodeQuery.eq).toHaveBeenCalledWith('user_show_id', 'owned-show');
  expect(personalControls).toHaveBeenCalledWith({
    userShowId: 'owned-show', initialIsFavorite: true, initialRating: 9,
  }, undefined);
  expect(accordion.mock.calls[0]?.[0]).toEqual({
    seasons: [summary], showId: 1399, userShowId: 'owned-show', watchedEpisodeKeys: ['S1E2'],
  });
});

it('guides an authenticated nonmember to add the show before using personal controls', async () => {
  getShowDetails.mockResolvedValue({
    id: 1399, name: 'Dizi', overview: '', backdrop_path: null, poster_path: null,
    vote_average: 8.2, first_air_date: '', seasons: [], number_of_episodes: 8,
  });
  const showQuery = {
    select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data: null }),
  };
  showQuery.select.mockReturnValue(showQuery);
  showQuery.eq.mockReturnValue(showQuery);
  createClient.mockResolvedValue({
    from: vi.fn().mockReturnValue(showQuery),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
  });

  const markup = renderToStaticMarkup(await ShowDetailPage({
    params: Promise.resolve({ id: '1399' }),
  }));

  expect(markup).toContain('TMDB 8.2');
  expect(markup).toContain('Favorilere eklemek ve kişisel puan vermek için önce diziyi listene ekle.');
  expect(addShowButton).toHaveBeenCalledWith(expect.objectContaining({ isInLibrary: false }), undefined);
  expect(personalControls).not.toHaveBeenCalled();
});
