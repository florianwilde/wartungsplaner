'use client'

import { useMemo, useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { anzeigeName } from '@/lib/audit-referenzen'

export type ReportDefinition = {
  typ: 'compliance' | 'historie' | 'abweichungen' | 'vorschau' | 'nachweise'
  titel: string
  beschreibung: string
  /** true = Zeitraumfilter, false = Vorschau in Monaten */
  mitZeitraum: boolean
  /** Verfuegbare PDF-Vorlagen; leer = eingebaute Fassung */
  vorlagen: { id: string; name: string; istStandard: boolean }[]
}

export function ReportFormular({
  berichte,
  kategorien,
  referenzen,
  standardVon,
  standardBis,
}: {
  berichte: ReportDefinition[]
  kategorien: { id: string; name: string; color: string }[]
  /** Audit-Referenzen mit zugeordneten Aufgaben. */
  referenzen: { id: string; kuerzel: string; rahmenwerk: string | null }[]
  standardVon: string
  standardBis: string
}) {
  const [von, setVon] = useState(standardVon)
  const [bis, setBis] = useState(standardBis)
  const [monate, setMonate] = useState('6')
  const [gewaehlt, setGewaehlt] = useState<string[]>([])
  // Je Bericht die gewaehlte PDF-Vorlage (leer = Standardvorlage)
  const [vorlagen, setVorlagen] = useState<Record<string, string>>({})

  const [gewaehlteReferenzen, setGewaehlteReferenzen] = useState<string[]>([])

  const referenzenParameter = useMemo(
    () => (gewaehlteReferenzen.length > 0 ? gewaehlteReferenzen.join(',') : ''),
    [gewaehlteReferenzen],
  )

  const kategorienParameter = useMemo(
    () => (gewaehlt.length > 0 ? gewaehlt.join(',') : ''),
    [gewaehlt],
  )

  const umschalten = (id: string) =>
    setGewaehlt((bisher) =>
      bisher.includes(id) ? bisher.filter((k) => k !== id) : [...bisher, id],
    )

  const baueUrl = (bericht: ReportDefinition, format: 'pdf' | 'xlsx') => {
    const params = new URLSearchParams({ format })
    if (bericht.mitZeitraum) {
      params.set('von', von)
      params.set('bis', bis)
    } else {
      params.set('monate', monate)
    }
    if (kategorienParameter) params.set('kategorien', kategorienParameter)
    if (referenzenParameter) params.set('referenzen', referenzenParameter)

    // Die Vorlage betrifft nur das PDF; Excel enthaelt stets alle Felder.
    const vorlage = vorlagen[bericht.typ]
    if (format === 'pdf' && vorlage) params.set('vorlage', vorlage)

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
              <p className="text-muted-foreground text-xs">
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
            <p className="text-muted-foreground text-xs">
              {gewaehlt.length === 0
                ? 'Keine Auswahl bedeutet: alle Kategorien.'
                : `${gewaehlt.length} von ${kategorien.length} Kategorien gewählt.`}
            </p>
          </div>

          {referenzen.length > 0 ? (
            <div className="space-y-2">
              <Label>Audit-Referenzen</Label>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {referenzen.map((referenz) => (
                  <label
                    key={referenz.id}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <Checkbox
                      checked={gewaehlteReferenzen.includes(referenz.id)}
                      onCheckedChange={() =>
                        setGewaehlteReferenzen((bisher) =>
                          bisher.includes(referenz.id)
                            ? bisher.filter((id) => id !== referenz.id)
                            : [...bisher, referenz.id],
                        )
                      }
                    />
                    {anzeigeName(referenz)}
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                {gewaehlteReferenzen.length === 0
                  ? 'Keine Auswahl bedeutet: alle Referenzen.'
                  : 'Enthalten sind Aufgaben, die mindestens eine der gewählten Anforderungen abdecken.'}
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {berichte.map((bericht) => (
          <Card key={bericht.typ}>
            <CardHeader>
              <CardTitle className="text-base">{bericht.titel}</CardTitle>
              <CardDescription>{bericht.beschreibung}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {bericht.vorlagen.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor={`vorlage-${bericht.typ}`} className="text-xs">
                    PDF-Vorlage
                  </Label>
                  <select
                    id={`vorlage-${bericht.typ}`}
                    value={vorlagen[bericht.typ] ?? ''}
                    onChange={(e) =>
                      setVorlagen((bisher) => ({
                        ...bisher,
                        [bericht.typ]: e.target.value,
                      }))
                    }
                    className="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <option value="">Standardvorlage</option>
                    {bericht.vorlagen.map((vorlage) => (
                      <option key={vorlage.id} value={vorlage.id}>
                        {vorlage.name}
                        {vorlage.istStandard ? ' (Standard)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
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
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
