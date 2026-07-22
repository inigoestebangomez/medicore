'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

/**
 * RGPD-compliant cookie consent banner.
 *
 * Design refs:
 *   - docs/04-design-spec.md §12 (Accesibilidad WCAG 2.1 AA)
 *   - SDD design: fixed-bottom banner, NOT a modal; accept and reject buttons
 *     share the same size and visual weight so rejecting is as easy as accepting.
 *
 * Persistence:
 *   - localStorage `medicore-cookie-consent` → 'accepted' | 'rejected'
 *   - document cookie `medicore-consent` (server-readable via middleware later)
 *
 * Failure handling: if localStorage is unavailable (private browsing, quota),
 * the banner still renders and the click handler silently no-ops persistence —
 * the user is never blocked by a broken storage layer.
 */
const STORAGE_KEY = 'medicore-cookie-consent';
const COOKIE_NAME = 'medicore-consent';
const PRIVACY_POLICY_HREF =
  'https://www.privacypolicies.com/live/ab4f55aa-8ebe-46ca-b984-e4ce21ad7f45';

type ConsentValue = 'accepted' | 'rejected';

// Routes where a cookie banner would be intrusive — hide it there.
function isConsentRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return (
    pathname === '/' ||
    pathname.startsWith('/landing')
  );
}

function readStoredConsent(): ConsentValue | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === 'accepted' || value === 'rejected') return value;
    return null;
  } catch {
    // localStorage unavailable (private mode / disabled) — treat as no consent.
    return null;
  }
}

function persistConsent(value: ConsentValue): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // private mode / quota — ignore; banner already hidden by UI state.
  }
  // Server-readable cookie (path-scoped, 1 year). document.cookie is widely
  // available even when localStorage is locked down in some private modes.
  try {
    const oneYear = 60 * 60 * 24 * 365;
    document.cookie = `${COOKIE_NAME}=${value}; path=/; max-age=${oneYear}; SameSite=Lax`;
  } catch {
    // no-op
  }
}

export function CookieConsent() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Only show on public-facing routes, and only when no valid consent exists.
    if (!isConsentRoute(pathname)) {
      setVisible(false);
      return;
    }
    setVisible(readStoredConsent() === null);
  }, [pathname]);

  // The banner is client-only (localStorage). Before mount we render nothing to
  // avoid hydration mismatches — static HTML can't know the stored consent.
  if (!mounted) return null;

  function handleChoice(value: ConsentValue) {
    persistConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Consentimiento de cookies"
      data-testid="cookie-consent-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-outline-variant bg-surface-lowest/95 backdrop-blur supports-[backdrop-filter]:bg-surface-lowest/80 px-4 py-4 shadow-modal"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p
          id="cookie-consent-description"
          className="text-sm leading-relaxed text-on-surface-variant"
        >
          Este sitio utiliza cookies para mejorar la experiencia y analizar el uso
          del sitio. Puedes aceptar o rechazar las cookies no esenciales. Consulta
          la{' '}
          <a
            href={PRIVACY_POLICY_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-secondary underline underline-offset-2 hover:text-secondary/80"
          >
            Política de privacidad
          </a>
          .
        </p>
        <div className="flex flex-shrink-0 gap-3 sm:justify-end">
          <Button
            type="button"
            size="default"
            variant="default"
            onClick={() => handleChoice('accepted')}
            data-testid="cookie-accept"
          >
            Aceptar
          </Button>
          <Button
            type="button"
            size="default"
            variant="default"
            onClick={() => handleChoice('rejected')}
            data-testid="cookie-reject"
            className="bg-primary-container text-on-primary-container hover:bg-primary/90 focus-visible:ring-primary-container"
          >
            Rechazar
          </Button>
        </div>
      </div>
    </div>
  );
}