import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// `next/navigation` must be mocked before importing the component because
// usePathname() runs at module-eval time indirectly via the first render.
const usePathnameMock = vi.fn(() => '/');
vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
}));

import { CookieConsent } from '@/components/cookie-consent';

const STORAGE_KEY = 'medicore-cookie-consent';
const COOKIE_NAME = 'medicore-consent';

function setStoredConsent(value: string | null) {
  if (value === null) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, value);
  }
}

function makeStorageUnavailable() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const failing = (): any => {
    throw new Error('localStorage unavailable');
  };
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: failing,
      setItem: failing,
      removeItem: failing,
      clear: failing,
      key: failing,
      length: 0,
    },
  });
}

// jsdom's document.cookie persists across tests; we replace it with a fresh
// in-memory store per test so assertions are isolated. Using a getter/setter
// (not a fixed value) keeps write-through working so the component can set it.
function installCookieStore() {
  const store = new Map<string, string>();
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set(value: string) {
      const [pair] = value.split(';');
      const [k, v] = pair.split('=');
      if (k) store.set(k.trim(), (v ?? '').trim());
    },
  });
  return store;
}

describe('CookieConsent', () => {
  let originalLocalStorage: Storage | undefined;

  beforeEach(() => {
    originalLocalStorage = window.localStorage;
    originalLocalStorage.clear();
    installCookieStore();
    usePathnameMock.mockReturnValue('/');
  });

  afterEach(() => {
    cleanup();
    // Restore a working localStorage so other tests aren't poisoned.
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage as unknown as Storage,
    });
    vi.clearAllMocks();
  });

  it('shows the banner when no consent is stored', async () => {
    render(<CookieConsent />);
    expect(await screen.findByTestId('cookie-consent-banner')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('persists "accepted", hides the banner, and sets the server cookie', async () => {
    render(<CookieConsent />);
    const accept = await screen.findByTestId('cookie-accept');
    fireEvent.click(accept);
    await waitFor(() =>
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('accepted');
    expect(document.cookie).toContain(`${COOKIE_NAME}=accepted`);
  });

  it('persists "rejected" and hides the banner', async () => {
    render(<CookieConsent />);
    const reject = await screen.findByTestId('cookie-reject');
    fireEvent.click(reject);
    await waitFor(() =>
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('rejected');
    expect(document.cookie).toContain(`${COOKIE_NAME}=rejected`);
  });

  it('does not show the banner when consent already exists', async () => {
    setStoredConsent('accepted');
    render(<CookieConsent />);
    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    });
  });

  it('treats an invalid stored value as no consent (banner shows)', async () => {
    setStoredConsent('maybe');
    render(<CookieConsent />);
    expect(await screen.findByTestId('cookie-consent-banner')).toBeVisible();
  });

  it('renders the banner when localStorage is unavailable, and hides on accept without throwing', async () => {
    makeStorageUnavailable();
    // Reading should not throw; component should gracefully fall back to shown.
    render(<CookieConsent />);
    const accept = await screen.findByTestId('cookie-accept');
    fireEvent.click(accept);
    await waitFor(() =>
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument(),
    );
  });

  it('does not render the banner on authenticated routes', async () => {
    usePathnameMock.mockReturnValue('/dashboard');
    render(<CookieConsent />);
    await waitFor(() => {
      expect(screen.queryByTestId('cookie-consent-banner')).not.toBeInTheDocument();
    });
  });
});