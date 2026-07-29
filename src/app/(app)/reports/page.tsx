import type { Metadata } from 'next'

import { SeitenKopf } from '@/components/seiten-kopf'
import { addMonths, startOfMonth, toISODate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicherBenutzer } from '@/lib/session'
import { REPORT_BESCHREIBUNG, REPORT_TITEL } from '@/server/reports/daten'
import { ReportFormular, type ReportDefinition } from './report-formular'

export const metadata: Metadata = { title: 'Reports' }
export const dynamic = 'force-dynamic'

const BERICHTE: ReportDefinition[] = [
  {
    typ: 'compliance',
    titel: REPORT_TITEL.compliance,
    beschreibung: REPORT_BESCHREIBUNG.compliance,
    mitZeitraum: true,
  },
  {
    typ: 'historie',
    titel: REPORT_TITEL.historie,
    beschreibung: REPORT_BESCHREIBUNG.historie,
    mitZeitraum: true,
  },
  {
    typ: 'abweichungen',
    titel: REPORT_TITEL.abweichungen,
    beschreibung: REPORT_BESCHREIBUNG.abweichungen,
    mitZeitraum: true,
  },
  {
    typ: 'vorschau',
    titel: REPORT_TITEL.vorschau,
    beschreibung: REPORT_BESCHREIBUNG.vorschau,
    mitZeitraum: false,
  },
]

export default async function ReportsSeite() {
  const benutzer = await erforderlicherBenutzer()
  const heute = todayInBerlin()

  const kategorien = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true },
  })

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Reports"
        beschreibung="Auditfertige Auswertungen als PDF oder Excel. Jeder Abruf wird protokolliert."
      />

      <ReportFormular
        berichte={BERICHTE}
        kategorien={kategorien}
        standardVon={toISODate(startOfMonth(addMonths(heute, -11)))}
        standardBis={toISODate(heute)}
      />

      <p className="text-xs text-muted-foreground">
        Die Berichte tragen im Kopf Anwendungsname, Zeitraum, Kategorienfilter
        sowie Erstellungsdatum und erstellende Person ({benutzer.name}); PDF-Berichte
        zusätzlich eine Seitenzählung.
      </p>
    </div>
  )
}
