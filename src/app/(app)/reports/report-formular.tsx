'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type ReportDefinition = {
  typ: 'compliance' | 'historie' | 'abweichungen' | 'vorschau'
  titel: string
  beschreibung: string
  /** true = Zeitraumfilter, false = Vorschau in Monaten */
  mitZeitraum: boolean
}

export function ReportFormular({
  berichte,
  kategorien,
  standardVon,
  standardBis,
}: {
  berichte: ReportDefinition[]
  kategorien: { id: string; name: string; color: string }[]
  standardVon: string
  standardBis: string
}) {
  const [von, setVon] = useState(standardVon)
  const [bis, setBis] = useState(standardBis)
  const [monate, setMonate] = useState('6')
  const [gewaehlt, setGewaehlt] = useState<string[]>([])

  const kategorienParameter = useMemo(
    () => (gewaehlt.length > 0 ? gewaehlt.join(',') : ''),
    [gewaehlt],
  )

  const umschalten = (id: string) =>
    setGewaehlt((bisher) =>
      bisher.includes(id) ? bisher.filter((k) => k !== id) : [...bisher, id],
    )

  const baueUrl = (
    bericht: ReportDefinition,
    format: 'pdf' | 'xlsx',
  ) => {
    const params = new URLSearchParams({ format })
    if (bericht.mitZeitraum) {
      params.set('von', von)
      params.set('bis', bis)
    } else {
      params.set('monate', monate)
    }
    if (kategorienParameter) params.set('kategorien', kategorienParameter)
    return `/api/reports/${bericht.typ}?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Filter</CardTitle>
          <CardDescription>
            Zeitraum und Kategorien gelten für alle Berichte auf dieser Seite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="von">Zeitraum von</Label>
              <Input
                id="von"
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bis">Zeitraum bis</Label>
              <Input
                id="bis"
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monate">Vorschau über … Monate</Label>
              <Input
                id="monate"
                type="number"
                min={1}
                max={36}
                value={monate}
                onChange={(e) => setMonate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Gilt nur für die Fälligkeitsvorschau.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Kategorien</Label>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {kategorien.map((kategorie) => (
                <label
                  key={kategorie.id}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={gewaehlt.includes(kategorie.id)}
                    onCheckedChange={() => umschalten(kategorie.id)}
                  />
                  <span
                    aria-hidden
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: kategorie.color }}
                  />
                  {kategorie.name}
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {gewaehlt.length === 0
                ? 'Keine Auswahl bedeutet: alle Kategorien.'
                : `${gewaehlt.length} von ${kategorien.length} Kategorien gewählt.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {berichte.map((bericht) => (
          <Card key={bericht.typ}>
            <CardHeader>
              <CardTitle className="text-base">{bericht.titel}</CardTitle>
              <CardDescription>{bericht.beschreibung}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <a href={baueUrl(bericht, 'pdf')} download>
                  <FileText className="size-4" />
                  PDF herunterladen
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={baueUrl(bericht, 'xlsx')} download>
                  <FileSpreadsheet className="size-4" />
                  Excel herunterladen
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
