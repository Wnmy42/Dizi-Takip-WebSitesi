// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signIn } = vi.hoisted(() => ({
  signIn: vi.fn(),
}));

vi.mock('@/lib/supabase/actions', () => ({ signIn }));

// Stub useActionState to control state, action and isPending from tests.
let mockState: { error?: string } | undefined;
let mockPending: boolean;
const mockAction = vi.fn();

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: () => [mockState, mockAction, mockPending],
  };
});

import LoginPage from '@/app/(auth)/login/page';

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mockState = undefined;
  mockPending = false;
});

describe('login page', () => {
  it('renders the email and password fields with a submit button', () => {
    render(<LoginPage />);

    expect(screen.getByLabelText('E-posta')).toBeDefined();
    expect(screen.getByLabelText('Şifre')).toBeDefined();

    const submit = screen.getByRole('button', { name: 'Giriş Yap' });
    expect(submit).toBeDefined();
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the submit button and shows loading text while pending', () => {
    mockPending = true;
    render(<LoginPage />);

    const submit = screen.getByRole('button', { name: 'Giriş yapılıyor...' });
    expect(submit).toBeDefined();
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays the auth error message when state contains an error', () => {
    mockState = { error: 'Invalid login credentials' };
    render(<LoginPage />);

    expect(screen.getByText('Invalid login credentials')).toBeDefined();
  });

  it('does not display any error message when state is undefined', () => {
    render(<LoginPage />);

    expect(screen.queryByText(/Invalid/)).toBeNull();
  });

  it('links to the registration page', () => {
    render(<LoginPage />);

    const link = screen.getByRole('link', { name: 'Kayıt Ol' });
    expect(link.getAttribute('href')).toBe('/register');
  });

  it('links the logo to the discover page', () => {
    render(<LoginPage />);

    const logo = screen.getByRole('link', { name: /BingeTrack/ });
    expect(logo.getAttribute('href')).toBe('/discover');
  });
});
