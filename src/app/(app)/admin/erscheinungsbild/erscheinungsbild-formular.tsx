'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, AlertTriangle, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  KONTRAST_AA,
  besterKontrast,
  lesbareVordergrundfarbe,
  normalisiereHex,
} from '@/lib/farben'
import { BILD_ACCEPT_ATTRIBUT, BILD_ENDUNGEN_TEXT } from '@/lib/bilder'
import {
  erscheinungsbildSpeichern,
  erscheinungsbildZuruecksetzen,
} from '@/server/actions/erscheinungsbild'

export type ErscheinungsbildWerte = {
  appName: string
  organisation: string
  primaryColor: string
  accentColor: string
  reportFooter: string
  hatLogo: boolean
  hatLogoDunkel: boolean
  hatFavicon: boolean
}

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Erscheinungsbild speichern'}
    </Button>
  )
}

/** Farbfeld mit Farbwähler, Hex-Eingabe und Kontrasthinweis. */
function Farbfeld({
  id,
  name,
  label,
  beschreibung,
  wert,
  setzeWert,
  mitKontrastpruefung,
}: {
  id: string
  name: string
  label: string
  beschreibung: string
  wert: string
  setzeWert: (neu: string) => void
  mitKontrastpruefung?: boolean
}) {
  const gueltig = normalisiereHex(wert)
  const kontrast = gueltig ? besterKontrast(gueltig) : null

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={gueltig ?? '#000000'}
          onChange={(e) => setzeWert(e.target.value)}
          className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-input bg-background p-1"
          aria-label={`${label} auswählen`}
        />
        <Input
          name={name}
          value={wert}
          onChange={(e) => setzeWert(e.target.value)}
          className="font-mono"
          maxLength={7}
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">{beschreibung}</p>

      {mitKontrastpruefung && kontrast !== null ? (
        kontrast >= KONTRAST_AA ? (
          <p className="text-xs text-status-ok">
            Kontrast {kontrast.toFixed(1)}:1 – erfüllt WCAG AA für Schaltflächen.
          </p>
        ) : (
          <p className="flex items-start gap-1.5 text-xs text-status-warn">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Kontrast nur {kontrast.toFixed(1)}:1. Für gut lesbare Schaltflächen
            werden {KONTRAST_AA}:1 empfohlen – wählen Sie einen dunkleren oder
            helleren Ton.
          </p>
        )
      ) : null}

      {!gueltig ? (
        <p className="text-xs text-destructive">
          Bitte eine Farbe im Format #rrggbb angeben.
        </p>
      ) : null}
    </div>
  )
}

/** Upload-Feld für ein Logo mit Vorschau des aktuellen Motivs. */
function Bildfeld({
  id,
  name,
  label,
  beschreibung,
  vorhanden,
  vorschauUrl,
  dunklerHintergrund,
}: {
  id: string
  name: string
  label: string
  beschreibung: string
  vorhanden: boolean
  vorschauUrl: string
  dunklerHintergrund?: boolean
}) {
  const [entfernen, setEntfernen] = useState(false)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>

      {vorhanden ? (
        <div
          className={
            dunklerHintergrund
              ? 'flex items-center gap-3 rounded-md border border-border bg-slate-800 p-3'
              : 'flex items-center gap-3 rounded-md border border-border bg-background p-3'
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={vorschauUrl}
            alt="Aktuelles Motiv"
            className="h-10 w-auto max-w-48 object-contain"
          />
          <label className="flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              name={`${name}Entfernen`}
              checked={entfernen}
              onCheckedChange={(wert) => setEntfernen(wert === true)}
            />
            <span className={dunklerHintergrund ? 'text-slate-200' : ''}>
              Entfernen und Standard verwenden
            </span>
          </label>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Kein eigenes Motiv hinterlegt – es wird das mitgelieferte Standardlogo
          verwendet.
        </p>
      )}

      <Input
        id={id}
        name={name}
        type="file"
        accept={BILD_ACCEPT_ATTRIBUT}
        disabled={entfernen}
        className="cursor-pointer"
      />
      <p className="text-xs text-muted-foreground">{beschreibung}</p>
    </div>
  )
}

export function ErscheinungsbildFormular({
  werte,
}: {
  werte: ErscheinungsbildWerte
}) {
  const router = useRouter()
  const [primaer, setPrimaer] = useState(werte.primaryColor)
  const [akzent, setAkzent] = useState(werte.accentColor)
  const [zuruecksetzenLaeuft, starteZuruecksetzen] = useTransition()

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await erscheinungsbildSpeichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  const primaerGueltig = normalisiereHex(primaer) ?? '#1b7cb5'
  const akzentGueltig = normalisiereHex(akzent) ?? '#2f9bd8'
  const vordergrund = lesbareVordergrundfarbe(primaerGueltig)

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Bezeichnungen</CardTitle>
          <CardDescription>
            Diese Angaben erscheinen in der Kopfzeile, im Browsertitel und im
            Kopf aller Reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="appName">Anwendungsname</Label>
            <Input
              id="appName"
              name="appName"
              defaultValue={werte.appName}
              required
              maxLength={60}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="organisation">Organisation</Label>
            <Input
              id="organisation"
              name="organisation"
              defaultValue={werte.organisation}
              maxLength={120}
              placeholder="z. B. Beispiel GmbH"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reportFooter">Zusatz in der Report-Fußzeile</Label>
            <Textarea
              id="reportFooter"
              name="reportFooter"
              defaultValue={werte.reportFooter}
              rows={2}
              maxLength={200}
              placeholder="z. B. Vertraulich – nur zur internen Verwendung"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Farben</CardTitle>
          <CardDescription>
            Die Primärfarbe bestimmt Schaltflächen, Links und Hervorhebungen.
            Die übrigen Farben werden daraus abgeleitet – auch für das dunkle
            Farbschema.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Farbfeld
            id="primaerfarbe"
            name="primaryColor"
            label="Primärfarbe"
            beschreibung="Hauptfarbe der Oberfläche."
            wert={primaer}
            setzeWert={setPrimaer}
            mitKontrastpruefung
          />

          <Farbfeld
            id="akzentfarbe"
            name="accentColor"
            label="Akzentfarbe"
            beschreibung="Für Verläufe und sekundäre Hervorhebungen."
            wert={akzent}
            setzeWert={setAkzent}
          />

          <div className="space-y-2 sm:col-span-2">
            <Label>Vorschau</Label>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4">
              <span
                className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium"
                style={{ backgroundColor: primaerGueltig, color: vordergrund }}
              >
                Schaltfläche
              </span>
              <span
                className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium"
                style={{ borderColor: primaerGueltig, color: primaerGueltig }}
              >
                Umrandet
              </span>
              <span
                className="inline-flex h-9 items-center rounded-md px-4 text-sm font-medium text-white"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${akzentGueltig}, ${primaerGueltig})`,
                }}
              >
                Verlauf
              </span>
              <span className="text-sm" style={{ color: primaerGueltig }}>
                Beispiel für einen Link
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logos</CardTitle>
          <CardDescription>
            Erlaubt: {BILD_ENDUNGEN_TEXT} · maximal 2 MB je Datei. Ohne eigenes
            Motiv wird das mitgelieferte Standardlogo verwendet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <Bildfeld
            id="logo"
            name="logo"
            label="Logo (helle Oberfläche)"
            beschreibung="Erscheint in der Kopfzeile, auf der Anmeldeseite und im Report-Kopf. Ein breites Logo mit Schriftzug passt am besten."
            vorhanden={werte.hatLogo}
            vorschauUrl="/api/branding/logo"
          />

          <Bildfeld
            id="logoDunkel"
            name="logoDunkel"
            label="Logo (dunkler Hintergrund)"
            beschreibung="Optional. Wird verwendet, sobald ein dunkles Farbschema aktiv ist."
            vorhanden={werte.hatLogoDunkel}
            vorschauUrl="/api/branding/logo-dunkel"
            dunklerHintergrund
          />

          <Bildfeld
            id="favicon"
            name="favicon"
            label="Browsersymbol (Favicon)"
            beschreibung="Quadratisch, idealerweise 64 × 64 Pixel oder als SVG."
            vorhanden={werte.hatFavicon}
            vorschauUrl="/api/branding/favicon"
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
        <SpeichernButton />
        <Button
          type="button"
          variant="ghost"
          disabled={zuruecksetzenLaeuft}
          onClick={() =>
            starteZuruecksetzen(async () => {
              const ergebnis = await erscheinungsbildZuruecksetzen()
              if (ergebnis.fehler) toast.error(ergebnis.fehler)
              else {
                toast.success(ergebnis.erfolg ?? 'Zurückgesetzt.')
                router.refresh()
              }
            })
          }
        >
          <RotateCcw className="size-4" />
          Auf Auslieferungszustand zurücksetzen
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Änderungen wirken sofort für alle Benutzer. Jede Änderung wird im
        Audit-Log protokolliert.
      </p>
    </form>
  )
}
