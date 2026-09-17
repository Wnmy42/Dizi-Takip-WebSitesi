// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShowStatus } from '@/lib/supabase/types';

const { createClient, personalControls, updateShowStatus } = vi.hoisted(() => ({
  createClient: vi.fn(),
  personalControls: vi.fn<(props: unknown) => null>(() => null),
  updateShowStatus: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/supabase/actions', () => ({ updateShowStatus }));
vi.mock('@/lib/tmdb/client', () => ({ getPosterUrl: () => '/poster.png' }));
vi.mock('@/components/personal-show-controls', () => ({ PersonalShowControls: personalControls }));
vi.mock('@/components/progress-bar', () => ({ ProgressBar: () => null }));
// Test double: image optimization is outside this interaction test.
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => <img src="/poster.png" alt={alt} /> }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));

import LibraryPage from '@/app/(app)/library/page';

const ids = {
  watching: '8d50c4a7-3ff8-47d6-bbe9-3b825b35ef2d',
  planned: '42ce475a-56bd-42a2-9b75-aa3b617b78b9',
  completed: 'ad0f434d-8a3f-47bb-a9cb-9476f2f54587',
} as const;

type LibraryShow = {
  id: string; tmdb_show_id: number; title: string; poster_path: null;
  total_episodes: number; status: ShowStatus; rating: number | null;
  is_favorite: boolean; user_episodes: [{ count: number }];
};

function show(id: string, tmdb_show_id: number, title: string, status: ShowStatus): LibraryShow {
  return { id, tmdb_show_id, title, status, poster_path: null, total_episodes: 10,
    rating: null, is_favorite: false, user_episodes: [{ count: 0 }] };
}

const initialShows: LibraryShow[] = [
  { ...show(ids.watching, 101, 'Aktif Dizi', 'watching'), rating: 9, is_favorite: true, user_episodes: [{ count: 4 }] },
  show(ids.planned, 202, 'Sıradaki Dizi', 'plan_to_watch'),
  show(ids.completed, 303, 'Biten Dizi', 'completed'),
];

let serverShows: LibraryShow[];

function installSupabaseMock() {
  const query = { select: vi.fn(), order: vi.fn(() => Promise.resolve({ data: serverShows, error: null })) };
  query.select.mockReturnValue(query);
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
    from: vi.fn().mockReturnValue(query),
  });
  return query;
}

function activePanel() {
  const panelId = screen.getByRole('tab', { selected: true }).getAttribute('aria-controls');
  const panel = panelId ? document.getElementById(panelId) : null;
  if (!panel) throw new Error('Active library tab panel was not found');
  return panel;
}

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  serverShows = initialShows.map((entry) => ({ ...entry }));
  updateShowStatus.mockResolvedValue({ success: true });
});

describe('library categories', () => {
  it('shows accurate counters and only the selected category contents', async () => {
    installSupabaseMock();
    render(await LibraryPage());

    expect(screen.getByRole('tab', { name: 'İzliyorum (1)' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'İzleyeceğim (1)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Tamamlandı (1)' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Bıraktım' })).toBeDefined();
    expect(screen.queryByRole('tab', { name: 'Bıraktım (0)' })).toBeNull();

    expect(within(activePanel()).getByRole('link', { name: /Aktif Dizi/ })).toBeDefined();
    expect(within(activePanel()).queryByRole('link', { name: /Sıradaki Dizi/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'İzleyeceğim (1)' }));
    expect(within(activePanel()).getByRole('link', { name: /Sıradaki Dizi/ })).toBeDefined();
    expect(within(activePanel()).queryByRole('link', { name: /Aktif Dizi/ })).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Bıraktım' }));
    const emptyPanel = activePanel();
    expect(within(emptyPanel).getByText('Bu kategoride dizi yok.')).toBeDefined();
    expect(within(emptyPanel).getByRole('link', { name: 'Dizi keşfet →' }).getAttribute('href')).toBe('/discover');
  });

  it('moves a status-updated show after fresh server data while keeping the selected tab', async () => {
    installSupabaseMock();
    const view = render(await LibraryPage());

    fireEvent.click(within(activePanel()).getByRole('combobox'));
    const completedOption = await screen.findByRole('option', { name: 'Tamamlandı' });
    fireEvent.pointerDown(completedOption);
    fireEvent.pointerUp(completedOption);
    fireEvent.click(completedOption);
    await waitFor(() => expect(updateShowStatus).toHaveBeenCalledExactlyOnceWith(ids.watching, 'completed'));

    serverShows = serverShows.map((entry) => entry.id === ids.watching ? { ...entry, status: 'completed' } : entry);
    view.rerender(await LibraryPage());

    expect(screen.getByRole('tab', { name: 'İzliyorum' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.queryByRole('tab', { name: 'İzliyorum (1)' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Tamamlandı (2)' })).toBeDefined();
    expect(within(activePanel()).getByText('Bu kategoride dizi yok.')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Tamamlandı (2)' }));
    const completedPanel = activePanel();
    expect(within(completedPanel).getByRole('link', { name: /Aktif Dizi/ })).toBeDefined();
    expect(within(completedPanel).getByRole('link', { name: /Biten Dizi/ })).toBeDefined();
  });

  it('keeps personal values and episode progress for grouped rows', async () => {
    const query = installSupabaseMock();
    render(await LibraryPage());

    expect(query.select).toHaveBeenCalledExactlyOnceWith('*, user_episodes(count)');
    expect(personalControls).toHaveBeenCalledWith({
      userShowId: ids.watching, initialIsFavorite: true, initialRating: 9,
    }, undefined);
    expect(within(activePanel()).getByText('4/10 bölüm')).toBeDefined();
  });
});
