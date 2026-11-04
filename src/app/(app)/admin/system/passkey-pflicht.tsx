'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import type { Role } from '@/generated/prisma/client'
import { Fingerprint } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ROLLEN_BEZEICHNUNG } from '@/lib/passkey-pflicht'
import { passkeyPflichtSpeichern } from '@/server/actions/sicherheit'

const ROLLEN: Role[] = ['ADMIN', 'EDITOR', 'AUDITOR']

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Speichern'}
    </Button>
  )
}

export function PasskeyPflicht({
  gewaehlt,
  ohnePasskey,
  passkeysMoeglich,
}: {
  gewaehlt: Role[]
  /** Anzahl Personen je Rolle ohne hinterlegten Passkey */
  ohnePasskey: Record<string, number>
  passkeysMoeglich: boolean
}) {
  const router = useRouter()

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await passkeyPflichtSpeichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg, { duration: 8000 })
        router.refresh()
      } else if (antwort.fehler) {
        toast.error(antwort.fehler)
      }
      return antwort
    },
    {},
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="size-4" />
          Passkey-Pflicht
        </CardTitle>
        <CardDescription>
          Für die gewählten Rollen ist ein hinterlegter Passkey verpflichtend. Wer
          keinen hat, wird bei der nächsten Anmeldung zur Einrichtung geführt, bevor er
          weiterarbeiten kann.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!passkeysMoeglich ? (
          <p className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
            Passkeys sind erst möglich, wenn die Anwendung über <b>HTTPS</b>
            erreichbar ist – der Browser bietet die Registrierung sonst gar nicht an.
            Die Pflicht bleibt deshalb wirkungslos und lässt sich derzeit nicht
            einschalten.
          </p>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              {ROLLEN.map((rolle) => (
                <label
                  key={rolle}
                  className="border-border flex items-start gap-3 rounded-md border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    name={`pflicht-${rolle}`}
                    defaultChecked={gewaehlt.includes(rolle)}
                    className="mt-0.5 size-4"
                  />
                  <span>
                    <span className="font-medium">{ROLLEN_BEZEICHNUNG[rolle]}</span>
                    <span className="text-muted-foreground block text-xs">
                      {(ohnePasskey[rolle] ?? 0) === 0
                        ? 'Alle haben bereits einen Passkey.'
                        : `${ohnePasskey[rolle]} ${
                            ohnePasskey[rolle] === 1 ? 'Person hat' : 'Personen haben'
                          } noch keinen.`}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <p className="text-muted-foreground text-xs">
              Konten, die sich über das Unternehmens-SSO anmelden, sind ausgenommen:
              Dort gibt es bereits ein Verfahren, und ein zweiter Faktor gehört in den
              Identity Provider.
            </p>

            {status.fehler ? (
              <p role="alert" className="text-destructive text-sm">
                {status.fehler}
              </p>
            ) : null}

            <SpeichernButton />
          </form>
        )}
      </CardContent>
    </Card>
  )
}
