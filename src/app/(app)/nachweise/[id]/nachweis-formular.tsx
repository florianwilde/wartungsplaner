'use client'

import { useActionState, useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Save,
  Paperclip,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateiEingabe } from '@/components/datei-eingabe'
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
  wendeSammelentscheidungAn,
  zeilenVon,
  type PruefpunktArt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import {
  ERLAUBTE_ENDUNGEN_TEXT,
  MAX_DATEIGROESSE_TEXT,
  lesbareGroesse,
} from '@/lib/uploads'
import { Zeilenliste, type ZeileAnzeige } from './zeilenliste'
import {
  nachweisBelegEntfernen,
  nachweisBelegeHochladen,
  nachweisSpeichern,
  nachweisUebergang,
  nachweisZeilenSpeichern,
} from '@/server/actions/nachweise'

export type BelegAnzeige = {
  id: string
  filename: string
  sizeBytes: number
  sha256: string
  punktId: string | null
  hochgeladenVon: string
  hochgeladenAm: string
}

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
  belege,
  zeilen: anfangsZeilen,
  vierAugen,
  aenderbar,
  darfGegenzeichnen,
  ablehnungsgrund,
}: {
  nachweisId: string
  punkte: PunktAnzeige[]
  bemerkung: string
  belege: BelegAnzeige[]
  zeilen: ZeileAnzeige[]
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
  const [zeilen, setZeilen] = useState(anfangsZeilen)
  // Der Zwischenstand wird aus einer Formular-Aktion heraus gespeichert; der
  // Verweis hält dabei den aktuellen Stand fest. Nachgezogen wird er im
  // Effekt, nicht beim Rendern: Ein Verweis ist kein Renderergebnis.
  const zeilenRef = useRef(anfangsZeilen)
  useEffect(() => {
    zeilenRef.current = zeilen
  }, [zeilen])
  const [ablehnen, setAblehnen] = useState(false)
  const [grund, setGrund] = useState('')
  const [uebergangLaeuft, starteUebergang] = useTransition()
  const [belegLaeuft, starteBeleg] = useTransition()
  const [belegPunktId, setBelegPunktId] = useState('')
  const dateiFeld = useRef<HTMLInputElement>(null)
  const [leerenSignal, setLeerenSignal] = useState(0)

  const hochladen = () => {
    const dateien = Array.from(dateiFeld.current?.files ?? [])
    if (dateien.length === 0) {
      toast.error('Bitte zuerst eine Datei auswählen.')
      return
    }

    starteBeleg(async () => {
      const formular = new FormData()
      for (const datei of dateien) formular.append('dateien', datei)
      formular.set('punktId', belegPunktId)

      const antwort = await nachweisBelegeHochladen(nachweisId, {}, formular)
      if (antwort.fehler) {
        toast.error(antwort.fehler)
        return
      }
      toast.success(antwort.erfolg ?? 'Hinzugefügt.')
      setLeerenSignal((wert) => wert + 1)
      setBelegPunktId('')
      router.refresh()
    })
  }

  const entferne = (belegId: string, dateiname: string) =>
    starteBeleg(async () => {
      const antwort = await nachweisBelegEntfernen(nachweisId, belegId)
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(`„${dateiname}“ wurde entfernt.`)
        router.refresh()
      }
    })

  const speichern = nachweisSpeichern.bind(null, nachweisId)
  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await speichern(vorher, formData)
      if (antwort.erfolg) {
        if (zeilenRef.current.length > 0) {
          await nachweisZeilenSpeichern(
            nachweisId,
            zeilenRef.current.map((z) => ({
              id: z.id,
              ergebnis: z.ergebnis,
              bemerkung: z.bemerkung,
            })),
          )
        }
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
    zeilen,
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

  const aendereZeile = (
    zeilenId: string,
    feld: 'ergebnis' | 'bemerkung',
    wert: string,
  ) =>
    setZeilen((bisher) =>
      bisher.map((z) =>
        z.id === zeilenId
          ? {
              ...z,
              [feld]:
                feld === 'ergebnis'
                  ? ((wert || null) as PruefpunktErgebnis | null)
                  : wert || null,
            }
          : z,
      ),
    )

  /**
   * Setzt alle noch offenen Zeilen eines Prüfpunkts auf denselben Wert.
   *
   * Bei einer Rezertifizierung ist die überwiegende Mehrheit in Ordnung –
   * ohne diesen Griff müsste man achtzig Mal dasselbe auswählen, um an die
   * drei Ausnahmen zu kommen.
   */
  const sammelentscheidung = (punktId: string, ergebnis: PruefpunktErgebnis) => {
    setZeilen((bisher) => {
      const eigene = wendeSammelentscheidungAn(
        bisher.filter((z) => z.punktId === punktId),
        ergebnis,
      )
      const nachId = new Map(eigene.map((z) => [z.id, z]))
      return bisher.map((z) => nachId.get(z.id) ?? z)
    })
  }

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

  const alsZeilenEingabe = () =>
    zeilen.map((z) => ({
      id: z.id,
      ergebnis: z.ergebnis,
      bemerkung: z.bemerkung,
    }))

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
        if (zeilen.length > 0) {
          const zeilenStand = await nachweisZeilenSpeichern(nachweisId, alsZeilenEingabe())
          if (zeilenStand.fehler) {
            toast.error(zeilenStand.fehler)
            return
          }
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

                  {punkt.art === 'LISTE' ? (
                    <Zeilenliste
                      nachweisId={nachweisId}
                      punktId={punkt.id}
                      position={punkt.position}
                      zeilen={zeilenVon(zeilen, punkt.id)}
                      aenderbar={aenderbar}
                      aendere={aendereZeile}
                      sammelentscheidung={sammelentscheidung}
                    />
                  ) : ergebnisse.length > 0 ? (
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

                  {punkt.art === 'LISTE' ? null : (
                  <Textarea
                    value={punkt.bemerkung ?? ''}
                    disabled={!aenderbar}
                    onChange={(e) => aendere(punkt.id, 'bemerkung', e.target.value)}
                    rows={2}
                    placeholder="Bemerkung (optional) – bei Feststellungen bitte die Maßnahme angeben"
                    className="text-sm"
                  />
                  )}
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

        <Card>
          <CardHeader>
            <CardTitle>Belege</CardTitle>
            <CardDescription>
              Die tatsächlichen Nachweise aus den geprüften Systemen –
              AD-Export, Screenshot, Herstellerprotokoll, Sicherungsbericht.
              Erlaubt sind {ERLAUBTE_ENDUNGEN_TEXT}; je Datei bis{' '}
              {MAX_DATEIGROESSE_TEXT}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {belege.length > 0 ? (
              <ul className="space-y-2">
                {belege.map((beleg) => {
                  const punkt = punkte.find((p) => p.id === beleg.punktId)
                  return (
                    <li
                      key={beleg.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <a
                          href={`/api/attachments/${beleg.id}`}
                          className="flex items-center gap-2 text-sm font-medium hover:underline"
                        >
                          <Paperclip className="size-4 shrink-0" />
                          <span className="break-all">{beleg.filename}</span>
                        </a>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {lesbareGroesse(beleg.sizeBytes)} ·{' '}
                          {beleg.hochgeladenVon} · {beleg.hochgeladenAm}
                          {punkt ? ` · zu Prüfpunkt ${punkt.position}` : ''}
                        </p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          SHA-256: {beleg.sha256}
                        </p>
                      </div>
                      {aenderbar ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={belegLaeuft}
                          onClick={() => entferne(beleg.id, beleg.filename)}
                        >
                          <Trash2 className="size-4" />
                          Entfernen
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Noch keine Belege hinterlegt.
              </p>
            )}

            {aenderbar ? (
              <div className="space-y-3 rounded-md border border-dashed border-border p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="belegDateien">Dateien auswählen</Label>
                    {/* Ohne name-Attribut: Die Dateien gehören nicht zum
                        Zwischenstand, sondern werden einzeln hochgeladen. */}
                    <DateiEingabe
                      id="belegDateien"
                      feldRef={dateiFeld}
                      leerenSignal={leerenSignal}
                      hinweis={`Erlaubt: ${ERLAUBTE_ENDUNGEN_TEXT} · maximal ${MAX_DATEIGROESSE_TEXT} je Datei`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="belegPunkt">Zuordnung (optional)</Label>
                    <select
                      id="belegPunkt"
                      value={belegPunktId}
                      onChange={(e) => setBelegPunktId(e.target.value)}
                      className={selectKlassen}
                    >
                      <option value="">Zum gesamten Prüfbogen</option>
                      {punkte.map((p) => (
                        <option key={p.id} value={p.id}>
                          Zu Prüfpunkt {p.position}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={belegLaeuft}
                  onClick={hochladen}
                >
                  <Upload className="size-4" />
                  {belegLaeuft ? 'Wird übertragen …' : 'Belege hinzufügen'}
                </Button>
              </div>
            ) : null}
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
