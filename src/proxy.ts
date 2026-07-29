import NextAuth from 'next-auth'
import { NextResponse } from 'next/server'

import { authConfig } from '@/auth.config'

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

export default auth((request) => {
  const { nextUrl } = request
  const pfad = nextUrl.pathname
  const angemeldet = Boolean(request.auth?.user)

  const istOeffentlich = OEFFENTLICHE_PFADE.some(
    (p) => pfad === p || pfad.startsWith(`${p}/`),
  )
  const ursprung = anfrageUrsprung(request, nextUrl.origin)

  if (!angemeldet) {
    if (istOeffentlich) return NextResponse.next()
    const ziel = new URL('/login', ursprung)
    if (pfad !== '/') ziel.searchParams.set('weiter', `${pfad}${nextUrl.search}`)
    return NextResponse.redirect(ziel)
  }

  // Angemeldet, aber Passwortwechsel erzwungen: alles außer der
  // Wechselseite und dem Abmelden umleiten.
  if (
    request.auth?.user?.mustChangePassword &&
    pfad !== '/passwort-aendern' &&
    !istOeffentlich
  ) {
    return NextResponse.redirect(new URL('/passwort-aendern', ursprung))
  }

  if (angemeldet && pfad === '/login') {
    return NextResponse.redirect(new URL('/', ursprung))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Alles außer:
     * - /api/auth  (Anmeldeendpunkte von Auth.js)
     * - /api/cron  (per Token abgesicherter Hintergrundjob)
     * - /api/health(Healthcheck des Containers)
     * - Next.js-interne Pfade und statische Dateien
     */
    '/((?!api/auth|api/cron|api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
