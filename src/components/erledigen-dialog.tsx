'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { DateiEingabe } from '@/components/datei-eingabe'
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
import { STATUS_BEZEICHNUNG, type NachweisStatus } from '@/lib/nachweise'
import { ERLAUBTE_ENDUNGEN_TEXT } from '@/lib/uploads'
import { faelligkeitErledigen } from '@/server/actions/durchfuehrungen'
import { nachweisBeginnen } from '@/server/actions/nachweise'

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

/** Ein Prüfbogen, der für diese Fälligkeit in Frage kommt. */
export type WaehlbarerBogen = {
  id: string
  name: string
  beschreibung: string | null
  vierAugen: boolean
  anzahlPunkte: number
  /** true = fest dieser Aufgabe zugeordnet */
  zugeordnet: boolean
}

/** Ein Prüfbogen, der zu dieser Fälligkeit bereits ausgefüllt wurde. */
export type VorliegenderNachweis = {
  nachweisId: string
  pruefbogen: string
  status: NachweisStatus
  vierAugen: boolean
  erfasstVon: string
  geprueftVon: string | null
  feststellungen: { titel: string; bemerkung: string | null }[]
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
  boegen = [],
  nachweise = [],
  ausloeser,
}: {
  aufgabe: ErledigenAufgabe
  personen: { id: string; name: string }[]
  /** Heutiges Datum als JJJJ-MM-TT (Europe/Berlin). */
  heute: string
  /** Vorschlag für die Frist neuer Abweichungen (JJJJ-MM-TT). */
  standardFrist: string
  /** Prüfbögen, die für diese Aufgabe bereitstehen. */
  boegen?: WaehlbarerBogen[]
  /** Bereits zu dieser Fälligkeit geführte Prüfbögen. */
  nachweise?: VorliegenderNachweis[]
  ausloeser?: React.ReactNode
}) {
  const router = useRouter()

  // Ein abgeschlossener Bogen erledigt die Fälligkeit nicht von selbst – es
  // fehlen Ergebnis und Abweichungen. Liegt einer vor, wird hier nicht mehr
  // nach dem Weg gefragt, sondern der Bogen der Durchführung zugeschlagen.
  const fertige = nachweise.filter((n) => n.status === 'GEGENGEZEICHNET')
  const offeneBoegen = nachweise.filter((n) => n.status !== 'GEGENGEZEICHNET')
  const feststellungen = fertige.flatMap((nachweis) =>
    nachweis.feststellungen.map((f, index) => ({
      ...f,
      schluessel: `${nachweis.nachweisId}-${index}`,
    })),
  )

  const [offen, setOffen] = useState(false)
  const [ergebnis, setErgebnis] = useState<Ergebnis>('OK')
  // Wegwahl: Mit Prüfbogen erfassen oder unmittelbar protokollieren.
  const [weg, setWeg] = useState<'bogen' | 'direkt'>('direkt')
  const [bogenId, setBogenId] = useState(boegen[0]?.id ?? '')
  const [oeffnetBogen, setOeffnetBogen] = useState(false)
  const [abweichungen, setAbweichungen] = useState<Abweichung[]>([])
  const [uebernommen, setUebernommen] = useState<string[]>([])
  const [dateiAnzahl, setDateiAnzahl] = useState(0)

  // Ein fertiger Bogen zählt als Nachweis; die Dateipflicht ist damit erfüllt.
  const nachweisPflicht = aufgabe.evidenceRequired && fertige.length === 0

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

  // Beim Öffnen zurücksetzen, damit kein alter Zustand stehen bleibt. Hat der
  // Bogen Feststellungen, ist „ohne Befund“ die falsche Voreinstellung.
  const hatFeststellungen = feststellungen.length > 0
  useEffect(() => {
    if (offen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setErgebnis(hatFeststellungen ? 'OK_WITH_REMARKS' : 'OK')
      setAbweichungen([])
      setUebernommen([])
      setDateiAnzahl(0)
    }
  }, [offen, hatFeststellungen])

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

  /** Übernimmt eine Feststellung des Bogens als vorbelegte Abweichung. */
  const uebernimmFeststellung = (feststellung: {
    schluessel: string
    titel: string
    bemerkung: string | null
  }) => {
    setAbweichungen((bisher) => [
      ...bisher,
      {
        schluessel: `abw-${feststellung.schluessel}`,
        title: feststellung.titel.slice(0, 200),
        description: feststellung.bemerkung ?? '',
        severity: 'MEDIUM',
        responsibleId: personen[0]?.id ?? '',
        dueDate: standardFrist,
      },
    ])
    setUebernommen((bisher) => [...bisher, feststellung.schluessel])
    if (ergebnis === 'OK') setErgebnis('OK_WITH_REMARKS')
  }

  const aendere = (schluessel: string, feld: keyof Abweichung, wert: string) =>
    setAbweichungen((bisher) =>
      bisher.map((a) => (a.schluessel === schluessel ? { ...a, [feld]: wert } : a)),
    )

  const entferne = (schluessel: string) => {
    setAbweichungen((bisher) => bisher.filter((a) => a.schluessel !== schluessel))
    // Wieder anbietbar machen, falls die Feststellung dahintersteckt.
    setUebernommen((bisher) => bisher.filter((k) => `abw-${k}` !== schluessel))
  }

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

        {fertige.length > 0 ? (
          <div className="space-y-2 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <FileCheck2 className="size-4" />
              {fertige.length === 1
                ? 'Ein ausgefüllter Prüfbogen liegt vor'
                : `${fertige.length} ausgefüllte Prüfbögen liegen vor`}
            </p>
            {fertige.map((nachweis) => (
              <p key={nachweis.nachweisId} className="text-xs text-muted-foreground">
                <Link
                  href={`/nachweise/${nachweis.nachweisId}`}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {nachweis.pruefbogen}
                </Link>
                {' · erfasst von '}
                {nachweis.erfasstVon}
                {nachweis.geprueftVon
                  ? ` · gegengezeichnet von ${nachweis.geprueftVon}`
                  : ''}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Der Bogen zählt als Nachweis. Sein PDF und die daran hängenden
              Belege gehen mit dieser Durchführung ein.
            </p>
          </div>
        ) : null}

        {offeneBoegen.length > 0 ? (
          <div className="space-y-1 rounded-lg border border-border p-3">
            <p className="text-sm font-medium">Noch nicht abgeschlossen</p>
            {offeneBoegen.map((nachweis) => (
              <p key={nachweis.nachweisId} className="text-xs text-muted-foreground">
                <Link
                  href={`/nachweise/${nachweis.nachweisId}`}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  {nachweis.pruefbogen}
                </Link>
                {' · '}
                {STATUS_BEZEICHNUNG[nachweis.status]}
                {' · erfasst von '}
                {nachweis.erfasstVon}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Wird dieser Bogen später abgeschlossen, kommt sein PDF zur
              Durchführung hinzu.
            </p>
          </div>
        ) : null}

        {boegen.length > 0 && fertige.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Wie möchten Sie vorgehen?</p>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary">
              <input
                type="radio"
                name="weg"
                checked={weg === 'bogen'}
                onChange={() => setWeg('bogen')}
                className="mt-1"
              />
              <span className="min-w-0 flex-1 space-y-2">
                <span className="flex items-center gap-2 font-medium">
                  <ClipboardList className="size-4" />
                  Prüfbogen ausfüllen
                </span>
                <span className="block text-xs text-muted-foreground">
                  Der Befund wird Punkt für Punkt festgehalten; daraus entsteht
                  ein PDF-Nachweis. Die Fälligkeit erledigen Sie danach hier –
                  mit Ergebnis und etwaigen Abweichungen.
                </span>

                {weg === 'bogen' ? (
                  <span className="block space-y-2 pt-1">
                    {boegen.map((bogen) => (
                      <label
                        key={bogen.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-border/60 p-2 text-sm has-[:checked]:border-primary"
                      >
                        <input
                          type="radio"
                          name="bogen"
                          checked={bogenId === bogen.id}
                          onChange={() => setBogenId(bogen.id)}
                          className="mt-1"
                        />
                        <span className="min-w-0">
                          <span className="font-medium">{bogen.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {bogen.anzahlPunkte} Prüfpunkte
                            {bogen.vierAugen
                              ? ' · Gegenzeichnung durch eine zweite Person'
                              : ''}
                            {bogen.zugeordnet ? ' · für diese Aufgabe' : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </span>
                ) : null}
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary">
              <input
                type="radio"
                name="weg"
                checked={weg === 'direkt'}
                onChange={() => setWeg('direkt')}
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="font-medium">Ohne Prüfbogen protokollieren</span>
                <span className="block text-xs text-muted-foreground">
                  Ergebnis und Kommentar erfassen, Dateien als Nachweis anhängen.
                </span>
              </span>
            </label>
          </div>
        ) : null}

        {weg === 'bogen' && boegen.length > 0 && fertige.length === 0 ? (
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={oeffnetBogen || !bogenId}
              onClick={async () => {
                setOeffnetBogen(true)
                const ergebnis = await nachweisBeginnen(
                  aufgabe.occurrenceId,
                  bogenId,
                )
                setOeffnetBogen(false)
                if (ergebnis.fehler) {
                  toast.error(ergebnis.fehler)
                } else if (ergebnis.nachweisId) {
                  setOffen(false)
                  router.push(`/nachweise/${ergebnis.nachweisId}`)
                }
              }}
            >
              <ClipboardList className="size-4" />
              {oeffnetBogen ? 'Wird geöffnet …' : 'Zum Prüfbogen'}
            </Button>
          </DialogFooter>
        ) : (
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
              {nachweisPflicht ? (
                <span className="text-destructive">(verpflichtend)</span>
              ) : (
                <span className="text-muted-foreground">
                  {aufgabe.evidenceRequired
                    ? '(durch den Prüfbogen erfüllt)'
                    : '(optional)'}
                </span>
              )}
            </Label>
            <DateiEingabe
              id="nachweise"
              name="nachweise"
              required={nachweisPflicht}
              onAnzahl={setDateiAnzahl}
              hinweis={`Erlaubt: ${ERLAUBTE_ENDUNGEN_TEXT} · maximal 25 MB je Datei${
                dateiAnzahl > 0
                  ? ` · ${dateiAnzahl} ${dateiAnzahl === 1 ? 'Datei' : 'Dateien'} gewählt`
                  : ''
              }`}
            />
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

            {feststellungen.length > 0 ? (
              <div className="space-y-2 rounded-md border border-dashed border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Der Prüfbogen weist folgende Feststellungen aus. Was
                  nachverfolgt werden soll, übernehmen Sie als Abweichung.
                </p>
                {feststellungen.map((feststellung) => (
                  <div
                    key={feststellung.schluessel}
                    className="flex flex-wrap items-start justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{feststellung.titel}</p>
                      {feststellung.bemerkung ? (
                        <p className="text-xs text-muted-foreground">
                          {feststellung.bemerkung}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uebernommen.includes(feststellung.schluessel)}
                      onClick={() => uebernimmFeststellung(feststellung)}
                    >
                      {uebernommen.includes(feststellung.schluessel)
                        ? 'Übernommen'
                        : 'Als Abweichung übernehmen'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}

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
        )}
      </DialogContent>
    </Dialog>
  )
}
