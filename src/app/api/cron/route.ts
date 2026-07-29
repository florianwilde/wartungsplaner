import { NextResponse, type NextRequest } from 'next/server'

import { starteTagesabgleich } from '@/server/cron'

export const dynamic = 'force-dynamic'

/**
 * Löst den Tagesabgleich zusätzlich per HTTP aus – etwa aus einem externen
 * Scheduler heraus oder zum Testen.
 *
 * Der Endpunkt ist nur nutzbar, wenn `CRON_TOKEN` gesetzt ist, und verlangt
 * dann den Header `Authorization: Bearer <token>`.
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

  try {
    const ergebnis = await starteTagesabgleich(null)
    if (!ergebnis) {
      return NextResponse.json(
        { hinweis: 'Ein Lauf ist bereits aktiv.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ status: 'ok', ergebnis })
  } catch (error) {
    console.error('Tagesabgleich über HTTP fehlgeschlagen:', error)
    return NextResponse.json(
      { fehler: 'Der Tagesabgleich ist fehlgeschlagen.' },
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
