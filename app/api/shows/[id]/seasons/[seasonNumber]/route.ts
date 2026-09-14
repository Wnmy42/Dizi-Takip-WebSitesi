import { getSeasonDetails } from '@/lib/tmdb/client';
import { parseSeasonRequestParams } from '@/lib/tmdb/season-request';

interface SeasonRouteContext {
  params: Promise<{
    id: string;
    seasonNumber: string;
  }>;
}

export async function GET(_request: Request, context: SeasonRouteContext) {
  const { id, seasonNumber } = await context.params;
  const parsed = parseSeasonRequestParams(id, seasonNumber);

  if (!parsed) {
    return Response.json(
      { error: 'Geçersiz dizi veya sezon numarası.' },
      { status: 400 },
    );
  }

  try {
    const season = await getSeasonDetails(parsed.showId, parsed.seasonNumber);
    return Response.json(season);
  } catch {
    return Response.json(
      { error: 'Sezon bölümleri yüklenemedi.' },
      { status: 502 },
    );
  }
}
