import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { AlertTriangle } from 'lucide-react'

import { FilterLeiste, type FilterFeld } from '@/app/(app)/tasks/filter-leiste'
import { LeerHinweis, SeitenKopf } from '@/components/seiten-kopf'
import { AbweichungStatusBadge, SchwereBadge } from '@/components/status-anzeigen'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { compareDates, formatDate, toISODate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canManageFindings } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { BearbeitenDialog, SchliessenDialog } from './abweichung-aktionen'

export const metadata: Metadata = { title: 'Abweichungen' }
export const dynamic = 'force-dynamic'

type SuchParameter = {
  suche?: string
  status?: string
  schwere?: string
  verantwortlich?: string
}

export default async function AbweichungenSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>
}) {
  const benutzer = await erforderlicherBenutzer()
  const filter = await searchParams
  const heute = todayInBerlin()

  const where: Prisma.FindingWhereInput = {}
  if (filter.suche?.trim()) {
    const suche = filter.suche.trim()
    where.OR = [
      { title: { contains: suche, mode: 'insensitive' } },
      { description: { contains: suche, mode: 'insensitive' } },
    ]
  }
  if (filter.status && filter.status !== 'alle') {
    if (filter.status === 'unerledigt') {
      where.status = { in: ['OPEN', 'IN_PROGRESS'] }
    } else if (filter.status === 'ueberfaellig') {
      where.status = { in: ['OPEN', 'IN_PROGRESS'] }
      where.dueDate = { lt: heute }
    } else {
      where.status = filter.status as Prisma.FindingWhereInput['status']
    }
  }
  if (filter.schwere && filter.schwere !== 'alle') {
    where.severity = filter.schwere as Prisma.FindingWhereInput['severity']
  }
  if (filter.verantwortlich && filter.verantwortlich !== 'alle') {
    where.responsibleId = filter.verantwortlich
  }

  const [abweichungen, personen, verantwortliche] = await Promise.all([
    prisma.finding.findMany({
      where,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      include: {
        responsible: { select: { id: true, name: true } },
        execution: {
          select: {
            executedAt: true,
            executedBy: { select: { name: true } },
            occurrence: {
              select: {
                dueDate: true,
                task: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ['ADMIN', 'EDITOR'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      where: { responsibleFindings: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const darfBearbeiten = canManageFindings(benutzer.role)

  const filterFelder: FilterFeld[] = [
    {
      name: 'status',
      label: 'Status',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        { wert: 'unerledigt', label: 'Offen und in Bearbeitung' },
        { wert: 'ueberfaellig', label: 'Frist überschritten' },
        { wert: 'OPEN', label: 'Offen' },
        { wert: 'IN_PROGRESS', label: 'In Bearbeitung' },
        { wert: 'CLOSED', label: 'Geschlossen' },
      ],
    },
    {
      name: 'schwere',
      label: 'Schweregrad',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        { wert: 'CRITICAL', label: 'Kritisch' },
        { wert: 'HIGH', label: 'Hoch' },
        { wert: 'MEDIUM', label: 'Mittel' },
        { wert: 'LOW', label: 'Gering' },
      ],
    },
    {
      name: 'verantwortlich',
      label: 'Verantwortlich',
      optionen: [
        { wert: 'alle', label: 'Alle Personen' },
        ...verantwortliche.map((v) => ({ wert: v.id, label: v.name })),
      ],
    },
  ]

  const offeneAnzahl = abweichungen.filter((a) => a.status !== 'CLOSED').length

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Abweichungen"
        beschreibung="Feststellungen aus Durchführungen mit Maßnahme, Verantwortlichkeit und Frist."
      />

      <FilterLeiste
        felder={filterFelder}
        suchePlatzhalter="Titel oder Beschreibung"
      />

      {abweichungen.length === 0 ? (
        <LeerHinweis text="Zu den gewählten Filtern gibt es keine Abweichungen." />
      ) : (
        <div className="space-y-3">
          {abweichungen.map((abweichung) => {
            const fristUeberschritten =
              abweichung.status !== 'CLOSED' &&
              compareDates(abweichung.dueDate, heute) < 0

            return (
              <Card key={abweichung.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-medium">{abweichung.title}</h2>
                        <SchwereBadge schwere={abweichung.severity} />
                        <AbweichungStatusBadge status={abweichung.status} />
                        {fristUeberschritten ? (
                          <Badge variant="danger">
                            <AlertTriangle className="size-3" />
                            Frist überschritten
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Aus der Durchführung vom{' '}
                        {formatDate(abweichung.execution.executedAt)} zur Aufgabe{' '}
                        <Link
                          href={`/tasks/${abweichung.execution.occurrence.task.id}`}
                          className="underline hover:no-underline"
                        >
                          {abweichung.execution.occurrence.task.title}
                        </Link>{' '}
                        (Soll-Fälligkeit{' '}
                        {formatDate(abweichung.execution.occurrence.dueDate)})
                      </p>
                    </div>

                    {darfBearbeiten && abweichung.status !== 'CLOSED' ? (
                      <div className="kein-druck flex shrink-0 items-center gap-2">
                        <BearbeitenDialog
                          personen={personen}
                          abweichung={{
                            id: abweichung.id,
                            title: abweichung.title,
                            description: abweichung.description ?? '',
                            severity: abweichung.severity,
                            responsibleId: abweichung.responsibleId,
                            dueDate: toISODate(abweichung.dueDate),
                            status:
                              abweichung.status === 'IN_PROGRESS'
                                ? 'IN_PROGRESS'
                                : 'OPEN',
                          }}
                        />
                        <SchliessenDialog
                          findingId={abweichung.id}
                          titel={abweichung.title}
                        />
                      </div>
                    ) : null}
                  </div>

                  {abweichung.description ? (
                    <p className="whitespace-pre-wrap text-sm">
                      {abweichung.description}
                    </p>
                  ) : null}

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Verantwortlich: <strong>{abweichung.responsible.name}</strong>
                    </span>
                    <span>
                      Frist: <strong>{formatDate(abweichung.dueDate)}</strong>
                    </span>
                    <span>
                      Festgestellt durch {abweichung.execution.executedBy.name}
                    </span>
                    {abweichung.closedAt ? (
                      <span>Geschlossen am {formatDate(abweichung.closedAt)}</span>
                    ) : null}
                  </div>

                  {abweichung.closingComment ? (
                    <div className="rounded-md bg-muted/60 p-3 text-sm">
                      <p className="text-xs font-medium text-muted-foreground">
                        Umgesetzte Maßnahme
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">
                        {abweichung.closingComment}
                      </p>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {abweichungen.length} angezeigt, davon {offeneAnzahl} nicht geschlossen.
      </p>
    </div>
  )
}
