'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { MAX_KOPIEN, vorschlagFuerKopie } from '@/lib/duplizieren'
import { aufgabeDuplizieren } from '@/server/actions/aufgaben'

function AbsendenButton({ anzahl }: { anzahl: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Copy className="size-4" />
      {pending
        ? 'Wird angelegt …'
        : anzahl > 1
          ? `${anzahl} Aufgaben anlegen`
          : 'Aufgabe anlegen'}
    </Button>
  )
}

/**
 * Eine Aufgabe kopieren – auch mehrfach.
 *
 * Zehn Restore-Tests für zehn Systeme unterscheiden sich meist nur im Titel.
 * Deshalb ein Feld für mehrere Titel statt zehnmal derselbe Vorgang.
 */
export function DuplizierenDialog({
  taskId,
  titel,
  heute,
  anzahlBoegen,
}: {
  taskId: string
  titel: string
  /** Heutiges Datum als JJJJ-MM-TT (Europe/Berlin). */
  heute: string
  /** Fest zugeordnete Prüfbögen der Vorlage. */
  anzahlBoegen: number
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [eingabe, setEingabe] = useState(vorschlagFuerKopie(titel))

  const duplizieren = aufgabeDuplizieren.bind(null, taskId)
  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string }, formData: FormData) => {
      const antwort = await duplizieren(vorher, formData)
      if (antwort.anzahl) {
        toast.success(
          antwort.anzahl === 1
            ? 'Die Aufgabe wurde angelegt.'
            : `${antwort.anzahl} Aufgaben wurden angelegt.`,
        )
        setOffen(false)
        if (antwort.anzahl === 1 && antwort.ersteId) {
          router.push(`/tasks/${antwort.ersteId}`)
        } else {
          router.push('/tasks')
        }
        router.refresh()
      }
      return antwort
    },
    {},
  )

  const zeilen = eingabe
    .split('\n')
    .map((zeile) => zeile.trim())
    .filter(Boolean)

  return (
    <Dialog
      open={offen}
      onOpenChange={(wert) => {
        setOffen(wert)
        if (wert) setEingabe(vorschlagFuerKopie(titel))
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Copy className="size-4" />
          Duplizieren
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aufgabe duplizieren</DialogTitle>
          <DialogDescription>
            Alle Einstellungen von „{titel}“ werden übernommen – Intervall, Kategorie,
            Zuständigkeit, Prüfanleitung und Audit-Referenzen. Fälligkeiten und
            Durchführungen der Vorlage bleiben unberührt.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titel">Titel der neuen Aufgaben</Label>
            <Textarea
              id="titel"
              name="titel"
              rows={4}
              value={eingabe}
              onChange={(e) => setEingabe(e.target.value)}
              placeholder={'Restore-Test DC01\nRestore-Test DC02\nRestore-Test DC03'}
            />
            <p className="text-muted-foreground text-xs">
              Ein Titel je Zeile – so lässt sich dieselbe Prüfung für mehrere Systeme
              ausrollen. Höchstens {MAX_KOPIEN} auf einmal.
              {zeilen.length > 1 ? ` Derzeit ${zeilen.length} Zeilen.` : ''}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Erste Fälligkeit am</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={heute}
              required
            />
            <p className="text-muted-foreground text-xs">
              Eine Kopie beginnt bei null; das Startdatum der Vorlage liegt meist in der
              Vergangenheit.
            </p>
          </div>

          {anzahlBoegen > 0 ? (
            <label className="border-border flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
              <Checkbox name="mitBoegen" defaultChecked className="mt-0.5" />
              <span>
                <span className="font-medium">
                  {anzahlBoegen === 1
                    ? 'Prüfbogen mitkopieren'
                    : `${anzahlBoegen} Prüfbögen mitkopieren`}
                </span>
                <span className="text-muted-foreground block text-xs">
                  Jede Kopie bekommt einen eigenen Bogen mit denselben Prüfpunkten; der
                  Name der Aufgabe steht im Namen des Bogens.
                </span>
              </span>
            </label>
          ) : null}

          <label className="border-border flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm">
            <Checkbox name="aktiv" defaultChecked className="mt-0.5" />
            <span>
              <span className="font-medium">Sofort aktiv</span>
              <span className="text-muted-foreground block text-xs">
                Mit der ersten Fälligkeit zum gewählten Datum. Ohne Haken entsteht die
                Aufgabe still und lässt sich vorher nacharbeiten.
              </span>
            </span>
          </label>

          {status.fehler ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {status.fehler}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <AbsendenButton anzahl={zeilen.length} />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
