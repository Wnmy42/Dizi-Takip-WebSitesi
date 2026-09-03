import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getTrendingShows, getPopularShows, searchShows, getPosterUrl } from '@/lib/tmdb/client';
import { ShowCard } from '@/components/show-card';
import { SearchBar } from '@/components/search-bar';
import { ProgressBar } from '@/components/progress-bar';
import { createClient } from '@/lib/supabase/server';

interface DiscoverPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function ShowGrid({ query, page }: { query?: string; page: number }) {
  const data = query
    ? await searchShows(query, page)
    : await getPopularShows(page);

  if (data.results.length === 0) {
    return (
      <div className="col-span-full text-center py-16 text-muted-foreground">
        <p className="text-lg">Sonuç bulunamadı.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.results.map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground mt-4">
        {data.total_results.toLocaleString('tr-TR')} sonuç · Sayfa {data.page} / {data.total_pages}
      </p>
    </>
  );
}

async function TrendingSection() {
  const data = await getTrendingShows();
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold mb-4">Bu Hafta Trend</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {data.results.slice(0, 10).map((show) => (
          <ShowCard key={show.id} show={show} />
        ))}
      </div>
    </section>
  );
}

export default async function DiscoverPage({ searchParams }: DiscoverPageProps) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let continueWatching: Array<{
    id: string;
    tmdb_show_id: number;
    title: string;
    poster_path: string | null;
    watched: number;
    total: number;
  }> = [];

  if (user) {
    const { data } = await supabase
      .from('user_shows')
      .select('id, tmdb_show_id, title, poster_path, total_episodes, user_episodes(count)')
      .eq('status', 'watching')
      .order('updated_at', { ascending: false })
      .limit(6);

    continueWatching = (data ?? []).map((s) => ({
      id: s.id,
      tmdb_show_id: s.tmdb_show_id,
      title: s.title,
      poster_path: s.poster_path,
      watched: (s as typeof s & { user_episodes: [{ count: number }] }).user_episodes?.[0]?.count ?? 0,
      total: s.total_episodes,
    }));
  }

  const { q, page: pageStr } = await searchParams;
  const page = Number(pageStr ?? 1);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Keşfet</h1>
        <p className="text-muted-foreground mb-4">Yeni diziler bul, listene ekle.</p>
        <Suspense>
          <SearchBar defaultValue={q} />
        </Suspense>
      </div>

      {continueWatching.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Kaldığın Yerden Devam Et</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {continueWatching.map((show) => (
              <Link
                key={show.id}
                href={`/shows/${show.tmdb_show_id}`}
                className="shrink-0 w-28 group"
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                  <Image
                    src={getPosterUrl(show.poster_path, 'w185')}
                    alt={show.title}
                    fill
                    className="object-cover transition-opacity group-hover:opacity-80"
                  />
                </div>
                <p className="text-xs font-medium line-clamp-2 mb-1">{show.title}</p>
                {show.total > 0 && (
                  <>
                    <ProgressBar value={(show.watched / show.total) * 100} />
                    <p className="text-xs text-muted-foreground mt-0.5">{show.watched}/{show.total}</p>
                  </>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!q && (
        <Suspense fallback={<div className="h-48 animate-pulse bg-muted rounded-lg" />}>
          <TrendingSection />
        </Suspense>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4">
          {q ? `"${q}" için sonuçlar` : 'Popüler Diziler'}
        </h2>
        <Suspense
          key={`${q}-${page}`}
          fallback={
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] animate-pulse bg-muted rounded-lg" />
              ))}
            </div>
          }
        >
          <ShowGrid query={q} page={page} />
        </Suspense>
      </section>
    </main>
  );
}
