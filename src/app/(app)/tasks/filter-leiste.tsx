'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type FilterOption = { wert: string; label: string }

export type FilterFeld = {
  name: string
  label: string
  optionen: FilterOption[]
}

/**
 * Filter über Query-Parameter: die Auswahl bleibt damit teil- und
 * verlinkbar und funktioniert ohne clientseitigen Zustand.
 */
export function FilterLeiste({
  felder,
  suchfeld = true,
  suchePlatzhalter = 'Suchen …',
}: {
  felder: FilterFeld[]
  suchfeld?: boolean
  suchePlatzhalter?: string
}) {
  const router = useRouter()
  const pfad = usePathname()
  const params = useSearchParams()
  const [wirdGeladen, starteUebergang] = useTransition()

  const setze = (name: string, wert: string) => {
    const neu = new URLSearchParams(params.toString())
    if (!wert || wert === 'alle') neu.delete(name)
    else neu.set(name, wert)
    starteUebergang(() => {
      router.replace(`${pfad}?${neu.toString()}`, { scroll: false })
    })
  }

  const hatFilter = [...params.keys()].length > 0

  return (
    <div className="kein-druck flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
      {suchfeld ? (
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="filter-suche" className="text-xs text-muted-foreground">
            Suche
          </Label>
          <Input
            id="filter-suche"
            defaultValue={params.get('suche') ?? ''}
            placeholder={suchePlatzhalter}
            onChange={(e) => setze('suche', e.target.value)}
          />
        </div>
      ) : null}

      {felder.map((feld) => (
        <div key={feld.name} className="min-w-44 space-y-1.5">
          <Label
            htmlFor={`filter-${feld.name}`}
            className="text-xs text-muted-foreground"
          >
            {feld.label}
          </Label>
          <select
            id={`filter-${feld.name}`}
            value={params.get(feld.name) ?? 'alle'}
            onChange={(e) => setze(feld.name, e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {feld.optionen.map((option) => (
              <option key={option.wert} value={option.wert}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hatFilter ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={wirdGeladen}
          onClick={() => starteUebergang(() => router.replace(pfad, { scroll: false }))}
        >
          <X className="size-4" />
          Filter zurücksetzen
        </Button>
      ) : null}
    </div>
  )
}
