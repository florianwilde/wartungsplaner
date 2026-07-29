import type { Role } from '@prisma/client'
import type { NextAuthConfig } from 'next-auth'

/** Die Felder, die diese Anwendung im Sitzungs-Token ablegt. */
export type AnmeldeToken = {
  sub?: string
  uid?: string
  name?: unknown
  email?: unknown
  role?: Role
  mustChangePassword?: boolean
  authProvider?: 'LOCAL' | 'OIDC'
}

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
      // Die Felder werden hier ausdrücklich beschrieben, statt sich auf die
      // Typerweiterung von Auth.js zu verlassen: Sobald weitere Auth.js-Module
      // (etwa die WebAuthn-Typen) im Spiel sind, greift die Erweiterung nicht
      // mehr zuverlässig. Die Werte selbst setzt der jwt-Callback in auth.ts.
      const inhalt = token as unknown as AnmeldeToken

      if (session.user) {
        session.user.id = inhalt.uid ?? inhalt.sub ?? ''
        session.user.role = inhalt.role ?? 'AUDITOR'
        session.user.mustChangePassword = inhalt.mustChangePassword ?? false
        session.user.authProvider = inhalt.authProvider ?? 'LOCAL'
        if (typeof inhalt.name === 'string') session.user.name = inhalt.name
        if (typeof inhalt.email === 'string') session.user.email = inhalt.email
      }
      return session
    },
  },
  providers: [],
} satisfies NextAuthConfig
