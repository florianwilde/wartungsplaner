import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

import { authConfig } from '@/auth.config'
import {
  baueContentSecurityPolicy,
  baueSicherheitsHeader,
  erzeugeNonce,
} from '@/lib/sicherheit'

/**
 * Grobe Zugriffskontrolle vor dem Rendern (früher "middleware").
 *
 * Hier wird bewusst nur geprüft, ob überhaupt eine gültige Sitzung besteht –
 * die fachliche Rollenprüfung erfolgt serverseitig in den Seiten und Server
 * Actions (siehe `src/lib/session.ts`). Diese Datei läuft in der
 * Edge-Laufzeit und darf deshalb keine Datenbank verwenden.
 */
const { auth } = NextAuth(authConfig)

/** Seiten, die ohne Anmeldung erreichbar sind. */
const OEFFENTLICHE_PFADE = ['/login', '/kein-zugriff']

/**
 * Ermittelt den Ursprung (Schema + Host) der eingehenden Anfrage.
 * Berücksichtigt `X-Forwarded-*`, damit Weiterleitungen auch hinter einem
 * Reverse Proxy und bei abweichendem Port auf die richtige Adresse zeigen.
 */
function anfrageUrsprung(request: Request, fallback: string): string {
  const headers = request.headers
  const host = headers.get('x-forwarded-host') ?? headers.get('host')
  if (!host) return fallback
  const protokoll =
    headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https')
  return `${protokoll}://${host}`
}

/**
 * Versieht eine Antwort mit den Schutz-Headern.
 * Wird auf jede Antwort angewandt – auch auf Weiterleitungen.
 */
function mitSchutzHeadern(
  antwort: NextResponse,
  nonce: string,
  https: boolean,
): NextResponse {
  antwort.headers.set(
    'Content-Security-Policy',
    baueContentSecurityPolicy({
      nonce,
      entwicklung: process.env.NODE_ENV !== 'production',
      https,
    }),
  )
  for (const [name, wert] of Object.entries(baueSicherheitsHeader(https))) {
    antwort.headers.set(name, wert)
  }
  return antwort
}

export default auth((request) => {
  const { nextUrl } = request
  const pfad = nextUrl.pathname
  const angemeldet = Boolean(request.auth?.user)

  // Nonce für die Content-Security-Policy. Next.js übernimmt ihn automatisch
  // für die eigenen Skripte, sobald er im CSP-Header steht; die Anwendung
  // liest ihn zusätzlich über den Anfrage-Header aus (siehe layout.tsx).
  const nonce = erzeugeNonce()
  const https =
    (request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
      nextUrl.protocol.replace(':', '')) === 'https'

  const anfrageHeader = new Headers(request.headers)
  anfrageHeader.set('x-nonce', nonce)

  const weiter = () =>
    mitSchutzHeadern(
      NextResponse.next({ request: { headers: anfrageHeader } }),
      nonce,
      https,
    )
  const umleiten = (ziel: URL) =>
    mitSchutzHeadern(NextResponse.redirect(ziel), nonce, https)

  const istOeffentlich = OEFFENTLICHE_PFADE.some(
    (p) => pfad === p || pfad.startsWith(`${p}/`),
  )
  const ursprung = anfrageUrsprung(request, nextUrl.origin)

  if (!angemeldet) {
    if (istOeffentlich) return weiter()
    const ziel = new URL('/login', ursprung)
    if (pfad !== '/') ziel.searchParams.set('weiter', `${pfad}${nextUrl.search}`)
    return umleiten(ziel)
  }

  // Ein erzwungener Passwortwechsel wird bewusst NICHT hier geprüft:
  // Das Sitzungs-Cookie kann veraltet sein (es wird erst beim nächsten
  // Schreibvorgang neu ausgestellt), was nach einer Passwortänderung zu einer
  // Weiterleitungsschleife führen würde. Die Prüfung erfolgt stattdessen
  // serverseitig in `erforderlicherBenutzer()` gegen den aktuellen
  // Datenbankstand.

  if (angemeldet && pfad === '/login') {
    return umleiten(new URL('/', ursprung))
  }

  return weiter()
})

export const config = {
  matcher: [
    /*
     * Alles außer:
     * - /api/auth    (Anmeldeendpunkte von Auth.js)
     * - /api/cron    (per Token abgesicherter Hintergrundjob)
     * - /api/health  (Healthcheck des Containers)
     * - /api/branding(Logo und Favicon; werden bereits auf der Anmeldeseite
     *                 gebraucht und dürfen deshalb keine Sitzung verlangen)
     * - Next.js-interne Pfade und statische Dateien
     */
    '/((?!api/auth|api/cron|api/health|api/branding|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
