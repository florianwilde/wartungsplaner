import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { istOidcAktiv, oidcAnzeigename } from '@/auth'
import { FarbschemaUmschalter } from '@/components/farbschema-umschalter'
import { Markenzeichen } from '@/components/markenzeichen'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { holeBenutzer } from '@/lib/session'
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

  // Wer bereits angemeldet ist, hat auf der Anmeldeseite nichts verloren.
  // Bewusst hier und nicht in der Middleware: Dort lässt sich das Cookie nur
  // entschlüsseln, nicht prüfen – ein nach dem Abmelden wiederhergestelltes
  // Cookie ergäbe sonst eine Endlosschleife zwischen Anmeldeseite und
  // Dashboard.
  const angemeldet = await holeBenutzer()
  if (angemeldet) redirect(params.weiter?.startsWith('/') ? params.weiter : '/')

  const branding = await holeBranding()
  const weiter = params.weiter?.startsWith('/') ? params.weiter : '/'
  const fehlerSchluessel = params.fehler ?? params.error
  const fehlertext = fehlerSchluessel
    ? (FEHLERTEXTE[fehlerSchluessel] ??
      'Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.')
    : null

  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Markenzeichen branding={branding} className="h-14 max-w-[280px]" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmeldung bei {branding.appName}</CardTitle>
            <CardDescription>
              Interne Anwendung zur Planung und zum Nachweis wiederkehrender IT-Prüf-
              und Wartungsaufgaben.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fehlertext ? (
              <p
                role="alert"
                className="bg-destructive/10 text-destructive rounded-md p-3 text-sm"
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
          <p className="text-muted-foreground text-center text-xs">
            Zugänge werden von der IT-Administration vergeben.
            <span className="mt-1 block tabular-nums opacity-70">{versionKurz()}</span>
          </p>
        </div>
      </div>
    </main>
  )
}
