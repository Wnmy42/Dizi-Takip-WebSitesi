import Image from 'next/image';
import { notFound } from 'next/navigation';
import { Star, Calendar, Tv } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddShowButton } from '@/components/add-show-button';
import { EpisodeList } from '@/components/episode-list';
import { ProgressBar } from '@/components/progress-bar';
import { createClient } from '@/lib/supabase/server';
import { getBackdropUrl, getPosterUrl, getShowDetails, getSeasonDetails } from '@/lib/tmdb/client';

interface ShowDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ShowDetailPage({ params }: ShowDetailPageProps) {
  const { id } = await params;
  const showId = Number(id);

  if (isNaN(showId)) notFound();

  let show;
  try {
    show = await getShowDetails(showId);
  } catch {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  let isInLibrary = false;
  if (user) {
    const { data } = await supabase
      .from('user_shows')
      .select('id')
      .eq('user_id', user.id)
      .eq('tmdb_show_id', showId)
      .single();
    isInLibrary = !!data;
  }

  // Kullanıcı kendi bölüm ilerlemesini çek
  let userShow: { id: string; total_episodes: number } | null = null;
  let watchedEpisodeKeys = new Set<string>();

  if (user) {
    const { data: userShowData } = await supabase
      .from('user_shows')
      .select('id, total_episodes')
      .eq('user_id', user.id)
      .eq('tmdb_show_id', showId)
      .single();

    if (userShowData) {
      userShow = userShowData;
      const { data: episodes } = await supabase
        .from('user_episodes')
        .select('season_number, episode_number')
        .eq('user_show_id', userShowData.id);

      episodes?.forEach((ep) => {
        watchedEpisodeKeys.add(`S${ep.season_number}E${ep.episode_number}`);
      });
    }
  }

  const backdropUrl = getBackdropUrl(show.backdrop_path, 'w1280');
  const posterUrl = getPosterUrl(show.poster_path, 'w342');

  return (
    <main>
      {/* Backdrop */}
      <div className="relative h-64 md:h-96 w-full overflow-hidden">
        <Image
          src={backdropUrl}
          alt={show.name}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
      </div>

      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-6 -mt-24 md:-mt-32 relative">
          {/* Poster */}
          <div className="w-36 md:w-48 shrink-0 rounded-lg overflow-hidden shadow-xl border">
            <Image
              src={posterUrl}
              alt={show.name}
              width={192}
              height={288}
              className="w-full h-auto"
            />
          </div>

          {/* Info */}
          <div className="pt-4 md:pt-28 flex-1">
            <h1 className="text-3xl font-bold">{show.name}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
              {show.first_air_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(show.first_air_date).getFullYear()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {show.vote_average.toFixed(1)}
              </span>
              {show.number_of_seasons && (
                <span className="flex items-center gap-1">
                  <Tv className="h-4 w-4" />
                  {show.number_of_seasons} sezon
                </span>
              )}
              {show.status && <Badge variant="outline">{show.status}</Badge>}
            </div>

            {show.genres && show.genres.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {show.genres.map((g) => (
                  <Badge key={g.id} variant="secondary">{g.name}</Badge>
                ))}
              </div>
            )}

            {userShow && userShow.total_episodes > 0 && (
              <div className="mt-3 w-full max-w-xs">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{watchedEpisodeKeys.size} / {userShow.total_episodes} bölüm</span>
                  <span>{Math.round((watchedEpisodeKeys.size / userShow.total_episodes) * 100)}%</span>
                </div>
                <ProgressBar value={(watchedEpisodeKeys.size / userShow.total_episodes) * 100} />
              </div>
            )}

            {user && (
              <div className="mt-4">
                <AddShowButton show={show} isInLibrary={isInLibrary} />
              </div>
            )}

            {show.overview && (
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-2xl">
                {show.overview}
              </p>
            )}
          </div>
        </div>

        {/* Seasons */}
        {show.seasons && show.seasons.length > 0 && (
          <section className="mt-10 mb-10">
            <h2 className="text-xl font-bold mb-4">Sezonlar</h2>
            <div className="space-y-8">
              {await Promise.all(
                show.seasons
                  .filter((s) => s.season_number > 0)
                  .map(async (season) => {
                    const detail = await getSeasonDetails(show.id, season.season_number);
                    return (
                      <div key={season.id} className="border rounded-lg p-4">
                        {userShow ? (
                          <EpisodeList
                            season={detail}
                            userShowId={userShow.id}
                            watchedEpisodeKeys={watchedEpisodeKeys}
                          />
                        ) : (
                          <div>
                            <h3 className="font-semibold mb-3">{season.name}</h3>
                            <div className="space-y-1">
                              {detail.episodes.map((ep) => (
                                <div key={ep.id} className="flex items-center gap-3 p-2 text-sm">
                                  <span className="text-muted-foreground w-8">B{ep.episode_number}</span>
                                  <span className="flex-1 truncate">{ep.name}</span>
                                  {ep.runtime && <span className="text-muted-foreground text-xs">{ep.runtime}dk</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}