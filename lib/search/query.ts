export const MIN_SEARCH_QUERY_LENGTH = 2;
export const MAX_SEARCH_QUERY_LENGTH = 100;
export const MAX_SEARCH_PAGE = 500;

export type ParsedSearchQuery =
  | { ok: true; query: string }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'invalid_characters' };

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/;

export function normalizeSearchQuery(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export function parseSearchQuery(value: unknown): ParsedSearchQuery {
  if (typeof value === 'string' && CONTROL_CHARACTER_PATTERN.test(value)) {
    return { ok: false, reason: 'invalid_characters' };
  }

  const query = normalizeSearchQuery(value);

  if (query.length === 0) return { ok: false, reason: 'empty' };
  if (query.length < MIN_SEARCH_QUERY_LENGTH) return { ok: false, reason: 'too_short' };
  if (query.length > MAX_SEARCH_QUERY_LENGTH) return { ok: false, reason: 'too_long' };

  return { ok: true, query };
}

export function parseSearchPage(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return null;
  if (value < 1 || value > MAX_SEARCH_PAGE) return null;
  return value;
}

export function getSearchQueryError(reason: Exclude<ParsedSearchQuery, { ok: true }>['reason']): string {
  switch (reason) {
    case 'too_short':
      return `Arama en az ${MIN_SEARCH_QUERY_LENGTH} karakter olmalı.`;
    case 'too_long':
      return `Arama en fazla ${MAX_SEARCH_QUERY_LENGTH} karakter olabilir.`;
    case 'empty':
      return 'Aramak için bir dizi adı yazın.';
    case 'invalid_characters':
      return 'Arama geçersiz karakterler içeriyor.';
  }
}
