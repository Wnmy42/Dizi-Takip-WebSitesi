import { redirect } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getPosterUrl } from '@/lib/tmdb/client';
import { getStatusLabel } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProgressBar } from '@/components/progress-bar';
import { StatusSelector } from '@/components/status-selector';
import type { ShowStatus } from '@/lib/supabase/types';

const STATUSES: ShowStatus[] = ['watching', 'plan_to_watch', 'completed', 'dropped'];

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: shows } = await supabase
    .from('user_shows')
    .select('*, user_episodes(count)')
    .order('updated_at', { ascending: false });

  const grouped = STATUSES.reduce<Record<ShowStatus, typeof shows>>((acc, s) => {
    acc[s] = shows?.filter((show) => show.status === s) ?? [];
    return acc;
  }, {} as Record<ShowStatus, typeof shows>);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Kütüphanem</h1>
      <Tabs defaultValue="watching">
        <TabsList className="mb-6">
          {STATUSES.map((s) => (
            <TabsTrigger key={s} value={s}>
              {getStatusLabel(s)}
              {grouped[s] && grouped[s]!.length > 0 && (
                <span className="ml-1.5 text-xs opacity-70">({grouped[s]!.length})</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        {STATUSES.map((s) => (
          <TabsContent key={s} value={s}>
            {grouped[s]?.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <p>Bu kategoride dizi yok.</p>
                <Link href="/discover" className="text-primary hover:underline text-sm mt-2 block">
                  Dizi keşfet →
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {grouped[s]?.map((show) => (
                  <div key={show.id} className="group">
                    <Link href={`/shows/${show.tmdb_show_id}`}>
                      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                        <Image
                          src={getPosterUrl(show.poster_path, 'w342')}
                          alt={show.title}
                          fill
                          className="object-cover transition-opacity group-hover:opacity-80"
                        />
                      </div>
                      <p className="text-sm font-medium line-clamp-2 hover:underline">{show.title}</p>
                    </Link>
                    <div className="mt-2">
                      <StatusSelector showId={show.id} currentStatus={show.status as ShowStatus} />
                    </div>
                    {show.total_episodes > 0 && (() => {
                      const watchedCount = (show as typeof show & { user_episodes: [{ count: number }] }).user_episodes?.[0]?.count ?? 0;
                      const pct = Math.round((watchedCount / show.total_episodes) * 100);
                      return (
                        <div className="mt-2">
                          <ProgressBar value={pct} />
                          <p className="text-xs text-muted-foreground mt-1">{watchedCount}/{show.total_episodes} bölüm</p>
                        </div>
                      );
                    })()}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </main>
  );
}
