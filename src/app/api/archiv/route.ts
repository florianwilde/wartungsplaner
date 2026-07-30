import { NextResponse, type NextRequest } from 'next/server'

import { schreibeAuditLeise } from '@/lib/audit'
import { formatDate, parseISODate, startOfMonth, todayInBerlin } from '@/lib/dates'
import { canViewReports } from '@/lib/rbac'
import { holeBenutzer } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import {
  baueArchivDateiname,
  erzeugeNachweisArchiv,
} from '@/server/reports/archiv'

export const dynamic = 'force-dynamic'
// Das Archiv wird als Datenstrom gebaut und braucht die Node-Laufzeit.
export const runtime = 'nodejs'

/**
 * Liefert alle Nachweise eines Zeitraums als ZIP.
 *
 * Beigelegt sind ein Inhaltsverzeichnis, eine Prüfsummenliste im Format von
 * `sha256sum` und eine Erläuterung, wie sich die Unverändertheit ohne diese
 * Anwendung nachrechnen lässt.
 *
 * Parameter:
 *   von, bis   JJJJ-MM-TT         (Standard: laufendes Jahr bis heute)
 *   kategorien kommagetrennte IDs (leer = alle)
 */
export async function GET(request: NextRequest) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }
  if (!canViewReports(benutzer.role)) {
    return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 })
  }

  const suche = request.nextUrl.searchParams
  const heute = todayInBerlin()

  let von: Date
  let bis: Date
  try {
    von = suche.get('von')
      ? parseISODate(suche.get('von')!)
      : startOfMonth(new Date(Date.UTC(heute.getUTCFullYear(), 0, 1)))
    bis = suche.get('bis') ? parseISODate(suche.get('bis')!) : heute
  } catch {
    return NextResponse.json({ fehler: 'Ungültiger Zeitraum.' }, { status: 400 })
  }
  if (von.getTime() > bis.getTime()) {
    return NextResponse.json(
      { fehler: 'Das Startdatum liegt nach dem Enddatum.' },
      { status: 400 },
    )
  }

  const kategorien = (suche.get('kategorien') ?? '')
    .split(',')
    .map((eintrag) => eintrag.trim())
    .filter(Boolean)

  let kategorienText = 'Alle Kategorien'
  if (kategorien.length > 0) {
    const gefunden = await prisma.category.findMany({
      where: { id: { in: kategorien } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    })
    kategorienText = gefunden.map((k) => k.name).join(', ') || 'Alle Kategorien'
  }

  try {
    const zeitraum = { von, bis }
    const { strom, inhalt } = await erzeugeNachweisArchiv(
      zeitraum,
      kategorien,
      benutzer.name,
      kategorienText,
    )

    await schreibeAuditLeise({
      userId: benutzer.id,
      action: 'ARCHIV_ERZEUGT',
      entityType: 'Report',
      entityId: 'archiv',
      payload: {
        von: formatDate(von),
        bis: formatDate(bis),
        nachweise: inhalt.eintraege.length,
        fehlend: inhalt.fehlend.length,
        bytes: inhalt.gesamtBytes,
        kategorien: kategorien.length > 0 ? kategorien.length : 'alle',
      },
    })

    const dateiname = baueArchivDateiname(zeitraum)

    // Der Strom wird durchgereicht, statt das Archiv vorher vollständig im
    // Speicher zu halten – ein Jahresbestand kann hunderte Megabyte umfassen.
    return new NextResponse(strom as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Archiv konnte nicht erzeugt werden:', error)
    return NextResponse.json(
      { fehler: 'Das Archiv konnte nicht erzeugt werden.' },
      { status: 500 },
    )
  }
}
