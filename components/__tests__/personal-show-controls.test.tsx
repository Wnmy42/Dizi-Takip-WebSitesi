// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { setShowFavorite, setShowRating } = vi.hoisted(() => ({
  setShowFavorite: vi.fn(),
  setShowRating: vi.fn(),
}));

vi.mock('@/lib/supabase/actions', () => ({ setShowFavorite, setShowRating }));

import { PersonalShowControls } from '@/components/personal-show-controls';

const FIRST_SHOW_ID = '8d50c4a7-3ff8-47d6-bbe9-3b825b35ef2d';
const SECOND_SHOW_ID = '42ce475a-56bd-42a2-9b75-aa3b617b78b9';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  setShowFavorite.mockResolvedValue({ success: true });
  setShowRating.mockResolvedValue({ success: true });
});

afterEach(cleanup);

describe('PersonalShowControls', () => {
  it('labels the personal rating separately and renders the current server values', () => {
    render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite
        initialRating={8}
      />,
    );

    expect(screen.getByRole('button', { name: 'Favorilerden çıkar' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Kişisel puanım') as HTMLSelectElement).value).toBe('8');
  });

  it('submits an explicit favorite state once, disables both controls, and reports success', async () => {
    const request = deferred<{ success: true }>();
    setShowFavorite.mockReturnValue(request.promise);
    render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite={false}
        initialRating={6}
      />,
    );

    const favoriteButton = screen.getByRole('button', { name: 'Favorilere ekle' });
    fireEvent.click(favoriteButton);
    fireEvent.click(favoriteButton);

    expect(setShowFavorite).toHaveBeenCalledExactlyOnceWith(FIRST_SHOW_ID, true);
    expect(favoriteButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Kişisel puanım').hasAttribute('disabled')).toBe(true);

    request.resolve({ success: true });

    expect((await screen.findByRole('status')).textContent).toContain('Favorilere eklendi.');
    expect(screen.getByRole('button', { name: 'Favorilerden çıkar' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Kişisel puanım') as HTMLSelectElement).value).toBe('6');
  });

  it('keeps the previous value and shows a returned action error', async () => {
    setShowFavorite.mockResolvedValue({ error: 'Güncelleme reddedildi' });
    render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite={false}
        initialRating={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Favorilere ekle' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Güncelleme reddedildi');
    expect(screen.getByRole('button', { name: 'Favorilere ekle' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('updates and clears only the personal rating', async () => {
    render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite
        initialRating={7}
      />,
    );
    const ratingSelect = screen.getByLabelText('Kişisel puanım') as HTMLSelectElement;

    fireEvent.change(ratingSelect, { target: { value: '9' } });
    await waitFor(() => {
      expect(ratingSelect.disabled).toBe(false);
      expect(screen.getByRole('status').textContent).toContain('9/10');
    });
    expect(setShowRating).toHaveBeenLastCalledWith(FIRST_SHOW_ID, 9);
    expect(screen.getByRole('button', { name: 'Favorilerden çıkar' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.change(ratingSelect, { target: { value: '' } });
    await waitFor(() => {
      expect(ratingSelect.disabled).toBe(false);
      expect(screen.getByRole('status').textContent).toContain('temizlendi');
      expect(setShowRating).toHaveBeenLastCalledWith(FIRST_SHOW_ID, null);
      expect(ratingSelect.value).toBe('');
    });
  });

  it('surfaces rejected action promises as a retryable error', async () => {
    setShowRating.mockRejectedValue(new Error('network failed'));
    render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite={false}
        initialRating={null}
      />,
    );

    fireEvent.change(screen.getByLabelText('Kişisel puanım'), { target: { value: '4' } });

    expect((await screen.findByRole('alert')).textContent).toContain('İşlem tamamlanamadı. Tekrar deneyin.');
    expect((screen.getByLabelText('Kişisel puanım') as HTMLSelectElement).value).toBe('');
  });

  it('applies refreshed server values for the same show and clears stale feedback', async () => {
    setShowFavorite.mockResolvedValue({ error: 'Eski sunucu hatası' });
    const view = render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite={false}
        initialRating={3}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Favorilere ekle' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Eski sunucu hatası');

    view.rerender(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite
        initialRating={9}
      />,
    );

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('button', { name: 'Favorilerden çıkar' }).getAttribute('aria-pressed')).toBe('true');
    expect((screen.getByLabelText('Kişisel puanım') as HTMLSelectElement).value).toBe('9');
  });

  it('resets local feedback and values when a fresh server snapshot arrives', async () => {
    setShowFavorite.mockResolvedValue({ error: 'Eski dizi hatası' });
    const view = render(
      <PersonalShowControls
        userShowId={FIRST_SHOW_ID}
        initialIsFavorite={false}
        initialRating={null}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Favorilere ekle' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Eski dizi hatası');

    view.rerender(
      <PersonalShowControls
        userShowId={SECOND_SHOW_ID}
        initialIsFavorite
        initialRating={10}
      />,
    );

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(screen.getByRole('button', { name: 'Favorilerden çıkar' })).toBeTruthy();
    expect((screen.getByLabelText('Kişisel puanım') as HTMLSelectElement).value).toBe('10');
  });
});
