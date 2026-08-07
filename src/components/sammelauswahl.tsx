'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { Checkbox } from '@/components/ui/checkbox'

/**
 * Mehrfachauswahl für Listen.
 *
 * Hält die Markierung, liefert das Kästchen je Zeile und den Balken mit den
 * Sammelaktionen. Bewusst ohne eigene Aktionen: Was mit der Auswahl geschieht,
 * entscheidet die jeweilige Liste – beim Löschen hängt daran, was verloren
 * ginge.
 */
export function useSammelauswahl(alleIds: string[]) {
  const [markiert, setMarkiert] = useState<string[]>([])

  // Verschwindet ein Eintrag (Filter, Löschung), soll er nicht unsichtbar
  // markiert bleiben und beim nächsten Klick mitgehen.
  const gueltig = useMemo(
    () => markiert.filter((id) => alleIds.includes(id)),
    [markiert, alleIds],
  )

  const umschalten = (id: string) =>
    setMarkiert((bisher) =>
      bisher.includes(id) ? bisher.filter((x) => x !== id) : [...bisher, id],
    )

  const alleUmschalten = () =>
    setMarkiert(gueltig.length === alleIds.length ? [] : [...alleIds])

  return {
    markiert: gueltig,
    istMarkiert: (id: string) => gueltig.includes(id),
    umschalten,
    alleUmschalten,
    alleMarkiert: alleIds.length > 0 && gueltig.length === alleIds.length,
    teilweise: gueltig.length > 0 && gueltig.length < alleIds.length,
    leeren: () => setMarkiert([]),
  }
}

/** Kästchen in der Kopfzeile: alle markieren oder alle abwählen. */
export function AlleAuswaehlen({
  alleMarkiert,
  teilweise,
  onChange,
}: {
  alleMarkiert: boolean
  teilweise: boolean
  onChange: () => void
}) {
  return (
    <Checkbox
      checked={alleMarkiert ? true : teilweise ? 'indeterminate' : false}
      onCheckedChange={onChange}
      aria-label="Alle markieren"
    />
  )
}

/** Kästchen einer Zeile. */
export function ZeileAuswaehlen({
  markiert,
  onChange,
  bezeichnung,
}: {
  markiert: boolean
  onChange: () => void
  bezeichnung: string
}) {
  return (
    <Checkbox
      checked={markiert}
      onCheckedChange={onChange}
      aria-label={`„${bezeichnung}" markieren`}
    />
  )
}

/**
 * Balken über der Liste, sobald etwas markiert ist.
 *
 * Er erscheint nur bei Bedarf: Ein dauerhaft sichtbarer Balken mit
 * ausgegrauten Schaltflächen kostet Platz und sagt nichts.
 */
export function Sammelleiste({
  anzahl,
  einzahl,
  mehrzahl,
  onAbwaehlen,
  children,
}: {
  anzahl: number
  einzahl: string
  mehrzahl: string
  onAbwaehlen: () => void
  children: ReactNode
}) {
  if (anzahl === 0) return null

  return (
    <div className="kein-druck border-primary/40 bg-primary/5 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <span className="text-sm">
        <span className="font-medium">{anzahl}</span>{' '}
        {anzahl === 1 ? einzahl : mehrzahl} markiert
        <button
          type="button"
          onClick={onAbwaehlen}
          className="text-muted-foreground ml-3 text-xs underline underline-offset-2"
        >
          Auswahl aufheben
        </button>
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}
