import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import { isAllowedDomain, isAdmin } from './authRules';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      authorization: {
        params: { hd: process.env.ALLOWED_DOMAIN ?? 'automationsystems.org', prompt: 'select_account' },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      return isAllowedDomain(user.email, process.env.ALLOWED_DOMAIN ?? 'automationsystems.org');
    },
    async jwt({ token }) {
      token.isAdmin = isAdmin(token.email, process.env.ADMIN_EMAIL ?? '');
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).isAdmin = Boolean((token as any).isAdmin);
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
};
