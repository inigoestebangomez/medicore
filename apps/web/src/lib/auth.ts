// apps/web/src/lib/auth.ts
// Auth.js v5 configuration for MediCore
// NOTE: TS2742 workaround — Auth.js v5 beta types cannot be named portably
// in pnpm monorepos. We use explicit type annotations to satisfy strict mode.
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const nextAuth = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt' as const,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (user) {
        token.id = user.id;
      }

      if (account?.provider === 'google') {
        // Store OAuth data in token so we can re-sync if needed
        token.oauthProvider = account.provider;
        token.oauthSub = account.providerAccountId;
        token.userEmail = user?.email ?? token.email;
        token.userName = user?.name ?? token.name;
      }

      // Handle session update — e.g., after onboarding creates an org,
      // the client calls update({ organizationId }). Merge it into the token
      // so the next server-side auth() picks it up without a round-trip.
      if (trigger === 'update' && session) {
        if (session.organizationId) {
          token.organizationId = session.organizationId;
        }
        if (session.role) {
          token.role = session.role;
        }
      }

      // Re-sync with backend: if we have OAuth credentials but no
      // organizationId (e.g. initial sync failed, or org was created
      // after sign-in), fetch it now. This covers:
      // - First sync failure during sign-in
      // - update() calls when the client doesn't pass organizationId
      if (!token.organizationId && token.oauthProvider && token.oauthSub) {
        try {
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
          const response = await fetch(`${apiBaseUrl}/v1/auth/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token.backendToken
                ? { Cookie: `medicore-session=${token.backendToken}` }
                : {}),
            },
            body: JSON.stringify({
              oauthProvider: token.oauthProvider,
              oauthSub: token.oauthSub,
              email: token.userEmail ?? token.email,
              name: token.userName ?? token.name,
            }),
          });

          if (response.ok) {
            const body = await response.json();
            const data = body.data ?? body;
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
              const match = setCookieHeader.match(/medicore-session=([^;]+)/);
              if (match) {
                token.backendToken = match[1];
              }
            }

            if (!token.backendToken && data.token) {
              token.backendToken = data.token;
            }

            token.userId = token.userId ?? data.id;
            token.organizationId = data.organizationId;
            token.role = token.role ?? data.role;
            token.isNewUser = data.isNewUser;
          } else {
            console.error('[Auth JWT] Backend sync returned non-OK status:', response.status);
          }
        } catch (err) {
          console.error('[Auth JWT] Backend sync failed — organizationId will be missing:', err);
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.organizationId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).organizationId = token.organizationId;
      } else if (token.email) {
        // Fallback: if JWT sync missed organizationId, fetch from backend
        try {
          const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
          const email = token.email ?? session.user?.email;
          if (email) {
            const res = await fetch(`${apiBaseUrl}/v1/auth/sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                oauthProvider: token.oauthProvider ?? 'google',
                oauthSub: token.oauthSub ?? token.sub,
                email,
              }),
            });
            if (res.ok) {
              const body = await res.json();
              const data = body.data ?? body;
              if (data.organizationId) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (session as any).organizationId = data.organizationId;
              }
              if (data.role) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (session as any).role = data.role;
              }
            }
          }
        } catch (err) {
          console.error('[Auth Session] Fallback sync failed:', err);
        }
      }
      if (token.role) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).role = token.role;
      }
      if (token.backendToken) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).backendToken = token.backendToken;
      }
      if (token.oauthProvider) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).oauthProvider = token.oauthProvider;
      }
      if (token.oauthSub) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).oauthSub = token.oauthSub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
});

// TS2742 workaround: Auth.js v5 beta inferred types reference internal modules
// that TypeScript cannot resolve portably in pnpm monorepos.
// Exporting with explicit any-typed intermediate satisfies strict mode.
export const handlers: typeof nextAuth.handlers = nextAuth.handlers;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: (typeof nextAuth)['auth'] = nextAuth.auth;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn: (typeof nextAuth)['signIn'] = nextAuth.signIn;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut: (typeof nextAuth)['signOut'] = nextAuth.signOut;