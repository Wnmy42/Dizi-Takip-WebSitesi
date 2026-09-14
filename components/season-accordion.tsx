'use client';

import { useRef, useState } from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { ChevronDown, Loader2, RotateCcw } from 'lucide-react';
import { EpisodeList } from '@/components/episode-list';
import { Button } from '@/components/ui/button';
import { SeasonDetailsLoader } from '@/lib/tmdb/season-loader';
import type { TMDBSeason, TMDBSeasonDetail } from '@/lib/tmdb/types';

interface SeasonAccordionProps {
  seasons: TMDBSeason[];
  showId: number;
  userShowId: string | null;
  watchedEpisodeKeys: string[];
}

type SeasonLoadState =
  | { status: 'loading' }
  | { status: 'success'; season: TMDBSeasonDetail }
  | { status: 'error'; message: string };

function seasonKey(showId: number, seasonNumber: number): string {
  return `${showId}:${seasonNumber}`;
}

export function SeasonEpisodeContent({
  season,
  showId,
  userShowId,
  watchedEpisodeKeys,
}: {
  season: TMDBSeasonDetail;
  showId: number;
  userShowId: string | null;
  watchedEpisodeKeys: string[];
}) {
  if (season.episodes.length === 0) {
    return <p className="text-sm text-muted-foreground">Bu sezonda bölüm bilgisi bulunamadı.</p>;
  }

  if (userShowId) {
    return (
      <EpisodeList
        season={season}
        userShowId={userShowId}
        tmdbShowId={showId}
        watchedEpisodeKeys={new Set(watchedEpisodeKeys)}
      />
    );
  }

  return (
    <div className="space-y-1">
      {season.episodes.map((episode) => (
        <div key={episode.id} className="flex items-center gap-3 p-2 text-sm">
          <span className="text-muted-foreground w-8">B{episode.episode_number}</span>
          <span className="flex-1 truncate">{episode.name}</span>
          {episode.runtime && (
            <span className="text-muted-foreground text-xs">{episode.runtime}dk</span>
          )}
        </div>
      ))}
    </div>
  );
}

export function SeasonAccordion({
  seasons,
  showId,
  userShowId,
  watchedEpisodeKeys,
}: SeasonAccordionProps) {
  const loaderRef = useRef<SeasonDetailsLoader | null>(null);
  const [loadStates, setLoadStates] = useState<Record<string, SeasonLoadState>>({});

  if (!loaderRef.current) {
    loaderRef.current = new SeasonDetailsLoader();
  }

  async function loadSeason(seasonNumber: number) {
    const key = seasonKey(showId, seasonNumber);

    setLoadStates((current) => {
      if (current[key]?.status === 'success') return current;
      return { ...current, [key]: { status: 'loading' } };
    });

    try {
      const season = await loaderRef.current!.load(showId, seasonNumber);
      setLoadStates((current) => ({
        ...current,
        [key]: { status: 'success', season },
      }));
    } catch (error) {
      setLoadStates((current) => ({
        ...current,
        [key]: {
          status: 'error',
          message: error instanceof Error ? error.message : 'Sezon bölümleri yüklenemedi.',
        },
      }));
    }
  }

  function handleOpenSeasons(openSeasonNumbers: number[]) {
    openSeasonNumbers.forEach((seasonNumber) => {
      if (!loadStates[seasonKey(showId, seasonNumber)]) {
        void loadSeason(seasonNumber);
      }
    });
  }

  return (
    <Accordion.Root<number>
      multiple
      onValueChange={handleOpenSeasons}
      className="space-y-3"
    >
      {seasons.map((season) => {
        const state = loadStates[seasonKey(showId, season.season_number)];
        const triggerId = `season-trigger-${showId}-${season.season_number}`;
        const panelId = `season-panel-${showId}-${season.season_number}`;

        return (
          <Accordion.Item
            key={season.id}
            value={season.season_number}
            className="overflow-hidden rounded-lg border"
          >
            <Accordion.Header>
              <Accordion.Trigger
                id={triggerId}
                aria-controls={panelId}
                className="group flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{season.name}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {season.episode_count} bölüm
                    {season.air_date
                      ? ` · ${new Date(season.air_date).toLocaleDateString('tr-TR')}`
                      : ''}
                  </span>
                  {season.overview && (
                    <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
                      {season.overview}
                    </span>
                  )}
                </span>
                <ChevronDown className="mt-1 size-5 shrink-0 transition-transform group-data-panel-open:rotate-180" />
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel
              id={panelId}
              aria-labelledby={triggerId}
              className="border-t p-4"
            >
              {!state || state.status === 'loading' ? (
                <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Bölümler yükleniyor…
                </div>
              ) : state.status === 'error' ? (
                <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-destructive">
                  <span>{state.message}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void loadSeason(season.season_number)}
                  >
                    <RotateCcw className="size-4" />
                    Tekrar dene
                  </Button>
                </div>
              ) : (
                <SeasonEpisodeContent
                  season={state.season}
                  showId={showId}
                  userShowId={userShowId}
                  watchedEpisodeKeys={watchedEpisodeKeys}
                />
              )}
            </Accordion.Panel>
          </Accordion.Item>
        );
      })}
    </Accordion.Root>
  );
}
