import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'

import { SeitenKopf } from '@/components/seiten-kopf'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { VertretungsFormular } from '@/components/vertretung-formular'
import { formatDateTime, toISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { ROLLEN_BESCHREIBUNG, ROLLEN_BEZEICHNUNG, canExecute } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { beschreibeZeitraum } from '@/lib/vertretung'
import { passkeyHinweis } from '@/lib/webauthn'
import { appUrl, ladePasskeys } from '@/server/passkeys'
import { ladeKalenderToken } from '@/server/kalender-abo'
import { ladeVertretung, ladeVertretungenFuer } from '@/server/vertretung'
import { KalenderAbo } from './kalender-abo'
import { PasskeyVerwaltung } from './passkey-verwaltung'

export const metadata: Metadata = { title: 'Mein Konto' }
export const dynamic = 'force-dynamic'

export default async function KontoSeite() {
  const benutzer = await erforderlicherBenutzer()

  const [konto, passkeys] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: benutzer.id },
      select: {
        name: true,
        email: true,
        role: true,
        authProvider: true,
        lastLoginAt: true,
        createdAt: true,
        passwordHash: true,
      },
    }),
    ladePasskeys(benutzer.id),
  ])

  const darfVertreten = canExecute(benutzer.role)
  const [vertretung, vertreteneListe, kandidaten] = darfVertreten
    ? await Promise.all([
        ladeVertretung(benutzer.id),
        ladeVertretungenFuer(benutzer.id),
        prisma.user.findMany({
          where: {
            active: true,
            role: { in: ['ADMIN', 'EDITOR'] },
            id: { not: benutzer.id },
          },
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        }),
      ])
    : [null, [], []]

  const kalenderToken = await ladeKalenderToken(benutzer.id)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SeitenKopf
        titel="Mein Konto"
        beschreibung="Ihre Angaben und die Verwaltung der Anmeldeverfahren."
      />

      <Card>
        <CardHeader>
          <CardTitle>Angaben</CardTitle>
          <CardDescription>
            Name und Rolle werden von der Administration vergeben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <Zeile label="Name" wert={konto.name} />
            <Zeile label="E-Mail" wert={konto.email} />
            <Zeile
              label="Rolle"
              wert={ROLLEN_BEZEICHNUNG[konto.role]}
              zusatz={ROLLEN_BESCHREIBUNG[konto.role]}
            />
            <Zeile
              label="Anmeldeverfahren"
              wert={konto.authProvider === 'OIDC' ? 'SSO' : 'Passwort'}
            />
            <Zeile
              label="Letzte Anmeldung"
              wert={
                konto.lastLoginAt ? formatDateTime(konto.lastLoginAt) : 'noch nie'
              }
            />
          </dl>
        </CardContent>
      </Card>

      <KalenderAbo
        adresse={
          kalenderToken ? `${appUrl()}/api/kalender/${kalenderToken}.ics` : null
        }
      />

      {darfVertreten ? (
        <Card>
          <CardHeader>
            <CardTitle>Vertretung bei Abwesenheit</CardTitle>
            <CardDescription>
              Wer Sie vertritt, erhält für die Dauer Ihrer Abwesenheit die
              Erinnerungen zu Ihren Prüfungen und Abweichungen. Die
              Zuständigkeit selbst bleibt bei Ihnen – umgeleitet wird nur die
              Post.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vertretung?.vertretungName ? (
              <p className="rounded-md bg-muted p-3 text-sm">
                {vertretung.aktiv ? 'Aktiv: ' : 'Hinterlegt: '}
                <span className="font-medium">{vertretung.vertretungName}</span>
                {' · '}
                {beschreibeZeitraum(vertretung.von, vertretung.bis)}
                {vertretung.aktiv ? '' : ' (greift noch nicht oder ist vorbei)'}
              </p>
            ) : null}

            <VertretungsFormular
              personen={kandidaten}
              start={{
                vertretungId: vertretung?.vertretungId ?? null,
                von: vertretung?.von ? toISODate(vertretung.von) : '',
                bis: vertretung?.bis ? toISODate(vertretung.bis) : '',
              }}
            />

            {vertreteneListe.length > 0 ? (
              <div className="rounded-md border border-border p-3 text-sm">
                <p className="font-medium">Sie vertreten derzeit</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {vertreteneListe.map((person) => (
                    <li key={person.personId}>
                      {person.name} · {person.zeitraum}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {konto.authProvider === 'LOCAL' ? (
        <Card>
          <CardHeader>
            <CardTitle>Passwort</CardTitle>
            <CardDescription>
              {konto.passwordHash
                ? 'Wählen Sie ein Passwort, das Sie nirgendwo sonst verwenden.'
                : 'Für dieses Konto ist kein Passwort hinterlegt – die Anmeldung erfolgt ausschließlich über Passkeys.'}
            </CardDescription>
          </CardHeader>
          {konto.passwordHash ? (
            <CardContent>
              <Button variant="outline" asChild>
                <Link href="/passwort-aendern">
                  <KeyRound className="size-4" />
                  Passwort ändern
                </Link>
              </Button>
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      <PasskeyVerwaltung
        passkeys={passkeys}
        hinweis={passkeyHinweis(appUrl())}
        nurSso={konto.authProvider === 'OIDC'}
      />
    </div>
  )
}

function Zeile({
  label,
  wert,
  zusatz,
}: {
  label: string
  wert: string
  zusatz?: string
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">
        <span className="font-medium">{wert}</span>
        {zusatz ? (
          <span className="block text-xs text-muted-foreground">{zusatz}</span>
        ) : null}
      </dd>
    </div>
  )
}
