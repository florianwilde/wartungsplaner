import type { Metadata } from 'next'

import { SeitenKopf } from '@/components/seiten-kopf'
import { toISODate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import { aufgabeAnlegen } from '@/server/actions/aufgaben'
import { AufgabenFormular } from '../aufgaben-formular'

export const metadata: Metadata = { title: 'Neue Aufgabe' }
export const dynamic = 'force-dynamic'

export default async function NeueAufgabeSeite() {
  await erforderlicheRolle('ADMIN')

  const [kategorien, personen] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ['ADMIN', 'EDITOR'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SeitenKopf
        titel="Neue Aufgabe"
        beschreibung="Nach dem Speichern wird automatisch die erste Fälligkeit zum Startdatum erzeugt."
      />

      <AufgabenFormular
        aktion={aufgabeAnlegen}
        absendeLabel="Aufgabe anlegen"
        leitetZuDetailWeiter
        abbrechenHref="/tasks"
        kategorien={kategorien}
        personen={personen}
        werte={{
          title: '',
          description: '',
          instructionsMd: '',
          categoryId: kategorien[0]?.id ?? '',
          ownerId: '',
          intervalType: 'QUARTERLY',
          intervalValue: null,
          scheduleMode: 'FIXED',
          startDate: toISODate(todayInBerlin()),
          leadTimeDays: 14,
          graceDays: 7,
          evidenceRequired: true,
          criticality: 'MEDIUM',
          auditReference: '',
          active: true,
        }}
      />
    </div>
  )
}
