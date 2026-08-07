import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Fingerprint } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ROLLEN_BEZEICHNUNG } from '@/lib/passkey-pflicht'
import { holeBenutzer } from '@/lib/session'
import { brauchtPasskey } from '@/server/sicherheit-einstellungen'
import { PasskeyEinrichtung } from './passkey-einrichtung'

export const metadata: Metadata = { title: 'Passkey einrichten' }
export const dynamic = 'force-dynamic'

/**
 * Bewusst außerhalb des angemeldeten Bereichs: `erforderlicherBenutzer()`
 * leitet hierher, diese Seite darf ihn deshalb nicht selbst aufrufen – sonst
 * entstünde eine Weiterleitungsschleife.
 */
export default async function PasskeyEinrichtenSeite() {
  const benutzer = await holeBenutzer()
  if (!benutzer) redirect('/login')
  if (benutzer.mustChangePassword) redirect('/passwort-aendern')

  // Ist die Pflicht inzwischen erfüllt oder aufgehoben, gehört niemand hierher.
  if (!(await brauchtPasskey(benutzer))) redirect('/')

  return (
    <main className="bg-muted/40 flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="bg-primary/10 text-primary mb-2 flex size-10 items-center justify-center rounded-lg">
            <Fingerprint className="size-5" />
          </span>
          <CardTitle>Passkey einrichten</CardTitle>
          <CardDescription>
            Für {ROLLEN_BEZEICHNUNG[benutzer.role]} ist ein Passkey verpflichtend. Bevor
            Sie fortfahren können, hinterlegen Sie bitte einen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-muted-foreground text-sm">
            Ein Passkey ersetzt das Passwort durch Windows Hello, Touch ID oder einen
            Sicherheitsschlüssel. Er lässt sich nicht abphishen und nicht
            wiederverwenden – bei einem Konto mit weitreichenden Rechten wiegt das
            schwer.
          </p>

          <PasskeyEinrichtung />

          <p className="text-muted-foreground text-xs">
            Angemeldet als {benutzer.email}. Der geheime Teil des Schlüssels verlässt
            Ihr Gerät nicht; die Anwendung speichert nur den öffentlichen Teil.
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
