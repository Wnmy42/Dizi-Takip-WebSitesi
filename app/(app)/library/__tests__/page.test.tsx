import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const { createClient, personalControls, statusSelector } = vi.hoisted(() => ({
  createClient: vi.fn(),
  personalControls: vi.fn<(props: unknown) => null>(() => null),
  statusSelector: vi.fn<(props: unknown) => null>(() => null),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient }));
vi.mock('@/lib/tmdb/client', () => ({ getPosterUrl: () => '/poster.png' }));
vi.mock('@/components/personal-show-controls', () => ({ PersonalShowControls: personalControls }));
vi.mock('@/components/status-selector', () => ({ StatusSelector: statusSelector }));
vi.mock('@/components/progress-bar', () => ({ ProgressBar: () => null }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: ReactNode }) => <button>{children}</button>,
}));

import LibraryPage from '@/app/(app)/library/page';

beforeEach(() => vi.clearAllMocks());

it('passes each library row personal favorite and rating values to shared controls', async () => {
  const shows = [{
    id: '8d50c4a7-3ff8-47d6-bbe9-3b825b35ef2d',
    tmdb_show_id: 1399,
    title: 'Dizi',
    poster_path: null,
    total_episodes: 10,
    status: 'watching',
    rating: 9,
    is_favorite: true,
    user_episodes: [{ count: 4 }],
  }];
  const query = {
    select: vi.fn(),
    order: vi.fn().mockResolvedValue({ data: shows, error: null }),
  };
  query.select.mockReturnValue(query);
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
    from: vi.fn().mockReturnValue(query),
  });

  const markup = renderToStaticMarkup(await LibraryPage());

  expect(query.select).toHaveBeenCalledExactlyOnceWith('*, user_episodes(count)');
  expect(personalControls.mock.calls[0]?.[0]).toEqual({
    userShowId: shows[0].id,
    initialIsFavorite: true,
    initialRating: 9,
  });
  expect(markup).toContain('4/10 bölüm');
});
