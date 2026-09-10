'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toggleEpisode } from '@/lib/supabase/actions';
import type { TMDBSeasonDetail } from '@/lib/tmdb/types';

interface EpisodeListProps {
  season: TMDBSeasonDetail;
  userShowId: string;
  tmdbShowId: number;
  watchedEpisodeKeys: Set<string>; // "S{season}E{ep}" formatında
}

function EpisodeRow({
  episode,
  userShowId,
  tmdbShowId,
  seasonNumber,
  isWatched,
}: {
  episode: TMDBSeasonDetail['episodes'][number];
  userShowId: string;
  tmdbShowId: number;
  seasonNumber: number;
  isWatched: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleEpisode({
        userShowId,
        tmdbShowId,
        seasonNumber,
        episodeNumber: episode.episode_number,
        isWatched,
      });
      if (result?.error) {
        setError(result.error);
      }
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
      {error && <span role="alert" aria-live="polite" className="text-xs text-destructive">{error}</span>}
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

export function EpisodeList({ season, userShowId, tmdbShowId, watchedEpisodeKeys }: EpisodeListProps) {
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
            tmdbShowId={tmdbShowId}
            seasonNumber={season.season_number}
            isWatched={watchedEpisodeKeys.has(`S${season.season_number}E${ep.episode_number}`)}
          />
        ))}
      </div>
    </div>
  );
}
