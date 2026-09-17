import { consumeSearchRateLimit } from '@/lib/search/rate-limit';
import {
  getSearchQueryError,
  parseSearchPage,
  parseSearchQuery,
} from '@/lib/search/query';
import { searchShows, TMDBRequestError } from '@/lib/tmdb/client';

const RATE_LIMIT_MESSAGE = 'Çok fazla arama yaptınız. Lütfen biraz sonra tekrar deneyin.';
const UPSTREAM_RATE_LIMIT_MESSAGE = 'Dizi servisi şu anda yoğun. Lütfen biraz sonra tekrar deneyin.';
const SEARCH_UNAVAILABLE_MESSAGE = 'Arama şu anda kullanılamıyor. Lütfen biraz sonra tekrar deneyin.';
const MAX_SEARCH_BODY_BYTES = 2_048;
const MAX_PUBLIC_RETRY_AFTER_SECONDS = 300;

type SearchRequestBody = {
  query?: unknown;
  page?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readBoundedJson(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; tooLarge: boolean }
> {
  const declaredLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_SEARCH_BODY_BYTES) {
    return { ok: false, tooLarge: true };
  }
  if (!request.body) return { ok: false, tooLarge: false };

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let byteLength = 0;
  let text = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_SEARCH_BODY_BYTES) {
        await reader.cancel();
        return { ok: false, tooLarge: true };
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, tooLarge: false };
  } finally {
    reader.releaseLock();
  }
}

function errorResponse(
  error: string,
  code: string,
  status: number,
  retryAfterSeconds?: number,
) {
  const normalizedRetryAfter = typeof retryAfterSeconds === 'number'
    && Number.isFinite(retryAfterSeconds)
    ? Math.min(MAX_PUBLIC_RETRY_AFTER_SECONDS, Math.max(1, Math.ceil(retryAfterSeconds)))
    : undefined;
  const headers = normalizedRetryAfter
    ? { 'Retry-After': String(normalizedRetryAfter) }
    : undefined;

  return Response.json(
    { error, code, retryAfterSeconds: normalizedRetryAfter ?? null },
    { status, headers },
  );
}

export async function POST(request: Request) {
  const parsedBody = await readBoundedJson(request);
  if (!parsedBody.ok) {
    if (parsedBody.tooLarge) {
      return errorResponse('Arama isteği çok büyük.', 'request_too_large', 413);
    }
    return errorResponse('Geçersiz arama isteği.', 'invalid_request', 400);
  }
  if (!isRecord(parsedBody.value)) {
    return errorResponse('Geçersiz arama isteği.', 'invalid_request', 400);
  }
  const body: SearchRequestBody = parsedBody.value;

  const parsedQuery = parseSearchQuery(body.query);
  if (!parsedQuery.ok) {
    return errorResponse(getSearchQueryError(parsedQuery.reason), 'invalid_query', 400);
  }

  const page = parseSearchPage(body.page);
  if (page === null) {
    return errorResponse('Geçersiz arama sayfası.', 'invalid_page', 400);
  }

  const rateLimit = await consumeSearchRateLimit(request.headers);
  if (rateLimit.status === 'unavailable') {
    return errorResponse(SEARCH_UNAVAILABLE_MESSAGE, 'rate_limit_unavailable', 503);
  }
  if (rateLimit.status === 'denied') {
    return errorResponse(
      RATE_LIMIT_MESSAGE,
      'rate_limited',
      429,
      rateLimit.retryAfterSeconds,
    );
  }

  try {
    const data = await searchShows(parsedQuery.query, page);
    return Response.json(data);
  } catch (error) {
    if (error instanceof TMDBRequestError && error.kind === 'rate_limited') {
      const retryAfterSeconds = error.retryAfterSeconds ?? 60;
      return errorResponse(
        UPSTREAM_RATE_LIMIT_MESSAGE,
        'upstream_rate_limited',
        503,
        retryAfterSeconds,
      );
    }

    return errorResponse(SEARCH_UNAVAILABLE_MESSAGE, 'upstream_unavailable', 502);
  }
}
