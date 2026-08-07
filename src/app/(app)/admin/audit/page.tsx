import type { Metadata } from 'next'
import Link from 'next/link'
import type { Prisma } from '@prisma/client'
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

import { FilterLeiste, type FilterFeld } from '@/app/(app)/tasks/filter-leiste'
import { LeerHinweis } from '@/components/seiten-kopf'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AUDIT_AKTIONEN, auditAktionLabel } from '@/lib/audit'
import { formatDateTime, parseISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'

export const metadata: Metadata = { title: 'Audit-Log' }
export const dynamic = 'force-dynamic'

const PRO_SEITE = 50

type SuchParameter = {
  suche?: string
  aktion?: string
  entitaet?: string
  benutzer?: string
  von?: string
  bis?: string
  seite?: string
}

export default async function AuditSeite({
  searchParams,
}: {
  searchParams: Promise<SuchParameter>
}) {
  await erforderlicheRolle('ADMIN')
  const filter = await searchParams

  const seite = Math.max(1, Number(filter.seite ?? '1') || 1)

  const where: Prisma.AuditLogWhereInput = {}
  if (filter.aktion && filter.aktion !== 'alle') where.action = filter.aktion
  if (filter.entitaet && filter.entitaet !== 'alle') where.entityType = filter.entitaet
  if (filter.benutzer && filter.benutzer !== 'alle') {
    where.userId = filter.benutzer === 'system' ? null : filter.benutzer
  }
  if (filter.suche?.trim()) {
    const suche = filter.suche.trim()
    where.OR = [
      { entityId: { contains: suche, mode: 'insensitive' } },
      { action: { contains: suche, mode: 'insensitive' } },
      { entityType: { contains: suche, mode: 'insensitive' } },
      { user: { name: { contains: suche, mode: 'insensitive' } } },
    ]
  }

  const zeitfilter: Prisma.DateTimeFilter = {}
  if (filter.von) {
    try {
      zeitfilter.gte = parseISODate(filter.von)
    } catch {
      /* ungültige Eingabe ignorieren */
    }
  }
  if (filter.bis) {
    try {
      const bis = parseISODate(filter.bis)
      zeitfilter.lte = new Date(bis.getTime() + 24 * 60 * 60 * 1000 - 1)
    } catch {
      /* ungültige Eingabe ignorieren */
    }
  }
  if (Object.keys(zeitfilter).length > 0) where.timestamp = zeitfilter

  const [eintraege, gesamt, benutzer, entitaeten] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (seite - 1) * PRO_SEITE,
      take: PRO_SEITE,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.auditLog.findMany({
      distinct: ['entityType'],
      select: { entityType: true },
      orderBy: { entityType: 'asc' },
    }),
  ])

  const seiten = Math.max(1, Math.ceil(gesamt / PRO_SEITE))

  const filterFelder: FilterFeld[] = [
    {
      name: 'aktion',
      label: 'Aktion',
      optionen: [
        { wert: 'alle', label: 'Alle Aktionen' },
        ...Object.entries(AUDIT_AKTIONEN).map(([wert, label]) => ({ wert, label })),
      ],
    },
    {
      name: 'entitaet',
      label: 'Objektart',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        ...entitaeten.map((e) => ({ wert: e.entityType, label: e.entityType })),
      ],
    },
    {
      name: 'benutzer',
      label: 'Benutzer',
      optionen: [
        { wert: 'alle', label: 'Alle' },
        { wert: 'system', label: 'System / Hintergrundjob' },
        ...benutzer.map((b) => ({ wert: b.id, label: b.name })),
      ],
    },
  ]

  const seitenUrl = (nummer: number) => {
    const params = new URLSearchParams()
    for (const [schluessel, wert] of Object.entries(filter)) {
      if (wert && schluessel !== 'seite') params.set(schluessel, wert)
    }
    params.set('seite', String(nummer))
    return `/admin/audit?${params.toString()}`
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="text-status-ok size-4" />
            Audit-Log
          </CardTitle>
          <CardDescription>
            Revisionssicheres Protokoll aller schreibenden Vorgänge. Einträge können
            ausschließlich hinzugefügt werden – Änderungen und Löschungen sind
            zusätzlich per Datenbank-Trigger unterbunden. Diese Ansicht ist rein lesend.
          </CardDescription>
        </CardHeader>
      </Card>

      <FilterLeiste
        felder={filterFelder}
        suchePlatzhalter="Aktion, Objekt-ID oder Person"
      />

      {eintraege.length === 0 ? (
        <LeerHinweis text="Zu den gewählten Filtern gibt es keine Protokolleinträge." />
      ) : (
        <div className="border-border bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Zeitpunkt</TableHead>
                <TableHead className="w-44">Benutzer</TableHead>
                <TableHead className="w-56">Aktion</TableHead>
                <TableHead className="w-28">Objektart</TableHead>
                <TableHead>Einzelheiten</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eintraege.map((eintrag) => (
                <TableRow key={eintrag.id}>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatDateTime(eintrag.timestamp)}
                  </TableCell>
                  <TableCell>
                    {eintrag.user ? (
                      <span title={eintrag.user.email}>{eintrag.user.name}</span>
                    ) : (
                      <Badge variant="neutral">System</Badge>
                    )}
                  </TableCell>
                  <TableCell>{auditAktionLabel(eintrag.action)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {eintrag.entityType}
                  </TableCell>
                  <TableCell>
                    <Einzelheiten payload={eintrag.payloadJson} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-xs">
          {gesamt.toLocaleString('de-DE')} Einträge · Seite {seite} von {seiten}
        </p>
        {/* Ein <a> lässt sich nicht deaktivieren – am Rand wird deshalb ein
            echter, inaktiver Button gerendert. */}
        <div className="kein-druck flex items-center gap-2">
          {seite > 1 ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={seitenUrl(seite - 1)}>
                <ChevronLeft className="size-4" />
                Zurück
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-4" />
              Zurück
            </Button>
          )}

          {seite < seiten ? (
            <Button variant="outline" size="sm" asChild>
              <Link href={seitenUrl(seite + 1)}>
                Weiter
                <ChevronRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Weiter
              <ChevronRight className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Stellt die Nutzdaten eines Eintrags kompakt als Schlüssel-Wert-Paare dar. */
function Einzelheiten({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== 'object') {
    return <span className="text-muted-foreground">–</span>
  }

  const paare = Object.entries(payload as Record<string, unknown>)
  if (paare.length === 0) {
    return <span className="text-muted-foreground">–</span>
  }

  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
      {paare.map(([schluessel, wert]) => (
        <div key={schluessel} className="flex gap-1">
          <dt className="text-muted-foreground">{schluessel}:</dt>
          <dd className="font-medium break-all">{darstelle(wert)}</dd>
        </div>
      ))}
    </dl>
  )
}

function darstelle(wert: unknown): string {
  if (wert === null || wert === undefined) return '–'
  if (typeof wert === 'boolean') return wert ? 'ja' : 'nein'
  if (typeof wert === 'object') return JSON.stringify(wert)
  const text = String(wert)
  return text.length > 160 ? `${text.slice(0, 160)} …` : text
}
