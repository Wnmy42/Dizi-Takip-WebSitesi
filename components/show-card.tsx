import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPosterUrl } from '@/lib/tmdb/client';
import type { TMDBShow } from '@/lib/tmdb/types';

interface ShowCardProps {
  show: TMDBShow;
}

export function ShowCard({ show }: ShowCardProps) {
  const posterUrl = getPosterUrl(show.poster_path, 'w342');

  return (
    <Link href={`/shows/${show.id}`}>
      <Card className="group overflow-hidden transition-transform hover:scale-105 cursor-pointer h-full">
        <div className="relative aspect-[2/3] overflow-hidden bg-muted">
          <Image
            src={posterUrl}
            alt={show.name}
            fill
            className="object-cover transition-opacity group-hover:opacity-90"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="flex items-center gap-1 text-xs font-semibold">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {show.vote_average.toFixed(1)}
            </Badge>
          </div>
        </div>
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{show.name}</h3>
          {show.first_air_date && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(show.first_air_date).getFullYear()}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
