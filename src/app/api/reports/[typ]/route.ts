import { NextResponse, type NextRequest } from 'next/server'

import { schreibeAuditLeise } from '@/lib/audit'
import {
  addMonths,
  formatDate,
  parseISODate,
  startOfMonth,
  todayInBerlin,
} from '@/lib/dates'
import { canViewReports } from '@/lib/rbac'
import { holeBenutzer } from '@/lib/session'
import {
  baueDateiname,
  baueKopf,
  ladeAbweichungen,
  ladeCompliance,
  ladeHistorie,
  ladeNachweisregister,
  ladeVorschau,
  REPORT_TITEL,
  type ReportTyp,
} from '@/server/reports/daten'
import {
  erzeugeAbweichungenExcel,
  erzeugeComplianceExcel,
  erzeugeHistorieExcel,
  erzeugeNachweisregisterExcel,
  erzeugeVorschauExcel,
} from '@/server/reports/excel'
import { holeVorlage } from '@/server/report-vorlagen'
import {
  erzeugeAbweichungenPdf,
  erzeugeCompliancePdf,
  erzeugeHistoriePdf,
  erzeugeNachweisregisterPdf,
  erzeugeVorschauPdf,
} from '@/server/reports/pdf'

export const dynamic = 'force-dynamic'
// PDF- und Excel-Erzeugung benötigen die Node-Laufzeit.
export const runtime = 'nodejs'

const GUELTIGE_TYPEN: ReportTyp[] = [
  'compliance',
  'historie',
  'abweichungen',
  'vorschau',
  'nachweise',
]

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

/**
 * Erzeugt einen Report als PDF oder Excel.
 *
 * Parameter:
 *   format     pdf | xlsx        (Pflicht)
 *   von, bis   JJJJ-MM-TT        (Compliance, Historie, Abweichungen)
 *   monate     1 – 36            (Fälligkeitsvorschau)
 *   kategorien kommagetrennte IDs (leer = alle)
 *   referenzen kommagetrennte IDs der Audit-Referenzen (leer = alle)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ typ: string }> },
) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }
  if (!canViewReports(benutzer.role)) {
    return NextResponse.json({ fehler: 'Keine Berechtigung.' }, { status: 403 })
  }

  const { typ } = await params
  if (!GUELTIGE_TYPEN.includes(typ as ReportTyp)) {
    return NextResponse.json({ fehler: 'Unbekannter Report.' }, { status: 404 })
  }
  const reportTyp = typ as ReportTyp

  const suche = request.nextUrl.searchParams
  const format = suche.get('format') === 'xlsx' ? 'xlsx' : 'pdf'

  const kategorien = (suche.get('kategorien') ?? '')
    .split(',')
    .map((eintrag) => eintrag.trim())
    .filter(Boolean)

  const referenzen = (suche.get('referenzen') ?? '')
    .split(',')
    .map((eintrag) => eintrag.trim())
    .filter(Boolean)

  const heute = todayInBerlin()
  // Ohne ausdrueckliche Wahl greift die Standardvorlage der Reportart.
  const vorlage = await holeVorlage(reportTyp, suche.get('vorlage'))

  try {
    let inhalt: Buffer
    let zeitraum: { von: Date; bis: Date }

    if (reportTyp === 'vorschau') {
      const monate = begrenze(Number(suche.get('monate') ?? '6'), 1, 36, 6)
      const vorschau = await ladeVorschau(monate, kategorien, referenzen)
      zeitraum = vorschau.zeitraum
      const kopf = await baueKopf(
        reportTyp,
        zeitraum,
        benutzer.name,
        kategorien,
        referenzen,
      )

      inhalt =
        format === 'pdf'
          ? await erzeugeVorschauPdf(kopf, vorschau.zeilen, vorlage)
          : await erzeugeVorschauExcel(kopf, vorschau.zeilen)
    } else {
      zeitraum = leseZeitraum(suche.get('von'), suche.get('bis'), heute)
      const kopf = await baueKopf(
        reportTyp,
        zeitraum,
        benutzer.name,
        kategorien,
        referenzen,
      )

      if (reportTyp === 'compliance') {
        const daten = await ladeCompliance(zeitraum, kategorien, referenzen)
        inhalt =
          format === 'pdf'
            ? await erzeugeCompliancePdf(kopf, daten, vorlage)
            : await erzeugeComplianceExcel(kopf, daten)
      } else if (reportTyp === 'historie') {
        const daten = await ladeHistorie(zeitraum, kategorien, referenzen)
        inhalt =
          format === 'pdf'
            ? await erzeugeHistoriePdf(kopf, daten, vorlage)
            : await erzeugeHistorieExcel(kopf, daten)
      } else if (reportTyp === 'abweichungen') {
        const daten = await ladeAbweichungen(zeitraum, kategorien, referenzen)
        inhalt =
          format === 'pdf'
            ? await erzeugeAbweichungenPdf(kopf, daten, vorlage)
            : await erzeugeAbweichungenExcel(kopf, daten)
      } else {
        const daten = await ladeNachweisregister(zeitraum, kategorien, referenzen)
        inhalt =
          format === 'pdf'
            ? await erzeugeNachweisregisterPdf(kopf, daten, vorlage)
            : await erzeugeNachweisregisterExcel(kopf, daten)
      }
    }

    await schreibeAuditLeise({
      userId: benutzer.id,
      action: 'REPORT_GENERATED',
      entityType: 'Report',
      entityId: reportTyp,
      payload: {
        bericht: REPORT_TITEL[reportTyp],
        format,
        von: formatDate(zeitraum.von),
        bis: formatDate(zeitraum.bis),
        kategorien: kategorien.length > 0 ? kategorien.length : 'alle',
        vorlage: vorlage.name,
      },
    })

    const dateiname = baueDateiname(reportTyp, zeitraum, format)

    return new NextResponse(new Uint8Array(inhalt), {
      headers: {
        'Content-Type': MIME[format],
        'Content-Length': String(inhalt.byteLength),
        'Content-Disposition': `attachment; filename="${dateiname}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error(`Report "${reportTyp}" konnte nicht erzeugt werden:`, error)
    return NextResponse.json(
      { fehler: 'Der Report konnte nicht erzeugt werden.' },
      { status: 500 },
    )
  }
}

function begrenze(wert: number, min: number, max: number, standard: number) {
  if (!Number.isFinite(wert)) return standard
  return Math.min(max, Math.max(min, Math.trunc(wert)))
}

/** Standardzeitraum: laufendes Jahr bis heute. */
function leseZeitraum(
  von: string | null,
  bis: string | null,
  heute: Date,
): { von: Date; bis: Date } {
  const standardVon = startOfMonth(addMonths(heute, -11))

  let vonDatum: Date
  let bisDatum: Date

  try {
    vonDatum = von ? parseISODate(von) : standardVon
  } catch {
    vonDatum = standardVon
  }
  try {
    bisDatum = bis ? parseISODate(bis) : heute
  } catch {
    bisDatum = heute
  }

  // Vertauschte Angaben werden stillschweigend korrigiert.
  return vonDatum.getTime() <= bisDatum.getTime()
    ? { von: vonDatum, bis: bisDatum }
    : { von: bisDatum, bis: vonDatum }
}
