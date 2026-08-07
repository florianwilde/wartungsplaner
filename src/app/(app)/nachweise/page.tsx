import type { Metadata } from 'next'
import Link from 'next/link'
import { ClipboardCheck, Stamp } from 'lucide-react'

import { LeerHinweis, SeitenKopf } from '@/components/seiten-kopf'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/dates'
import { STATUS_BEZEICHNUNG, type NachweisStatus } from '@/lib/nachweise'
import { prisma } from '@/lib/prisma'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeOffeneGegenzeichnungen } from '@/server/nachweise'

export const metadata: Metadata = { title: 'Prüfnachweise' }
export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: NachweisStatus }) {
  const variante = {
    ENTWURF: 'neutral',
    VORGELEGT: 'warn',
    GEGENGEZEICHNET: 'ok',
    ZURUECKGEWIESEN: 'danger',
  } as const
  return <Badge variant={variante[status]}>{STATUS_BEZEICHNUNG[status]}</Badge>
}

export default async function NachweiseSeite() {
  const benutzer = await erforderlicherBenutzer()

  const [eigene, zumGegenzeichnen, abgeschlossen] = await Promise.all([
    prisma.nachweis.findMany({
      where: {
        erfasstById: benutzer.id,
        status: { in: ['ENTWURF', 'VORGELEGT', 'ZURUECKGEWIESEN'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        vorlage: { select: { name: true, vierAugen: true } },
        occurrence: {
          select: { dueDate: true, task: { select: { id: true, title: true } } },
        },
      },
    }),
    ladeOffeneGegenzeichnungen(benutzer.id),
    prisma.nachweis.findMany({
      where: { status: 'GEGENGEZEICHNET' },
      orderBy: { geprueftAm: 'desc' },
      take: 15,
      include: {
        vorlage: { select: { name: true } },
        erfasstBy: { select: { name: true } },
        geprueftBy: { select: { name: true } },
        attachment: { select: { id: true } },
        occurrence: {
          select: { dueDate: true, task: { select: { id: true, title: true } } },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Prüfnachweise"
        beschreibung="Strukturiert erfasste Nachweise zu Reviews und Regelprüfungen. Nachweise mit Vier-Augen-Pflicht werden von einer zweiten Person gegengezeichnet."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stamp className="size-4" />
            Zur Gegenzeichnung
          </CardTitle>
          <CardDescription>
            Von anderen Personen vorgelegt. Die eigene Erfassung erscheint hier bewusst
            nicht – das Vier-Augen-Prinzip verlangt eine zweite Person.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {zumGegenzeichnen.length === 0 ? (
            <LeerHinweis text="Derzeit wartet kein Nachweis auf Ihre Gegenzeichnung." />
          ) : (
            zumGegenzeichnen.map((nachweis) => (
              <div
                key={nachweis.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{nachweis.vorlage.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {nachweis.occurrence.task.title} · fällig am{' '}
                    {formatDate(nachweis.occurrence.dueDate)} · erfasst von{' '}
                    {nachweis.erfasstBy.name}
                    {nachweis.vorgelegtAm
                      ? ` · vorgelegt am ${formatDateTime(nachweis.vorgelegtAm)}`
                      : ''}
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href={`/nachweise/${nachweis.id}`}>Prüfen</Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="size-4" />
            Meine offenen Nachweise
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {eigene.length === 0 ? (
            <LeerHinweis text="Sie haben derzeit keinen offenen Prüfnachweis." />
          ) : (
            eigene.map((nachweis) => (
              <div
                key={nachweis.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{nachweis.vorlage.name}</span>
                    <StatusBadge status={nachweis.status as NachweisStatus} />
                    {nachweis.vorlage.vierAugen ? (
                      <Badge variant="outline">Vier Augen</Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {nachweis.occurrence.task.title} · fällig am{' '}
                    {formatDate(nachweis.occurrence.dueDate)}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/nachweise/${nachweis.id}`}>
                    {nachweis.status === 'VORGELEGT' ? 'Ansehen' : 'Bearbeiten'}
                  </Link>
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zuletzt abgeschlossen</CardTitle>
          <CardDescription>
            Gegengezeichnete Nachweise sind unveränderlich und als Anhang an der
            Durchführung hinterlegt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {abgeschlossen.length === 0 ? (
            <LeerHinweis text="Es wurde noch kein Nachweis abgeschlossen." />
          ) : (
            abgeschlossen.map((nachweis) => (
              <div
                key={nachweis.id}
                className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{nachweis.vorlage.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {nachweis.occurrence.task.title} · erfasst von{' '}
                    {nachweis.erfasstBy.name}
                    {nachweis.geprueftBy
                      ? ` · gegengezeichnet von ${nachweis.geprueftBy.name}`
                      : ''}
                    {nachweis.geprueftAm
                      ? ` am ${formatDateTime(nachweis.geprueftAm)}`
                      : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {nachweis.attachment ? (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/api/attachments/${nachweis.attachment.id}`} download>
                        PDF
                      </a>
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/nachweise/${nachweis.id}`}>Ansehen</Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
