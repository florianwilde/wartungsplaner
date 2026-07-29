import type { Metadata } from 'next'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import { ImportFormular } from './import-formular'

export const metadata: Metadata = { title: 'Import und Export' }
export const dynamic = 'force-dynamic'

export default async function ImportExportSeite() {
  await erforderlicheRolle('ADMIN')

  const [kategorien, aufgaben, benutzer] = await Promise.all([
    prisma.category.count(),
    prisma.task.count(),
    prisma.user.count(),
  ])

  const bereiche = [
    {
      art: 'kategorien' as const,
      titel: 'Kategorien',
      anzahl: kategorien,
      beschreibung: 'Name, Farbe und Reihenfolge.',
    },
    {
      art: 'aufgaben' as const,
      titel: 'Aufgaben',
      anzahl: aufgaben,
      beschreibung:
        'Stammdaten inklusive Intervall, Fristen und Prüfanleitung. Ohne Fälligkeiten und Durchführungen.',
    },
    {
      art: 'benutzer' as const,
      titel: 'Benutzer',
      anzahl: benutzer,
      beschreibung: 'Name, E-Mail, Rolle und Status. Ohne Passwörter.',
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Die Ausgabe lässt sich unverändert wieder einlesen. Zugeordnet wird
            über Kategoriename, Aufgabentitel und E-Mail-Adresse – nicht über
            interne Kennungen. Dadurch sind die Daten zwischen Installationen
            übertragbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {bereiche.map((bereich) => (
              <div
                key={bereich.art}
                className="space-y-3 rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium">
                    {bereich.titel}{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                      ({bereich.anzahl})
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {bereich.beschreibung}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/export/${bereich.art}?format=csv`} download>
                      <FileSpreadsheet className="size-4" />
                      CSV
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/export/${bereich.art}?format=json`} download>
                      <FileJson className="size-4" />
                      JSON
                    </a>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Gesamtexport</p>
              <p className="text-xs text-muted-foreground">
                Alle drei Bereiche in einer JSON-Datei – etwa zur Übergabe an
                eine zweite Installation.
              </p>
            </div>
            <Button asChild size="sm">
              <a href="/api/export/alles" download>
                <Download className="size-4" />
                Alles herunterladen
              </a>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Hinweis: Der Export enthält personenbezogene Daten (Namen und
            E-Mail-Adressen). Behandeln Sie die Dateien entsprechend. Passwörter
            und Nachweisdateien werden nie exportiert; für Nachweise ist die
            Sicherung des Upload-Volumes zuständig.
          </p>
        </CardContent>
      </Card>

      <ImportFormular />
    </div>
  )
}
