import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { Plus } from 'lucide-react'

import { SeitenKopf, LeerHinweis } from '@/components/seiten-kopf'
import {
  AmpelBadge,
  FaelligkeitsStatusBadge,
  KategoriePunkt,
  KritikalitaetBadge,
} from '@/components/status-anzeigen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canManageTasks } from '@/lib/rbac'
import { bewerteAmpel, intervallText } from '@/lib/scheduling'
import {
  anzeigeName,
  langName,
  sortiereReferenzen,
} from '@/lib/audit-referenzen'
import { erforderlicherBenutzer } from '@/lib/session'
import { FilterLeiste, type FilterFeld } from './filter-leiste'

export const metadata: Metadata = { title: 'Aufgaben' }
export const dynamic = 'force-dynamic'

type SuchParameter = {
  suche?: string
  kategorie?: string
  verantwortlich?: string
  status?: string
  kritikalitaet?: string
  referenz?: string
}

export default async function AufgabenSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>
}) {
  const benutzer = await erforderlicherBenutzer()
  const filter = await searchParams
  const heute = todayInBerlin()

  const [kategorien, verantwortliche] = await Promise.all([
    prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.user.findMany({
      where: { ownedTasks: { some: {} } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ])

  const where: Prisma.TaskWhereInput = {}
  if (filter.suche?.trim()) {
    const suche = filter.suche.trim()
    where.OR = [
      { title: { contains: suche, mode: 'insensitive' } },
      { description: { contains: suche, mode: 'insensitive' } },
      { auditReference: { contains: suche, mode: 'insensitive' } },
      {
        auditReferenzen: {
          some: {
            referenz: {
              OR: [
                { kuerzel: { contains: suche, mode: 'insensitive' } },
                { bezeichnung: { contains: suche, mode: 'insensitive' } },
                { rahmenwerk: { contains: suche, mode: 'insensitive' } },
              ],
            },
          },
        },
      },
    ]
  }
  if (filter.referenz && filter.referenz !== 'alle') {
    where.auditReferenzen = { some: { referenzId: filter.referenz } }
  }
  if (filter.kategorie && filter.kategorie !== 'alle') {
    where.categoryId = filter.kategorie
  }
  if (filter.verantwortlich && filter.verantwortlich !== 'alle') {
    where.ownerId = filter.verantwortlich
  }
  if (filter.kritikalitaet && filter.kritikalitaet !== 'alle') {
    where.criticality = filter.kritikalitaet as Prisma.TaskWhereInput['criticality']
  }
  if (filter.status === 'aktiv') where.active = true
  if (filter.status === 'inaktiv') where.active = false
  if (filter.status === 'ueberfaellig') {
    where.occurrences = { some: { status: 'OVERDUE' } }
  }
  if (filter.status === 'offen') {
    where.occurrences = { some: { status: { in: ['OPEN', 'OVERDUE'] } } }
  }

  const aufgaben = await prisma.task.findMany({
    where,
    orderBy: [{ active: 'desc' }, { title: 'asc' }],
    include: {
      category: { select: { name: true, color: true } },
      owner: { select: { name: true } },
      auditReferenzen: {
        select: {
          referenzId: true,
          referenz: {
            select: { kuerzel: true, bezeichnung: true, rahmenwerk: true },
          },
        },
      },
      occurrences: {
        where: { status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { id: true, dueDate: true, status: true },
      },
    },
  })

  const referenzenMitAufgaben = sortiereReferenzen(
    await prisma.auditReferenz.findMany({
      where: { aufgaben: { some: {} } },
      select: { id: true, kuerzel: true, rahmenwerk: true },
    }),
  )

  const filterFelder: FilterFeld[] = [
    {
      name: 'kategorie',
      label: 'Kategorie',
      optionen: [
        { wert: 'alle', label: 'Alle Kategorien' },
        ...kategorien.map((k) => ({ wert: k.id, label: k.name })),
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
    {
      name: 'status',
      label: 'Status',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        { wert: 'aktiv', label: 'Nur aktive' },
        { wert: 'inaktiv', label: 'Nur deaktivierte' },
        { wert: 'offen', label: 'Mit offener Fälligkeit' },
        { wert: 'ueberfaellig', label: 'Mit überfälliger Fälligkeit' },
      ],
    },
    // Nur Referenzen anbieten, denen tatsaechlich Aufgaben zugeordnet sind -
    // ein Filter, der stets leer ausgeht, hilft niemandem.
    ...(referenzenMitAufgaben.length > 0
      ? [
          {
            name: 'referenz',
            label: 'Audit-Referenz',
            optionen: [
              { wert: 'alle', label: 'Alle Referenzen' },
              ...referenzenMitAufgaben.map((r) => ({
                wert: r.id,
                label: anzeigeName(r),
              })),
            ],
          },
        ]
      : []),
    {
      name: 'kritikalitaet',
      label: 'Kritikalität',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        { wert: 'HIGH', label: 'Hoch' },
        { wert: 'MEDIUM', label: 'Mittel' },
        { wert: 'LOW', label: 'Niedrig' },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Aufgaben"
        beschreibung="Alle wiederkehrenden Prüf- und Wartungsaufgaben mit ihrer nächsten Fälligkeit."
        aktionen={
          canManageTasks(benutzer.role) ? (
            <Button asChild>
              <Link href="/tasks/neu">
                <Plus className="size-4" />
                Neue Aufgabe
              </Link>
            </Button>
          ) : null
        }
      />

      <FilterLeiste
        felder={filterFelder}
        suchePlatzhalter="Titel, Beschreibung oder Audit-Referenz"
      />

      {aufgaben.length === 0 ? (
        <LeerHinweis text="Zu den gewählten Filtern gibt es keine Aufgaben." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aufgabe</TableHead>
                <TableHead>Kategorie</TableHead>
                <TableHead>Verantwortlich</TableHead>
                <TableHead>Intervall</TableHead>
                <TableHead>Nächste Fälligkeit</TableHead>
                <TableHead>Kritikalität</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aufgaben.map((aufgabe) => {
                const naechste = aufgabe.occurrences[0]
                return (
                  <TableRow key={aufgabe.id}>
                    <TableCell>
                      <Link
                        href={`/tasks/${aufgabe.id}`}
                        className="font-medium hover:underline"
                      >
                        {aufgabe.title}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {!aufgabe.active ? (
                          <Badge variant="secondary">Deaktiviert</Badge>
                        ) : null}
                        {aufgabe.evidenceRequired ? (
                          <Badge variant="outline">Nachweis nötig</Badge>
                        ) : null}
                        {aufgabe.auditReferenzen.map((zuordnung) => (
                          <Badge
                            key={zuordnung.referenzId}
                            variant="outline"
                            title={langName(zuordnung.referenz)}
                          >
                            {zuordnung.referenz.kuerzel}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <KategoriePunkt farbe={aufgabe.category.color} />
                        {aufgabe.category.name}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {aufgabe.owner.name}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {intervallText(aufgabe.intervalType, aufgabe.intervalValue)}
                    </TableCell>
                    <TableCell>
                      {naechste ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span>{formatDate(naechste.dueDate)}</span>
                          {naechste.status === 'SUSPENDED' ? (
                            <FaelligkeitsStatusBadge status="SUSPENDED" />
                          ) : (
                            <AmpelBadge
                              ampel={bewerteAmpel(
                                naechste.dueDate,
                                aufgabe.leadTimeDays,
                                aufgabe.graceDays,
                                heute,
                              )}
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <KritikalitaetBadge kritikalitaet={aufgabe.criticality} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {aufgaben.length} {aufgaben.length === 1 ? 'Aufgabe' : 'Aufgaben'} angezeigt.
      </p>
    </div>
  )
}
