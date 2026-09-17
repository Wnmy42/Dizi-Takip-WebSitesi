// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    vi.useFakeTimers();
    useSearchParams.mockReturnValue(new URLSearchParams('page=4&genre=drama'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('debounces, normalizes the URL query and resets pagination', async () => {
    render(<SearchBar />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Dizi ara' }), {
      target: { value: '  Better   Call Saul  ' },
    });
    expect(replace).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(replace).toHaveBeenCalledWith('/discover?genre=drama&q=Better+Call+Saul');
  });

  it('removes an all-whitespace query without leaving a dangling question mark', async () => {
    useSearchParams.mockReturnValue(new URLSearchParams('q=Lost&page=2'));
    render(<SearchBar defaultValue="Lost" />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '   ' } });
    await act(() => vi.advanceTimersByTimeAsync(300));

    expect(replace).toHaveBeenCalledWith('/discover');
  });

  it('enforces the client-side maximum length', () => {
    render(<SearchBar />);
    expect(screen.getByRole('searchbox').getAttribute('maxlength')).toBe('100');
  });
});
