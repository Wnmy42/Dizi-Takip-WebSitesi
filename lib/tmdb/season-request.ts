export interface SeasonRequestParams {
  showId: number;
  seasonNumber: number;
}

function parsePositiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseSeasonRequestParams(
  showId: string,
  seasonNumber: string,
): SeasonRequestParams | null {
  const parsedShowId = parsePositiveInteger(showId);
  const parsedSeasonNumber = parsePositiveInteger(seasonNumber);

  if (parsedShowId === null || parsedSeasonNumber === null) return null;

  return {
    showId: parsedShowId,
    seasonNumber: parsedSeasonNumber,
  };
}
