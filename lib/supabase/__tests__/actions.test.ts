import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePath, createClient } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

import { toggleEpisode } from '@/lib/supabase/actions';

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
