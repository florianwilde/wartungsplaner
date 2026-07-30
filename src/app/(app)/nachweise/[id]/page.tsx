import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText } from 'lucide-react'

import { SeitenKopf } from '@/components/seiten-kopf'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatDateTime } from '@/lib/dates'
import {
  STATUS_BEZEICHNUNG,
  istAenderbar,
  type NachweisStatus,
  type PruefpunktArt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import { canExecute } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeNachweis } from '@/server/nachweise'
import { NachweisFormular } from './nachweis-formular'

export const metadata: Metadata = { title: 'Prüfnachweis' }
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

export default async function NachweisSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const benutzer = await erforderlicherBenutzer()
  const { id } = await params

  const nachweis = await ladeNachweis(id)
  if (!nachweis) notFound()

  const status = nachweis.status as NachweisStatus
  const darfBearbeiten =
    canExecute(benutzer.role) &&
    istAenderbar(status) &&
    nachweis.erfasstById === benutzer.id

  // Gegenzeichnen darf nur eine andere Person – das ist der Kern des
  // Vier-Augen-Prinzips und wird zusätzlich serverseitig erzwungen.
  const darfGegenzeichnen =
    canExecute(benutzer.role) &&
    status === 'VORGELEGT' &&
    nachweis.erfasstById !== benutzer.id

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild className="kein-druck -ml-2">
        <Link href={`/tasks/${nachweis.occurrence.task.id}`}>
          <ArrowLeft className="size-4" />
          Zur Aufgabe
        </Link>
      </Button>

      <SeitenKopf
        titel={nachweis.vorlage.name}
        beschreibung={`${nachweis.occurrence.task.title} · Soll-Fälligkeit ${formatDate(
          nachweis.occurrence.dueDate,
        )}`}
        aktionen={<StatusBadge status={status} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>Vorgang</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Zeile
              label="Erfasst von"
              wert={`${nachweis.erfasstBy.name} · ${formatDateTime(nachweis.erfasstAm)}`}
            />
            <Zeile
              label="Vorgelegt"
              wert={
                nachweis.vorgelegtAm ? formatDateTime(nachweis.vorgelegtAm) : '–'
              }
            />
            <Zeile
              label="Gegenzeichnung"
              wert={
                nachweis.geprueftBy && nachweis.geprueftAm
                  ? `${nachweis.geprueftBy.name} · ${formatDateTime(nachweis.geprueftAm)}`
                  : nachweis.vorlage.vierAugen
                    ? 'noch offen'
                    : 'nicht vorgesehen'
              }
            />
            <Zeile
              label="Vier-Augen-Prinzip"
              wert={nachweis.vorlage.vierAugen ? 'erforderlich' : 'nicht erforderlich'}
            />
          </dl>

          {nachweis.attachment ? (
            <div className="mt-4 rounded-md border border-border p-3">
              <a
                href={`/api/attachments/${nachweis.attachment.id}`}
                className="flex items-center gap-2 text-sm font-medium hover:underline"
              >
                <FileText className="size-4 shrink-0" />
                {nachweis.attachment.filename}
              </a>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                SHA-256: {nachweis.attachment.sha256}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Als Nachweis an der Durchführung hinterlegt.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {status === 'GEGENGEZEICHNET' ? (
        <p className="rounded-md bg-status-ok/10 p-3 text-sm text-status-ok">
          Dieser Nachweis ist gegengezeichnet und damit unveränderlich.
          Korrekturen erfolgen ausschließlich als neuer, protokollierter Vorgang.
        </p>
      ) : null}

      <NachweisFormular
        nachweisId={nachweis.id}
        vierAugen={nachweis.vorlage.vierAugen}
        aenderbar={darfBearbeiten}
        darfGegenzeichnen={darfGegenzeichnen}
        ablehnungsgrund={nachweis.ablehnungsgrund}
        bemerkung={nachweis.bemerkung ?? ''}
        punkte={nachweis.vorlage.punkte.map((punkt) => {
          const antwort = nachweis.antworten.find((a) => a.punktId === punkt.id)
          return {
            id: punkt.id,
            position: punkt.position,
            frage: punkt.frage,
            hinweis: punkt.hinweis,
            art: punkt.art as PruefpunktArt,
            pflicht: punkt.pflicht,
            ergebnis: (antwort?.ergebnis as PruefpunktErgebnis | null) ?? null,
            wert: antwort?.wert ?? null,
            bemerkung: antwort?.bemerkung ?? null,
          }
        })}
      />
    </div>
  )
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{wert}</dd>
    </div>
  )
}
