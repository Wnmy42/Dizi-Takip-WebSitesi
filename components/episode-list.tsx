'use client';

import { useTransition } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toggleEpisode } from '@/lib/supabase/actions';
import type { TMDBSeasonDetail } from '@/lib/tmdb/types';

interface EpisodeListProps {
  season: TMDBSeasonDetail;
  userShowId: string;
  watchedEpisodeKeys: Set<string>; // "S{season}E{ep}" formatında
}

function EpisodeRow({
  episode,
  userShowId,
  seasonNumber,
  isWatched,
}: {
  episode: TMDBSeasonDetail['episodes'][number];
  userShowId: string;
  seasonNumber: number;
  isWatched: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleEpisode({
        userShowId,
        seasonNumber,
        episodeNumber: episode.episode_number,
        isWatched,
      });
    });
  }

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
      isWatched ? 'bg-primary/10' : 'hover:bg-muted'
    }`}>
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
          isWatched
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground hover:border-primary'
        }`}
        aria-label={isWatched ? 'Bölümü izlenmedi olarak işaretle' : 'Bölümü izlendi olarak işaretle'}
      >
        {isWatched && <Check className="h-3 w-3" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">
            B{episode.episode_number}
          </span>
          <span className="text-sm font-medium truncate">{episode.name}</span>
        </div>
        {episode.air_date && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(episode.air_date).toLocaleDateString('tr-TR')}
          </p>
        )}
      </div>
      {episode.runtime && (
        <Badge variant="outline" className="text-xs shrink-0">
          {episode.runtime}dk
        </Badge>
      )}
    </div>
  );
}

export function EpisodeList({ season, userShowId, watchedEpisodeKeys }: EpisodeListProps) {
  const watchedCount = season.episodes.filter(
    (ep) => watchedEpisodeKeys.has(`S${season.season_number}E${ep.episode_number}`)
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{season.name}</h3>
        <span className="text-sm text-muted-foreground">
          {watchedCount} / {season.episodes.length} bölüm
        </span>
      </div>
      <div className="space-y-1">
        {season.episodes.map((ep) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            userShowId={userShowId}
            seasonNumber={season.season_number}
            isWatched={watchedEpisodeKeys.has(`S${season.season_number}E${ep.episode_number}`)}
          />
        ))}
      </div>
    </div>
  );
}
