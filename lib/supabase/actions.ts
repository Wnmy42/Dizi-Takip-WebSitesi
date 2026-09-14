'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ShowStatus } from '@/lib/supabase/types';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INVALID_SHOW_ERROR = 'Geçersiz dizi kimliği';
const SHOW_UPDATE_ERROR = 'Dizi bulunamadı veya güncelleme yetkiniz yok';

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
export async function addShow(data: {
  tmdb_show_id: number;
  title: string;
  poster_path: string | null;
  total_episodes: number;
  status: ShowStatus;
}) {
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { error } = await supabase
    .from('user_shows')
    .update({ status })
    .eq('id', showId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/library');
  return { success: true };
}

export async function removeShow(showId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Giriş yapmalısınız' };

  const { error } = await supabase
    .from('user_shows')
    .delete()
    .eq('id', showId)
    .eq('user_id', user.id);

  if (error) return { error: error.message };
  revalidatePath('/library');
  return { success: true };
}

// EPISODE ACTIONS
export async function toggleEpisode(data: {
  userShowId: string;
  tmdbShowId: number;
  seasonNumber: number;
  episodeNumber: number;
  isWatched: boolean;
}) {
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
