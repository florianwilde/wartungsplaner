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
import { AufgabenTabelle } from './aufgaben-tabelle'
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
      // Entscheidet, ob sich die Aufgabe löschen lässt: Mit auch nur
      // einer Durchführung hängt Historie daran.
      _count: {
        select: { occurrences: { where: { execution: { isNot: null } } } },
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
        <AufgabenTabelle
          darfVerwalten={canManageTasks(benutzer.role)}
          istAdmin={benutzer.role === 'ADMIN'}
          aufgaben={aufgaben.map((aufgabe) => {
            const naechste = aufgabe.occurrences[0]
            return {
              id: aufgabe.id,
              titel: aufgabe.title,
              aktiv: aufgabe.active,
              nachweispflicht: aufgabe.evidenceRequired,
              referenzen: aufgabe.auditReferenzen.map((zuordnung) => ({
                id: zuordnung.referenzId,
                kuerzel: zuordnung.referenz.kuerzel,
                langname: langName(zuordnung.referenz),
              })),
              kategorie: {
                name: aufgabe.category.name,
                farbe: aufgabe.category.color,
              },
              verantwortlich: aufgabe.owner.name,
              intervall: intervallText(
                aufgabe.intervalType,
                aufgabe.intervalValue,
              ),
              kritikalitaet: aufgabe.criticality,
              naechste: naechste
                ? {
                    datum: formatDate(naechste.dueDate),
                    status: naechste.status,
                    // Der Stichtag gehört auf den Server: Sonst bewertet
                    // der Browser des Betrachters mit seiner eigenen Uhr.
                    ampel: bewerteAmpel(
                      naechste.dueDate,
                      aufgabe.leadTimeDays,
                      aufgabe.graceDays,
                      heute,
                    ),
                  }
                : null,
              durchfuehrungen: aufgabe._count.occurrences,
            }
          })}
        />
      )}
      <p className="text-xs text-muted-foreground">
        {aufgaben.length} {aufgaben.length === 1 ? 'Aufgabe' : 'Aufgaben'} angezeigt.
      </p>
    </div>
  )
}
