import type { Metadata } from 'next'
import { Download, FileJson, FileSpreadsheet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import { ImportFormular } from './import-formular'

export const metadata: Metadata = { title: 'Import und Export' }
export const dynamic = 'force-dynamic'

export default async function ImportExportSeite() {
  await erforderlicheRolle('ADMIN')

  const [kategorien, aufgaben, benutzer, referenzen, pruefboegen] = await Promise.all([
    prisma.category.count(),
    prisma.task.count(),
    prisma.user.count(),
    prisma.auditReferenz.count(),
    prisma.pruefbogenVorlage.count(),
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
    {
      art: 'referenzen' as const,
      titel: 'Audit-Referenzen',
      anzahl: referenzen,
      beschreibung:
        'Anforderungen aus Normen: Rahmenwerk, Kurzzeichen und Bezeichnung. Ohne die Zuordnung zu Aufgaben.',
    },
    {
      art: 'pruefboegen' as const,
      titel: 'Prüfbögen',
      anzahl: pruefboegen,
      beschreibung:
        'Vorlagen samt Prüfpunkten – eine Zeile je Prüfpunkt. Ohne geführte Nachweise.',
    },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            Die Ausgabe lässt sich unverändert wieder einlesen. Zugeordnet wird über
            Kategoriename, Aufgabentitel und E-Mail-Adresse – nicht über interne
            Kennungen. Dadurch sind die Daten zwischen Installationen übertragbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
            {bereiche.map((bereich) => (
              <div
                key={bereich.art}
                className="border-border space-y-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">
                    {bereich.titel}{' '}
                    <span className="text-muted-foreground text-sm font-normal">
                      ({bereich.anzahl})
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
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

          <div className="border-border flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Gesamtexport</p>
              <p className="text-muted-foreground text-xs">
                Alle drei Bereiche in einer JSON-Datei – etwa zur Übergabe an eine
                zweite Installation.
              </p>
            </div>
            <Button asChild size="sm">
              <a href="/api/export/alles" download>
                <Download className="size-4" />
                Alles herunterladen
              </a>
            </Button>
          </div>

          <p className="text-muted-foreground text-xs">
            Hinweis: Der Export enthält personenbezogene Daten (Namen und
            E-Mail-Adressen). Behandeln Sie die Dateien entsprechend. Passwörter und
            Nachweisdateien werden nie exportiert; für Nachweise ist die Sicherung des
            Upload-Volumes zuständig.
          </p>
        </CardContent>
      </Card>

      <ImportFormular />
    </div>
  )
}
