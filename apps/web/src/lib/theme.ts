'use server';

import { cookies } from 'next/headers';

const THEME_COOKIE = 'medicore-theme';

export async function getTheme(): Promise<'dark' | 'light'> {
  const cookieStore = await cookies();
  const theme = cookieStore.get(THEME_COOKIE)?.value;
  return theme === 'light' ? 'light' : 'dark';
}

export async function setTheme(theme: 'dark' | 'light') {
  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: true,
    sameSite: 'lax',
  });
}