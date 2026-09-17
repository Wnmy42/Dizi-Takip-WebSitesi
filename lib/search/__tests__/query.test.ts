import { describe, expect, it } from 'vitest';
import {
  MAX_SEARCH_QUERY_LENGTH,
  normalizeSearchQuery,
  parseSearchPage,
  parseSearchQuery,
} from '@/lib/search/query';

describe('search query validation', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeSearchQuery('  Better   Call Saul  ')).toBe('Better Call Saul');
    expect(parseSearchQuery('  Better   Call Saul  ')).toEqual({
      ok: true,
      query: 'Better Call Saul',
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['a', 'too_short'],
    ['x'.repeat(MAX_SEARCH_QUERY_LENGTH + 1), 'too_long'],
    ['Lost\u0000', 'invalid_characters'],
    ['Lost\n', 'invalid_characters'],
  ] as const)('rejects invalid query %j', (value, reason) => {
    expect(parseSearchQuery(value)).toEqual({ ok: false, reason });
  });

  it.each([0, -1, 1.5, 501, Number.NaN, '1', null])('rejects invalid page %j', (value) => {
    expect(parseSearchPage(value)).toBeNull();
  });

  it('accepts the supported page boundaries', () => {
    expect(parseSearchPage(1)).toBe(1);
    expect(parseSearchPage(500)).toBe(500);
  });
});
