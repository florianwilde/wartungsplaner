'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, KeyRound, LogIn } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasskeyAnmeldung } from './passkey-anmeldung'
import { anmeldenMitPasswort, anmeldenMitSso } from './actions'

function AnmeldeButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <LogIn className="size-4" />
      {pending ? 'Anmeldung läuft …' : 'Anmelden'}
    </Button>
  )
}

function SsoButton({ name }: { name: string }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="outline"
      className="w-full"
      disabled={pending}
    >
      <KeyRound className="size-4" />
      {pending ? 'Weiterleitung …' : `Anmelden mit ${name}`}
    </Button>
  )
}

export function LoginFormular({
  weiter,
  ssoAktiv,
  ssoName,
  passkeysMoeglich,
}: {
  weiter: string
  ssoAktiv: boolean
  ssoName: string
  passkeysMoeglich: boolean
}) {
  const [status, formAction] = useActionState(anmeldenMitPasswort, {})

  return (
    <div className="space-y-5">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="weiter" value={weiter} />

        <div className="space-y-2">
          <Label htmlFor="email">E-Mail-Adresse</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="vorname.nachname@firma.de"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        {status.fehler ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {status.fehler}
          </p>
        ) : null}

        <AnmeldeButton />
      </form>

      {ssoAktiv || passkeysMoeglich ? (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">oder</span>
          </div>
        </div>
      ) : null}

      {passkeysMoeglich ? <PasskeyAnmeldung weiter={weiter} /> : null}

      {ssoAktiv ? (
        <form action={anmeldenMitSso}>
          <input type="hidden" name="weiter" value={weiter} />
          <SsoButton name={ssoName} />
        </form>
      ) : null}
    </div>
  )
}
