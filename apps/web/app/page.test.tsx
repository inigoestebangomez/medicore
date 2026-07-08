import { describe, it, expect, vi } from 'vitest';
import { redirect } from 'next/navigation';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

import Home from './page';

describe('Home page', () => {
  it('should redirect to /login when not authenticated', async () => {
    await Home();
    expect(redirect).toHaveBeenCalledWith('/login');
  });

  it('should redirect to /dashboard when authenticated', async () => {
    const { auth } = await import('@/lib/auth');
    (auth as any).mockResolvedValueOnce({ user: { id: '1', email: 'test@test.com' } });
    await Home();
    expect(redirect).toHaveBeenCalledWith('/dashboard');
  });
});
