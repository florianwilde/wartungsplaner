import type { Metadata } from 'next'

import { SeitenKopf } from '@/components/seiten-kopf'
import { vergleicheKuerzel } from '@/lib/audit-referenzen'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { ReferenzenVerwaltung } from './referenzen-verwaltung'

export const metadata: Metadata = { title: 'Audit-Referenzen' }
export const dynamic = 'force-dynamic'

export default async function AuditReferenzenSeite() {
  const benutzer = await erforderlicherBenutzer()
  if (!canAdminister(benutzer.role)) {
    return (
      <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Diese Seite ist der Administration vorbehalten.
      </p>
    )
  }

  const referenzen = await prisma.auditReferenz.findMany({
    include: { _count: { select: { aufgaben: true } } },
  })

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Audit-Referenzen"
        beschreibung="Die Anforderungen, gegen die geprüft wird. Aufgaben lassen sich mehreren zuordnen; Listen und Auswertungen können danach gefiltert werden."
      />

      <ReferenzenVerwaltung
        referenzen={referenzen
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              vergleicheKuerzel(a.kuerzel, b.kuerzel),
          )
          .map((referenz) => ({
            id: referenz.id,
            kuerzel: referenz.kuerzel,
            bezeichnung: referenz.bezeichnung,
            rahmenwerk: referenz.rahmenwerk,
            beschreibung: referenz.beschreibung,
            aktiv: referenz.aktiv,
            anzahlAufgaben: referenz._count.aufgaben,
          }))}
      />
    </div>
  )
}
