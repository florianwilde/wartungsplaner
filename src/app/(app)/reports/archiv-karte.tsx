'use client'

import { useState } from 'react'
import { Archive, Download } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Archiv aller Nachweise eines Zeitraums.
 *
 * Bewusst neben den Berichten und nicht als sechster Bericht: Hier entsteht
 * kein Dokument über die Nachweise, sondern eine Mitnahme der Nachweise
 * selbst – ohne Vorlage, ohne Format­wahl.
 */
export function ArchivKarte({
  standardVon,
  standardBis,
  kategorien,
}: {
  standardVon: string
  standardBis: string
  kategorien: { id: string; name: string }[]
}) {
  const [von, setVon] = useState(standardVon)
  const [bis, setBis] = useState(standardBis)
  const [gewaehlt, setGewaehlt] = useState<string[]>([])

  const adresse = () => {
    const parameter = new URLSearchParams({ von, bis })
    if (gewaehlt.length > 0) parameter.set('kategorien', gewaehlt.join(','))
    return `/api/archiv?${parameter.toString()}`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="size-4" />
          Archiv der Nachweise
        </CardTitle>
        <CardDescription>
          Alle Nachweise des Zeitraums als ZIP, gegliedert nach Kategorie und Aufgabe.
          Beigelegt sind ein Inhaltsverzeichnis, eine Prüfsummenliste im Format von{' '}
          <code>sha256sum</code> und eine Erläuterung, wie sich die Unverändertheit ohne
          diese Anwendung nachrechnen lässt.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="archivVon">Von</Label>
            <Input
              id="archivVon"
              type="date"
              value={von}
              onChange={(e) => setVon(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="archivBis">Bis</Label>
            <Input
              id="archivBis"
              type="date"
              value={bis}
              onChange={(e) => setBis(e.target.value)}
            />
          </div>
        </div>

        {kategorien.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Kategorien</p>
            <div className="flex flex-wrap gap-3">
              {kategorien.map((kategorie) => (
                <label key={kategorie.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={gewaehlt.includes(kategorie.id)}
                    onChange={(e) =>
                      setGewaehlt((bisher) =>
                        e.target.checked
                          ? [...bisher, kategorie.id]
                          : bisher.filter((id) => id !== kategorie.id),
                      )
                    }
                    className="size-4"
                  />
                  {kategorie.name}
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Ohne Auswahl sind alle Kategorien enthalten.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button asChild disabled={von > bis}>
            <a href={adresse()} download>
              <Download className="size-4" />
              Archiv herunterladen
            </a>
          </Button>
          {von > bis ? (
            <span className="text-destructive text-sm">
              Das Startdatum liegt nach dem Enddatum.
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">
              Bei großen Zeiträumen kann der Download eine Weile dauern.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
