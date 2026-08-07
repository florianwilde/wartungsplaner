'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { ERGEBNIS_BEZEICHNUNG, type PruefpunktErgebnis } from '@/lib/nachweise'
import { abweichungAusFeststellung } from '@/server/actions/nachweise'

export type FeststellungAnzeige = {
  punktId: string
  position: number
  frage: string
  ergebnis: string
  bemerkung: string | null
  findingId: string | null
}

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function AnlegenButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird angelegt …' : 'Abweichung anlegen'}
    </Button>
  )
}

/**
 * Feststellungen eines abgeschlossenen Nachweises.
 *
 * Ein nicht erfüllter Prüfpunkt beschreibt bereits, was fehlt – deshalb sind
 * Titel und Beschreibung vorbelegt und es fehlen nur noch Schwere, Frist und
 * verantwortliche Person.
 */
export function Feststellungen({
  nachweisId,
  pruefbogen,
  feststellungen,
  personen,
  vorschlagFrist,
  darfAnlegen,
}: {
  nachweisId: string
  pruefbogen: string
  feststellungen: FeststellungAnzeige[]
  personen: { id: string; name: string }[]
  /** Vorbelegte Frist (ISO-Datum), 30 Tage ab heute */
  vorschlagFrist: string
  darfAnlegen: boolean
}) {
  const router = useRouter()
  const [offen, setOffen] = useState<FeststellungAnzeige | null>(null)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await abweichungAusFeststellung(nachweisId, vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(null)
        router.refresh()
      } else if (antwort.fehler) {
        toast.error(antwort.fehler)
      }
      return antwort
    },
    {},
  )

  if (feststellungen.length === 0) return null

  const offeneAnzahl = feststellungen.filter((f) => !f.findingId).length

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-status-warn size-4" />
            Feststellungen
          </CardTitle>
          <CardDescription>
            {feststellungen.length}{' '}
            {feststellungen.length === 1 ? 'Prüfpunkt' : 'Prüfpunkte'} mit Befund
            {offeneAnzahl > 0
              ? ` · ${offeneAnzahl} noch nicht als Abweichung erfasst`
              : ' · alle als Abweichung erfasst'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {feststellungen.map((eintrag) => (
              <li
                key={eintrag.punktId}
                className="border-border flex flex-wrap items-start justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {eintrag.position}. {eintrag.frage}
                  </p>
                  <p className="text-destructive mt-1 text-xs">
                    {ERGEBNIS_BEZEICHNUNG[eintrag.ergebnis as PruefpunktErgebnis] ??
                      eintrag.ergebnis}
                  </p>
                  {eintrag.bemerkung ? (
                    <p className="text-muted-foreground mt-1 text-xs">
                      {eintrag.bemerkung}
                    </p>
                  ) : null}
                </div>

                {eintrag.findingId ? (
                  <Link
                    href={`/findings#${eintrag.findingId}`}
                    className="text-status-ok flex items-center gap-1.5 text-sm hover:underline"
                  >
                    <CheckCircle2 className="size-4" />
                    Abweichung angelegt
                    <ArrowRight className="size-3.5" />
                  </Link>
                ) : darfAnlegen ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOffen(eintrag)}
                  >
                    Als Abweichung anlegen
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={offen !== null} onOpenChange={(auf) => !auf && setOffen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abweichung anlegen</DialogTitle>
            <DialogDescription>
              Aus Prüfpunkt {offen?.position} des Prüfbogens „{pruefbogen}“. Die
              Abweichung bleibt mit dem Prüfpunkt verknüpft.
            </DialogDescription>
          </DialogHeader>

          {offen ? (
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="punktId" value={offen.punktId} />

              <div className="space-y-1.5">
                <Label htmlFor="title">Titel</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  maxLength={200}
                  defaultValue={`${offen.frage} – ${
                    ERGEBNIS_BEZEICHNUNG[offen.ergebnis as PruefpunktErgebnis] ??
                    offen.ergebnis
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description">Beschreibung</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  maxLength={4000}
                  defaultValue={
                    offen.bemerkung
                      ? `${offen.bemerkung}\n\nQuelle: Prüfbogen „${pruefbogen}“, Prüfpunkt ${offen.position}.`
                      : `Quelle: Prüfbogen „${pruefbogen}“, Prüfpunkt ${offen.position}.`
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="severity">Schwere</Label>
                  <select
                    id="severity"
                    name="severity"
                    defaultValue="MEDIUM"
                    className={selectKlassen}
                  >
                    <option value="LOW">Gering</option>
                    <option value="MEDIUM">Mittel</option>
                    <option value="HIGH">Hoch</option>
                    <option value="CRITICAL">Kritisch</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueDate">Frist</Label>
                  <Input
                    id="dueDate"
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={vorschlagFrist}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="responsibleId">Verantwortlich</Label>
                <select
                  id="responsibleId"
                  name="responsibleId"
                  required
                  className={selectKlassen}
                >
                  {personen.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>

              {status.fehler ? (
                <p role="alert" className="text-destructive text-sm">
                  {status.fehler}
                </p>
              ) : null}

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOffen(null)}>
                  Abbrechen
                </Button>
                <AnlegenButton />
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
