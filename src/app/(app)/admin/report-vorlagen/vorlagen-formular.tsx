'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, FileText, Plus, Trash2 } from 'lucide-react'
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
import {
  SPALTEN_KATALOG,
  eingebauteVorlage,
  pflichtSpalten,
  type ReportVorlage,
} from '@/lib/report-vorlagen'
import { REPORT_TITEL, type ReportTyp } from '@/server/reports/typen'
import { vorlageLoeschen, vorlageSpeichern } from '@/server/actions/report-vorlagen'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Vorlage speichern'}
    </Button>
  )
}

/** Formular zum Anlegen und Ändern einer Vorlage. */
function VorlagenDialog({
  typ,
  vorlage,
  offen,
  setOffen,
}: {
  typ: ReportTyp
  /** null = neue Vorlage */
  vorlage: ReportVorlage | null
  offen: boolean
  setOffen: (offen: boolean) => void
}) {
  const router = useRouter()
  const start = vorlage ?? eingebauteVorlage(typ)
  const pflicht = new Set(pflichtSpalten(typ))

  const [spalten, setSpalten] = useState<string[]>(start.spalten)
  const [deckblatt, setDeckblatt] = useState(start.mitDeckblatt)
  const [unterschriften, setUnterschriften] = useState(start.mitUnterschriften)

  const aktion = vorlageSpeichern.bind(null, vorlage?.id ?? null)
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

  const umschalten = (key: string) => {
    if (pflicht.has(key)) return
    setSpalten((bisher) =>
      bisher.includes(key) ? bisher.filter((s) => s !== key) : [...bisher, key],
    )
  }

  return (
    <Dialog open={offen} onOpenChange={setOffen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {vorlage ? 'Vorlage bearbeiten' : 'Neue Vorlage'} – {REPORT_TITEL[typ]}
          </DialogTitle>
          <DialogDescription>
            Aufbau und Umfang des PDF. Excel-Exporte bleiben unverändert.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="typ" value={typ} />
          {spalten.map((key) => (
            <input key={key} type="hidden" name="spalten" value={key} />
          ))}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`name-${typ}`}>Name der Vorlage</Label>
              <Input
                id={`name-${typ}`}
                name="name"
                defaultValue={vorlage?.name ?? ''}
                placeholder="z. B. Jahresaudit"
                maxLength={60}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`ausrichtung-${typ}`}>Ausrichtung</Label>
              <select
                id={`ausrichtung-${typ}`}
                name="ausrichtung"
                defaultValue={start.ausrichtung}
                className={selectKlassen}
              >
                <option value="hoch">A4 hoch</option>
                <option value="quer">A4 quer (mehr Platz für Spalten)</option>
              </select>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id={`standard-${typ}`}
              name="istStandard"
              defaultChecked={vorlage?.istStandard ?? false}
            />
            <div className="space-y-1">
              <Label htmlFor={`standard-${typ}`}>Als Standard verwenden</Label>
              <p className="text-muted-foreground text-xs">
                Diese Vorlage ist dann auf der Reports-Seite vorausgewählt. Je Reportart
                kann es nur einen Standard geben.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Spalten</Label>
            <div className="border-border grid gap-2 rounded-md border p-3 sm:grid-cols-2">
              {SPALTEN_KATALOG[typ].map((spalte) => (
                <label
                  key={spalte.key}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={spalten.includes(spalte.key)}
                    disabled={pflicht.has(spalte.key)}
                    onCheckedChange={() => umschalten(spalte.key)}
                  />
                  <span>{spalte.kopf}</span>
                  {pflicht.has(spalte.key) ? (
                    <span className="text-muted-foreground text-xs">(fest)</span>
                  ) : null}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Feste Spalten lassen sich nicht abwählen – ohne sie wäre der Bericht nicht
              aussagekräftig. Die Breiten passen sich automatisch an.
            </p>
          </div>

          <div className="border-border space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`deckblatt-${typ}`}
                name="mitDeckblatt"
                checked={deckblatt}
                onCheckedChange={(wert) => setDeckblatt(wert === true)}
              />
              <div className="space-y-1">
                <Label htmlFor={`deckblatt-${typ}`}>Deckblatt voranstellen</Label>
                <p className="text-muted-foreground text-xs">
                  Eigene erste Seite mit Titel, Zeitraum und Eckdaten. Die Seitenzählung
                  beginnt danach.
                </p>
              </div>
            </div>

            {deckblatt ? (
              <div className="space-y-2">
                <Label htmlFor={`untertitel-${typ}`}>Untertitel</Label>
                <Input
                  id={`untertitel-${typ}`}
                  name="deckblattUntertitel"
                  defaultValue={vorlage?.deckblattUntertitel ?? ''}
                  maxLength={120}
                  placeholder="z. B. Interne Revision 2026"
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`einleitung-${typ}`}>Einleitender Text</Label>
            <Textarea
              id={`einleitung-${typ}`}
              name="einleitung"
              defaultValue={vorlage?.einleitung ?? ''}
              rows={3}
              maxLength={2000}
              placeholder="Erscheint vor der Auswertung, z. B. Zweck und Umfang der Prüfung."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`schluss-${typ}`}>Abschließender Text</Label>
            <Textarea
              id={`schluss-${typ}`}
              name="schluss"
              defaultValue={vorlage?.schluss ?? ''}
              rows={3}
              maxLength={2000}
              placeholder="Erscheint nach der Auswertung, z. B. Bewertung oder Hinweise."
            />
          </div>

          <div className="border-border space-y-3 rounded-md border p-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id={`unterschriften-${typ}`}
                name="mitUnterschriften"
                checked={unterschriften}
                onCheckedChange={(wert) => setUnterschriften(wert === true)}
              />
              <div className="space-y-1">
                <Label htmlFor={`unterschriften-${typ}`}>
                  Unterschriftenfelder anfügen
                </Label>
                <p className="text-muted-foreground text-xs">
                  Zwei Linien am Ende des Berichts zum Gegenzeichnen.
                </p>
              </div>
            </div>

            {unterschriften ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`links-${typ}`}>Beschriftung links</Label>
                  <Input
                    id={`links-${typ}`}
                    name="unterschriftLinks"
                    defaultValue={vorlage?.unterschriftLinks ?? ''}
                    maxLength={80}
                    placeholder="Datum, Unterschrift (Durchführung)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rechts-${typ}`}>Beschriftung rechts</Label>
                  <Input
                    id={`rechts-${typ}`}
                    name="unterschriftRechts"
                    defaultValue={vorlage?.unterschriftRechts ?? ''}
                    maxLength={80}
                    placeholder="Datum, Unterschrift (Prüfung)"
                  />
                </div>
              </div>
            ) : null}
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

export function VorlagenVerwaltung({
  typ,
  vorlagen,
}: {
  typ: ReportTyp
  vorlagen: ReportVorlage[]
}) {
  const router = useRouter()
  const [neu, setNeu] = useState(false)
  const [bearbeiten, setBearbeiten] = useState<ReportVorlage | null>(null)
  const [laeuft, starte] = useTransition()

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4" />
            {REPORT_TITEL[typ]}
          </CardTitle>
          <CardDescription>
            {vorlagen.length === 0
              ? 'Keine eigene Vorlage – es gilt die eingebaute Fassung.'
              : `${vorlagen.length} ${vorlagen.length === 1 ? 'Vorlage' : 'Vorlagen'}.`}
          </CardDescription>
        </div>
        <Button size="sm" variant="outline" onClick={() => setNeu(true)}>
          <Plus className="size-4" />
          Vorlage
        </Button>
      </CardHeader>

      <CardContent className="space-y-2">
        {vorlagen.map((vorlage) => (
          <div
            key={vorlage.id}
            className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{vorlage.name}</span>
                {vorlage.istStandard ? <Badge variant="ok">Standard</Badge> : null}
                <Badge variant="neutral">
                  {vorlage.ausrichtung === 'quer' ? 'A4 quer' : 'A4 hoch'}
                </Badge>
              </div>
              <p className="text-muted-foreground text-xs">
                {vorlage.spalten.length} Spalten
                {vorlage.mitDeckblatt ? ' · Deckblatt' : ''}
                {vorlage.mitUnterschriften ? ' · Unterschriften' : ''}
                {vorlage.einleitung ? ' · Einleitung' : ''}
                {vorlage.schluss ? ' · Schlusstext' : ''}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                asChild
                title="Mit dieser Vorlage erzeugen"
              >
                <a
                  href={`/api/reports/${typ}?format=pdf&vorlage=${vorlage.id}`}
                  download
                >
                  Vorschau
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBearbeiten(vorlage)}
              >
                Bearbeiten
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    if (!vorlage.id) return
                    const ergebnis = await vorlageLoeschen(vorlage.id)
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
        ))}
      </CardContent>

      {neu ? (
        <VorlagenDialog typ={typ} vorlage={null} offen={neu} setOffen={setNeu} />
      ) : null}

      {bearbeiten ? (
        <VorlagenDialog
          key={bearbeiten.id}
          typ={typ}
          vorlage={bearbeiten}
          offen
          setOffen={(offen) => !offen && setBearbeiten(null)}
        />
      ) : null}
    </Card>
  )
}
