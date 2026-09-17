// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { replace, useSearchParams } = vi.hoisted(() => ({
  replace: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  useSearchParams,
}));

import { SearchBar } from '@/components/search-bar';

describe('SearchBar', () => {
  beforeEach(() => {
    useSearchParams.mockReturnValue(new URLSearchParams('page=4&genre=drama'));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not navigate while the user is typing', () => {
    render(<SearchBar />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Dizi ara' }), {
      target: { value: 'Breaking Bad' },
    });

    expect(replace).not.toHaveBeenCalled();
  });

  it('normalizes the query and resets pagination on form submit', () => {
    render(<SearchBar />);
    const input = screen.getByRole('searchbox', { name: 'Dizi ara' });

    fireEvent.change(input, { target: { value: '  Better   Call Saul  ' } });
    fireEvent.submit(input.closest('form')!);

    expect(replace).toHaveBeenCalledWith('/discover?genre=drama&q=Better+Call+Saul');
  });

  it('clears the search on all-whitespace submit without a dangling question mark', () => {
    useSearchParams.mockReturnValue(new URLSearchParams('q=Lost&page=2'));
    render(<SearchBar defaultValue="Lost" />);

    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    expect(replace).toHaveBeenCalledWith('/discover');
  });

  it('does not trigger navigation on typing alone, even after a long wait', () => {
    vi.useFakeTimers();
    render(<SearchBar />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Dizi ara' }), {
      target: { value: 'Full' },
    });
    vi.advanceTimersByTime(5000);

    expect(replace).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('submits a partial query that TMDB can match against', () => {
    render(<SearchBar />);
    const input = screen.getByRole('searchbox', { name: 'Dizi ara' });

    fireEvent.change(input, { target: { value: 'Full' } });
    fireEvent.submit(input.closest('form')!);

    expect(replace).toHaveBeenCalledWith('/discover?genre=drama&q=Full');
  });

  it('enforces the client-side maximum length', () => {
    render(<SearchBar />);
    expect(screen.getByRole('searchbox').getAttribute('maxlength')).toBe('100');
  });
});
