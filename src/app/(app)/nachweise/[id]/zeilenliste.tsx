'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ListChecks, Trash2, Upload, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  ERGEBNIS_BEZEICHNUNG,
  ERLAUBTE_ERGEBNISSE,
  zaehleZeilen,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import {
  nachweisZeilenLeeren,
  nachweisZeilenUebernehmen,
} from '@/server/actions/nachweise'

export type ZeileAnzeige = {
  id: string
  punktId: string
  position: number
  bezeichnung: string
  zusatz: string | null
  ergebnis: PruefpunktErgebnis | null
  bemerkung: string | null
}

const selectKlassen =
  'flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/**
 * Zeilenliste eines Prüfpunkts – etwa die Konten einer Rezertifizierung.
 *
 * Der Aufwand steckt nicht im Entscheiden, sondern in der Menge: Deshalb gibt
 * es die Übernahme aus einer CSV-Datei und die Sammelentscheidung für alle
 * Zeilen ohne eigenen Befund.
 */
export function Zeilenliste({
  nachweisId,
  punktId,
  position,
  zeilen,
  aenderbar,
  aendere,
  sammelentscheidung,
}: {
  nachweisId: string
  punktId: string
  position: number
  zeilen: ZeileAnzeige[]
  aenderbar: boolean
  aendere: (zeilenId: string, feld: 'ergebnis' | 'bemerkung', wert: string) => void
  sammelentscheidung: (punktId: string, ergebnis: PruefpunktErgebnis) => void
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [ersetzen, setErsetzen] = useState(true)
  const dateiFeld = useRef<HTMLInputElement>(null)

  const stand = zaehleZeilen(zeilen)
  const ergebnisse = ERLAUBTE_ERGEBNISSE.LISTE

  const uebernehmen = () => {
    const datei = dateiFeld.current?.files?.[0]
    if (!datei) {
      toast.error('Bitte zuerst eine CSV-Datei auswählen.')
      return
    }

    starte(async () => {
      const formular = new FormData()
      formular.set('punktId', punktId)
      formular.set('datei', datei)
      if (ersetzen) formular.set('ersetzen', 'on')

      const antwort = await nachweisZeilenUebernehmen(nachweisId, {}, formular)
      if (antwort.fehler) {
        toast.error(antwort.fehler)
        return
      }
      toast.success(antwort.erfolg ?? 'Übernommen.')
      if (dateiFeld.current) dateiFeld.current.value = ''
      router.refresh()
    })
  }

  const leeren = () =>
    starte(async () => {
      const antwort = await nachweisZeilenLeeren(nachweisId, punktId)
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(antwort.erfolg ?? 'Entfernt.')
        router.refresh()
      }
    })

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="size-4" />
          {stand.gesamt} {stand.gesamt === 1 ? 'Zeile' : 'Zeilen'}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {stand.offen > 0 ? (
            <Badge variant="warn">{stand.offen} offen</Badge>
          ) : stand.gesamt > 0 ? (
            <Badge variant="ok">vollständig entschieden</Badge>
          ) : null}
          {stand.auffaellig > 0 ? (
            <Badge variant="danger">{stand.auffaellig} mit Befund</Badge>
          ) : null}
        </div>
      </div>

      {aenderbar ? (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor={`csv-${punktId}`}>Zeilen aus CSV übernehmen</Label>
              <input
                id={`csv-${punktId}`}
                ref={dateiFeld}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
            </div>
            <Button type="button" variant="outline" disabled={laeuft} onClick={uebernehmen}>
              <Upload className="size-4" />
              Übernehmen
            </Button>
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={ersetzen}
              onChange={(e) => setErsetzen(e.target.checked)}
              className="size-3.5"
            />
            Vorhandene Zeilen ersetzen (sonst anhängen)
          </label>

          <p className="text-xs text-muted-foreground">
            Erste Spalte als Bezeichnung, weitere als Zusatz. Semikolon, Komma
            und Tabulator werden erkannt, eine Kopfzeile ebenfalls – ein
            AD-Export lässt sich unverändert einlesen.
          </p>
        </div>
      ) : null}

      {stand.gesamt > 0 ? (
        <>
          {aenderbar && stand.offen > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-background p-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wand2 className="size-3.5" />
                Übrige {stand.offen} Zeilen auf einmal:
              </span>
              {ergebnisse.map((wert) => (
                <Button
                  key={wert}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => sammelentscheidung(punktId, wert)}
                >
                  {ERGEBNIS_BEZEICHNUNG[wert]}
                </Button>
              ))}
            </div>
          ) : null}

          <div className="max-h-[28rem] overflow-auto rounded-md border border-border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-border text-left">
                  <th className="w-10 p-2 font-medium text-muted-foreground">#</th>
                  <th className="p-2 font-medium text-muted-foreground">Eintrag</th>
                  <th className="w-40 p-2 font-medium text-muted-foreground">
                    Entscheidung
                  </th>
                  <th className="w-56 p-2 font-medium text-muted-foreground">
                    Bemerkung
                  </th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((zeile) => (
                  <tr
                    key={zeile.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="p-2 align-top text-xs text-muted-foreground">
                      {zeile.position}
                    </td>
                    <td className="p-2 align-top">
                      <span className="font-medium">{zeile.bezeichnung}</span>
                      {zeile.zusatz ? (
                        <span className="block text-xs text-muted-foreground">
                          {zeile.zusatz}
                        </span>
                      ) : null}
                    </td>
                    <td className="p-2 align-top">
                      <select
                        value={zeile.ergebnis ?? ''}
                        disabled={!aenderbar}
                        onChange={(e) => aendere(zeile.id, 'ergebnis', e.target.value)}
                        className={selectKlassen}
                        aria-label={`Entscheidung zu ${zeile.bezeichnung}`}
                      >
                        <option value="">offen</option>
                        {ergebnisse.map((wert) => (
                          <option key={wert} value={wert}>
                            {ERGEBNIS_BEZEICHNUNG[wert]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 align-top">
                      <Input
                        value={zeile.bemerkung ?? ''}
                        disabled={!aenderbar}
                        onChange={(e) => aendere(zeile.id, 'bemerkung', e.target.value)}
                        className="h-8 text-sm"
                        placeholder={
                          zeile.ergebnis && zeile.ergebnis !== 'BELASSEN'
                            ? 'Maßnahme'
                            : ''
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {aenderbar ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={laeuft}
              onClick={leeren}
            >
              <Trash2 className="size-4" />
              Alle Zeilen entfernen
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Noch keine Zeilen. Prüfpunkt {position} gilt erst als beantwortet, wenn
          Zeilen vorhanden und alle entschieden sind.
        </p>
      )}
    </div>
  )
}
