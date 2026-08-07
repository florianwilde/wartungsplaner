import { NextResponse, type NextRequest } from 'next/server'

import {
  starteBenachrichtigungen,
  starteIntegritaetslauf,
  starteTagesabgleich,
} from '@/server/cron'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Löst die Hintergrundläufe zusätzlich per HTTP aus – etwa aus einem externen
 * Scheduler heraus oder zum Testen.
 *
 * Der Endpunkt ist nur nutzbar, wenn `CRON_TOKEN` gesetzt ist, und verlangt
 * dann den Header `Authorization: Bearer <token>`.
 *
 * Parameter `aufgabe`:
 *   abgleich (Standard)  Fälligkeiten abgleichen
 *   mail                 Benachrichtigungen versenden
 *   integritaet          Nachweise auf Unversehrtheit prüfen
 *   alles                alle drei nacheinander
 */
export async function POST(request: NextRequest) {
  const token = process.env.CRON_TOKEN?.trim()

  if (!token) {
    return NextResponse.json(
      {
        fehler:
          'Der HTTP-Auslöser ist nicht konfiguriert. Bitte CRON_TOKEN in der .env setzen.',
      },
      { status: 404 },
    )
  }

  const uebergeben = request.headers
    .get('authorization')
    ?.replace(/^Bearer\s+/i, '')
    .trim()

  if (uebergeben !== token) {
    return NextResponse.json({ fehler: 'Nicht autorisiert.' }, { status: 401 })
  }

  const aufgabe = request.nextUrl.searchParams.get('aufgabe') ?? 'abgleich'
  if (!['abgleich', 'mail', 'integritaet', 'alles'].includes(aufgabe)) {
    return NextResponse.json(
      {
        fehler: 'Unbekannte Aufgabe. Erlaubt: abgleich, mail, integritaet, alles.',
      },
      { status: 400 },
    )
  }

  try {
    const antwort: Record<string, unknown> = { status: 'ok' }

    if (aufgabe === 'abgleich' || aufgabe === 'alles') {
      const ergebnis = await starteTagesabgleich(null)
      if (!ergebnis) {
        return NextResponse.json(
          { hinweis: 'Ein Lauf ist bereits aktiv.' },
          { status: 409 },
        )
      }
      antwort.abgleich = ergebnis
    }

    if (aufgabe === 'mail' || aufgabe === 'alles') {
      const ergebnis = await starteBenachrichtigungen(null)
      if (!ergebnis) {
        return NextResponse.json(
          { hinweis: 'Ein Versandlauf ist bereits aktiv.' },
          { status: 409 },
        )
      }
      antwort.benachrichtigungen = ergebnis
    }

    if (aufgabe === 'integritaet' || aufgabe === 'alles') {
      const ergebnis = await starteIntegritaetslauf(null)
      if (!ergebnis) {
        return NextResponse.json(
          { hinweis: 'Ein Integritätslauf ist bereits aktiv.' },
          { status: 409 },
        )
      }
      // Die Einzelbefunde können sehr umfangreich sein; die Zahlen
      // genügen für den Aufrufer, die Einzelheiten stehen im
      // Administrationsbereich.
      const { befunde: _befunde, ...zahlen } = ergebnis
      antwort.integritaet = zahlen
    }

    return NextResponse.json(antwort)
  } catch (error) {
    console.error(`Hintergrundlauf "${aufgabe}" über HTTP fehlgeschlagen:`, error)
    return NextResponse.json(
      { fehler: 'Der Lauf ist fehlgeschlagen.' },
      { status: 500 },
    )
  }
}

/** GET wird bewusst nicht unterstützt, damit der Job nicht versehentlich läuft. */
export function GET() {
  return NextResponse.json(
    { hinweis: 'Bitte POST mit gültigem Bearer-Token verwenden.' },
    { status: 405 },
  )
}
