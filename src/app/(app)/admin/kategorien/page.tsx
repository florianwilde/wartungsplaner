import type { Metadata } from 'next'

import { KategoriePunkt } from '@/components/status-anzeigen'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import {
  KategorieAnlegenDialog,
  KategorieBearbeitenDialog,
  KategorieLoeschenButton,
} from './kategorie-aktionen'

export const metadata: Metadata = { title: 'Kategorien' }
export const dynamic = 'force-dynamic'

export default async function KategorienSeite() {
  await erforderlicheRolle('ADMIN')

  const kategorien = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { tasks: true } } },
  })

  const naechsteReihenfolge =
    kategorien.length > 0
      ? Math.max(...kategorien.map((k) => k.sortOrder)) + 10
      : 10

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Kategorien</CardTitle>
          <CardDescription>
            Gliederung der Aufgaben; die Farbe steuert die Darstellung in
            Dashboard, Liste und Kalender.
          </CardDescription>
        </div>
        <KategorieAnlegenDialog naechsteReihenfolge={naechsteReihenfolge} />
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kategorie</TableHead>
              <TableHead>Farbe</TableHead>
              <TableHead>Reihenfolge</TableHead>
              <TableHead>Aufgaben</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kategorien.map((kategorie) => (
              <TableRow key={kategorie.id}>
                <TableCell>
                  <span className="flex items-center gap-2 font-medium">
                    <KategoriePunkt farbe={kategorie.color} />
                    {kategorie.name}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {kategorie.color}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {kategorie.sortOrder}
                </TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {kategorie._count.tasks}
                </TableCell>
                <TableCell>
                  <div className="kein-druck flex justify-end gap-2">
                    <KategorieBearbeitenDialog
                      kategorie={{
                        id: kategorie.id,
                        name: kategorie.name,
                        color: kategorie.color,
                        sortOrder: kategorie.sortOrder,
                      }}
                    />
                    <KategorieLoeschenButton
                      kategorieId={kategorie.id}
                      name={kategorie.name}
                      anzahlAufgaben={kategorie._count.tasks}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="mt-4 text-xs text-muted-foreground">
          Kategorien mit zugeordneten Aufgaben lassen sich nicht löschen.
        </p>
      </CardContent>
    </Card>
  )
}
