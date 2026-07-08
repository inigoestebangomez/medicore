'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Client-side auth sync component.
 * Calls /api/auth/sync to set the medicore-session cookie in the browser
 * so that the Next.js proxy can forward it to the NestJS API.
 */
export function AuthSync({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated' || synced) return;

    async function sync() {
      try {
        const oauthProvider = (session as any)?.oauthProvider;
        const oauthSub = (session as any)?.oauthSub;

        if (!oauthProvider || !oauthSub) {
          setSynced(true);
          return;
        }

        const res = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oauthProvider,
            oauthSub,
            email: session.user?.email,
            name: session.user?.name,
          }),
          credentials: 'include',
        });

        if (res.ok) {
          console.log('[AuthSync] medicore-session cookie set');
        }
      } catch (e) {
        console.error('[AuthSync] sync failed:', e);
      } finally {
        setSynced(true);
      }
    }

    sync();
  }, [status, synced, session]);

  // Show nothing while syncing (or a spinner)
  if (status === 'loading' || !synced) {
    return null;
  }

  return <>{children}</>;
}
