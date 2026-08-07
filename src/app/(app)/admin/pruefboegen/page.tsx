import type { Metadata } from 'next'

import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import type { PruefpunktArt } from '@/lib/nachweise'
import { PruefbogenVerwaltung } from './pruefbogen-verwaltung'

export const metadata: Metadata = { title: 'Prüfbögen' }
export const dynamic = 'force-dynamic'

export default async function PruefboegenSeite() {
  await erforderlicheRolle('ADMIN')

  const [boegen, aufgaben] = await Promise.all([
    prisma.pruefbogenVorlage.findMany({
      orderBy: [{ aktiv: 'desc' }, { name: 'asc' }],
      include: {
        task: { select: { title: true } },
        punkte: { orderBy: { position: 'asc' } },
        _count: { select: { nachweise: true } },
      },
    }),
    prisma.task.findMany({
      where: { active: true },
      orderBy: { title: 'asc' },
      select: { id: true, title: true },
    }),
  ])

  return (
    <div className="space-y-6">
      <p className="border-border bg-card text-muted-foreground rounded-lg border p-4 text-sm">
        Prüfbögen führen den Prüfvorgang in der Anwendung durch, statt ihn in Word- oder
        Tabellendateien auszulagern. Aus dem ausgefüllten Bogen entsteht ein
        PDF-Nachweis mit Prüfsumme, der automatisch als Anhang an der Durchführung
        hinterlegt wird. Mit aktivem Vier-Augen-Prinzip wird er erst nach Gegenzeichnung
        durch eine zweite Person gültig.
      </p>

      <PruefbogenVerwaltung
        aufgaben={aufgaben.map((a) => ({ id: a.id, titel: a.title }))}
        boegen={boegen.map((bogen) => ({
          id: bogen.id,
          name: bogen.name,
          beschreibung: bogen.beschreibung,
          taskId: bogen.taskId,
          taskTitel: bogen.task?.title ?? null,
          vierAugen: bogen.vierAugen,
          aktiv: bogen.aktiv,
          anzahlPunkte: bogen.punkte.length,
          anzahlNachweise: bogen._count.nachweise,
          punkte: bogen.punkte.map((punkt) => ({
            schluessel: punkt.id,
            frage: punkt.frage,
            hinweis: punkt.hinweis ?? '',
            art: punkt.art as PruefpunktArt,
            pflicht: punkt.pflicht,
          })),
        }))}
      />
    </div>
  )
}
