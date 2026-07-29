import type { Metadata } from 'next'
import { ClipboardCheck } from 'lucide-react'

import { istOidcAktiv, oidcAnzeigename } from '@/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginFormular } from './login-formular'

export const metadata: Metadata = { title: 'Anmelden' }

const FEHLERTEXTE: Record<string, string> = {
  OhneEmail:
    'Der Identity Provider hat keine E-Mail-Adresse übermittelt. Bitte wenden Sie sich an die IT.',
  Deaktiviert:
    'Dieses Konto ist deaktiviert. Bitte wenden Sie sich an einen Administrator.',
  Configuration:
    'Die Anmeldung ist derzeit nicht konfiguriert. Bitte wenden Sie sich an die IT.',
  AccessDenied: 'Der Zugriff wurde verweigert.',
  Verification: 'Der Anmeldelink ist abgelaufen oder wurde bereits verwendet.',
}

export default async function LoginSeite({
  searchParams,
}: {
  searchParams: Promise<{ weiter?: string; fehler?: string; error?: string }>
}) {
  const params = await searchParams
  const weiter = params.weiter?.startsWith('/') ? params.weiter : '/'
  const fehlerSchluessel = params.fehler ?? params.error
  const fehlertext = fehlerSchluessel
    ? (FEHLERTEXTE[fehlerSchluessel] ??
      'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.')
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ClipboardCheck className="size-5" />
          </span>
          <span className="text-xl font-semibold tracking-tight">
            Wartungsplaner
          </span>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmeldung</CardTitle>
            <CardDescription>
              Interne Anwendung zur Planung und zum Nachweis wiederkehrender
              IT-Prüf- und Wartungsaufgaben.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fehlertext ? (
              <p
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                {fehlertext}
              </p>
            ) : null}

            <LoginFormular
              weiter={weiter}
              ssoAktiv={istOidcAktiv()}
              ssoName={oidcAnzeigename()}
            />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Zugänge werden von der IT-Administration vergeben.
        </p>
      </div>
    </main>
  )
}
