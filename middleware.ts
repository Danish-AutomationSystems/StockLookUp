import { withAuth } from 'next-auth/middleware';

export function isAuthorized(token: { isAdmin?: boolean } | null, pathname: string): boolean {
  if (!token) return false;
  if (pathname.startsWith('/admin')) return Boolean(token.isAdmin);
  return true;
}

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => isAuthorized(token as any, req.nextUrl.pathname),
  },
  pages: { signIn: '/login' },
});

export const config = {
  matcher: ['/', '/admin/:path*'],
};
