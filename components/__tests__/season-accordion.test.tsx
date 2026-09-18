// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeasonAccordion } from '@/components/season-accordion';
import type { TMDBSeason, TMDBSeasonDetail } from '@/lib/tmdb/types';

const firstSummary: TMDBSeason = {
  id: 101,
  season_number: 1,
  name: 'Birinci Sezon',
  episode_count: 1,
  air_date: '2024-01-01',
  poster_path: null,
  overview: 'Sezonun kısa özeti.',
};

const secondSummary: TMDBSeason = {
  ...firstSummary,
  id: 102,
  season_number: 2,
  name: 'İkinci Sezon',
  overview: '',
};

function seasonDetail(seasonNumber = 1): TMDBSeasonDetail {
  return {
    id: 100 + seasonNumber,
    season_number: seasonNumber,
    name: seasonNumber === 1 ? 'Birinci Sezon' : 'İkinci Sezon',
    overview: '',
    episodes: [
      {
        id: 1000 + seasonNumber,
        episode_number: 1,
        name: seasonNumber === 1 ? 'Pilot Bölüm' : 'İkinci Sezon Bölümü',
        overview: '',
        air_date: '2024-01-01',
        still_path: null,
        runtime: 42,
        season_number: seasonNumber,
      },
    ],
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAccordion({
  userShowId = null,
  watchedEpisodeKeys = [],
  seasons = [firstSummary],
}: {
  userShowId?: string | null;
  watchedEpisodeKeys?: string[];
  seasons?: TMDBSeason[];
} = {}) {
  return render(
    <SeasonAccordion
      seasons={seasons}
      showId={1399}
      userShowId={userShowId}
      watchedEpisodeKeys={watchedEpisodeKeys}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SeasonAccordion', () => {
  it('renders only accessible summaries initially and loads only the opened season', async () => {
    const fetchSeason = vi.fn().mockResolvedValue(jsonResponse(seasonDetail(2)));
    vi.stubGlobal('fetch', fetchSeason);
    renderAccordion({ seasons: [firstSummary, secondSummary] });

    const firstTrigger = screen.getByRole('button', { name: /Birinci Sezon/ });
    const secondTrigger = screen.getByRole('button', { name: /İkinci Sezon/ });
    expect(firstTrigger.getAttribute('aria-expanded')).toBe('false');
    expect(firstTrigger.hasAttribute('aria-controls')).toBe(true);
    expect(screen.getByText('Sezonun kısa özeti.')).toBeTruthy();
    expect(screen.queryByText('Pilot Bölüm')).toBeNull();
    expect(fetchSeason).not.toHaveBeenCalled();

    fireEvent.click(secondTrigger);

    expect(screen.getByRole('status').textContent).toContain('Bölümler yükleniyor');
    expect(await screen.findByText('İkinci Sezon Bölümü')).toBeTruthy();
    expect(fetchSeason).toHaveBeenCalledOnce();
    expect(fetchSeason).toHaveBeenCalledWith('/api/shows/1399/seasons/2', { method: 'GET' });
  });

  it('deduplicates close/reopen while loading and reuses data after success', async () => {
    let resolveRequest!: (response: Response) => void;
    const fetchSeason = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    }));
    vi.stubGlobal('fetch', fetchSeason);
    renderAccordion();

    const trigger = screen.getByRole('button', { name: /Birinci Sezon/ });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(fetchSeason).toHaveBeenCalledOnce();

    resolveRequest(jsonResponse(seasonDetail()));
    expect(await screen.findByText('Pilot Bölüm')).toBeTruthy();

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(await screen.findByText('Pilot Bölüm')).toBeTruthy();
    expect(fetchSeason).toHaveBeenCalledOnce();
  });

  it('keeps a failed season stable while another season is opened', async () => {
    const fetchSeason = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith('/1')) {
        return Promise.resolve(jsonResponse({ error: 'Sezon bölümleri yüklenemedi.' }, 502));
      }
      return Promise.resolve(jsonResponse(seasonDetail(2)));
    });
    vi.stubGlobal('fetch', fetchSeason);
    renderAccordion({ seasons: [firstSummary, secondSummary] });

    fireEvent.click(screen.getByRole('button', { name: /Birinci Sezon/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Sezon bölümleri yüklenemedi.');

    fireEvent.click(screen.getByRole('button', { name: /İkinci Sezon/ }));
    expect(await screen.findByText('İkinci Sezon Bölümü')).toBeTruthy();
    expect(fetchSeason).toHaveBeenCalledTimes(2);
  });

  it('retries a failed request from the error state', async () => {
    const fetchSeason = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ error: 'Geçici hata.' }, 502))
      .mockResolvedValueOnce(jsonResponse(seasonDetail()));
    vi.stubGlobal('fetch', fetchSeason);
    renderAccordion();

    fireEvent.click(screen.getByRole('button', { name: /Birinci Sezon/ }));
    const retry = await screen.findByRole('button', { name: /Tekrar dene/ });
    fireEvent.click(retry);

    expect(await screen.findByText('Pilot Bölüm')).toBeTruthy();
    expect(fetchSeason).toHaveBeenCalledTimes(2);
  });

  it('preserves cached episodes while accepting fresh watched props after revalidation', async () => {
    const fetchSeason = vi.fn().mockResolvedValue(jsonResponse(seasonDetail()));
    vi.stubGlobal('fetch', fetchSeason);
    const view = renderAccordion({ userShowId: 'user-show-id' });

    fireEvent.click(screen.getByRole('button', { name: /Birinci Sezon/ }));
    expect(await screen.findByLabelText('Bölümü izlendi olarak işaretle')).toBeTruthy();

    view.rerender(
      <SeasonAccordion
        seasons={[firstSummary]}
        showId={1399}
        userShowId="user-show-id"
        watchedEpisodeKeys={['S1E1']}
      />,
    );

    expect(screen.getByLabelText('Bölümü izlenmedi olarak işaretle')).toBeTruthy();
    expect(screen.getByText('1 / 1 bölüm')).toBeTruthy();
    expect(fetchSeason).toHaveBeenCalledOnce();
  });

  it('renders loaded guest episodes without watch controls', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(seasonDetail())));
    renderAccordion();

    fireEvent.click(screen.getByRole('button', { name: /Birinci Sezon/ }));
    expect(await screen.findByText('Pilot Bölüm')).toBeTruthy();
    expect(screen.queryByLabelText(/Bölümü .* olarak işaretle/)).toBeNull();
  });

  it('shows an empty successful season without refetching it', async () => {
    const fetchSeason = vi.fn().mockResolvedValue(jsonResponse({ ...seasonDetail(), episodes: [] }));
    vi.stubGlobal('fetch', fetchSeason);
    renderAccordion();

    const trigger = screen.getByRole('button', { name: /Birinci Sezon/ });
    fireEvent.click(trigger);
    expect(await screen.findByText('Bu sezonda bölüm bilgisi bulunamadı.')).toBeTruthy();

    fireEvent.click(trigger);
    fireEvent.click(trigger);
    await waitFor(() => expect(fetchSeason).toHaveBeenCalledOnce());
  });

  it('loads episodes for a season with overview: null (TMDB non-English locale regression)', async () => {
    const nullOverviewSeason: TMDBSeason = {
      ...firstSummary,
      overview: null,
    };
    const detail = { ...seasonDetail(), overview: null };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(detail)));
    renderAccordion({ seasons: [nullOverviewSeason] });

    fireEvent.click(screen.getByRole('button', { name: /Birinci Sezon/ }));
    expect(await screen.findByText('Pilot Bölüm')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
