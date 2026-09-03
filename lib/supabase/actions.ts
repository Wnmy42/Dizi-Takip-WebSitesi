'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { ShowStatus } from '@/lib/supabase/types';

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

  const { error } = await supabase.from('user_shows').upsert({
    user_id: user.id,
    ...data,
  }, { onConflict: 'user_id,tmdb_show_id' });

  if (error) return { error: error.message };
  revalidatePath('/library');
  return { success: true };
}

export async function updateShowStatus(showId: string, status: ShowStatus) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_shows')
    .update({ status })
    .eq('id', showId);

  if (error) return { error: error.message };
  revalidatePath('/library');
  return { success: true };
}

export async function removeShow(showId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from('user_shows')
    .delete()
    .eq('id', showId);

  if (error) return { error: error.message };
  revalidatePath('/library');
  return { success: true };
}

// EPISODE ACTIONS
export async function toggleEpisode(data: {
  userShowId: string;
  seasonNumber: number;
  episodeNumber: number;
  isWatched: boolean;
}) {
  const supabase = await createClient();

  if (data.isWatched) {
    // İzlenmemiş olarak işaretle (sil)
    await supabase
      .from('user_episodes')
      .delete()
      .eq('user_show_id', data.userShowId)
      .eq('season_number', data.seasonNumber)
      .eq('episode_number', data.episodeNumber);
  } else {
    // İzlenmiş olarak işaretle (ekle)
    await supabase.from('user_episodes').insert({
      user_show_id: data.userShowId,
      season_number: data.seasonNumber,
      episode_number: data.episodeNumber,
    });
  }

  revalidatePath('/library');
  revalidatePath(`/shows/${data.userShowId}`);
  return { success: true };
}
