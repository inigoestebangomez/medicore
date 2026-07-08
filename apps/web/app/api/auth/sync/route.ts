import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/**
 * Client-side sync proxy.
 * Calls the backend /auth/sync and forwards the medicore-session cookie
 * to the browser so client-side fetch with credentials: 'include' works.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json();

  const res = await fetch(`${API_BASE}/v1/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Sync failed' }));
    return NextResponse.json({ error: err.message }, { status: res.status });
  }

  const data = await res.json();

  // Forward the set-cookie header to the browser
  const response = NextResponse.json(data);
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    response.headers.set('set-cookie', setCookie);
  }

  return response;
}
