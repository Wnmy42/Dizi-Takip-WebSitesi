'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShowCard } from '@/components/show-card';
import type { TMDBPaginatedResponse, TMDBShow } from '@/lib/tmdb/types';

type SearchState =
  | { status: 'loading' }
  | { status: 'success'; data: TMDBPaginatedResponse<TMDBShow> }
  | { status: 'error'; message: string; retryAfterSeconds: number | null };

const FALLBACK_ERROR = 'Arama şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.';

export function SearchResults({ query, page }: { query: string; page: number }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SearchState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, page }),
          signal: controller.signal,
        });
        const payload = await response.json() as Partial<TMDBPaginatedResponse<TMDBShow>> & {
          error?: unknown;
          retryAfterSeconds?: unknown;
        };

        if (!response.ok) {
          setState({
            status: 'error',
            message: typeof payload.error === 'string' ? payload.error : FALLBACK_ERROR,
            retryAfterSeconds: typeof payload.retryAfterSeconds === 'number'
              ? payload.retryAfterSeconds
              : null,
          });
          return;
        }

        if (!Array.isArray(payload.results)
          || typeof payload.page !== 'number'
          || typeof payload.total_pages !== 'number'
          || typeof payload.total_results !== 'number') {
          setState({ status: 'error', message: FALLBACK_ERROR, retryAfterSeconds: null });
          return;
        }

        setState({
          status: 'success',
          data: payload as TMDBPaginatedResponse<TMDBShow>,
        });
      } catch (error) {
        if ((error as { name?: unknown }).name === 'AbortError') return;
        setState({ status: 'error', message: FALLBACK_ERROR, retryAfterSeconds: null });
      }
    }

    void load();
    return () => controller.abort();
  }, [attempt, page, query]);

  if (state.status === 'loading') {
    return (
      <div
        aria-label="Arama sonuçları yükleniyor"
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <div key={index} className="aspect-[2/3] animate-pulse bg-muted rounded-lg" />
        ))}
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p role="alert">{state.message}</p>
        {state.retryAfterSeconds !== null && (
          <p className="mt-2 text-sm">Yaklaşık {state.retryAfterSeconds} saniye sonra tekrar deneyebilirsiniz.</p>
        )}
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={() => {
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        >
          Tekrar dene
        </Button>
      </div>
    );
  }

  if (state.data.results.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">Sonuç bulunamadı.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {state.data.results.map((show) => <ShowCard key={show.id} show={show} />)}
      </div>
      <p className="text-center text-sm text-muted-foreground mt-4">
        {state.data.total_results.toLocaleString('tr-TR')} sonuç · Sayfa {state.data.page} / {state.data.total_pages}
      </p>
    </>
  );
}
