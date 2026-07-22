import { test, expect } from '@playwright/test';

/**
 * Landing page E2E.
 *
 * Requires a running web dev server (baseURL, default http://localhost:3000).
 * Start it with `pnpm --filter @medicore/web dev` before `pnpm test:e2e`.
 *
 * The authenticated-redirect scenario is skipped by default: it needs a
 * logged-in storageState fixture (NextAuth JWT) that this PR does not provide.
 */

test.describe('Landing page (unauthenticated)', () => {
  test.beforeEach(async ({ context }) => {
    // Ensure no prior consent influences banner visibility.
    await context.clearCookies();
  });

  test('shows the landing page and cookie banner', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      /Gestión clínica/i,
    );
    await expect(
      page.getByRole('button', { name: 'Empieza gratis' }),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog', { name: /Consentimiento de cookies/i }),
    ).toBeVisible();
  });

  test('clicking "Empieza gratis" starts the Google OAuth flow', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Empieza gratis' }).click();

    // signIn('google') redirects to NextAuth's provider endpoint (or directly
    // to Google when credentials are configured). Either way we leave /.
    await page.waitForURL(/(api\/auth|google)/, { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL('/');
  });

  test('clicking "Iniciar sesión" starts the Google OAuth flow', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();

    await page.waitForURL(/(api\/auth|google)/, { timeout: 10_000 }).catch(() => {});
    await expect(page).not.toHaveURL('/');
  });
});

test.describe('Cookie consent', () => {
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  test('accepting cookies hides the banner and persists consent', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.getByTestId('cookie-consent-banner');
    await expect(banner).toBeVisible();

    await page.getByTestId('cookie-accept').click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(
      () => window.localStorage.getItem('medicore-cookie-consent'),
    );
    expect(stored).toBe('accepted');
  });

  test('rejecting cookies hides the banner and persists consent', async ({
    page,
  }) => {
    await page.goto('/');

    const banner = page.getByTestId('cookie-consent-banner');
    await expect(banner).toBeVisible();

    await page.getByTestId('cookie-reject').click();
    await expect(banner).toBeHidden();

    const stored = await page.evaluate(
      () => window.localStorage.getItem('medicore-cookie-consent'),
    );
    expect(stored).toBe('rejected');
  });
});

test.describe('Authenticated redirect', () => {
  // eslint-disable-next-line playwright/no-skipped-test
  test.skip('redirects an authenticated user on / to /dashboard', async ({
    page,
  }) => {
    // TODO(sdd/landing-page): requires a logged-in browserContext via
    // storageState (NextAuth JWT cookie). Add an auth fixture in a follow-up.
    await page.goto('/');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });
});