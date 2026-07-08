'use server';

import { auth } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function ensureBackendToken(): Promise<string> {
  const session = await auth();
  if (!session?.user) throw new Error('Not authenticated');

  let token = (session as any)?.backendToken as string | undefined;

  if (token) return token;

  // No backend token — try to sync now
  const oauthProvider = (session as any)?.oauthProvider as string | undefined;
  const oauthSub = (session as any)?.oauthSub as string | undefined;

  if (!oauthProvider || !oauthSub) {
    throw new Error(
      'No backend session and no OAuth data available to sync. Please sign out and sign in again.'
    );
  }

  const syncRes = await fetch(`${API_BASE}/v1/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      oauthProvider,
      oauthSub,
      email: session.user.email,
      name: session.user.name,
    }),
  });

  if (!syncRes.ok) {
    throw new Error(`API sync failed (${syncRes.status}). Is the API running on port 3001?`);
  }

  const data = await syncRes.json();
  token = data.token;

  if (!token) {
    throw new Error('API sync succeeded but did not return a token');
  }

  return token;
}

export async function createOrganization(name: string, type: string) {
  const token = await ensureBackendToken();

  const orgRes = await fetch(`${API_BASE}/v1/organizations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name, type }),
  });

  if (!orgRes.ok) {
    const err = await orgRes.json().catch(() => ({ message: 'Failed to create organization' }));
    throw new Error(err.message ?? `Request failed: ${orgRes.status}`);
  }

  const org = await orgRes.json();
  const orgId = org.data?.id ?? org.id;

  const switchRes = await fetch(`${API_BASE}/v1/auth/switch-organization`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ organizationId: orgId }),
  });

  if (!switchRes.ok) {
    const err = await switchRes.json().catch(() => ({ message: 'Failed to switch organization' }));
    throw new Error(err.message ?? `Request failed: ${switchRes.status}`);
  }

  const switchData = await switchRes.json();

  return {
    id: orgId,
    name: switchData.organizationName ?? org.data?.name ?? org.name,
  };
}
