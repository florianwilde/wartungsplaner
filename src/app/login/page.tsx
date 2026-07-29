import type { Metadata } from 'next'

import { istOidcAktiv, oidcAnzeigename } from '@/auth'
import { FarbschemaUmschalter } from '@/components/farbschema-umschalter'
import { Markenzeichen } from '@/components/markenzeichen'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { versionKurz } from '@/lib/version'
import { istPasskeyTauglich } from '@/lib/webauthn'
import { appUrl } from '@/server/passkeys'
import { holeBranding } from '@/server/branding'
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
  const branding = await holeBranding()
  const weiter = params.weiter?.startsWith('/') ? params.weiter : '/'
  const fehlerSchluessel = params.fehler ?? params.error
  const fehlertext = fehlerSchluessel
    ? (FEHLERTEXTE[fehlerSchluessel] ??
      'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.')
    : null

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Markenzeichen branding={branding} className="h-14 max-w-[280px]" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmeldung bei {branding.appName}</CardTitle>
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
              passkeysMoeglich={istPasskeyTauglich(appUrl())}
            />
          </CardContent>
        </Card>

        <div className="mt-6 flex flex-col items-center gap-2">
          <FarbschemaUmschalter mitBeschriftung className="text-muted-foreground" />
          <p className="text-center text-xs text-muted-foreground">
            Zugänge werden von der IT-Administration vergeben.
            <span className="mt-1 block tabular-nums opacity-70">
              {versionKurz()}
            </span>
          </p>
        </div>
      </div>
    </main>
  )
}
