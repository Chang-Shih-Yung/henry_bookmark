export { auth as proxy } from '@/auth';

export const config = {
  // Protect everything except auth callbacks, login page, static assets, and price API.
  // /api/prices is allowed unauthenticated because it doesn't expose user data,
  // only public market prices, and we don't want to gate it behind a session.
  matcher: ['/((?!api/auth|api/prices|login|_next/static|_next/image|favicon|manifest).*)'],
};
