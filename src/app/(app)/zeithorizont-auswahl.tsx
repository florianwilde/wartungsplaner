'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarRange } from 'lucide-react'

import {
  ZEITHORIZONT_AUSWAHL,
  ZEITHORIZONT_BEZEICHNUNG,
  ZEITHORIZONT_ERKLAERUNG,
  baueZeithorizontCookie,
  type Zeithorizont,
} from '@/lib/zeithorizont'

/**
 * Wählt den Zeitraum der Liste „Nächste Fälligkeiten“.
 *
 * Die Auswahl liegt in einem Cookie und wird serverseitig ausgewertet – so
 * bleibt die Liste auch nach einem Neuladen wie gewünscht eingestellt.
 */
export function ZeithorizontAuswahl({ aktuell }: { aktuell: Zeithorizont }) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <label className="flex items-center gap-2 text-sm">
      <CalendarRange className="size-4 text-muted-foreground" />
      <span className="sr-only">Zeitraum der nächsten Fälligkeiten</span>
      <select
        value={aktuell}
        disabled={laeuft}
        title={ZEITHORIZONT_ERKLAERUNG[aktuell]}
        onChange={(e) => {
          document.cookie = baueZeithorizontCookie(e.target.value as Zeithorizont)
          starte(() => router.refresh())
        }}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {ZEITHORIZONT_AUSWAHL.map((wert) => (
          <option key={wert} value={wert}>
            {ZEITHORIZONT_BEZEICHNUNG[wert]}
          </option>
        ))}
      </select>
    </label>
  )
}
