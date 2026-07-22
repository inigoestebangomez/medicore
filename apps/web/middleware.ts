// apps/web/middleware.ts
// Auth.js v5 middleware — protects routes, redirects unauthenticated users
export { auth as middleware } from '@/lib/auth';

export const config = {
  // The `$` alternative makes the negative lookahead fail for the root path
  // (remaining segment is empty), so `/` is excluded and public access works.
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|login|$).*)'],
};