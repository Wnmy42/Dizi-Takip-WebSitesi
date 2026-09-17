// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { signUp } = vi.hoisted(() => ({
  signUp: vi.fn(),
}));

vi.mock('@/lib/supabase/actions', () => ({ signUp }));

// Stub useActionState to control state, action and isPending from tests.
let mockState: { error?: string; success?: string } | undefined;
let mockPending: boolean;
const mockAction = vi.fn();

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useActionState: () => [mockState, mockAction, mockPending],
  };
});

import RegisterPage from '@/app/(auth)/register/page';

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  mockState = undefined;
  mockPending = false;
});

describe('register page', () => {
  it('renders the email and password fields with a submit button', () => {
    render(<RegisterPage />);

    expect(screen.getByLabelText('E-posta')).toBeDefined();
    expect(screen.getByLabelText('Şifre')).toBeDefined();

    const submit = screen.getByRole('button', { name: 'Kayıt Ol' });
    expect(submit).toBeDefined();
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables the submit button and shows loading text while pending', () => {
    mockPending = true;
    render(<RegisterPage />);

    const submit = screen.getByRole('button', { name: 'Hesap oluşturuluyor...' });
    expect(submit).toBeDefined();
    expect((submit as HTMLButtonElement).disabled).toBe(true);
  });

  it('displays the auth error message when state contains an error', () => {
    mockState = { error: 'User already registered' };
    render(<RegisterPage />);

    expect(screen.getByText('User already registered')).toBeDefined();
  });

  it('hides the form and shows the success message with a login link on success', () => {
    mockState = { success: 'Hesabın oluşturuldu. E-posta adresinizi doğrulayın.' };
    render(<RegisterPage />);

    // Success message is visible
    expect(screen.getByText('Hesabın oluşturuldu. E-posta adresinizi doğrulayın.')).toBeDefined();

    // Navigate to login button is visible
    const loginButton = screen.getByRole('link', { name: 'Giriş Sayfasına Git' });
    expect(loginButton.getAttribute('href')).toBe('/login');

    // The form fields should be hidden
    expect(screen.queryByLabelText('E-posta')).toBeNull();
    expect(screen.queryByLabelText('Şifre')).toBeNull();
  });

  it('does not display any error or success when state is undefined', () => {
    render(<RegisterPage />);

    expect(screen.queryByText(/already registered/)).toBeNull();
    expect(screen.queryByText(/oluşturuldu/)).toBeNull();
  });

  it('links to the login page', () => {
    render(<RegisterPage />);

    const link = screen.getByRole('link', { name: 'Giriş Yap' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('links the logo to the discover page', () => {
    render(<RegisterPage />);

    const logo = screen.getByRole('link', { name: /BingeTrack/ });
    expect(logo.getAttribute('href')).toBe('/discover');
  });

  it('enforces a minimum password length via the input attribute', () => {
    render(<RegisterPage />);

    const password = screen.getByLabelText('Şifre') as HTMLInputElement;
    expect(password.minLength).toBe(6);
  });
});
