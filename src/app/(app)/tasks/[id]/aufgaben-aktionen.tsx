'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { PauseCircle, Play, Power } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  aufgabeAktivierungUmschalten,
  aussetzungAufheben,
  faelligkeitAussetzen,
} from '@/server/actions/aufgaben'

export function AktivierungSchalter({
  taskId,
  aktiv,
}: {
  taskId: string
  aktiv: boolean
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      variant={aktiv ? 'outline' : 'default'}
      size="sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await aufgabeAktivierungUmschalten(taskId, !aktiv)
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Gespeichert.')
            router.refresh()
          }
        })
      }
    >
      <Power className="size-4" />
      {aktiv ? 'Deaktivieren' : 'Aktivieren'}
    </Button>
  )
}

export function AussetzenDialog({
  occurrenceId,
  faelligAm,
}: {
  occurrenceId: string
  faelligAm: string
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [grund, setGrund] = useState('')
  const [laeuft, starte] = useTransition()

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOffen(true)}>
        <PauseCircle className="size-4" />
        Aussetzen
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fälligkeit aussetzen</DialogTitle>
            <DialogDescription>
              Die Fälligkeit vom {faelligAm} wird ausgesetzt und erzeugt keine
              Überfälligkeit. Die Begründung wird revisionssicher protokolliert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="aussetzen-grund">Begründung</Label>
            <Textarea
              id="aussetzen-grund"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              rows={3}
              placeholder="z. B. System bis 31.08. außer Betrieb, Prüfung entfällt einmalig"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={laeuft || grund.trim().length < 5}
              onClick={() =>
                starte(async () => {
                  const ergebnis = await faelligkeitAussetzen(occurrenceId, grund)
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else {
                    toast.success(ergebnis.erfolg ?? 'Gespeichert.')
                    setOffen(false)
                    setGrund('')
                    router.refresh()
                  }
                })
              }
            >
              Aussetzen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AussetzungAufhebenButton({ occurrenceId }: { occurrenceId: string }) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await aussetzungAufheben(occurrenceId)
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Gespeichert.')
            router.refresh()
          }
        })
      }
    >
      <Play className="size-4" />
      Aussetzung aufheben
    </Button>
  )
}
