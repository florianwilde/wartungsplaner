'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { BESTAETIGUNGSWORT, MIN_BEGRUENDUNG } from '@/lib/sammelaktion'
import {
  aufgabenErzwungenLoeschen,
  ermittleVerlust,
  type VerlustBericht,
} from '@/server/actions/sammelaktionen'

/**
 * Löschen von Aufgaben samt ihrer Nachweise.
 *
 * Der Ausnahmeweg für Testdaten und Fehlimporte. Der Dialog zeigt zuerst, was
 * verlorenginge, und verlangt dann Begründung und abgetipptes Wort – ein
 * Klick auf „OK" passiert versehentlich, das Abtippen nicht.
 */
export function ErzwungenLoeschenDialog({
  ids,
  offen,
  onSchliessen,
  onErledigt,
}: {
  ids: string[]
  offen: boolean
  onSchliessen: () => void
  onErledigt: () => void
}) {
  const router = useRouter()
  const [bericht, setBericht] = useState<VerlustBericht | null>(null)
  const [begruendung, setBegruendung] = useState('')
  const [bestaetigung, setBestaetigung] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [laeuft, starte] = useTransition()

  // Der Umfang wird beim Öffnen frisch ermittelt: Zwischen dem Markieren und
  // dem Bestätigen kann jemand anderes eine Durchführung protokolliert haben.
  // Das Zurücksetzen läuft genau einmal je Öffnen; die von React empfohlene
  // Alternative über einen wechselnden `key` brächte hier nichts.
  useEffect(() => {
    if (!offen) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBegruendung('')
    setBestaetigung('')
    setFehler(null)
    setBericht(null)
    ermittleVerlust(ids)
      .then(setBericht)
      .catch(() =>
        setFehler('Der Umfang konnte nicht ermittelt werden. Bitte erneut öffnen.'),
      )
  }, [offen, ids])

  const absenden = () =>
    starte(async () => {
      setFehler(null)
      const antwort = await aufgabenErzwungenLoeschen(ids, begruendung, bestaetigung)
      if (antwort.fehler) {
        setFehler(antwort.fehler)
        return
      }
      toast.success(antwort.erfolg ?? 'Gelöscht.', { duration: 8000 })
      onErledigt()
      onSchliessen()
      router.refresh()
    })

  return (
    <Dialog open={offen} onOpenChange={(wert) => !wert && onSchliessen()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            Aufgaben samt Nachweisen löschen
          </DialogTitle>
          <DialogDescription>
            Dieser Weg vernichtet Nachweise. Er ist für Testdaten und
            Fehlimporte gedacht – nicht zum Ausmustern einer Prüfung. Dafür
            gibt es das Deaktivieren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium">Unwiderruflich entfernt werden</p>
            {bericht === null ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Umfang wird ermittelt …
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm">{bericht.beschreibung}</p>
                {bericht.aufgaben.length > 0 ? (
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    {bericht.aufgaben.slice(0, 8).map((titel) => (
                      <li key={titel}>· {titel}</li>
                    ))}
                    {bericht.aufgaben.length > 8 ? (
                      <li>· und {bericht.aufgaben.length - 8} weitere</li>
                    ) : null}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
            Der Vorgang wird mit Ihrem Namen, dem Umfang, den Prüfsummen der
            entfernten Dateien und Ihrer Begründung im <strong>Audit-Log</strong>{' '}
            festgehalten. Das Protokoll ist unveränderlich und übersteht diese
            Löschung – es bleibt nachvollziehbar, dass es die Nachweise gab und
            warum sie entfernt wurden.
          </p>

          <div className="space-y-2">
            <Label htmlFor="begruendung">Begründung</Label>
            <Textarea
              id="begruendung"
              rows={3}
              value={begruendung}
              onChange={(e) => setBegruendung(e.target.value)}
              maxLength={1000}
              placeholder="Warum müssen diese Nachweise entfernt werden? Wer hat es entschieden?"
            />
            <p className="text-xs text-muted-foreground">
              Mindestens {MIN_BEGRUENDUNG} Zeichen. Sie ist später das Einzige,
              was von den Nachweisen übrig bleibt.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bestaetigung">
              Zur Bestätigung „{BESTAETIGUNGSWORT}“ eingeben
            </Label>
            <Input
              id="bestaetigung"
              value={bestaetigung}
              onChange={(e) => setBestaetigung(e.target.value)}
              autoComplete="off"
              placeholder={BESTAETIGUNGSWORT}
            />
          </div>

          {fehler ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {fehler}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onSchliessen} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={absenden}
            disabled={
              laeuft ||
              bericht === null ||
              begruendung.trim().length < MIN_BEGRUENDUNG ||
              bestaetigung.trim().toUpperCase() !== BESTAETIGUNGSWORT
            }
          >
            {laeuft ? 'Wird gelöscht …' : 'Endgültig löschen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
