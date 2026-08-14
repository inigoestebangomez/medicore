'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

const THEME_COOKIE = 'medicore-theme';

export async function toggleTheme(): Promise<'light' | 'dark'> {
  const cookieStore = await cookies();
  const current = cookieStore.get(THEME_COOKIE)?.value;
  const next = current === 'light' ? 'dark' : 'light';

  cookieStore.set(THEME_COOKIE, next, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: true,
    sameSite: 'lax',
  });

  revalidatePath('/');
  return next;
}

export async function getCurrentTheme(): Promise<'light' | 'dark'> {
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  return theme === 'light' ? 'light' : 'dark';
}
