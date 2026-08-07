'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PASSWORT_MINDESTLAENGE } from '@/lib/passwort'
import { passwortAendern } from './actions'

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Passwort speichern'}
    </Button>
  )
}

export function PasswortFormular() {
  const [status, formAction] = useActionState(passwortAendern, {})

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="aktuellesPasswort">Aktuelles Passwort</Label>
        <Input
          id="aktuellesPasswort"
          name="aktuellesPasswort"
          type="password"
          autoComplete="current-password"
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="neuesPasswort">Neues Passwort</Label>
        <Input
          id="neuesPasswort"
          name="neuesPasswort"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORT_MINDESTLAENGE}
          required
        />
        <p className="text-muted-foreground text-xs">
          Mindestens {PASSWORT_MINDESTLAENGE} Zeichen aus mindestens drei der vier
          Kategorien: Kleinbuchstaben, Großbuchstaben, Ziffern, Sonderzeichen.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="wiederholung">Neues Passwort wiederholen</Label>
        <Input
          id="wiederholung"
          name="wiederholung"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORT_MINDESTLAENGE}
          required
        />
      </div>

      {status.fehler ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {status.fehler}
        </p>
      ) : null}

      <SpeichernButton />
    </form>
  )
}
