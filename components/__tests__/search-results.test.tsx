// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/show-card', () => ({
  ShowCard: ({ show }: { show: { name: string } }) => <div>{show.name}</div>,
}));

import { SearchResults } from '@/components/search-results';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('SearchResults', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts the normalized request and renders successful results', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      page: 1,
      results: [{ id: 1, name: 'Lost' }],
      total_pages: 2,
      total_results: 21,
    }));

    render(<SearchResults query="Lost" page={1} />);

    expect(await screen.findByText('Lost')).toBeTruthy();
    expect(screen.getByText('21 sonuç · Sayfa 1 / 2')).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith('/api/search', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ query: 'Lost', page: 1 }),
    }));
  });

  it('shows a controlled rate-limit message and retry delay', async () => {
    vi.mocked(fetch).mockImplementation(() => jsonResponse({
      error: 'Çok fazla arama yaptınız. Lütfen biraz sonra tekrar deneyin.',
      retryAfterSeconds: 42,
    }, 429));

    render(<SearchResults query="Lost" page={1} />);

    expect((await screen.findByRole('alert')).textContent).toContain('Çok fazla arama yaptınız.');
    expect(screen.getByText('Yaklaşık 42 saniye sonra tekrar deneyebilirsiniz.')).toBeTruthy();
  });

  it('uses a stable fallback for malformed failures and can retry', async () => {
    vi.mocked(fetch)
      .mockImplementationOnce(() => jsonResponse({ internal: 'secret' }, 500))
      .mockImplementationOnce(() => jsonResponse({
        page: 1,
        results: [],
        total_pages: 0,
        total_results: 0,
      }));

    render(<SearchResults query="Lost" page={1} />);

    expect((await screen.findByRole('alert')).textContent).toContain('Arama şu anda kullanılamıyor.');
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));

    expect(await screen.findByText('Sonuç bulunamadı.')).toBeTruthy();
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
