import { NextResponse, type NextRequest } from 'next/server'

import { schreibeAuditLeise } from '@/lib/audit'
import { toISODate, todayInBerlin } from '@/lib/dates'
import { canAdminister } from '@/lib/rbac'
import { holeBenutzer } from '@/lib/session'
import type { ImportArt } from '@/lib/import-export'
import {
  exportiereAllesJson,
  exportiereCsv,
  exportiereJson,
  vorlageCsv,
} from '@/server/export'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ARTEN: ImportArt[] = ['kategorien', 'aufgaben', 'benutzer']

/**
 * Exportiert Stammdaten als CSV oder JSON.
 *
 * Nur für Administratoren: Der Export enthält die vollständige Benutzerliste
 * und die Zuordnung der Verantwortlichkeiten.
 *
 *   /api/export/kategorien?format=csv
 *   /api/export/aufgaben?format=json
 *   /api/export/alles                    (JSON mit allen Bereichen)
 *   /api/export/benutzer?vorlage=true    (leere Vorlage mit Beispielzeile)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typ: string }> },
) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }
  if (!canAdminister(benutzer.role)) {
    return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 })
  }

  const { typ } = await params
  const suche = request.nextUrl.searchParams
  const format = suche.get('format') === 'json' ? 'json' : 'csv'
  const istVorlage = suche.get('vorlage') === 'true'
  const stichtag = toISODate(todayInBerlin())

  try {
    let inhalt: string
    let dateiname: string
    let mimeType: string

    if (typ === 'alles') {
      inhalt = await exportiereAllesJson()
      dateiname = `wartungsplaner-export-${stichtag}.json`
      mimeType = 'application/json; charset=utf-8'
    } else if (ARTEN.includes(typ as ImportArt)) {
      const art = typ as ImportArt

      if (istVorlage) {
        inhalt = vorlageCsv(art)
        dateiname = `wartungsplaner-vorlage-${art}.csv`
        mimeType = 'text/csv; charset=utf-8'
      } else if (format === 'json') {
        inhalt = await exportiereJson(art)
        dateiname = `wartungsplaner-${art}-${stichtag}.json`
        mimeType = 'application/json; charset=utf-8'
      } else {
        inhalt = await exportiereCsv(art)
        dateiname = `wartungsplaner-${art}-${stichtag}.csv`
        mimeType = 'text/csv; charset=utf-8'
      }
    } else {
      return NextResponse.json(
        { fehler: 'Unbekannter Bereich. Erlaubt: kategorien, aufgaben, benutzer, alles.' },
        { status: 404 },
      )
    }

    if (!istVorlage) {
      await schreibeAuditLeise({
        userId: benutzer.id,
        action: 'EXPORT_ERZEUGT',
        entityType: 'Export',
        entityId: typ,
        payload: { bereich: typ, format },
      })
    }

    return new NextResponse(inhalt, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error(`Export "${typ}" fehlgeschlagen:`, error)
    return NextResponse.json(
      { fehler: 'Der Export konnte nicht erzeugt werden.' },
      { status: 500 },
    )
  }
}
