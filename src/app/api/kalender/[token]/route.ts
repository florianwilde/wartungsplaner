import { NextResponse, type NextRequest } from 'next/server'

import { appBasisUrl } from '@/server/benachrichtigungen'
import { baueKalenderFuerToken } from '@/server/kalender-abo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Abonnierbarer Kalender einer Person.
 *
 * Ohne Anmeldung erreichbar – Kalenderprogramme können sich nicht anmelden.
 * Der Zugang ist das Geheimnis in der Adresse; es lässt sich im Konto
 * jederzeit neu erzeugen, wodurch die alte Adresse ins Leere läuft.
 *
 * Ein unbekanntes Geheimnis beantwortet die Route mit 404 – ohne Hinweis
 * darauf, ob es einmal gültig war.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  // Outlook hängt gern eine Endung an; beides soll funktionieren.
  const geheimnis = token.replace(/\.ics$/i, '')

  const kalender = await baueKalenderFuerToken(geheimnis, appBasisUrl())
  if (!kalender) {
    return new NextResponse('Nicht gefunden', { status: 404 })
  }

  return new NextResponse(kalender.inhalt, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="wartungsplaner.ics"',
      // Der Feed ist persönlich: Kein Zwischenspeicher darf ihn festhalten.
      'Cache-Control': 'private, no-store',
    },
  })
}
