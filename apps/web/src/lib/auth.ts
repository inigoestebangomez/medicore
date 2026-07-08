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
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
      }

      if (account?.provider === 'google' && account?.access_token) {
        // Store OAuth data in token so we can re-sync if needed
        token.oauthProvider = account.provider;
        token.oauthSub = account.providerAccountId;
        token.userEmail = user?.email ?? token.email;
        token.userName = user?.name ?? token.name;

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
              oauthProvider: 'google',
              oauthSub: account.providerAccountId,
              email: user?.email ?? token.email,
              name: user?.name ?? token.name,
              avatarUrl: user?.image ?? token.picture,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const setCookieHeader = response.headers.get('set-cookie');
            if (setCookieHeader) {
              const match = setCookieHeader.match(/medicore-session=([^;]+)/);
              if (match) {
                token.backendToken = match[1];
              }
            }

            // Fallback: also capture token from response body
            if (!token.backendToken && data.token) {
              token.backendToken = data.token;
            }

            token.userId = data.id;
            token.organizationId = data.organizationId;
            token.role = data.role;
            token.isNewUser = data.isNewUser;
          }
        } catch {
          // Fail gracefully — user can retry sync
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