import { beforeEach, describe, expect, it, vi } from 'vitest';

const { revalidatePath, createClient, redirect } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  createClient: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/lib/supabase/server', () => ({ createClient }));

import {
  addShow,
  removeShow,
  setShowFavorite,
  setShowRating,
  signIn,
  signOut,
  signUp,
  toggleEpisode,
  updateShowStatus,
} from '@/lib/supabase/actions';

const USER_SHOW_ID = '8d50c4a7-3ff8-47d6-bbe9-3b825b35ef2d';
const ANOTHER_USER_SHOW_ID = 'c4736f96-92ae-4a4c-8af9-718d68b28a7b';

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
  return { from, ownershipQuery };
}

describe('toggleEpisode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a database error and does not revalidate when insert fails', async () => {
    const insert = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
    const { ownershipQuery } = mockAuthenticatedClient({ insert });

    const result = await toggleEpisode({
      userShowId: USER_SHOW_ID,
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: false,
    });

    expect(result).toEqual({ error: 'insert failed' });
    expect(ownershipQuery.select).toHaveBeenCalledExactlyOnceWith('id');
    expect(ownershipQuery.eq).toHaveBeenCalledTimes(2);
    expect(ownershipQuery.eq).toHaveBeenCalledWith('id', USER_SHOW_ID);
    expect(ownershipQuery.eq).toHaveBeenCalledWith('user_id', 'user-id');
    expect(insert).toHaveBeenCalledExactlyOnceWith({
      user_show_id: USER_SHOW_ID,
      season_number: 1,
      episode_number: 1,
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a database error and does not revalidate when delete fails', async () => {
    const query = deleteQuery({ message: 'delete failed' });
    mockAuthenticatedClient(query);

    const result = await toggleEpisode({
      userShowId: USER_SHOW_ID,
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: true,
    });

    expect(result).toEqual({ error: 'delete failed' });
    expect(query.eq).toHaveBeenCalledTimes(3);
    expect(query.eq).toHaveBeenCalledWith('user_show_id', USER_SHOW_ID);
    expect(query.eq).toHaveBeenCalledWith('season_number', 1);
    expect(query.eq).toHaveBeenCalledWith('episode_number', 1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('inserts the exact episode payload and revalidates the numeric TMDB detail route', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    mockAuthenticatedClient({ insert });

    const result = await toggleEpisode({
      userShowId: USER_SHOW_ID,
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 2,
      isWatched: false,
    });

    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledExactlyOnceWith({
      user_show_id: USER_SHOW_ID,
      season_number: 1,
      episode_number: 2,
    });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/1399');
    expect(revalidatePath).not.toHaveBeenCalledWith(`/shows/${USER_SHOW_ID}`);
  });

  it('deletes the exact watched episode and revalidates after success', async () => {
    const query = deleteQuery(null);
    mockAuthenticatedClient(query);

    const result = await toggleEpisode({
      userShowId: USER_SHOW_ID,
      tmdbShowId: 2316,
      seasonNumber: 4,
      episodeNumber: 7,
      isWatched: true,
    });

    expect(result).toEqual({ success: true });
    expect(query.delete).toHaveBeenCalledOnce();
    expect(query.eq).toHaveBeenCalledTimes(3);
    expect(query.eq).toHaveBeenCalledWith('user_show_id', USER_SHOW_ID);
    expect(query.eq).toHaveBeenCalledWith('season_number', 4);
    expect(query.eq).toHaveBeenCalledWith('episode_number', 7);
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/2316');
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
      userShowId: USER_SHOW_ID,
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched: false,
    });

    expect(result).toEqual({ error: 'Giriş yapmalısınız' });
    expect(from).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([false, true])('rejects users who do not own the show before the watched=%s mutation', async (isWatched) => {
    const episodeQuery = {
      insert: vi.fn(),
      delete: vi.fn(),
    };
    const { from, ownershipQuery } = mockAuthenticatedClient(episodeQuery, null);

    const result = await toggleEpisode({
      userShowId: ANOTHER_USER_SHOW_ID,
      tmdbShowId: 1399,
      seasonNumber: 1,
      episodeNumber: 1,
      isWatched,
    });

    expect(result).toEqual({ error: 'Bu dizi sizin kütüphanenizde değil' });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('user_shows');
    expect(ownershipQuery.select).toHaveBeenCalledExactlyOnceWith('id');
    expect(ownershipQuery.eq).toHaveBeenCalledTimes(2);
    expect(ownershipQuery.eq).toHaveBeenCalledWith('id', ANOTHER_USER_SHOW_ID);
    expect(ownershipQuery.eq).toHaveBeenCalledWith('user_id', 'user-id');
    expect(episodeQuery.insert).not.toHaveBeenCalled();
    expect(episodeQuery.delete).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { userShowId: 'not-a-uuid', tmdbShowId: 1399, seasonNumber: 1, episodeNumber: 1, isWatched: false },
    { userShowId: USER_SHOW_ID, tmdbShowId: 0, seasonNumber: 1, episodeNumber: 1, isWatched: false },
    { userShowId: USER_SHOW_ID, tmdbShowId: 1399, seasonNumber: 0, episodeNumber: 1, isWatched: false },
    { userShowId: USER_SHOW_ID, tmdbShowId: 1399, seasonNumber: 1, episodeNumber: -1, isWatched: false },
    { userShowId: USER_SHOW_ID, tmdbShowId: 1399, seasonNumber: 1, episodeNumber: 1.5, isWatched: false },
    { userShowId: USER_SHOW_ID, tmdbShowId: 1399, seasonNumber: 1, episodeNumber: 1, isWatched: 'false' },
  ])('rejects malformed episode input before creating a database client', async (input) => {
    const result = await toggleEpisode(input as never);

    expect(result).toEqual({ error: 'Geçersiz bölüm bilgisi' });
    expect(createClient).not.toHaveBeenCalled();
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

  it('trims bounded text fields and accepts zero as the unknown total episode sentinel', async () => {
    const chain = {
      upsert: vi.fn(),
      select: vi.fn(),
      single: vi.fn().mockResolvedValue({ data: { tmdb_show_id: 2316 }, error: null }),
    };
    chain.upsert.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
      from: vi.fn().mockReturnValue(chain),
    });

    const result = await addShow({
      tmdb_show_id: 2316,
      title: '  The Office  ',
      poster_path: '  /poster.jpg  ',
      total_episodes: 0,
      status: 'plan_to_watch',
    });

    expect(result).toEqual({ success: true });
    expect(chain.upsert).toHaveBeenCalledWith(expect.objectContaining({
      title: 'The Office',
      poster_path: '/poster.jpg',
      total_episodes: 0,
    }), expect.anything());
  });

  it.each([
    null,
    {},
    { tmdb_show_id: 0, title: 'Dizi', poster_path: null, total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1.5, title: 'Dizi', poster_path: null, total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1, title: '   ', poster_path: null, total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1, title: 'x'.repeat(201), poster_path: null, total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1, title: 'Dizi', poster_path: '', total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1, title: 'Dizi', poster_path: 'x'.repeat(501), total_episodes: 1, status: 'watching' },
    { tmdb_show_id: 1, title: 'Dizi', poster_path: null, total_episodes: -1, status: 'watching' },
    { tmdb_show_id: 1, title: 'Dizi', poster_path: null, total_episodes: 1.2, status: 'watching' },
    { tmdb_show_id: 1, title: 'Dizi', poster_path: null, total_episodes: 1, status: 'paused' },
  ])('rejects malformed show data before creating a database client', async (input) => {
    const result = await addShow(input as never);

    expect(result).toEqual({ error: 'Geçersiz dizi bilgisi' });
    expect(createClient).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('show mutation identifiers and status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['', 'watching'],
    ['not-a-uuid', 'watching'],
    [42, 'watching'],
  ])('rejects an invalid show id before a status update', async (showId, status) => {
    const result = await updateShowStatus(showId as never, status as never);

    expect(result).toEqual({ error: 'Geçersiz dizi kimliği' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(['paused', '', 1, null])('rejects an invalid status before querying the database: %s', async (status) => {
    const result = await updateShowStatus(USER_SHOW_ID, status as never);

    expect(result).toEqual({ error: 'Geçersiz dizi durumu' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-uuid', 42, null])('rejects an invalid remove id before querying the database: %s', async (showId) => {
    const result = await removeShow(showId as never);

    expect(result).toEqual({ error: 'Geçersiz dizi kimliği' });
    expect(createClient).not.toHaveBeenCalled();
  });

  function mutationQuery(data: { id?: string; tmdb_show_id?: number } | null) {
    const chain = {
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    };
    chain.update.mockReturnValue(chain);
    chain.delete.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.select.mockReturnValue(chain);
    return chain;
  }

  function mockMutationClient(query: ReturnType<typeof mutationQuery>) {
    createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-id' } } }) },
      from: vi.fn().mockReturnValue(query),
    });
  }

  it('does not report success when an owner-scoped status update affects zero rows', async () => {
    const query = mutationQuery(null);
    mockMutationClient(query);

    const result = await updateShowStatus(USER_SHOW_ID, 'completed');

    expect(result).toEqual({ error: 'Dizi bulunamadı veya güncelleme yetkiniz yok' });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', USER_SHOW_ID);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-id');
    expect(query.select).toHaveBeenCalledExactlyOnceWith('tmdb_show_id');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates the library and trusted detail route after a status update', async () => {
    const query = mutationQuery({ tmdb_show_id: 1399 });
    mockMutationClient(query);

    const result = await updateShowStatus(USER_SHOW_ID, 'completed');

    expect(result).toEqual({ success: true });
    expect(query.update).toHaveBeenCalledExactlyOnceWith({ status: 'completed' });
    expect(revalidatePath).toHaveBeenNthCalledWith(1, '/library');
    expect(revalidatePath).toHaveBeenNthCalledWith(2, '/shows/1399');
  });

  it('does not report success when an owner-scoped delete affects zero rows', async () => {
    const query = mutationQuery(null);
    mockMutationClient(query);

    const result = await removeShow(USER_SHOW_ID);

    expect(result).toEqual({ error: 'Dizi bulunamadı veya silme yetkiniz yok' });
    expect(query.eq).toHaveBeenNthCalledWith(1, 'id', USER_SHOW_ID);
    expect(query.eq).toHaveBeenNthCalledWith(2, 'user_id', 'user-id');
    expect(query.select).toHaveBeenCalledExactlyOnceWith('id');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('revalidates the library after an owner-scoped delete', async () => {
    const query = mutationQuery({ id: USER_SHOW_ID });
    mockMutationClient(query);

    const result = await removeShow(USER_SHOW_ID);

    expect(result).toEqual({ success: true });
    expect(query.delete).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith('/library');
  });
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}

function mockAuthClient(overrides: {
  signInWithPassword?: ReturnType<typeof vi.fn>;
  signUp?: ReturnType<typeof vi.fn>;
  signOut?: ReturnType<typeof vi.fn>;
} = {}) {
  const client = {
    auth: {
      signInWithPassword: overrides.signInWithPassword ?? vi.fn().mockResolvedValue({ error: null }),
      signUp: overrides.signUp ?? vi.fn().mockResolvedValue({ error: null }),
      signOut: overrides.signOut ?? vi.fn().mockResolvedValue({ error: null }),
    },
  };
  createClient.mockResolvedValue(client);
  return client;
}

describe('signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes email and password to Supabase and redirects to /library on success', async () => {
    const signInFn = vi.fn().mockResolvedValue({ error: null });
    mockAuthClient({ signInWithPassword: signInFn });

    await signIn(undefined, formData({ email: 'test@example.com', password: 'secret123' }));

    expect(signInFn).toHaveBeenCalledExactlyOnceWith({
      email: 'test@example.com',
      password: 'secret123',
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/library');
  });

  it('returns the auth error message and does not redirect on failure', async () => {
    const signInFn = vi.fn().mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    mockAuthClient({ signInWithPassword: signInFn });

    const result = await signIn(undefined, formData({ email: 'wrong@example.com', password: 'bad' }));

    expect(result).toEqual({ error: 'Invalid login credentials' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('accepts FormData as prevState for direct form action binding', async () => {
    const signInFn = vi.fn().mockResolvedValue({ error: null });
    mockAuthClient({ signInWithPassword: signInFn });

    const fd = formData({ email: 'direct@example.com', password: 'pass123' });
    await signIn(fd);

    expect(signInFn).toHaveBeenCalledExactlyOnceWith({
      email: 'direct@example.com',
      password: 'pass123',
    });
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/library');
  });
});

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Supabase signUp and returns a success message without redirecting', async () => {
    const signUpFn = vi.fn().mockResolvedValue({ error: null });
    mockAuthClient({ signUp: signUpFn });

    const result = await signUp(undefined, formData({ email: 'new@example.com', password: 'strong456' }));

    expect(signUpFn).toHaveBeenCalledExactlyOnceWith({
      email: 'new@example.com',
      password: 'strong456',
    });
    expect(result).toEqual({ success: 'Hesabın oluşturuldu. E-posta adresinizi doğrulayın.' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('returns the auth error message on failure', async () => {
    const signUpFn = vi.fn().mockResolvedValue({
      error: { message: 'User already registered' },
    });
    mockAuthClient({ signUp: signUpFn });

    const result = await signUp(undefined, formData({ email: 'existing@example.com', password: 'pass123' }));

    expect(result).toEqual({ error: 'User already registered' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('accepts FormData as prevState for direct form action binding', async () => {
    const signUpFn = vi.fn().mockResolvedValue({ error: null });
    mockAuthClient({ signUp: signUpFn });

    const fd = formData({ email: 'direct@example.com', password: 'pass789' });
    const result = await signUp(fd);

    expect(signUpFn).toHaveBeenCalledExactlyOnceWith({
      email: 'direct@example.com',
      password: 'pass789',
    });
    expect(result).toEqual({ success: 'Hesabın oluşturuldu. E-posta adresinizi doğrulayın.' });
  });
});

describe('signOut', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Supabase signOut and redirects to /discover', async () => {
    const signOutFn = vi.fn().mockResolvedValue({ error: null });
    mockAuthClient({ signOut: signOutFn });

    await signOut();

    expect(signOutFn).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledExactlyOnceWith('/discover');
  });
});
