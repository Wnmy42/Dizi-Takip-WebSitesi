'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ShowStatus } from '@/lib/supabase/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHOW_STATUSES: readonly ShowStatus[] = ['watching', 'plan_to_watch', 'completed', 'dropped'];
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const MAX_SHOW_TITLE_LENGTH = 200;
const MAX_POSTER_PATH_LENGTH = 500;
const INVALID_SHOW_ERROR = 'Geçersiz dizi kimliği';
const INVALID_SHOW_DATA_ERROR = 'Geçersiz dizi bilgisi';
const INVALID_STATUS_ERROR = 'Geçersiz dizi durumu';
const INVALID_EPISODE_ERROR = 'Geçersiz bölüm bilgisi';
const SHOW_UPDATE_ERROR = 'Dizi bulunamadı veya güncelleme yetkiniz yok';
const SHOW_REMOVE_ERROR = 'Dizi bulunamadı veya silme yetkiniz yok';

type AddShowInput = {
  tmdb_show_id: number;
  title: string;
  poster_path: string | null;
  total_episodes: number;
  status: ShowStatus;
};

type ToggleEpisodeInput = {
  userShowId: string;
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
  isWatched: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDatabaseInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number'
    && Number.isSafeInteger(value)
    && value >= minimum
    && value <= POSTGRES_INTEGER_MAX;
}

function isShowStatus(value: unknown): value is ShowStatus {
  return typeof value === 'string' && SHOW_STATUSES.includes(value as ShowStatus);
}

function parseAddShowInput(value: unknown): AddShowInput | null {
  if (!isRecord(value)) return null;

  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const posterPath = typeof value.poster_path === 'string' ? value.poster_path.trim() : value.poster_path;

  if (
    !isDatabaseInteger(value.tmdb_show_id, 1)
    || title.length === 0
    || title.length > MAX_SHOW_TITLE_LENGTH
    || (posterPath !== null
      && (typeof posterPath !== 'string'
        || posterPath.length === 0
        || posterPath.length > MAX_POSTER_PATH_LENGTH))
    || !isDatabaseInteger(value.total_episodes, 0)
    || !isShowStatus(value.status)
  ) {
    return null;
  }

  return {
    tmdb_show_id: value.tmdb_show_id,
    title,
    poster_path: posterPath,
    total_episodes: value.total_episodes,
    status: value.status,
  };
}

function parseToggleEpisodeInput(value: unknown): ToggleEpisodeInput | null {
  if (
    !isRecord(value)
    || typeof value.userShowId !== 'string'
    || !UUID_PATTERN.test(value.userShowId)
    || !isDatabaseInteger(value.tmdbShowId, 1)
    || !isDatabaseInteger(value.seasonNumber, 1)
    || !isDatabaseInteger(value.episodeNumber, 1)
    || typeof value.isWatched !== 'boolean'
  ) {
    return null;
  }

  return {
    userShowId: value.userShowId,
    tmdbShowId: value.tmdbShowId,
    seasonNumber: value.seasonNumber,
    episodeNumber: value.episodeNumber,
    isWatched: value.isWatched,
  };
}

// AUTH ACTIONS
export async function signIn(
  prevState: { error?: string } | FormData | undefined,
  formData?: FormData
) {
  const data = formData instanceof FormData ? formData : (prevState as FormData);
  const supabase = await createClient();
  const email = data.get('email') as string;
  const password = data.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect('/library');
}

export async function signUp(
  prevState: { error?: string; success?: string } | FormData | undefined,
  formData?: FormData
) {
  const data = formData instanceof FormData ? formData : (prevState as FormData);
  const supabase = await createClient();
  const email = data.get('email') as string;
  const password = data.get('password') as string;

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  return { success: 'Hesabın oluşturuldu. E-posta adresinizi doğrulayın.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/discover');
}

// SHOW ACTIONS
export async function addShow(input: AddShowInput) {
  const data = parseAddShowInput(input);
  if (!data) return { error: INVALID_SHOW_DATA_ERROR };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { data: savedShow, error } = await supabase
    .from('user_shows')
    .upsert({
      user_id: user.id,
      tmdb_show_id: data.tmdb_show_id,
      title: data.title,
      poster_path: data.poster_path,
      total_episodes: data.total_episodes,
      status: data.status,
    }, { onConflict: 'user_id,tmdb_show_id' })
    .select('tmdb_show_id')
    .single();

  if (error) return { error: error.message };
  if (!savedShow) return { error: 'Dizi listeye eklenemedi' };
  revalidatePath('/library');
  revalidatePath(`/shows/${savedShow.tmdb_show_id}`);
  return { success: true };
}

async function updatePersonalPreference(
  showId: string,
  values: { is_favorite: boolean } | { rating: number | null },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { data: updatedShow, error } = await supabase
    .from('user_shows')
    .update(values)
    .eq('id', showId)
    .eq('user_id', user.id)
    .select('tmdb_show_id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updatedShow) return { error: SHOW_UPDATE_ERROR };

  revalidatePath('/library');
  revalidatePath(`/shows/${updatedShow.tmdb_show_id}`);
  return { success: true };
}

export async function setShowFavorite(showId: unknown, isFavorite: unknown) {
  if (typeof showId !== 'string' || !UUID_PATTERN.test(showId)) {
    return { error: INVALID_SHOW_ERROR };
  }
  if (typeof isFavorite !== 'boolean') {
    return { error: 'Geçersiz favori değeri' };
  }

  return updatePersonalPreference(showId, { is_favorite: isFavorite });
}

export async function setShowRating(showId: unknown, rating: unknown) {
  if (typeof showId !== 'string' || !UUID_PATTERN.test(showId)) {
    return { error: INVALID_SHOW_ERROR };
  }
  if (
    rating !== null
    && (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 10)
  ) {
    return { error: 'Puan 1 ile 10 arasında bir tam sayı olmalı' };
  }

  return updatePersonalPreference(showId, { rating });
}

export async function updateShowStatus(showId: string, status: ShowStatus) {
  if (typeof showId !== 'string' || !UUID_PATTERN.test(showId)) {
    return { error: INVALID_SHOW_ERROR };
  }
  if (!isShowStatus(status)) {
    return { error: INVALID_STATUS_ERROR };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { data: updatedShow, error } = await supabase
    .from('user_shows')
    .update({ status })
    .eq('id', showId)
    .eq('user_id', user.id)
    .select('tmdb_show_id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!updatedShow) return { error: SHOW_UPDATE_ERROR };
  revalidatePath('/library');
  revalidatePath(`/shows/${updatedShow.tmdb_show_id}`);
  return { success: true };
}

export async function removeShow(showId: string) {
  if (typeof showId !== 'string' || !UUID_PATTERN.test(showId)) {
    return { error: INVALID_SHOW_ERROR };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { data: removedShow, error } = await supabase
    .from('user_shows')
    .delete()
    .eq('id', showId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (error) return { error: error.message };
  if (!removedShow) return { error: SHOW_REMOVE_ERROR };
  revalidatePath('/library');
  return { success: true };
}

// EPISODE ACTIONS
export async function toggleEpisode(input: ToggleEpisodeInput) {
  const data = parseToggleEpisodeInput(input);
  if (!data) return { error: INVALID_EPISODE_ERROR };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  // Sahiplik doğrula
  const { data: ownerCheck } = await supabase
    .from('user_shows')
    .select('id')
    .eq('id', data.userShowId)
    .eq('user_id', user.id)
    .single();

  if (!ownerCheck) return { error: 'Bu dizi sizin kütüphanenizde değil' };

  if (data.isWatched) {
    // İzlenmemiş olarak işaretle (sil)
    const { error } = await supabase
      .from('user_episodes')
      .delete()
      .eq('user_show_id', data.userShowId)
      .eq('season_number', data.seasonNumber)
      .eq('episode_number', data.episodeNumber);

    if (error) return { error: error.message };
  } else {
    // İzlenmiş olarak işaretle (ekle)
    const { error } = await supabase.from('user_episodes').insert({
      user_show_id: data.userShowId,
      season_number: data.seasonNumber,
      episode_number: data.episodeNumber,
    });

    if (error) return { error: error.message };
  }

  revalidatePath('/library');
  revalidatePath(`/shows/${data.tmdbShowId}`);
  return { success: true };
}
