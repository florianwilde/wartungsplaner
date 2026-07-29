'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  kategorieAendern,
  kategorieAnlegen,
  kategorieLoeschen,
} from '@/server/actions/kategorien'

function AbsendenButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : label}
    </Button>
  )
}

function Fehlermeldung({ text }: { text?: string }) {
  if (!text) return null
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  )
}

function Felder({
  werte,
  idPraefix,
}: {
  werte: { name: string; color: string; sortOrder: number }
  idPraefix: string
}) {
  const [farbe, setFarbe] = useState(werte.color)

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPraefix}-name`}>Name</Label>
        <Input
          id={`${idPraefix}-name`}
          name="name"
          defaultValue={werte.name}
          required
          maxLength={80}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPraefix}-color`}>Farbe</Label>
          <div className="flex items-center gap-2">
            <input
              id={`${idPraefix}-color`}
              name="color"
              type="color"
              value={farbe}
              onChange={(e) => setFarbe(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
            />
            <Input
              value={farbe}
              onChange={(e) => setFarbe(e.target.value)}
              pattern="#[0-9a-fA-F]{6}"
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${idPraefix}-sort`}>Reihenfolge</Label>
          <Input
            id={`${idPraefix}-sort`}
            name="sortOrder"
            type="number"
            min={0}
            max={9999}
            defaultValue={werte.sortOrder}
          />
          <p className="text-xs text-muted-foreground">
            Kleinere Werte erscheinen weiter oben.
          </p>
        </div>
      </div>
    </>
  )
}

export function KategorieAnlegenDialog({
  naechsteReihenfolge,
}: {
  naechsteReihenfolge: number
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await kategorieAnlegen(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <>
      <Button size="sm" onClick={() => setOffen(true)}>
        <Plus className="size-4" />
        Kategorie anlegen
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie anlegen</DialogTitle>
            <DialogDescription>
              Die Farbe wird im Dashboard, in der Aufgabenliste und im Kalender
              verwendet.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <Felder
              idPraefix="neu"
              werte={{ name: '', color: '#64748b', sortOrder: naechsteReihenfolge }}
            />
            <Fehlermeldung text={status.fehler} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Anlegen" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function KategorieBearbeitenDialog({
  kategorie,
}: {
  kategorie: { id: string; name: string; color: string; sortOrder: number }
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const aendern = kategorieAendern.bind(null, kategorie.id)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await aendern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOffen(true)}>
        <Pencil className="size-4" />
        Bearbeiten
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie bearbeiten</DialogTitle>
            <DialogDescription>{kategorie.name}</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <Felder idPraefix={kategorie.id} werte={kategorie} />
            <Fehlermeldung text={status.fehler} />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Speichern" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function KategorieLoeschenButton({
  kategorieId,
  name,
  anzahlAufgaben,
}: {
  kategorieId: string
  name: string
  anzahlAufgaben: number
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [laeuft, starte] = useTransition()

  if (anzahlAufgaben > 0) {
    return (
      <Button variant="ghost" size="sm" disabled title="Es sind noch Aufgaben zugeordnet">
        <Trash2 className="size-4" />
        Löschen
      </Button>
    )
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOffen(true)}>
        <Trash2 className="size-4" />
        Löschen
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kategorie löschen</DialogTitle>
            <DialogDescription>
              Soll die Kategorie „{name}“ endgültig gelöscht werden? Der Vorgang
              wird protokolliert.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={laeuft}
              onClick={() =>
                starte(async () => {
                  const ergebnis = await kategorieLoeschen(kategorieId)
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else {
                    toast.success(ergebnis.erfolg ?? 'Gelöscht.')
                    setOffen(false)
                    router.refresh()
                  }
                })
              }
            >
              Endgültig löschen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
