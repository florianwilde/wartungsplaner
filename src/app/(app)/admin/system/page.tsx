import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import { CheckCircle2, XCircle } from 'lucide-react'

import { istOidcAktiv, oidcAnzeigename } from '@/auth'
import { istPasskeyTauglich } from '@/lib/webauthn'
import {
  istVirenpruefungEingerichtet,
  istVirenpruefungPflicht,
  pruefeVerbindung,
} from '@/server/virenpruefung'
import {
  appUrl,
  holeSicherheitsEinstellungen,
  ohnePasskeyJeRolle,
} from '@/server/sicherheit-einstellungen'
import { PasskeyPflicht } from './passkey-pflicht'
import { MarkdownAnzeige } from '@/components/markdown-anzeige'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { APP_TIME_ZONE, formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import { APP_BUILD_TIME, APP_GIT_COMMIT, APP_VERSION } from '@/lib/version'

export const metadata: Metadata = { title: 'System' }
export const dynamic = 'force-dynamic'

/** Liest den Änderungsverlauf aus dem Anwendungsverzeichnis. */
async function leseChangelog(): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  } catch {
    return null
  }
}

export default async function SystemSeite() {
  await erforderlicheRolle('ADMIN')

  const [datenbankErreichbar, letzterJob, anzahlen, changelog] = await Promise.all([
    prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false),
    prisma.auditLog.findFirst({
      where: { action: 'CRON_RUN' },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true, payloadJson: true },
    }),
    Promise.all([
      prisma.task.count(),
      prisma.task.count({ where: { active: true } }),
      prisma.occurrence.count({ where: { status: { in: ['OPEN', 'OVERDUE'] } } }),
      prisma.execution.count(),
      prisma.attachment.count(),
      prisma.finding.count({ where: { status: { not: 'CLOSED' } } }),
      prisma.auditLog.count(),
    ]),
    leseChangelog(),
  ])

  const [
    aufgaben,
    aufgabenAktiv,
    offeneFaelligkeiten,
    durchfuehrungen,
    nachweise,
    offeneAbweichungen,
    protokolleintraege,
  ] = anzahlen

  const virenpruefung = istVirenpruefungEingerichtet()
    ? await pruefeVerbindung()
    : null

  const sicherheit = await holeSicherheitsEinstellungen()
  const ohnePasskey = await ohnePasskeyJeRolle()

  const cronAktiv = process.env.CRON_ENABLED !== 'false'
  const cronZeitplan = process.env.CRON_SCHEDULE?.trim() || '15 2 * * *'

  return (
    <div className="space-y-6">
      <PasskeyPflicht
        gewaehlt={sicherheit.passkeyPflichtRollen}
        ohnePasskey={ohnePasskey}
        passkeysMoeglich={istPasskeyTauglich(appUrl())}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fassung</CardTitle>
            <CardDescription>
              Angaben zum ausgelieferten Stand dieser Installation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <Zeile label="Version" wert={APP_VERSION} hervorgehoben />
              <Zeile
                label="Git-Commit"
                wert={APP_GIT_COMMIT || 'nicht übergeben'}
              />
              <Zeile
                label="Build erstellt"
                wert={
                  APP_BUILD_TIME ? formatDateTime(new Date(APP_BUILD_TIME)) : '–'
                }
              />
              <Zeile label="Zeitzone" wert={APP_TIME_ZONE} />
              <Zeile
                label="Betriebsart"
                wert={process.env.NODE_ENV === 'production' ? 'Produktion' : 'Entwicklung'}
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Zustand</CardTitle>
            <CardDescription>
              Datenbank, Hintergrundjob und Anmeldeverfahren.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <ZustandZeile
                label="Datenbank"
                gut={datenbankErreichbar}
                text={datenbankErreichbar ? 'erreichbar' : 'nicht erreichbar'}
              />
              <ZustandZeile
                label="Hintergrundjob"
                gut={cronAktiv}
                text={cronAktiv ? `aktiv (${cronZeitplan})` : 'deaktiviert'}
              />
              <Zeile
                label="Letzter Lauf"
                wert={
                  letzterJob ? formatDateTime(letzterJob.timestamp) : 'noch nicht gelaufen'
                }
              />
              <ZustandZeile
                label="SSO (OIDC)"
                gut={istOidcAktiv()}
                text={
                  istOidcAktiv()
                    ? `aktiv – ${oidcAnzeigename()}`
                    : 'nicht konfiguriert'
                }
                neutralWennAus
              />
              <ZustandZeile
                label="Virenprüfung"
                gut={virenpruefung?.erreichbar === true}
                text={
                  !virenpruefung
                    ? 'nicht eingerichtet'
                    : virenpruefung.erreichbar
                      ? `aktiv – ${virenpruefung.version}`
                      : `nicht erreichbar: ${virenpruefung.grund}`
                }
                neutralWennAus={!virenpruefung}
              />
              {istVirenpruefungPflicht() ? (
                <Zeile label="Prüfung verpflichtend" wert="ja" />
              ) : null}
              <Zeile
                label="HTTP-Auslöser für den Job"
                wert={process.env.CRON_TOKEN?.trim() ? 'konfiguriert' : 'nicht konfiguriert'}
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datenbestand</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <Kennzahl label="Aufgaben" wert={`${aufgabenAktiv} / ${aufgaben}`} zusatz="aktiv / gesamt" />
          <Kennzahl label="Offene Fälligkeiten" wert={String(offeneFaelligkeiten)} />
          <Kennzahl label="Durchführungen" wert={String(durchfuehrungen)} />
          <Kennzahl label="Nachweise" wert={String(nachweise)} />
          <Kennzahl label="Offene Abweichungen" wert={String(offeneAbweichungen)} />
          <Kennzahl label="Protokolleinträge" wert={protokolleintraege.toLocaleString('de-DE')} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Änderungsverlauf</CardTitle>
          <CardDescription>
            Was sich mit den einzelnen Fassungen geändert hat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {changelog ? (
            <div className="max-h-[32rem] overflow-y-auto rounded-md border border-border p-4">
              <MarkdownAnzeige inhalt={changelog} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Die Datei CHANGELOG.md ist in dieser Installation nicht vorhanden.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Zeile({
  label,
  wert,
  hervorgehoben,
}: {
  label: string
  wert: string
  hervorgehoben?: boolean
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={hervorgehoben ? 'font-mono font-semibold' : 'font-mono text-xs'}>
        {wert}
      </dd>
    </div>
  )
}

function ZustandZeile({
  label,
  gut,
  text,
  neutralWennAus,
}: {
  label: string
  gut: boolean
  text: string
  neutralWennAus?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>
        <Badge variant={gut ? 'ok' : neutralWennAus ? 'neutral' : 'danger'}>
          {gut ? (
            <CheckCircle2 className="size-3" />
          ) : neutralWennAus ? null : (
            <XCircle className="size-3" />
          )}
          {text}
        </Badge>
      </dd>
    </div>
  )
}

function Kennzahl({
  label,
  wert,
  zusatz,
}: {
  label: string
  wert: string
  zusatz?: string
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{wert}</p>
      {zusatz ? (
        <p className="text-[11px] text-muted-foreground">{zusatz}</p>
      ) : null}
    </div>
  )
}
