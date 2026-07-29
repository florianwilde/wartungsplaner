import type { Metadata } from 'next'

import { erforderlicheRolle } from '@/lib/session'
import { ladeAlleVorlagen } from '@/server/report-vorlagen'
import { REPORT_BESCHREIBUNG, REPORT_TYPEN } from '@/server/reports/typen'
import { VorlagenVerwaltung } from './vorlagen-formular'

export const metadata: Metadata = { title: 'Report-Vorlagen' }
export const dynamic = 'force-dynamic'

export default async function ReportVorlagenSeite() {
  await erforderlicheRolle('ADMIN')
  const vorlagen = await ladeAlleVorlagen()

  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        Vorlagen bestimmen Aufbau und Umfang der <strong>PDF-Berichte</strong>:
        Ausrichtung, Spaltenauswahl, Deckblatt, Freitextblöcke und
        Unterschriftenfelder. Ohne eigene Vorlage gilt die eingebaute Fassung.
        Die Excel-Exporte enthalten stets alle Felder und sind davon nicht
        betroffen.
      </p>

      {REPORT_TYPEN.map((typ) => (
        <div key={typ} className="space-y-2">
          <VorlagenVerwaltung typ={typ} vorlagen={vorlagen[typ] ?? []} />
          <p className="px-1 text-xs text-muted-foreground">
            {REPORT_BESCHREIBUNG[typ]}
          </p>
        </div>
      ))}
    </div>
  )
}
