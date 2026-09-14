import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePath, createClient } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

import {
  addShow,
  setShowFavorite,
  setShowRating,
  toggleEpisode,
} from '@/lib/supabase/actions';

const USER_SHOW_ID = '8d50c4a7-3ff8-47d6-bbe9-3b825b35ef2d';

function deleteQuery(error: { message: string } | null) {
  const chain = {
    delete: vi.fn(),
    eq: vi.fn(),
  };
  chain.delete.mockReturnValue(chain);
  chain.eq.mockReturnValueOnce(chain).mockReturnValueOnce(chain).mockResolvedValueOnce({ error });
  return chain;
}

function ownerQuery(owner: { id: string } | null = { id: 'user-show-id' }) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue({ data: owner, error: null }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function mockAuthenticatedClient(
  episodeQuery: Record<string, unknown>,
  owner: { id: string } | null = { id: 'user-show-id' },
) {
  const ownershipQuery = ownerQuery(owner);
  const from = vi.fn((table: string) =>
    table === 'user_shows' ? ownershipQuery : episodeQuery,
  );
  createClient.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-id' } },
      }),
    },
    from,
  });
  return { from };
}

describe('toggleEpisode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a database error and does not revalidate when insert fails', async () => {
    mockAuthenticatedClient({
      insert: vi.fn().mockResolvedValue({ error: { message: 'insert failed' } }),
    });

    const result = await toggleEpisode({
      userShowId: 'user-show-id',
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: false,
    });

    expect(result).toEqual({ error: 'insert failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a database error and does not revalidate when delete fails', async () => {
    const query = deleteQuery({ message: 'delete failed' });
    mockAuthenticatedClient(query);

    const result = await toggleEpisode({
      userShowId: 'user-show-id',
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: true,
    });

    expect(result).toEqual({ error: 'delete failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates the library and numeric TMDB detail route after success', async () => {
    mockAuthenticatedClient({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await toggleEpisode({
      userShowId: 'uuid-value',
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 2,
      isWatched: false,
    });

    expect(result).toEqual({ success: true });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/1399');
    expect(revalidatePath).not.toHaveBeenCalledWith('/shows/uuid-value');
  });

  it('rejects unauthenticated users before querying the database', async () => {
    const from = vi.fn();
    createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
      from,
    });

    const result = await toggleEpisode({
      userShowId: 'user-show-id',
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: false,
    });

    expect(result).toEqual({ error: 'Giriş yapmalısınız' });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('rejects users who do not own the show', async () => {
    const { from } = mockAuthenticatedClient({}, null);

    const result = await toggleEpisode({
      userShowId: 'another-users-show',
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: false,
    });

    expect(result).toEqual({ error: 'Bu dizi sizin kütüphanenizde değil' });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('user_shows');
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

function preferenceUpdateQuery({
  data = { tmdb_show_id: 1399 },
  error = null,
}: {
  data?: { tmdb_show_id: number } | null;
  error?: { message: string } | null;
} = {}) {
  const chain = {
    update: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

function mockPreferenceClient(
  query: ReturnType<typeof preferenceUpdateQuery>,
  user: { id: string } | null = { id: 'user-id' },
) {
  const from = vi.fn().mockReturnValue(query);
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from,
  });
  return { from };
}

describe('personal show preference actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['', true, setShowFavorite],
    ['not-a-uuid', true, setShowFavorite],
    [42, true, setShowFavorite],
    ['', 8, setShowRating],
  ])('rejects an invalid show id before creating a database client', async (showId, value, action) => {
    const result = await action(showId, value);

    expect(result).toEqual({ error: 'Geçersiz dizi kimliği' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('requires a real boolean favorite value', async () => {
    const result = await setShowFavorite(USER_SHOW_ID, 'true');

    expect(result).toEqual({ error: 'Geçersiz favori değeri' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([0, 11, 4.5, '8', undefined])('rejects invalid ratings before querying the database: %s', async (rating) => {
    const result = await setShowRating(USER_SHOW_ID, rating);

    expect(result).toEqual({ error: 'Puan 1 ile 10 arasında bir tam sayı olmalı' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('requires authentication before updating preferences', async () => {
    const query = preferenceUpdateQuery();
    const { from } = mockPreferenceClient(query, null);

    const result = await setShowFavorite(USER_SHOW_ID, true);

    expect(result).toEqual({ error: 'Giriş yapmalısınız' });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('treats a zero-row owner-scoped update as a failed authorization', async () => {
    const query = preferenceUpdateQuery({ data: null });
    mockPreferenceClient(query);

    const result = await setShowFavorite(USER_SHOW_ID, true);

    expect(result).toEqual({ error: 'Dizi bulunamadı veya güncelleme yetkiniz yok' });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', USER_SHOW_ID);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-id');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns database failures without revalidating', async () => {
    const query = preferenceUpdateQuery({ error: { message: 'update failed' } });
    mockPreferenceClient(query);

    const result = await setShowRating(USER_SHOW_ID, 7);

    expect(result).toEqual({ error: 'update failed' });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('updates only favorite state and revalidates using the returned TMDB id', async () => {
    const query = preferenceUpdateQuery({ data: { tmdb_show_id: 2316 } });
    mockPreferenceClient(query);

    const result = await setShowFavorite(USER_SHOW_ID, true);

    expect(result).toEqual({ success: true });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ is_favorite: true });
    expect(query.select).toHaveBeenCalledExactlyOnceWith('tmdb_show_id');
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/2316');
  });

  it('can clear only the personal rating', async () => {
    const query = preferenceUpdateQuery();
    mockPreferenceClient(query);

    const result = await setShowRating(USER_SHOW_ID, null);

    expect(result).toEqual({ success: true });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ rating: null });
  });
});

describe('addShow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps preference fields out of the upsert and refreshes the detail route', async () => {
    const chain = {
      upsert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: { tmdb_show_id: 1399 }, error: null }),
    };
    chain.upsert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
      from: vi.fn().mockReturnValue(chain),
    });
    const clientPayload = {
      tmdb_show_id: 1399,
      title: 'Dizi',
      poster_path: '/poster.jpg',
      total_episodes: 10,
      status: 'watching' as const,
      rating: 10,
      is_favorite: true,
    };

    const result = await addShow(clientPayload);

    expect(result).toEqual({ success: true });
    expect(chain.upsert).toHaveBeenCalledExactlyOnceWith({
      user_id: 'user-id',
      tmdb_show_id: 1399,
      title: 'Dizi',
      poster_path: '/poster.jpg',
      total_episodes: 10,
      status: 'watching',
    }, { onConflict: 'user_id,tmdb_show_id' });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/1399');
  });
});
