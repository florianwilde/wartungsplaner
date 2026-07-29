import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { KeyRound } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { holeBenutzer } from '@/lib/session'
import { PasswortFormular } from './passwort-formular'

export const metadata: Metadata = { title: 'Passwort ändern' }

export default async function PasswortAendernSeite() {
  const benutzer = await holeBenutzer()
  if (!benutzer) redirect('/login')

  const erzwungen = benutzer.mustChangePassword

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </span>
          <CardTitle>Passwort ändern</CardTitle>
          <CardDescription>
            {erzwungen
              ? 'Bevor Sie fortfahren können, muss das Startpasswort geändert werden.'
              : `Angemeldet als ${benutzer.email}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {benutzer.authProvider === 'OIDC' ? (
            <p className="text-sm text-muted-foreground">
              Dieses Konto wird über SSO verwaltet. Das Passwort ändern Sie
              direkt beim Identity Provider Ihres Unternehmens.
            </p>
          ) : (
            <PasswortFormular />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
