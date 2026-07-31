'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, Upload } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { IMPORT_BEZEICHNUNG, type ImportArt } from '@/lib/import-export'
import {
  importAusfuehren,
  importVorschau,
  type ImportStatus,
} from '@/server/actions/import-export'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const ARTEN: ImportArt[] = [
  'kategorien',
  'aufgaben',
  'benutzer',
  'referenzen',
  'pruefboegen',
]

function PruefenButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Eye className="size-4" />
      {pending ? 'Wird geprüft …' : 'Datei prüfen'}
    </Button>
  )
}

function SchreibenButton({ anzahl }: { anzahl: number }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      <Upload className="size-4" />
      {pending ? 'Wird geschrieben …' : `${anzahl} Änderungen übernehmen`}
    </Button>
  )
}

function VorgangBadge({ vorgang }: { vorgang: string }) {
  if (vorgang === 'anlegen') return <Badge variant="ok">Neu</Badge>
  if (vorgang === 'aktualisieren') return <Badge variant="warn">Änderung</Badge>
  return <Badge variant="neutral">Unverändert</Badge>
}

export function ImportFormular() {
  const router = useRouter()
  const [art, setArt] = useState<ImportArt>('kategorien')

  const [status, pruefen] = useActionState<ImportStatus, FormData>(
    async (vorher, formData) => importVorschau(vorher, formData),
    {},
  )

  const [schreibStatus, schreiben] = useActionState<ImportStatus, FormData>(
    async (vorher, formData) => {
      const antwort = await importAusfuehren(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  const zuUebernehmen =
    (status.zeilen ?? []).filter((z) => z.vorgang !== 'unveraendert').length

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datei einlesen</CardTitle>
          <CardDescription>
            Vor dem Schreiben zeigt die Anwendung genau an, was angelegt und was
            geändert würde. Erst danach wird übernommen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={pruefen} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="art">Bereich</Label>
                <select
                  id="art"
                  name="art"
                  value={art}
                  onChange={(e) => setArt(e.target.value as ImportArt)}
                  className={selectKlassen}
                >
                  {ARTEN.map((wert) => (
                    <option key={wert} value={wert}>
                      {IMPORT_BEZEICHNUNG[wert]}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  {art === 'pruefboegen'
                    ? 'Eine Zeile je Prüfpunkt: Für einen Bogen mit fünf Punkten steht sein Name fünfmal untereinander.'
                    : art === 'aufgaben'
                      ? 'Setzt voraus, dass Kategorien, Verantwortliche und Audit-Referenzen bereits vorhanden sind.'
                      : 'Zugeordnet wird über den fachlichen Schlüssel, nicht über interne Kennungen.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="datei">CSV-Datei</Label>
                <Input
                  id="datei"
                  name="datei"
                  type="file"
                  accept=".csv,text/csv"
                  required
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground">
                  Trennzeichen Semikolon, Zeichensatz UTF-8, höchstens 5 MB.{' '}
                  <a
                    href={`/api/export/${art}?vorlage=true`}
                    className="underline hover:no-underline"
                    download
                  >
                    Vorlage herunterladen
                  </a>
                </p>
              </div>
            </div>

            {status.fehler ? (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {status.fehler}
              </p>
            ) : null}

            <PruefenButton />
          </form>
        </CardContent>
      </Card>

      {status.zusammenfassung ? (
        <Card>
          <CardHeader>
            <CardTitle>Vorschau</CardTitle>
            <CardDescription>{status.zusammenfassung}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(status.pruefFehler ?? []).length > 0 ? (
              <div className="space-y-2 rounded-md bg-destructive/10 p-3">
                <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                  <AlertCircle className="size-4" />
                  Die Datei enthält Fehler – es wird nichts geschrieben.
                </p>
                <ul className="space-y-1 text-sm text-destructive">
                  {(status.pruefFehler ?? []).slice(0, 30).map((fehler, index) => (
                    <li key={index}>
                      Zeile {fehler.zeile}
                      {fehler.spalte ? `, Spalte „${fehler.spalte}“` : ''}:{' '}
                      {fehler.meldung}
                    </li>
                  ))}
                </ul>
                {(status.pruefFehler ?? []).length > 30 ? (
                  <p className="text-xs text-destructive">
                    … und {(status.pruefFehler ?? []).length - 30} weitere.
                  </p>
                ) : null}
              </div>
            ) : null}

            {(status.zeilen ?? []).length > 0 ? (
              <div className="max-h-96 overflow-y-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Zeile</TableHead>
                      <TableHead>Datensatz</TableHead>
                      <TableHead className="w-32">Vorgang</TableHead>
                      <TableHead>Änderungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(status.zeilen ?? []).map((zeile) => (
                      <TableRow key={zeile.zeile}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {zeile.zeile}
                        </TableCell>
                        <TableCell className="font-medium">
                          {zeile.schluessel}
                        </TableCell>
                        <TableCell>
                          <VorgangBadge vorgang={zeile.vorgang} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {zeile.aenderungen.length > 0
                            ? zeile.aenderungen.join(', ')
                            : '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {status.schreibbar ? (
              <form action={schreiben} className="space-y-3">
                <input type="hidden" name="art" value={status.art ?? ''} />
                <input type="hidden" name="inhalt" value={status.inhalt ?? ''} />

                <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Beim Übernehmen wird alles in einer Transaktion geschrieben –
                  entweder vollständig oder gar nicht. Die Daten werden dabei
                  erneut geprüft. Vorhandene Fälligkeiten und Durchführungen
                  bleiben unangetastet.
                </p>

                {schreibStatus.fehler ? (
                  <p
                    role="alert"
                    className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    {schreibStatus.fehler}
                  </p>
                ) : null}

                {schreibStatus.erfolg ? (
                  <p className="flex items-start gap-2 rounded-md bg-status-ok/10 p-3 text-sm text-status-ok">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                    {schreibStatus.erfolg}
                  </p>
                ) : (
                  <SchreibenButton anzahl={zuUebernehmen} />
                )}
              </form>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
