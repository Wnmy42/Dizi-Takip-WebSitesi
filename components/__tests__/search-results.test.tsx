// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/show-card', () => ({
  ShowCard: ({ show }: { show: { name: string } }) => <div>{show.name}</div>,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { SearchResults } from '@/components/search-results';

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function searchPayload({
  page = 1,
  total_pages = 1,
  total_results = 1,
  results = [{ id: 1, name: 'Lost' }],
}: {
  page?: number;
  total_pages?: number;
  total_results?: number;
  results?: Array<{ id: number; name: string }>;
} = {}) {
  return { page, results, total_pages, total_results };
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

  describe('pagination controls', () => {
    it('disables prev on first page and enables next when more pages exist', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        jsonResponse(searchPayload({ page: 1, total_pages: 3, total_results: 55 })),
      );

      render(<SearchResults query="Lost" page={1} />);

      await screen.findByText('Lost');
      const nav = screen.getByRole('navigation', { name: 'Arama sonuçları sayfalama' });

      const prevButton = nav.querySelector('button[disabled]');
      expect(prevButton?.textContent).toContain('Önceki');

      const nextLink = nav.querySelector('a[href]') as HTMLAnchorElement;
      expect(nextLink.textContent).toContain('Sonraki');
      expect(nextLink.getAttribute('href')).toBe('/discover?q=Lost&page=2');
    });

    it('disables next on last page and enables prev', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        jsonResponse(searchPayload({ page: 3, total_pages: 3, total_results: 55 })),
      );

      render(<SearchResults query="Lost" page={3} />);

      await screen.findByText('Lost');
      const nav = screen.getByRole('navigation', { name: 'Arama sonuçları sayfalama' });

      const prevLink = nav.querySelector('a[href]') as HTMLAnchorElement;
      expect(prevLink.textContent).toContain('Önceki');
      expect(prevLink.getAttribute('href')).toBe('/discover?q=Lost&page=2');

      const nextButton = nav.querySelector('button[disabled]');
      expect(nextButton?.textContent).toContain('Sonraki');
    });

    it('enables both prev and next on a middle page', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        jsonResponse(searchPayload({ page: 2, total_pages: 5, total_results: 100 })),
      );

      render(<SearchResults query="Breaking Bad" page={2} />);

      await screen.findByText('Lost');
      const links = screen.getByRole('navigation', { name: 'Arama sonuçları sayfalama' }).querySelectorAll('a[href]');
      expect(links).toHaveLength(2);
      expect((links[0] as HTMLAnchorElement).getAttribute('href')).toBe('/discover?q=Breaking+Bad');
      expect((links[1] as HTMLAnchorElement).getAttribute('href')).toBe('/discover?q=Breaking+Bad&page=3');
    });

    it('omits page param from prev link when going back to page 1', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        jsonResponse(searchPayload({ page: 2, total_pages: 3, total_results: 55 })),
      );

      render(<SearchResults query="Lost" page={2} />);

      await screen.findByText('Lost');
      const nav = screen.getByRole('navigation', { name: 'Arama sonuçları sayfalama' });
      const prevLink = nav.querySelector('a[href]') as HTMLAnchorElement;
      expect(prevLink.getAttribute('href')).toBe('/discover?q=Lost');
    });

    it('does not show pagination nav when results fit on a single page', async () => {
      vi.mocked(fetch).mockImplementation(() =>
        jsonResponse(searchPayload({ page: 1, total_pages: 1, total_results: 3 })),
      );

      render(<SearchResults query="Lost" page={1} />);

      await screen.findByText('Lost');
      expect(screen.queryByRole('navigation', { name: 'Arama sonuçları sayfalama' })).toBeNull();
    });
  });
});
