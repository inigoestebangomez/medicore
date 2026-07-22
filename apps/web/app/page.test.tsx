import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above imports; define shared mocks with vi.hoisted so the
// factory can reference them without a temporal-dead-zone ReferenceError.
const { authMock, redirectMock } = vi.hoisted(() => {
  const authMock = vi.fn();
  const redirectMock = vi.fn((path: string) => {
    // next/navigation.redirect throws internally to unwind the RSC render; we
    // replicate that so the awaited render settles into a rejected promise.
    throw new Error(`REDIRECT:${path}`);
  });
  return { authMock, redirectMock };
});

vi.mock('@/lib/auth', () => ({ auth: authMock }));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('./_landing/landing-page', () => ({
  LandingPage: function LandingPageStub() {
    return <div data-testid="landing-page" />;
  },
}));

import Home from './page';

describe('Home page auth logic', () => {
  beforeEach(() => {
    authMock.mockReset();
    redirectMock.mockClear();
  });

  it('renders the landing page for an unauthenticated user (session null)', async () => {
    authMock.mockResolvedValue(null);
    const ui = await Home();

    expect(redirectMock).not.toHaveBeenCalled();
    expect(ui).toBeTruthy();
    expect(typeof ui.type).toBe('function');
    expect((ui.type as { name?: string }).name).toMatch(/LandingPageStub/i);
  });

  it('redirects to /dashboard when the session has a user', async () => {
    authMock.mockResolvedValue({
      user: { id: 'u1', name: 'Dr. House', email: 'house@example.com' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(Home()).rejects.toThrow('REDIRECT:/dashboard');
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('does not redirect when session exists but has no user', async () => {
    authMock.mockResolvedValue({ user: null });
    const ui = await Home();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(ui).toBeTruthy();
  });
});