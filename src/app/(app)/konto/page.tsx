import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'

import { SeitenKopf } from '@/components/seiten-kopf'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { ROLLEN_BESCHREIBUNG, ROLLEN_BEZEICHNUNG } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { passkeyHinweis } from '@/lib/webauthn'
import { appUrl, ladePasskeys } from '@/server/passkeys'
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
