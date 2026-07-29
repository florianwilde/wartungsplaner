import NextAuth from 'next-auth'
import type { Provider } from 'next-auth/providers'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

import { authConfig } from '@/auth.config'
import { prisma } from '@/lib/prisma'
import { schreibeAuditLeise } from '@/lib/audit'
import {
  baueKennung,
  neuerSpeicher,
  pruefeVersuch,
  raeumeAuf,
  setzeZurueck,
  vermerkeFehlversuch,
  type Versuchsspeicher,
} from '@/lib/anmeldeversuche'

/** Kennung des generischen OIDC-Providers (Teil der Redirect-URI). */
export const OIDC_PROVIDER_ID = 'oidc'

/**
 * SSO wird nur aktiviert, wenn alle drei Pflichtvariablen gesetzt sind.
 * Damit bleibt die Anwendung ohne Identity Provider vollständig nutzbar.
 */
export function istOidcAktiv(): boolean {
  return Boolean(
    process.env.OIDC_ISSUER?.trim() &&
      process.env.OIDC_CLIENT_ID?.trim() &&
      process.env.OIDC_CLIENT_SECRET?.trim(),
  )
}

/** Anzeigename des SSO-Buttons auf der Anmeldeseite. */
export function oidcAnzeigename(): string {
  return process.env.OIDC_NAME?.trim() || 'Unternehmens-SSO'
}

function normalisiereEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Speicher der Fehlversuche. Am globalen Objekt, damit er einen Hot-Reload
// übersteht. Für eine Installation mit einem App-Container ausreichend; bei
// mehreren Instanzen müsste er durch einen gemeinsamen Speicher ersetzt werden.
const globalForAnmeldung = globalThis as unknown as {
  wartungsplanerVersuche: Versuchsspeicher | undefined
}
const versuche: Versuchsspeicher = (globalForAnmeldung.wartungsplanerVersuche ??=
  neuerSpeicher())

/** Netzwerkadresse der Anfrage, soweit ermittelbar. */
function anfrageAdresse(request: Request | undefined): string {
  const kopf = request?.headers
  const weitergeleitet = kopf?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return weitergeleitet || kopf?.get('x-real-ip')?.trim() || 'unbekannt'
}

const credentialsProvider = Credentials({
  id: 'credentials',
  name: 'E-Mail und Passwort',
  credentials: {
    email: { label: 'E-Mail', type: 'email' },
    password: { label: 'Passwort', type: 'password' },
  },
  async authorize(credentials, request) {
    const email =
      typeof credentials?.email === 'string'
        ? normalisiereEmail(credentials.email)
        : ''
    const password =
      typeof credentials?.password === 'string' ? credentials.password : ''

    if (!email || !password) return null

    // --- Schutz vor dem Erraten von Passwörtern -------------------------
    const jetzt = Date.now()
    const kennung = baueKennung(email, anfrageAdresse(request as Request))

    // Gelegentlich aufräumen, damit der Speicher nicht unbegrenzt wächst.
    if (versuche.size > 500) raeumeAuf(versuche, jetzt)

    const zulaessig = pruefeVersuch(versuche, kennung, jetzt)
    if (!zulaessig.erlaubt) {
      await schreibeAuditLeise({
        userId: null,
        action: 'LOGIN_BLOCKED',
        entityType: 'User',
        entityId: null,
        payload: {
          email,
          grund: 'zu viele Fehlversuche',
          gesperrtNochSekunden: zulaessig.verbleibendeSekunden,
        },
      })
      return null
    }

    const user = await prisma.user.findUnique({ where: { email } })

    // Auch bei unbekannter E-Mail wird ein Hash-Vergleich durchgeführt, damit
    // die Antwortzeit keine Rückschlüsse auf existierende Konten zulässt.
    const hash =
      user?.passwordHash ??
      '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin'
    const passwortStimmt = await bcrypt.compare(password, hash)

    if (!user || !user.passwordHash || !user.active || !passwortStimmt) {
      const sperreAusgeloest = vermerkeFehlversuch(versuche, kennung, jetzt)

      await schreibeAuditLeise({
        userId: user?.id ?? null,
        action: 'LOGIN_FAILED',
        entityType: 'User',
        entityId: user?.id ?? null,
        payload: {
          email,
          grund: !user
            ? 'unbekannte E-Mail'
            : !user.active
              ? 'Konto deaktiviert'
              : !user.passwordHash
                ? 'Konto ohne lokales Passwort (nur SSO)'
                : 'falsches Passwort',
          ...(sperreAusgeloest
            ? { folge: 'Anmeldung vorübergehend gesperrt' }
            : {}),
        },
      })
      return null
    }

    setzeZurueck(versuche, kennung)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })
    await schreibeAuditLeise({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      payload: { verfahren: 'Passwort' },
    })

    return { id: user.id, name: user.name, email: user.email }
  },
})

function baueProviderListe(): Provider[] {
  const providers: Provider[] = [credentialsProvider]

  if (istOidcAktiv()) {
    providers.push({
      id: OIDC_PROVIDER_ID,
      name: oidcAnzeigename(),
      type: 'oidc',
      issuer: process.env.OIDC_ISSUER!.trim(),
      clientId: process.env.OIDC_CLIENT_ID!.trim(),
      clientSecret: process.env.OIDC_CLIENT_SECRET!.trim(),
      authorization: {
        params: { scope: process.env.OIDC_SCOPES?.trim() || 'openid profile email' },
      },
      // Die Verknüpfung erfolgt bewusst über die E-Mail-Adresse: der Identity
      // Provider des Unternehmens gilt als vertrauenswürdige Quelle.
      allowDangerousEmailAccountLinking: true,
    })
  }

  return providers
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: baueProviderListe(),
  callbacks: {
    ...authConfig.callbacks,

    /**
     * Legt SSO-Benutzer beim ersten Login an bzw. verknüpft sie per E-Mail mit
     * einem bestehenden Konto. Neue SSO-Konten erhalten die Rolle AUDITOR;
     * die Anpassung nimmt anschließend ein Administrator vor.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== OIDC_PROVIDER_ID) return true

      const email = user.email ? normalisiereEmail(user.email) : ''
      if (!email) {
        console.warn('SSO-Anmeldung ohne E-Mail-Adresse abgelehnt.')
        return '/login?fehler=OhneEmail'
      }

      const name =
        (typeof profile?.name === 'string' && profile.name.trim()) ||
        user.name?.trim() ||
        email

      const vorhanden = await prisma.user.findUnique({ where: { email } })

      if (!vorhanden) {
        const neu = await prisma.user.create({
          data: {
            name,
            email,
            passwordHash: null,
            authProvider: 'OIDC',
            role: 'AUDITOR',
            active: true,
            mustChangePassword: false,
            lastLoginAt: new Date(),
          },
        })
        await schreibeAuditLeise({
          userId: neu.id,
          action: 'USER_PROVISIONED_VIA_OIDC',
          entityType: 'User',
          entityId: neu.id,
          payload: { email, rolle: 'AUDITOR' },
        })
        return true
      }

      if (!vorhanden.active) {
        await schreibeAuditLeise({
          userId: vorhanden.id,
          action: 'LOGIN_FAILED',
          entityType: 'User',
          entityId: vorhanden.id,
          payload: { email, verfahren: 'SSO', grund: 'Konto deaktiviert' },
        })
        return '/login?fehler=Deaktiviert'
      }

      await prisma.user.update({
        where: { id: vorhanden.id },
        data: { lastLoginAt: new Date() },
      })
      await schreibeAuditLeise({
        userId: vorhanden.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'User',
        entityId: vorhanden.id,
        payload: { verfahren: 'SSO' },
      })
      return true
    },

    /**
     * Rolle und Kontostatus werden bei jedem Aufruf frisch aus der Datenbank
     * gelesen. Dadurch wirken Rollenänderungen und Deaktivierungen sofort,
     * ohne dass der Benutzer sich neu anmelden muss.
     */
    async jwt({ token, user }) {
      if (user?.email) token.email = normalisiereEmail(user.email)
      if (typeof token.email !== 'string') return token

      const dbUser = await prisma.user.findUnique({
        where: { email: token.email },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          mustChangePassword: true,
          authProvider: true,
        },
      })

      // Kein Konto mehr vorhanden oder deaktiviert -> Sitzung ungültig machen.
      if (!dbUser || !dbUser.active) return null

      token.uid = dbUser.id
      token.sub = dbUser.id
      token.name = dbUser.name
      token.email = dbUser.email
      token.role = dbUser.role
      token.mustChangePassword = dbUser.mustChangePassword
      token.authProvider = dbUser.authProvider
      return token
    },
  },
  events: {
    async signOut(message) {
      const userId =
        'token' in message ? (message.token?.uid ?? null) : null
      if (userId) {
        await schreibeAuditLeise({
          userId,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: userId,
        })
      }
    },
  },
})
