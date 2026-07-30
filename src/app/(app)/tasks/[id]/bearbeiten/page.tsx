import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { SeitenKopf } from '@/components/seiten-kopf'
import { sortiereReferenzen } from '@/lib/audit-referenzen'
import { toISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import { aufgabeAendern } from '@/server/actions/aufgaben'
import { AufgabenFormular } from '../../aufgaben-formular'

export const metadata: Metadata = { title: 'Aufgabe bearbeiten' }
export const dynamic = 'force-dynamic'

export default async function AufgabeBearbeitenSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await erforderlicheRolle('ADMIN')
  const { id } = await params

  const [aufgabe, kategorien, personen, referenzen] = await Promise.all([
    prisma.task.findUnique({
      where: { id },
      include: { auditReferenzen: { select: { referenzId: true } } },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ['ADMIN', 'EDITOR'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    // Ausgemusterte Referenzen bleiben zugeordnet, werden aber nicht mehr
    // zur Neuvergabe angeboten.
    prisma.auditReferenz.findMany({
      where: { aktiv: true },
      select: { id: true, kuerzel: true, bezeichnung: true, rahmenwerk: true },
    }),
  ])

  if (!aufgabe) notFound()

  // Der bisherige Verantwortliche bleibt wählbar, auch wenn er inzwischen
  // deaktiviert wurde – sonst ließe sich die Aufgabe nicht mehr speichern.
  const personenMitBisherigem = personen.some((p) => p.id === aufgabe.ownerId)
    ? personen
    : [
        ...personen,
        await prisma.user
          .findUniqueOrThrow({
            where: { id: aufgabe.ownerId },
            select: { id: true, name: true },
          })
          .then((p) => ({ ...p, name: `${p.name} (deaktiviert)` })),
      ]

  const aendern = aufgabeAendern.bind(null, aufgabe.id)

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SeitenKopf
        titel="Aufgabe bearbeiten"
        beschreibung={`Änderungen wirken sich auf künftige Fälligkeiten aus. Bereits protokollierte Durchführungen bleiben unverändert.`}
      />

      <AufgabenFormular
        aktion={aendern}
        absendeLabel="Änderungen speichern"
        abbrechenHref={`/tasks/${aufgabe.id}`}
        kategorien={kategorien}
        personen={personenMitBisherigem}
        referenzen={sortiereReferenzen(referenzen)}
        werte={{
          title: aufgabe.title,
          description: aufgabe.description ?? '',
          instructionsMd: aufgabe.instructionsMd ?? '',
          categoryId: aufgabe.categoryId,
          ownerId: aufgabe.ownerId,
          intervalType: aufgabe.intervalType,
          intervalValue: aufgabe.intervalValue,
          scheduleMode: aufgabe.scheduleMode,
          startDate: toISODate(aufgabe.startDate),
          leadTimeDays: aufgabe.leadTimeDays,
          graceDays: aufgabe.graceDays,
          evidenceRequired: aufgabe.evidenceRequired,
          criticality: aufgabe.criticality,
          auditReferenzIds: aufgabe.auditReferenzen.map((z) => z.referenzId),
          active: aufgabe.active,
        }}
      />
    </div>
  )
}
