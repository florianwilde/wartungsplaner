'use client'

import { useState } from 'react'
import { UserRoundCheck } from 'lucide-react'

import {
  VertretungsFormular,
  type VertretungsStart,
} from '@/components/vertretung-formular'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

/**
 * Vertretung einer anderen Person nachtragen.
 *
 * Wer bereits im Urlaub ist, kann die Angabe selbst nicht mehr machen – dafür
 * gibt es diesen Weg. Die Änderung landet als „für andere“ im Audit-Log.
 */
export function VertretungDialog({
  personId,
  name,
  personen,
  start,
  hinweis,
}: {
  personId: string
  name: string
  personen: { id: string; name: string }[]
  start: VertretungsStart
  /** Aktueller Stand im Klartext, falls hinterlegt. */
  hinweis: string | null
}) {
  const [offen, setOffen] = useState(false)

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserRoundCheck className="size-4" />
          Vertretung
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vertretung für {name}</DialogTitle>
          <DialogDescription>
            Für die Dauer der Abwesenheit gehen die Erinnerungen zu den
            Prüfungen und Abweichungen dieser Person an die Vertretung. Die
            Zuständigkeit bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        {hinweis ? (
          <p className="rounded-md bg-muted p-3 text-sm">{hinweis}</p>
        ) : null}

        <VertretungsFormular
          personId={personId}
          personen={personen}
          start={start}
        />
      </DialogContent>
    </Dialog>
  )
}
