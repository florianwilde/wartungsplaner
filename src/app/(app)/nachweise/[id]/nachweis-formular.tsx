'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Save,
  Send,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import {
  ERGEBNIS_BEZEICHNUNG,
  ERLAUBTE_ERGEBNISSE,
  pruefeVollstaendigkeit,
  type PruefpunktArt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import {
  nachweisSpeichern,
  nachweisUebergang,
} from '@/server/actions/nachweise'

export type PunktAnzeige = {
  id: string
  position: number
  frage: string
  hinweis: string | null
  art: PruefpunktArt
  pflicht: boolean
  ergebnis: PruefpunktErgebnis | null
  wert: string | null
  bemerkung: string | null
}

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="outline" disabled={pending}>
      <Save className="size-4" />
      {pending ? 'Wird gespeichert …' : 'Zwischenstand speichern'}
    </Button>
  )
}

export function NachweisFormular({
  nachweisId,
  punkte: anfangsPunkte,
  bemerkung: anfangsBemerkung,
  vierAugen,
  aenderbar,
  darfGegenzeichnen,
  ablehnungsgrund,
}: {
  nachweisId: string
  punkte: PunktAnzeige[]
  bemerkung: string
  vierAugen: boolean
  /** Darf die anmeldete Person die Antworten noch ändern? */
  aenderbar: boolean
  /** Ist die Person zur Gegenzeichnung berechtigt (und nicht die erfassende)? */
  darfGegenzeichnen: boolean
  ablehnungsgrund: string | null
}) {
  const router = useRouter()
  const [punkte, setPunkte] = useState(anfangsPunkte)
  const [bemerkung, setBemerkung] = useState(anfangsBemerkung)
  const [ablehnen, setAblehnen] = useState(false)
  const [grund, setGrund] = useState('')
  const [uebergangLaeuft, starteUebergang] = useTransition()

  const speichern = nachweisSpeichern.bind(null, nachweisId)
  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await speichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  const stand = pruefeVollstaendigkeit(
    punkte.map((p) => ({
      id: p.id,
      position: p.position,
      frage: p.frage,
      art: p.art,
      pflicht: p.pflicht,
    })),
    punkte.map((p) => ({ punktId: p.id, ergebnis: p.ergebnis, wert: p.wert })),
  )

  const aendere = (
    id: string,
    feld: 'ergebnis' | 'wert' | 'bemerkung',
    wert: string,
  ) =>
    setPunkte((bisher) =>
      bisher.map((p) =>
        p.id === id
          ? {
              ...p,
              [feld]:
                feld === 'ergebnis'
                  ? ((wert || null) as PruefpunktErgebnis | null)
                  : wert || null,
            }
          : p,
      ),
    )

  /** Bringt die Eingaben der Oberfläche in die Form der Server-Aktion. */
  const alsFormular = () => {
    const formular = new FormData()
    formular.set(
      'antworten',
      JSON.stringify(
        punkte.map((p) => ({
          punktId: p.id,
          ergebnis: p.ergebnis,
          wert: p.wert,
          bemerkung: p.bemerkung,
        })),
      ),
    )
    formular.set('bemerkung', bemerkung)
    return formular
  }

  const loeseUebergangAus = (
    uebergang: 'vorlegen' | 'gegenzeichnen' | 'zurueckweisen' | 'abschliessen',
    begruendung: string | null = null,
  ) =>
    starteUebergang(async () => {
      // Vorlegen und Abschließen prüfen serverseitig die Pflichtangaben. Was
      // gerade eingetippt wurde, steht aber nur im Browser – ohne vorheriges
      // Speichern würde der Server einen veralteten Stand bewerten und den
      // Vorgang mit „Pflichtangaben fehlen“ ablehnen, obwohl alles ausgefüllt ist.
      if (aenderbar && (uebergang === 'vorlegen' || uebergang === 'abschliessen')) {
        const gespeichert = await nachweisSpeichern(nachweisId, {}, alsFormular())
        if (gespeichert.fehler) {
          toast.error(gespeichert.fehler)
          return
        }
      }

      const ergebnis = await nachweisUebergang(nachweisId, uebergang, begruendung)
      if (ergebnis.fehler) toast.error(ergebnis.fehler)
      else {
        toast.success(ergebnis.erfolg ?? 'Gespeichert.')
        setAblehnen(false)
        setGrund('')
        router.refresh()
      }
    })

  return (
    <div className="space-y-6">
      {ablehnungsgrund ? (
        <p className="flex items-start gap-2 rounded-md bg-status-warn/15 p-3 text-sm text-status-warn">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>Zurückgewiesen:</strong> {ablehnungsgrund}
          </span>
        </p>
      ) : null}

      <form action={formAction} className="space-y-6">
        <input
          type="hidden"
          name="antworten"
          value={JSON.stringify(
            punkte.map((p) => ({
              punktId: p.id,
              ergebnis: p.ergebnis,
              wert: p.wert,
              bemerkung: p.bemerkung,
            })),
          )}
        />
        <input type="hidden" name="bemerkung" value={bemerkung} />

        <Card>
          <CardHeader>
            <CardTitle>Prüfpunkte</CardTitle>
            <CardDescription>
              {stand.beantwortet} von {stand.gesamt} beantwortet
              {stand.offenePflichtpunkte.length > 0
                ? ` · offen: Punkt ${stand.offenePflichtpunkte.join(', ')}`
                : ' · alle Pflichtangaben vollständig'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {punkte.map((punkt) => {
              const ergebnisse = ERLAUBTE_ERGEBNISSE[punkt.art]
              return (
                <div
                  key={punkt.id}
                  className="space-y-3 rounded-lg border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {punkt.position}. {punkt.frage}
                        {punkt.pflicht ? (
                          <span className="ml-1 text-destructive">*</span>
                        ) : null}
                      </p>
                      {punkt.hinweis ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {punkt.hinweis}
                        </p>
                      ) : null}
                    </div>
                    {punkt.ergebnis ? (
                      <Badge
                        variant={
                          punkt.ergebnis === 'NICHT_ERFUELLT' ||
                          punkt.ergebnis === 'ENTZIEHEN'
                            ? 'danger'
                            : punkt.ergebnis === 'ENTFAELLT'
                              ? 'neutral'
                              : 'ok'
                        }
                      >
                        {ERGEBNIS_BEZEICHNUNG[punkt.ergebnis]}
                      </Badge>
                    ) : null}
                  </div>

                  {ergebnisse.length > 0 ? (
                    <select
                      value={punkt.ergebnis ?? ''}
                      disabled={!aenderbar}
                      onChange={(e) => aendere(punkt.id, 'ergebnis', e.target.value)}
                      className={selectKlassen}
                      aria-label={`Ergebnis für Prüfpunkt ${punkt.position}`}
                    >
                      <option value="">Bitte wählen …</option>
                      {ergebnisse.map((wert) => (
                        <option key={wert} value={wert}>
                          {ERGEBNIS_BEZEICHNUNG[wert]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      type={
                        punkt.art === 'ZAHL'
                          ? 'number'
                          : punkt.art === 'DATUM'
                            ? 'date'
                            : 'text'
                      }
                      value={punkt.wert ?? ''}
                      disabled={!aenderbar}
                      onChange={(e) => aendere(punkt.id, 'wert', e.target.value)}
                      aria-label={`Antwort für Prüfpunkt ${punkt.position}`}
                    />
                  )}

                  <Textarea
                    value={punkt.bemerkung ?? ''}
                    disabled={!aenderbar}
                    onChange={(e) => aendere(punkt.id, 'bemerkung', e.target.value)}
                    rows={2}
                    placeholder="Bemerkung (optional) – bei Feststellungen bitte die Maßnahme angeben"
                    className="text-sm"
                  />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bemerkung zur Durchführung</CardTitle>
            <CardDescription>
              Erscheint zusammenfassend im PDF-Nachweis.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={bemerkung}
              disabled={!aenderbar}
              onChange={(e) => setBemerkung(e.target.value)}
              rows={4}
              maxLength={4000}
            />
          </CardContent>
        </Card>

        {status.fehler ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {status.fehler}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {aenderbar ? <SpeichernButton /> : null}

          {aenderbar && vierAugen ? (
            <Button
              type="button"
              disabled={uebergangLaeuft || !stand.vollstaendig}
              onClick={() => loeseUebergangAus('vorlegen')}
              title={
                stand.vollstaendig
                  ? undefined
                  : 'Bitte zuerst alle Pflichtangaben ausfüllen'
              }
            >
              <Send className="size-4" />
              Zur Gegenzeichnung vorlegen
            </Button>
          ) : null}

          {aenderbar && !vierAugen ? (
            <Button
              type="button"
              disabled={uebergangLaeuft || !stand.vollstaendig}
              onClick={() => loeseUebergangAus('abschliessen')}
            >
              <CheckCircle2 className="size-4" />
              Abschließen
            </Button>
          ) : null}

          {darfGegenzeichnen ? (
            <>
              <Button
                type="button"
                disabled={uebergangLaeuft}
                onClick={() => loeseUebergangAus('gegenzeichnen')}
              >
                <ThumbsUp className="size-4" />
                Gegenzeichnen
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={uebergangLaeuft}
                onClick={() => setAblehnen(true)}
              >
                <ThumbsDown className="size-4" />
                Zurückweisen
              </Button>
            </>
          ) : null}
        </div>

        {aenderbar && vierAugen ? (
          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Dieser Prüfbogen verlangt das Vier-Augen-Prinzip: Nach dem Vorlegen
            muss eine zweite Person gegenzeichnen. Erst danach gilt der Nachweis
            als gültig und wird als Anhang an der Durchführung hinterlegt.
          </p>
        ) : null}
      </form>

      <Dialog open={ablehnen} onOpenChange={setAblehnen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nachweis zurückweisen</DialogTitle>
            <DialogDescription>
              Die erfassende Person kann den Bogen danach erneut bearbeiten. Die
              Begründung wird revisionssicher protokolliert.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="ablehnungsgrund">Begründung</Label>
            <Textarea
              id="ablehnungsgrund"
              value={grund}
              onChange={(e) => setGrund(e.target.value)}
              rows={4}
              minLength={10}
              placeholder="Was fehlt oder ist nicht nachvollziehbar?"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setAblehnen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={uebergangLaeuft || grund.trim().length < 10}
              onClick={() => loeseUebergangAus('zurueckweisen', grund)}
            >
              Zurückweisen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
