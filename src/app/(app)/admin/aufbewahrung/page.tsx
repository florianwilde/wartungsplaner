import type { Metadata } from 'next'
import { Archive, ShieldCheck } from 'lucide-react'

import { SeitenKopf } from '@/components/seiten-kopf'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { fristText } from '@/lib/aufbewahrung'
import { lesbareGroesse } from '@/lib/uploads'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { holeAufbewahrungsEinstellungen } from '@/server/aufbewahrung'
import { AufbewahrungFormular } from './aufbewahrung-formular'

export const metadata: Metadata = { title: 'Aufbewahrung' }
export const dynamic = 'force-dynamic'

export default async function AufbewahrungSeite() {
  const benutzer = await erforderlicherBenutzer()
  if (!canAdminister(benutzer.role)) {
    return (
      <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
        Diese Seite ist der Administration vorbehalten.
      </p>
    )
  }

  const [einstellungen, kategorien, bestand, entfernt] = await Promise.all([
    holeAufbewahrungsEinstellungen(),
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, aufbewahrungMonate: true },
    }),
    prisma.attachment.aggregate({
      where: { archiviertAm: null },
      _count: true,
      _sum: { sizeBytes: true },
    }),
    prisma.attachment.aggregate({
      where: { archiviertAm: { not: null } },
      _count: true,
      _sum: { sizeBytes: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Aufbewahrung"
        beschreibung="Wie lange die hochgeladenen Nachweisdateien vorgehalten werden. Der Bestand wächst sonst unbegrenzt, und Belege wie ein AD-Export enthalten personenbezogene Daten."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Kennzahl
          titel="Vorgehalten"
          wert={`${bestand._count}`}
          hinweis={lesbareGroesse(bestand._sum.sizeBytes ?? 0)}
          icon={<Archive className="size-4" />}
        />
        <Kennzahl
          titel="Bereits entfernt"
          wert={`${entfernt._count}`}
          hinweis={
            entfernt._count > 0
              ? `${lesbareGroesse(entfernt._sum.sizeBytes ?? 0)} freigegeben`
              : 'noch nichts entfernt'
          }
          icon={<ShieldCheck className="size-4" />}
        />
        <Kennzahl
          titel="Letzter Lauf"
          wert={
            einstellungen.letzterLaufAm
              ? formatDateTime(einstellungen.letzterLaufAm)
              : '–'
          }
          hinweis={
            einstellungen.letzterLaufAm
              ? `${einstellungen.letzteAnzahl} entfernt`
              : 'bisher nicht ausgeführt'
          }
        />
      </div>

      {!einstellungen.aktiv ? (
        <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          Die Aufbewahrung ist ausgeschaltet – es wird nichts entfernt. Das ist
          der Auslieferungszustand: Gelöscht wird nie ungefragt. Aktuell gilt
          rechnerisch eine Vorgabe von {fristText(einstellungen.standardMonate)}.
        </p>
      ) : null}

      <AufbewahrungFormular
        aktiv={einstellungen.aktiv}
        standardMonate={einstellungen.standardMonate}
        kategorien={kategorien}
      />

      <Card>
        <CardHeader>
          <CardTitle>Was erhalten bleibt</CardTitle>
          <CardDescription>
            Damit klar ist, was ein Entfernen bedeutet und was nicht.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-status-ok">Bleibt</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>Die Durchführung mit Datum, Person, Ergebnis und Kommentar</li>
                <li>Dateiname, Größe und SHA-256-Prüfsumme des Nachweises</li>
                <li>Abweichungen samt Maßnahmen</li>
                <li>Prüfnachweise und ihre Antworten</li>
                <li>Das Audit-Log</li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-medium text-destructive">Entfällt</p>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>Der Inhalt der hochgeladenen Datei</li>
                <li>Damit auch der Download – die Seite sagt dann, dass die Frist abgelaufen ist</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Entfernte Nachweise werden vom Prüfsummenlauf nicht als fehlend
                beanstandet und tauchen nicht im Archiv-Export auf.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Kennzahl({
  titel,
  wert,
  hinweis,
  icon,
}: {
  titel: string
  wert: string
  hinweis: string
  icon?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {titel}
      </p>
      <p className="mt-1 text-xl font-semibold">{wert}</p>
      <p className="text-xs text-muted-foreground">{hinweis}</p>
    </div>
  )
}
