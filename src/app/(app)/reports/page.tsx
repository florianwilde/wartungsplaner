import type { Metadata } from 'next'

import { SeitenKopf } from '@/components/seiten-kopf'
import { ArchivKarte } from './archiv-karte'
import { addMonths, startOfMonth, toISODate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeAlleVorlagen } from '@/server/report-vorlagen'
import { REPORT_BESCHREIBUNG, REPORT_TITEL } from '@/server/reports/typen'
import { ReportFormular, type ReportDefinition } from './report-formular'

export const metadata: Metadata = { title: 'Reports' }
export const dynamic = 'force-dynamic'

const BERICHTE: Omit<ReportDefinition, 'vorlagen'>[] = [
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
    typ: 'nachweise',
    titel: REPORT_TITEL.nachweise,
    beschreibung: REPORT_BESCHREIBUNG.nachweise,
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

  const vorlagen = await ladeAlleVorlagen()

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
        berichte={BERICHTE.map((bericht) => ({
          ...bericht,
          vorlagen: (vorlagen[bericht.typ] ?? []).map((v) => ({
            id: v.id!,
            name: v.name,
            istStandard: v.istStandard,
          })),
        }))}
        kategorien={kategorien}
        standardVon={toISODate(startOfMonth(addMonths(heute, -11)))}
        standardBis={toISODate(heute)}
      />

      <ArchivKarte
        standardVon={toISODate(startOfMonth(addMonths(heute, -11)))}
        standardBis={toISODate(heute)}
        kategorien={kategorien.map((k) => ({ id: k.id, name: k.name }))}
      />

      <p className="text-xs text-muted-foreground">
        Die Berichte tragen im Kopf Anwendungsname, Zeitraum, Kategorienfilter
        sowie Erstellungsdatum und erstellende Person ({benutzer.name}); PDF-Berichte
        zusätzlich eine Seitenzählung.
      </p>
    </div>
  )
}
