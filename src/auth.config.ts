import type { NextAuthConfig } from 'next-auth'

/**
 * Basiskonfiguration ohne Datenbankzugriff.
 *
 * Diese Datei wird auch von `proxy.ts` (Edge-Laufzeit) importiert und darf
 * deshalb weder Prisma noch bcrypt verwenden. Die Provider und der
 * datenbankgestützte `jwt`-Callback werden in `src/auth.ts` ergänzt.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    // Arbeitstag zzgl. Puffer
    maxAge: 12 * 60 * 60,
  },
  callbacks: {
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? (token.sub as string)
        session.user.role = token.role ?? 'AUDITOR'
        session.user.mustChangePassword = token.mustChangePassword ?? false
        session.user.authProvider = token.authProvider ?? 'LOCAL'
        if (typeof token.name === 'string') session.user.name = token.name
        if (typeof token.email === 'string') session.user.email = token.email
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
