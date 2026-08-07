'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Eye, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { MAX_MONATE, MIN_MONATE, fristText } from '@/lib/aufbewahrung'
import {
  aufbewahrungAusfuehren,
  aufbewahrungSpeichern,
} from '@/server/actions/aufbewahrung'

export type KategorieFrist = {
  id: string
  name: string
  aufbewahrungMonate: number | null
}

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Speichern'}
    </Button>
  )
}

export function AufbewahrungFormular({
  aktiv: anfangsAktiv,
  standardMonate,
  kategorien,
}: {
  aktiv: boolean
  standardMonate: number
  kategorien: KategorieFrist[]
}) {
  const router = useRouter()
  const [aktiv, setAktiv] = useState(anfangsAktiv)
  const [standard, setStandard] = useState(standardMonate)
  const [laeuft, starte] = useTransition()
  const [nachfrage, setNachfrage] = useState(false)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await aufbewahrungSpeichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      } else if (antwort.fehler) {
        toast.error(antwort.fehler)
      }
      return antwort
    },
    {},
  )

  const ausfuehren = (nurVorschau: boolean) =>
    starte(async () => {
      const ergebnis = await aufbewahrungAusfuehren(nurVorschau)
      if (ergebnis.fehler) toast.error(ergebnis.fehler)
      else {
        toast.success(ergebnis.erfolg ?? 'Fertig.', { duration: 8000 })
        setNachfrage(false)
        if (!nurVorschau) router.refresh()
      }
    })

  return (
    <>
      <form action={formAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Fristen</CardTitle>
            <CardDescription>
              Nach Ablauf der Frist wird die <strong>Datei</strong> entfernt, nicht der
              Eintrag: Datum, Person, Ergebnis, Dateiname und Prüfsumme bleiben erhalten
              und belegen weiterhin, dass geprüft wurde. Gelöscht wird der Inhalt, nicht
              die Tatsache. Maßgeblich ist der Zeitpunkt der Durchführung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <label className="border-border flex items-start gap-3 rounded-md border p-3">
              <input
                type="checkbox"
                name="aktiv"
                checked={aktiv}
                onChange={(e) => setAktiv(e.target.checked)}
                className="mt-0.5 size-4"
              />
              <span>
                <span className="font-medium">Aufbewahrungsfristen anwenden</span>
                <span className="text-muted-foreground block text-sm">
                  Der tägliche Lauf entfernt dann abgelaufene Nachweisdateien. Ohne
                  diesen Haken geschieht nichts – die Vorschau bleibt jederzeit nutzbar.
                </span>
              </span>
            </label>

            <div className="max-w-xs space-y-1.5">
              <Label htmlFor="standardMonate">Vorgabe in Monaten</Label>
              <Input
                id="standardMonate"
                name="standardMonate"
                type="number"
                min={MIN_MONATE}
                max={MAX_MONATE}
                value={standard}
                onChange={(e) => setStandard(Number(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">
                Entspricht {fristText(standard || MIN_MONATE)}. Zulässig sind{' '}
                {MIN_MONATE} bis {MAX_MONATE} Monate.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Abweichend je Kategorie</p>
              <p className="text-muted-foreground text-xs">
                Leer lassen heißt: Es gilt die Vorgabe. Ein Restore-Test-Protokoll darf
                früher entfallen als der Nachweis einer Berechtigungsprüfung.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {kategorien.map((kategorie) => (
                  <div key={kategorie.id} className="space-y-1.5">
                    <Label htmlFor={`frist-${kategorie.id}`}>{kategorie.name}</Label>
                    <Input
                      id={`frist-${kategorie.id}`}
                      name={`frist-${kategorie.id}`}
                      type="number"
                      min={MIN_MONATE}
                      max={MAX_MONATE}
                      defaultValue={kategorie.aufbewahrungMonate ?? ''}
                      placeholder={`Vorgabe (${standard})`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {status.fehler ? (
              <p role="alert" className="text-destructive text-sm">
                {status.fehler}
              </p>
            ) : null}

            <SpeichernButton />
          </CardContent>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Jetzt anwenden</CardTitle>
          <CardDescription>
            Die Vorschau ermittelt dasselbe wie der tatsächliche Lauf, fasst aber nichts
            an. Sehen Sie erst nach, was entfallen würde.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            disabled={laeuft}
            onClick={() => ausfuehren(true)}
          >
            <Eye className="size-4" />
            Vorschau
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={laeuft}
            onClick={() => setNachfrage(true)}
          >
            <Trash2 className="size-4" />
            Abgelaufene Nachweise entfernen
          </Button>
        </CardContent>
      </Card>

      <Dialog open={nachfrage} onOpenChange={setNachfrage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5" />
              Dateien endgültig entfernen?
            </DialogTitle>
            <DialogDescription>
              Die betroffenen Nachweisdateien werden gelöscht und lassen sich nur aus
              einer Sicherung zurückholen. Die Einträge bleiben mit Dateiname, Größe und
              Prüfsumme bestehen.
            </DialogDescription>
          </DialogHeader>

          <p className="bg-muted rounded-md p-3 text-sm">
            Führen Sie zuvor die <strong>Vorschau</strong> aus, wenn Sie noch nicht
            wissen, was betroffen ist.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNachfrage(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={laeuft}
              onClick={() => ausfuehren(false)}
            >
              {laeuft ? 'Wird ausgeführt …' : 'Ja, entfernen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
