'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, UserRoundCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { vertretungSpeichern } from '@/server/actions/vertretung'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type VertretungsStart = {
  vertretungId: string | null
  /** JJJJ-MM-TT oder leer */
  von: string
  bis: string
}

function SpeichernButton({ aufheben }: { aufheben: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <UserRoundCheck className="size-4" />
      {pending
        ? 'Wird gespeichert …'
        : aufheben
          ? 'Vertretung aufheben'
          : 'Vertretung hinterlegen'}
    </Button>
  )
}

/**
 * Vertretung einer Person pflegen.
 *
 * `personId` leer bedeutet „für mich selbst“; die Benutzerverwaltung setzt
 * sie, um eine fremde Vertretung nachzutragen.
 */
export function VertretungsFormular({
  personId,
  personen,
  start,
}: {
  personId?: string
  /** Wählbare Vertretungen – ohne die Person selbst. */
  personen: { id: string; name: string }[]
  start: VertretungsStart
}) {
  const router = useRouter()
  const [gewaehlt, setGewaehlt] = useState(start.vertretungId ?? '')

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await vertretungSpeichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <form action={formAction} className="space-y-4">
      {personId ? (
        <input type="hidden" name="personId" value={personId} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`vertretung-${personId ?? 'selbst'}`}>
          Vertreten durch
        </Label>
        <select
          id={`vertretung-${personId ?? 'selbst'}`}
          name="vertretungId"
          value={gewaehlt}
          onChange={(e) => setGewaehlt(e.target.value)}
          className={selectKlassen}
        >
          <option value="">Niemand – Meldungen bleiben bei mir</option>
          {personen.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </div>

      {gewaehlt ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`von-${personId ?? 'selbst'}`}>Ab</Label>
            <Input
              id={`von-${personId ?? 'selbst'}`}
              name="von"
              type="date"
              defaultValue={start.von}
            />
            <p className="text-xs text-muted-foreground">
              Leer lassen für „ab sofort“.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`bis-${personId ?? 'selbst'}`}>Bis</Label>
            <Input
              id={`bis-${personId ?? 'selbst'}`}
              name="bis"
              type="date"
              defaultValue={start.bis}
            />
            <p className="text-xs text-muted-foreground">
              Dieser Tag zählt mit; leer lassen für „bis auf Weiteres“.
            </p>
          </div>
        </div>
      ) : null}

      {status.fehler ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {status.fehler}
        </p>
      ) : null}

      <SpeichernButton aufheben={!gewaehlt} />
    </form>
  )
}
