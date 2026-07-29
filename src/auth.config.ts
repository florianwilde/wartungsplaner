import type { NextAuthConfig } from 'next-auth'

/**
 * Basiskonfiguration ohne Datenbankzugriff.
 *
 * Diese Datei wird auch von `proxy.ts` (Edge-Laufzeit) importiert und darf
 * deshalb weder Prisma noch bcrypt verwenden. Die Provider und der
 * datenbankgestützte `jwt`-Callback werden in `src/auth.ts` ergänzt.
 */
/**
 * Sichere Cookies verwenden, sobald die Anwendung über HTTPS erreichbar ist.
 * Ohne diese Ableitung würde Auth.js bei einem Reverse Proxy, der intern per
 * HTTP spricht, das `Secure`-Kennzeichen weglassen.
 */
const nutzeSichereCookies = (
  process.env.AUTH_URL ??
  process.env.APP_URL ??
  ''
).startsWith('https://')

export const authConfig = {
  trustHost: true,
  useSecureCookies: nutzeSichereCookies,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    // Arbeitstag zzgl. Puffer
    maxAge: 12 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name: nutzeSichereCookies
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token',
      options: {
        httpOnly: true,
        // "lax" statt "strict": Nach der Rückkehr vom Identity Provider muss
        // das Cookie mitgesendet werden, sonst schlägt die SSO-Anmeldung fehl.
        // Gegen CSRF schützen die Origin-Prüfung der Server Actions und der
        // CSRF-Token von Auth.js.
        sameSite: 'lax',
        path: '/',
        secure: nutzeSichereCookies,
      },
    },
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
