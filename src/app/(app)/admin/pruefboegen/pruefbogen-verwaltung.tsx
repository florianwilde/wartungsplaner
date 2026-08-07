'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Textarea } from '@/components/ui/textarea'
import { ART_BEZEICHNUNG, type PruefpunktArt } from '@/lib/nachweise'
import { pruefbogenLoeschen, pruefbogenSpeichern } from '@/server/actions/nachweise'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const ARTEN: PruefpunktArt[] = [
  'BEWERTUNG',
  'ENTSCHEIDUNG',
  'LISTE',
  'TEXT',
  'ZAHL',
  'DATUM',
]

export type PunktEingabe = {
  schluessel: string
  frage: string
  hinweis: string
  art: PruefpunktArt
  pflicht: boolean
}

export type BogenAnzeige = {
  id: string
  name: string
  beschreibung: string | null
  taskId: string | null
  taskTitel: string | null
  vierAugen: boolean
  aktiv: boolean
  anzahlPunkte: number
  anzahlNachweise: number
  punkte: PunktEingabe[]
}

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Prüfbogen speichern'}
    </Button>
  )
}

function BogenDialog({
  bogen,
  aufgaben,
  offen,
  setOffen,
}: {
  bogen: BogenAnzeige | null
  aufgaben: { id: string; titel: string }[]
  offen: boolean
  setOffen: (offen: boolean) => void
}) {
  const router = useRouter()
  const [punkte, setPunkte] = useState<PunktEingabe[]>(
    bogen?.punkte ?? [
      { schluessel: 'p0', frage: '', hinweis: '', art: 'BEWERTUNG', pflicht: true },
    ],
  )

  const aktion = pruefbogenSpeichern.bind(null, bogen?.id ?? null)
  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await aktion(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  const aendere = (
    schluessel: string,
    feld: keyof PunktEingabe,
    wert: string | boolean,
  ) =>
    setPunkte((bisher) =>
      bisher.map((p) => (p.schluessel === schluessel ? { ...p, [feld]: wert } : p)),
    )

  const verschiebe = (index: number, richtung: -1 | 1) =>
    setPunkte((bisher) => {
      const ziel = index + richtung
      if (ziel < 0 || ziel >= bisher.length) return bisher
      const kopie = [...bisher]
      ;[kopie[index], kopie[ziel]] = [kopie[ziel], kopie[index]]
      return kopie
    })

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {bogen ? 'Prüfbogen bearbeiten' : 'Neuer Prüfbogen'}
          </DialogTitle>
          <DialogDescription>
            Prüfpunkte in der Reihenfolge, in der sie beim Erfassen erscheinen.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input
            type="hidden"
            name="punkte"
            value={JSON.stringify(punkte.map(({ schluessel: _s, ...rest }) => rest))}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bogen-name">Name</Label>
              <Input
                id="bogen-name"
                name="name"
                defaultValue={bogen?.name ?? ''}
                placeholder="z. B. Rezertifizierung Zugriffsberechtigungen"
                maxLength={120}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bogen-task">Aufgabe (optional)</Label>
              <select
                id="bogen-task"
                name="taskId"
                defaultValue={bogen?.taskId ?? ''}
                className={selectKlassen}
              >
                <option value="">Für alle Aufgaben verfügbar</option>
                {aufgaben.map((aufgabe) => (
                  <option key={aufgabe.id} value={aufgabe.id}>
                    {aufgabe.titel}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                Fest zugeordnete Bögen erscheinen bei der Aufgabe zuerst.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bogen-beschreibung">Beschreibung</Label>
            <Textarea
              id="bogen-beschreibung"
              name="beschreibung"
              defaultValue={bogen?.beschreibung ?? ''}
              rows={2}
              maxLength={1000}
              placeholder="Zweck und Umfang der Prüfung – erscheint im PDF-Nachweis."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Checkbox
                id="bogen-vieraugen"
                name="vierAugen"
                defaultChecked={bogen?.vierAugen ?? false}
              />
              <div className="space-y-1">
                <Label htmlFor="bogen-vieraugen">Vier-Augen-Prinzip</Label>
                <p className="text-muted-foreground text-xs">
                  Der Nachweis wird erst nach Gegenzeichnung durch eine zweite Person
                  gültig.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="bogen-aktiv"
                name="aktiv"
                defaultChecked={bogen?.aktiv ?? true}
              />
              <div className="space-y-1">
                <Label htmlFor="bogen-aktiv">Aktiv</Label>
                <p className="text-muted-foreground text-xs">
                  Nur aktive Bögen stehen zum Erfassen bereit.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Prüfpunkte ({punkte.length})</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setPunkte((bisher) => [
                    ...bisher,
                    {
                      schluessel: `p${bisher.length}-${Math.round(performance.now())}`,
                      frage: '',
                      hinweis: '',
                      art: 'BEWERTUNG',
                      pflicht: true,
                    },
                  ])
                }
              >
                <Plus className="size-4" />
                Prüfpunkt
              </Button>
            </div>

            <div className="max-h-96 space-y-3 overflow-y-auto">
              {punkte.map((punkt, index) => (
                <div
                  key={punkt.schluessel}
                  className="bg-muted/50 space-y-2 rounded-md p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-xs font-medium">
                      Punkt {index + 1}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Nach oben"
                        onClick={() => verschiebe(index, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Nach unten"
                        onClick={() => verschiebe(index, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Entfernen"
                        disabled={punkte.length <= 1}
                        onClick={() =>
                          setPunkte((bisher) =>
                            bisher.filter((p) => p.schluessel !== punkt.schluessel),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <Input
                    value={punkt.frage}
                    onChange={(e) => aendere(punkt.schluessel, 'frage', e.target.value)}
                    placeholder="Frage oder zu prüfender Sachverhalt"
                    maxLength={300}
                  />
                  <Input
                    value={punkt.hinweis}
                    onChange={(e) =>
                      aendere(punkt.schluessel, 'hinweis', e.target.value)
                    }
                    placeholder="Hinweis zur Durchführung (optional)"
                    maxLength={300}
                    className="text-sm"
                  />

                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      value={punkt.art}
                      onChange={(e) => aendere(punkt.schluessel, 'art', e.target.value)}
                      className={selectKlassen}
                      aria-label="Antwortart"
                    >
                      {ARTEN.map((art) => (
                        <option key={art} value={art}>
                          {ART_BEZEICHNUNG[art]}
                        </option>
                      ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={punkt.pflicht}
                        onCheckedChange={(wert) =>
                          aendere(punkt.schluessel, 'pflicht', wert === true)
                        }
                      />
                      Pflichtangabe
                    </label>
                  </div>
                </div>
              ))}
            </div>
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

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <SpeichernButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PruefbogenVerwaltung({
  boegen,
  aufgaben,
}: {
  boegen: BogenAnzeige[]
  aufgaben: { id: string; titel: string }[]
}) {
  const router = useRouter()
  const [neu, setNeu] = useState(false)
  const [bearbeiten, setBearbeiten] = useState<BogenAnzeige | null>(null)
  const [laeuft, starte] = useTransition()

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="size-4" />
            Prüfbögen
          </CardTitle>
          <CardDescription>
            Vorlagen für strukturierte Nachweise. Aus einem ausgefüllten Bogen entsteht
            ein PDF, das als Nachweis an der Durchführung hinterlegt wird.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setNeu(true)}>
          <Plus className="size-4" />
          Prüfbogen anlegen
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {boegen.length === 0 ? (
          <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
            Es ist noch kein Prüfbogen angelegt.
          </p>
        ) : (
          boegen.map((bogen) => (
            <div
              key={bogen.id}
              className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{bogen.name}</span>
                  {bogen.vierAugen ? <Badge variant="outline">Vier Augen</Badge> : null}
                  {!bogen.aktiv ? <Badge variant="secondary">Deaktiviert</Badge> : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  {bogen.anzahlPunkte} Prüfpunkte ·{' '}
                  {bogen.taskTitel
                    ? `zugeordnet: ${bogen.taskTitel}`
                    : 'für alle Aufgaben'}{' '}
                  · {bogen.anzahlNachweise} Nachweise
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBearbeiten(bogen)}
                >
                  Bearbeiten
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={laeuft || bogen.anzahlNachweise > 0}
                  title={
                    bogen.anzahlNachweise > 0
                      ? 'Es gibt Nachweise zu diesem Bogen – bitte deaktivieren'
                      : undefined
                  }
                  onClick={() =>
                    starte(async () => {
                      const ergebnis = await pruefbogenLoeschen(bogen.id)
                      if (ergebnis.fehler) toast.error(ergebnis.fehler)
                      else {
                        toast.success(ergebnis.erfolg ?? 'Gelöscht.')
                        router.refresh()
                      }
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      {neu ? (
        <BogenDialog bogen={null} aufgaben={aufgaben} offen setOffen={setNeu} />
      ) : null}

      {bearbeiten ? (
        <BogenDialog
          key={bearbeiten.id}
          bogen={bearbeiten}
          aufgaben={aufgaben}
          offen
          setOffen={(offen) => !offen && setBearbeiten(null)}
        />
      ) : null}
    </Card>
  )
}
