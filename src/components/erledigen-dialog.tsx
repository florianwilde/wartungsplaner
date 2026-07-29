'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Plus, Trash2, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import {
  ERGEBNIS_BESCHREIBUNG,
  ERGEBNIS_BEZEICHNUNG,
  SCHWERE_BEZEICHNUNG,
} from '@/lib/labels'
import { ACCEPT_ATTRIBUT, ERLAUBTE_ENDUNGEN_TEXT } from '@/lib/uploads'
import { faelligkeitErledigen } from '@/server/actions/durchfuehrungen'

type Ergebnis = 'OK' | 'OK_WITH_REMARKS' | 'DEVIATION'
type Schwere = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type Abweichung = {
  schluessel: string
  title: string
  description: string
  severity: Schwere
  responsibleId: string
  dueDate: string
}

export type ErledigenAufgabe = {
  occurrenceId: string
  aufgabenTitel: string
  faelligAm: string
  evidenceRequired: boolean
}

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function AbsendenButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <CheckCircle2 className="size-4" />
      {pending ? 'Wird gespeichert …' : 'Durchführung protokollieren'}
    </Button>
  )
}

export function ErledigenDialog({
  aufgabe,
  personen,
  heute,
  standardFrist,
  ausloeser,
}: {
  aufgabe: ErledigenAufgabe
  personen: { id: string; name: string }[]
  /** Heutiges Datum als JJJJ-MM-TT (Europe/Berlin). */
  heute: string
  /** Vorschlag für die Frist neuer Abweichungen (JJJJ-MM-TT). */
  standardFrist: string
  ausloeser?: React.ReactNode
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [ergebnis, setErgebnis] = useState<Ergebnis>('OK')
  const [abweichungen, setAbweichungen] = useState<Abweichung[]>([])
  const [dateiAnzahl, setDateiAnzahl] = useState(0)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await faelligkeitErledigen(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  // Beim Öffnen zurücksetzen, damit kein alter Zustand stehen bleibt.
  useEffect(() => {
    if (offen) {
      setErgebnis('OK')
      setAbweichungen([])
      setDateiAnzahl(0)
    }
  }, [offen])

  const neueAbweichung = () =>
    setAbweichungen((bisher) => [
      ...bisher,
      {
        schluessel: `abw-${bisher.length}-${Math.round(performance.now())}`,
        title: '',
        description: '',
        severity: 'MEDIUM',
        responsibleId: personen[0]?.id ?? '',
        dueDate: standardFrist,
      },
    ])

  const aendere = (schluessel: string, feld: keyof Abweichung, wert: string) =>
    setAbweichungen((bisher) =>
      bisher.map((a) => (a.schluessel === schluessel ? { ...a, [feld]: wert } : a)),
    )

  const entferne = (schluessel: string) =>
    setAbweichungen((bisher) => bisher.filter((a) => a.schluessel !== schluessel))

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogTrigger asChild>
        {ausloeser ?? (
          <Button size="sm">
            <CheckCircle2 className="size-4" />
            Erledigen
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Durchführung protokollieren</DialogTitle>
          <DialogDescription>
            {aufgabe.aufgabenTitel} · fällig am {aufgabe.faelligAm}
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="occurrenceId" value={aufgabe.occurrenceId} />
          <input
            type="hidden"
            name="abweichungen"
            value={JSON.stringify(
              abweichungen.map(({ schluessel: _schluessel, ...rest }) => rest),
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="result">Ergebnis</Label>
              <select
                id="result"
                name="result"
                value={ergebnis}
                onChange={(e) => setErgebnis(e.target.value as Ergebnis)}
                className={selectKlassen}
              >
                {(['OK', 'OK_WITH_REMARKS', 'DEVIATION'] as const).map((wert) => (
                  <option key={wert} value={wert}>
                    {ERGEBNIS_BEZEICHNUNG[wert]}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {ERGEBNIS_BESCHREIBUNG[ergebnis]}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="executedOn">Durchgeführt am</Label>
              <Input
                id="executedOn"
                name="executedOn"
                type="date"
                defaultValue={heute}
                max={heute}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Kommentar</Label>
            <Textarea
              id="comment"
              name="comment"
              rows={3}
              maxLength={4000}
              placeholder="Was wurde geprüft, welche Systeme, welche Auffälligkeiten?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nachweise">
              Nachweise{' '}
              {aufgabe.evidenceRequired ? (
                <span className="text-destructive">(verpflichtend)</span>
              ) : (
                <span className="text-muted-foreground">(optional)</span>
              )}
            </Label>
            <Input
              id="nachweise"
              name="nachweise"
              type="file"
              multiple
              accept={ACCEPT_ATTRIBUT}
              required={aufgabe.evidenceRequired}
              onChange={(e) => setDateiAnzahl(e.target.files?.length ?? 0)}
              className="cursor-pointer"
            />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Upload className="size-3.5" />
              Erlaubt: {ERLAUBTE_ENDUNGEN_TEXT} · maximal 25 MB je Datei
              {dateiAnzahl > 0
                ? ` · ${dateiAnzahl} ${dateiAnzahl === 1 ? 'Datei' : 'Dateien'} gewählt`
                : ''}
            </p>
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">Abweichungen</p>
                <p className="text-xs text-muted-foreground">
                  {ergebnis === 'DEVIATION'
                    ? 'Beim Ergebnis „Abweichung“ ist mindestens ein Eintrag erforderlich.'
                    : 'Optional – für Feststellungen, die nachverfolgt werden sollen.'}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={neueAbweichung}
              >
                <Plus className="size-4" />
                Hinzufügen
              </Button>
            </div>

            {abweichungen.map((abweichung, index) => (
              <div
                key={abweichung.schluessel}
                className="space-y-3 rounded-md bg-muted/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    Abweichung {index + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => entferne(abweichung.schluessel)}
                  >
                    <Trash2 className="size-4" />
                    Entfernen
                  </Button>
                </div>

                <Input
                  value={abweichung.title}
                  onChange={(e) =>
                    aendere(abweichung.schluessel, 'title', e.target.value)
                  }
                  placeholder="Titel der Abweichung"
                  maxLength={200}
                />
                <Textarea
                  value={abweichung.description}
                  onChange={(e) =>
                    aendere(abweichung.schluessel, 'description', e.target.value)
                  }
                  rows={2}
                  maxLength={4000}
                  placeholder="Feststellung und geplante Maßnahme"
                />

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Schweregrad</Label>
                    <select
                      value={abweichung.severity}
                      onChange={(e) =>
                        aendere(abweichung.schluessel, 'severity', e.target.value)
                      }
                      className={selectKlassen}
                    >
                      {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((stufe) => (
                        <option key={stufe} value={stufe}>
                          {SCHWERE_BEZEICHNUNG[stufe]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Verantwortlich</Label>
                    <select
                      value={abweichung.responsibleId}
                      onChange={(e) =>
                        aendere(abweichung.schluessel, 'responsibleId', e.target.value)
                      }
                      className={selectKlassen}
                    >
                      {personen.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Frist</Label>
                    <Input
                      type="date"
                      value={abweichung.dueDate}
                      onChange={(e) =>
                        aendere(abweichung.schluessel, 'dueDate', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
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

          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Hinweis: Eine protokollierte Durchführung ist unveränderlich.
            Korrekturen erfolgen ausschließlich als neuer, protokollierter
            Vorgang.
          </p>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <AbsendenButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
