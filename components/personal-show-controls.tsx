'use client';

import { useId, useState, useTransition } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setShowFavorite, setShowRating } from '@/lib/supabase/actions';

interface PersonalShowControlsProps {
  userShowId: string;
  initialIsFavorite: boolean;
  initialRating: number | null;
}

const RATINGS = Array.from({ length: 10 }, (_, index) => index + 1);
const FALLBACK_ERROR = 'İşlem tamamlanamadı. Tekrar deneyin.';

export function PersonalShowControls({
  userShowId,
  initialIsFavorite,
  initialRating,
}: PersonalShowControlsProps) {
  const serverSnapshot = `${userShowId}:${initialIsFavorite}:${initialRating ?? 'none'}`;

  return (
    <PersonalShowControlsState
      key={serverSnapshot}
      userShowId={userShowId}
      initialIsFavorite={initialIsFavorite}
      initialRating={initialRating}
    />
  );
}

function PersonalShowControlsState({
  userShowId,
  initialIsFavorite,
  initialRating,
}: PersonalShowControlsProps) {
  const ratingId = useId();
  const [isPending, startTransition] = useTransition();
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [rating, setRating] = useState(initialRating);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  function updateFavorite() {
    if (isPending) return;

    const desiredFavorite = !isFavorite;
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setShowFavorite(userShowId, desiredFavorite);
        if (result.error) {
          setError(result.error);
          return;
        }
        setIsFavorite(desiredFavorite);
        setFeedback(desiredFavorite ? 'Favorilere eklendi.' : 'Favorilerden çıkarıldı.');
      } catch {
        setError(FALLBACK_ERROR);
      }
    });
  }

  function updateRating(value: string) {
    if (isPending) return;

    const desiredRating = value === '' ? null : Number(value);
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      try {
        const result = await setShowRating(userShowId, desiredRating);
        if (result.error) {
          setError(result.error);
          return;
        }
        setRating(desiredRating);
        setFeedback(
          desiredRating === null
            ? 'Kişisel puanın temizlendi.'
            : `Kişisel puanın ${desiredRating}/10 olarak kaydedildi.`,
        );
      } catch {
        setError(FALLBACK_ERROR);
      }
    });
  }

  return (
    <div className="space-y-2" aria-busy={isPending}>
      <div className="flex flex-wrap items-end gap-2">
        <Button
          type="button"
          size="sm"
          variant={isFavorite ? 'secondary' : 'outline'}
          onClick={updateFavorite}
          disabled={isPending}
          aria-pressed={isFavorite}
          className="h-auto min-h-8 max-w-full whitespace-normal text-left"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Heart
              className={`h-4 w-4 ${isFavorite ? 'fill-current text-red-500' : ''}`}
              aria-hidden="true"
            />
          )}
          {isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        </Button>

        <div className="space-y-1">
          <label htmlFor={ratingId} className="block text-xs font-medium text-muted-foreground">
            Kişisel puanım
          </label>
          <select
            id={ratingId}
            value={rating ?? ''}
            onChange={(event) => updateRating(event.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">Puan yok</option>
            {RATINGS.map((value) => (
              <option key={value} value={value}>{value}/10</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {!error && feedback && (
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
          {feedback}
        </p>
      )}
    </div>
  );
}
