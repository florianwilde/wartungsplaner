'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { nachweisBeginnen } from '@/server/actions/nachweise'

export type VerfuegbarerBogen = {
  id: string
  name: string
  beschreibung: string | null
  vierAugen: boolean
  anzahlPunkte: number
  /** true = fest dieser Aufgabe zugeordnet */
  zugeordnet: boolean
}

/**
 * Startet einen strukturierten Prüfnachweis zu einer Fälligkeit.
 * Existiert bereits einer, führt die Aktion dorthin.
 */
export function NachweisStarten({
  occurrenceId,
  faelligAm,
  boegen,
  nachreichen = false,
}: {
  occurrenceId: string
  faelligAm: string
  boegen: VerfuegbarerBogen[]
  /** Die Fälligkeit ist bereits erledigt – der Bogen kommt hinzu. */
  nachreichen?: boolean
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [gewaehlt, setGewaehlt] = useState(boegen[0]?.id ?? '')
  const [laeuft, starte] = useTransition()

  if (boegen.length === 0) return null

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOffen(true)}>
        <ClipboardList className="size-4" />
        {nachreichen ? 'Prüfbogen nachreichen' : 'Prüfbogen'}
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Prüfnachweis erfassen</DialogTitle>
            <DialogDescription>
              Für die Fälligkeit vom {faelligAm}. Aus dem ausgefüllten Bogen
              entsteht ein PDF-Nachweis.
              {nachreichen
                ? ' Er wird der bereits protokollierten Durchführung hinzugefügt.'
                : ' Die Fälligkeit erledigen Sie danach wie gewohnt – dabei wird das PDF als Nachweis übernommen.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Label>Prüfbogen</Label>
            {boegen.map((bogen) => (
              <label
                key={bogen.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm has-[:checked]:border-primary"
              >
                <input
                  type="radio"
                  name="pruefbogen"
                  value={bogen.id}
                  checked={gewaehlt === bogen.id}
                  onChange={() => setGewaehlt(bogen.id)}
                  className="mt-1"
                />
                <span className="min-w-0 space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{bogen.name}</span>
                    {bogen.vierAugen ? (
                      <Badge variant="outline">Vier Augen</Badge>
                    ) : null}
                    {bogen.zugeordnet ? (
                      <Badge variant="neutral">für diese Aufgabe</Badge>
                    ) : null}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {bogen.anzahlPunkte} Prüfpunkte
                    {bogen.beschreibung ? ` · ${bogen.beschreibung}` : ''}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              disabled={laeuft || !gewaehlt}
              onClick={() =>
                starte(async () => {
                  const ergebnis = await nachweisBeginnen(occurrenceId, gewaehlt)
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else if (ergebnis.nachweisId) {
                    setOffen(false)
                    router.push(`/nachweise/${ergebnis.nachweisId}`)
                  }
                })
              }
            >
              Bogen öffnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
