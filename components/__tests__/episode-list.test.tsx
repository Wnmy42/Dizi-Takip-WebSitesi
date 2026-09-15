// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { toggleEpisode } = vi.hoisted(() => ({
  toggleEpisode: vi.fn(),
}));

vi.mock('@/lib/supabase/actions', () => ({ toggleEpisode }));

import { EpisodeList } from '@/components/episode-list';
import type { TMDBSeasonDetail } from '@/lib/tmdb/types';

const season: TMDBSeasonDetail = {
  id: 101,
  season_number: 3,
  name: 'Üçüncü Sezon',
  overview: '',
  episodes: [
    {
      id: 301,
      episode_number: 4,
      name: 'Dördüncü Bölüm',
      overview: '',
      air_date: '2025-03-04',
      still_path: null,
      runtime: 48,
      season_number: 3,
    },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function renderEpisodeList(watchedEpisodeKeys = new Set<string>()) {
  return render(
    <EpisodeList
      season={season}
      userShowId="user-show-id"
      tmdbShowId={1399}
      watchedEpisodeKeys={watchedEpisodeKeys}
    />,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  toggleEpisode.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe('EpisodeList', () => {
  it.each([
    [false, 'Bölümü izlendi olarak işaretle'],
    [true, 'Bölümü izlenmedi olarak işaretle'],
  ])('submits the episode identity and current watched state from a real click', async (isWatched, label) => {
    renderEpisodeList(isWatched ? new Set(['S3E4']) : new Set());

    fireEvent.click(screen.getByRole('button', { name: label }));

    await waitFor(() => expect(toggleEpisode).toHaveBeenCalledExactlyOnceWith({
      userShowId: 'user-show-id',
      tmdbShowId: 1399,
      seasonNumber: 3,
      episodeNumber: 4,
      isWatched,
    }));
    await waitFor(() => expect(screen.getByRole('button', { name: label }).hasAttribute('disabled')).toBe(false));
  });

  it('blocks a repeated toggle while pending but keeps sibling episodes usable', async () => {
    const request = deferred<{ success: true }>();
    toggleEpisode
      .mockReturnValueOnce(request.promise)
      .mockResolvedValueOnce({ success: true });
    render(
      <EpisodeList
        season={{
          ...season,
          episodes: [
            ...season.episodes,
            { ...season.episodes[0], id: 302, episode_number: 5, name: 'Beşinci Bölüm' },
          ],
        }}
        userShowId="user-show-id"
        tmdbShowId={1399}
        watchedEpisodeKeys={new Set()}
      />,
    );
    const [firstToggle, siblingToggle] = screen.getAllByRole('button', {
      name: 'Bölümü izlendi olarak işaretle',
    });

    fireEvent.click(firstToggle);
    fireEvent.click(firstToggle);
    fireEvent.click(siblingToggle);

    expect(toggleEpisode).toHaveBeenCalledTimes(2);
    expect(toggleEpisode).toHaveBeenNthCalledWith(2, {
      userShowId: 'user-show-id',
      tmdbShowId: 1399,
      seasonNumber: 3,
      episodeNumber: 5,
      isWatched: false,
    });
    expect(firstToggle.hasAttribute('disabled')).toBe(true);

    request.resolve({ success: true });
    await waitFor(() => expect(firstToggle.hasAttribute('disabled')).toBe(false));
  });

  it.each([
    ['returned error', () => Promise.resolve({ error: 'Bölüm güncellenemedi' }), 'Bölüm güncellenemedi'],
    ['rejected action', () => Promise.reject(new Error('network failed')), 'İşlem tamamlanamadı. Tekrar deneyin.'],
  ])('shows a %s without presenting a successful watched state', async (_case, response, message) => {
    toggleEpisode.mockImplementation(response);
    renderEpisodeList();

    fireEvent.click(screen.getByRole('button', { name: 'Bölümü izlendi olarak işaretle' }));

    expect((await screen.findByRole('alert')).textContent).toContain(message);
    expect(screen.getByRole('button', { name: 'Bölümü izlendi olarak işaretle' })).toBeTruthy();
    expect(screen.getByText('0 / 1 bölüm')).toBeTruthy();
  });

  it('accepts a fresh watched snapshot and clears an earlier error after a successful retry', async () => {
    toggleEpisode
      .mockResolvedValueOnce({ error: 'Geçici hata' })
      .mockResolvedValueOnce({ success: true });
    const view = renderEpisodeList();
    const toggle = screen.getByRole('button', { name: 'Bölümü izlendi olarak işaretle' });

    fireEvent.click(toggle);
    expect((await screen.findByRole('alert')).textContent).toContain('Geçici hata');
    await waitFor(() => expect(toggle.hasAttribute('disabled')).toBe(false));

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(toggleEpisode).toHaveBeenCalledTimes(2);
      expect(toggle.hasAttribute('disabled')).toBe(false);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    view.rerender(
      <EpisodeList
        season={season}
        userShowId="user-show-id"
        tmdbShowId={1399}
        watchedEpisodeKeys={new Set(['S3E4'])}
      />,
    );

    expect(screen.getByRole('button', { name: 'Bölümü izlenmedi olarak işaretle' })).toBeTruthy();
    expect(screen.getByText('1 / 1 bölüm')).toBeTruthy();
  });
});
