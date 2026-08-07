import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { LeerHinweis, SeitenKopf } from '@/components/seiten-kopf'
import { FaelligkeitsStatusBadge, KategoriePunkt } from '@/components/status-anzeigen'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  addDays,
  addMonths,
  compareDates,
  dateOnly,
  endOfMonth,
  formatDate,
  isSameDay,
  startOfMonth,
  startOfWeek,
  todayInBerlin,
} from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicherBenutzer } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Kalender' }
export const dynamic = 'force-dynamic'

const MONATSNAMEN = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
]

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function monatSchluessel(datum: Date): string {
  return `${datum.getUTCFullYear()}-${String(datum.getUTCMonth() + 1).padStart(2, '0')}`
}

export default async function KalenderSeite({
  searchParams,
}: {
  searchParams: Promise<{ monat?: string }>
}) {
  await erforderlicherBenutzer()
  const { monat } = await searchParams
  const heute = todayInBerlin()

  // Gewählten Monat bestimmen (Format JJJJ-MM), sonst laufender Monat.
  const treffer = /^(\d{4})-(\d{2})$/.exec(monat ?? '')
  const angezeigterMonat = treffer
    ? dateOnly(Number(treffer[1]), Number(treffer[2]), 1)
    : startOfMonth(heute)

  const monatsBeginn = startOfMonth(angezeigterMonat)
  const monatsEnde = endOfMonth(angezeigterMonat)

  // Das Raster beginnt am Montag der Woche des Monatsersten und umfasst
  // sechs volle Wochen, damit die Höhe konstant bleibt.
  const rasterBeginn = startOfWeek(monatsBeginn)
  const tage = Array.from({ length: 42 }, (_, i) => addDays(rasterBeginn, i))
  const rasterEnde = tage[tage.length - 1]

  const faelligkeiten = await prisma.occurrence.findMany({
    where: { dueDate: { gte: rasterBeginn, lte: rasterEnde } },
    orderBy: { dueDate: 'asc' },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          category: { select: { name: true, color: true } },
        },
      },
    },
  })

  const proTag = new Map<string, typeof faelligkeiten>()
  for (const faelligkeit of faelligkeiten) {
    const schluessel = faelligkeit.dueDate.toISOString().slice(0, 10)
    const liste = proTag.get(schluessel) ?? []
    liste.push(faelligkeit)
    proTag.set(schluessel, liste)
  }

  const vorherigerMonat = monatSchluessel(addMonths(monatsBeginn, -1))
  const naechsterMonat = monatSchluessel(addMonths(monatsBeginn, 1))

  const imMonat = faelligkeiten.filter(
    (f) =>
      compareDates(f.dueDate, monatsBeginn) >= 0 &&
      compareDates(f.dueDate, monatsEnde) <= 0,
  )

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Kalender"
        beschreibung={`${imMonat.length} ${imMonat.length === 1 ? 'Fälligkeit' : 'Fälligkeiten'} im angezeigten Monat.`}
        aktionen={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild>
              <Link
                href={`/calendar?monat=${vorherigerMonat}`}
                aria-label="Vorheriger Monat"
              >
                <ChevronLeft className="size-4" />
              </Link>
            </Button>
            <span className="min-w-40 text-center text-sm font-medium">
              {MONATSNAMEN[monatsBeginn.getUTCMonth()]} {monatsBeginn.getUTCFullYear()}
            </span>
            <Button variant="outline" size="icon" asChild>
              <Link
                href={`/calendar?monat=${naechsterMonat}`}
                aria-label="Nächster Monat"
              >
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/calendar">Heute</Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-7 gap-px">
            {WOCHENTAGE.map((tag) => (
              <div
                key={tag}
                className="text-muted-foreground pb-2 text-center text-xs font-medium tracking-wide uppercase"
              >
                {tag}
              </div>
            ))}

            {tage.map((tag) => {
              const schluessel = tag.toISOString().slice(0, 10)
              const eintraege = proTag.get(schluessel) ?? []
              const imAngezeigtenMonat =
                tag.getUTCMonth() === monatsBeginn.getUTCMonth()
              const istHeute = isSameDay(tag, heute)

              return (
                <div
                  key={schluessel}
                  className={cn(
                    'border-border min-h-24 rounded-md border p-1.5 sm:min-h-28',
                    !imAngezeigtenMonat && 'bg-muted/40 text-muted-foreground',
                    istHeute && 'border-primary ring-primary ring-1',
                  )}
                >
                  <div
                    className={cn(
                      'mb-1 text-xs tabular-nums',
                      istHeute && 'text-primary font-semibold',
                    )}
                  >
                    {tag.getUTCDate()}
                  </div>

                  <div className="space-y-1">
                    {eintraege.slice(0, 3).map((eintrag) => (
                      <Link
                        key={eintrag.id}
                        href={`/tasks/${eintrag.task.id}`}
                        title={`${eintrag.task.title} (${eintrag.task.category.name})`}
                        className={cn(
                          'hover:bg-accent flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight transition-colors',
                          eintrag.status === 'OVERDUE' &&
                            'bg-status-danger/10 text-status-danger',
                          eintrag.status === 'DONE' && 'opacity-60',
                          eintrag.status === 'SUSPENDED' && 'italic opacity-60',
                        )}
                      >
                        <KategoriePunkt
                          farbe={eintrag.task.category.color}
                          className="size-1.5"
                        />
                        <span className="truncate">{eintrag.task.title}</span>
                      </Link>
                    ))}

                    {eintraege.length > 3 ? (
                      <span className="text-muted-foreground block px-1 text-[11px]">
                        + {eintraege.length - 3} weitere
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-5">
          <h2 className="text-sm font-medium">
            Fälligkeiten im {MONATSNAMEN[monatsBeginn.getUTCMonth()]}{' '}
            {monatsBeginn.getUTCFullYear()}
          </h2>

          {imMonat.length === 0 ? (
            <LeerHinweis text="In diesem Monat steht keine Prüfung an." />
          ) : (
            <ul className="divide-border divide-y">
              {imMonat.map((eintrag) => (
                <li
                  key={eintrag.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground w-24 shrink-0 tabular-nums">
                      {formatDate(eintrag.dueDate)}
                    </span>
                    <KategoriePunkt farbe={eintrag.task.category.color} />
                    <Link
                      href={`/tasks/${eintrag.task.id}`}
                      className="truncate hover:underline"
                    >
                      {eintrag.task.title}
                    </Link>
                  </span>
                  <FaelligkeitsStatusBadge status={eintrag.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
