import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  TriangleAlert,
} from 'lucide-react'

import { ErledigenDialog } from '@/components/erledigen-dialog'
import { LeerHinweis, SeitenKopf } from '@/components/seiten-kopf'
import {
  AmpelBadge,
  KategoriePunkt,
  KritikalitaetBadge,
} from '@/components/status-anzeigen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  addDays,
  compareDates,
  differenceInDays,
  endOfWeek,
  formatDate,
  toISODate,
  todayInBerlin,
} from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canExecute } from '@/lib/rbac'
import { bewerteAmpel, type Ampel } from '@/lib/scheduling'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeNachweisStand, ladeOffeneGegenzeichnungen } from '@/server/nachweise'
import {
  ZEITHORIZONT_BEZEICHNUNG,
  ZEITHORIZONT_COOKIE,
  imHorizont,
  leseZeithorizont,
} from '@/lib/zeithorizont'
import { ZeithorizontAuswahl } from './zeithorizont-auswahl'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardSeite() {
  const benutzer = await erforderlicherBenutzer()
  const heute = todayInBerlin()
  const wochenende = endOfWeek(heute)
  const horizont = leseZeithorizont(
    (await cookies()).get(ZEITHORIZONT_COOKIE)?.value,
  )

  // Zur Gegenzeichnung vorgelegte Nachweise anderer Personen. Ohne diesen
  // Hinweis bliebe ein vorgelegter Bogen liegen, bis jemand die Seite
  // „Nachweise“ von sich aus aufruft.
  const offeneGegenzeichnungen = await ladeOffeneGegenzeichnungen(benutzer.id)

  // Einmal alle aktiven Prüfbögen holen und je Fälligkeit zuordnen – eine
  // Abfrage je Zeile wäre bei einer langen Liste spürbar.
  const alleBoegen = await prisma.pruefbogenVorlage.findMany({
    where: { aktiv: true },
    orderBy: [{ taskId: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      beschreibung: true,
      vierAugen: true,
      taskId: true,
      _count: { select: { punkte: true } },
    },
  })
  const boegenFuer = (taskId: string) =>
    alleBoegen
      .filter((bogen) => bogen.taskId === taskId || bogen.taskId === null)
      .map((bogen) => ({
        id: bogen.id,
        name: bogen.name,
        beschreibung: bogen.beschreibung,
        vierAugen: bogen.vierAugen,
        anzahlPunkte: bogen._count.punkte,
        zugeordnet: bogen.taskId === taskId,
      }))

  const [unerledigte, offeneAbweichungen, kategorien] = await Promise.all([
    prisma.occurrence.findMany({
      where: { status: { in: ['OPEN', 'OVERDUE'] }, task: { active: true } },
      orderBy: { dueDate: 'asc' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            leadTimeDays: true,
            graceDays: true,
            criticality: true,
            evidenceRequired: true,
            category: { select: { id: true, name: true, color: true } },
            owner: { select: { name: true } },
          },
        },
      },
    }),
    prisma.finding.findMany({
      where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: { dueDate: 'asc' },
      include: {
        responsible: { select: { name: true } },
        execution: {
          select: {
            occurrence: { select: { task: { select: { id: true, title: true } } } },
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, color: true },
    }),
  ])

  // --- Ampelbewertung je Fälligkeit ---------------------------------------
  const bewertet = unerledigte.map((occurrence) => ({
    occurrence,
    ampel: bewerteAmpel(
      occurrence.dueDate,
      occurrence.task.leadTimeDays,
      occurrence.task.graceDays,
      heute,
    ),
  }))

  const ueberfaellig = bewertet.filter((e) => e.ampel === 'ueberfaellig')
  const dieseWoche = bewertet.filter(
    (e) =>
      e.ampel !== 'ueberfaellig' &&
      compareDates(e.occurrence.dueDate, wochenende) <= 0,
  )
  const fristUeberschritten = offeneAbweichungen.filter(
    (a) => compareDates(a.dueDate, heute) < 0,
  )

  // --- Ampel je Kategorie -------------------------------------------------
  const kategorieAmpel = kategorien.map((kategorie) => {
    const eintraege = bewertet.filter(
      (e) => e.occurrence.task.category.id === kategorie.id,
    )
    const ueberfaelligeAnzahl = eintraege.filter(
      (e) => e.ampel === 'ueberfaellig',
    ).length
    const baldAnzahl = eintraege.filter((e) => e.ampel === 'bald').length
    const ampel: Ampel =
      ueberfaelligeAnzahl > 0 ? 'ueberfaellig' : baldAnzahl > 0 ? 'bald' : 'ok'

    return {
      ...kategorie,
      offen: eintraege.length,
      ueberfaellig: ueberfaelligeAnzahl,
      bald: baldAnzahl,
      ampel,
    }
  })

  const personen = canExecute(benutzer.role)
    ? await prisma.user.findMany({
        where: { active: true, role: { in: ['ADMIN', 'EDITOR'] } },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : []

  // Überfällige erscheinen immer, unabhängig vom gewählten Zeitraum.
  const imZeitraum = bewertet.filter((e) =>
    imHorizont(e.occurrence.dueDate, horizont, heute, e.ampel === 'ueberfaellig'),
  )
  // Auch bei weitem Zeitraum bleibt die Liste bedienbar.
  const naechsteFaelligkeiten = imZeitraum.slice(0, 30)

  // Bereits geführte Prüfbögen zu diesen Fälligkeiten: Der Erledigen-Dialog
  // soll den vorliegenden Bogen nennen, statt einen weiteren anzubieten.
  const nachweisStand = canExecute(benutzer.role)
    ? await ladeNachweisStand(naechsteFaelligkeiten.map((e) => e.occurrence.id))
    : []

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Dashboard"
        beschreibung={`Angemeldet als ${benutzer.name}. Stichtag ${formatDate(heute)} (Europe/Berlin).`}
      />

      {offeneGegenzeichnungen.length > 0 ? (
        <Link
          href="/nachweise"
          className="flex items-start gap-3 rounded-lg border border-status-warn/40 bg-status-warn/10 p-4 transition-colors hover:bg-status-warn/15"
        >
          <ClipboardCheck className="mt-0.5 size-5 shrink-0 text-status-warn" />
          <div className="min-w-0">
            <p className="font-medium">
              {offeneGegenzeichnungen.length === 1
                ? 'Ein Prüfnachweis wartet auf Ihre Gegenzeichnung'
                : `${offeneGegenzeichnungen.length} Prüfnachweise warten auf Ihre Gegenzeichnung`}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {offeneGegenzeichnungen
                .slice(0, 3)
                .map((n) => `${n.vorlage.name} (${n.erfasstBy.name})`)
                .join(' · ')}
              {offeneGegenzeichnungen.length > 3
                ? ` und ${offeneGegenzeichnungen.length - 3} weitere`
                : ''}
            </p>
          </div>
        </Link>
      ) : null}

      {/* --- Kennzahlen --- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kennzahl
          titel="Überfällig"
          wert={ueberfaellig.length}
          hinweis="Karenzfrist überschritten"
          ton={ueberfaellig.length > 0 ? 'danger' : 'ok'}
          icon={<AlertTriangle className="size-4" />}
          href="/tasks?status=ueberfaellig"
        />
        <Kennzahl
          titel="Diese Woche fällig"
          wert={dieseWoche.length}
          hinweis={`bis ${formatDate(wochenende)}`}
          ton={dieseWoche.length > 0 ? 'warn' : 'ok'}
          icon={<CalendarClock className="size-4" />}
          href="/calendar"
        />
        <Kennzahl
          titel="Offen gesamt"
          wert={unerledigte.length}
          hinweis="unerledigte Fälligkeiten"
          ton="neutral"
          icon={<ClipboardList className="size-4" />}
          href="/tasks?status=offen"
        />
        <Kennzahl
          titel="Offene Abweichungen"
          wert={offeneAbweichungen.length}
          hinweis={
            fristUeberschritten.length > 0
              ? `davon ${fristUeberschritten.length} über Frist`
              : 'alle innerhalb der Frist'
          }
          ton={fristUeberschritten.length > 0 ? 'danger' : offeneAbweichungen.length > 0 ? 'warn' : 'ok'}
          icon={<TriangleAlert className="size-4" />}
          href="/findings?status=unerledigt"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Nächste Fälligkeiten --- */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Nächste Fälligkeiten</CardTitle>
              <CardDescription>
                {ZEITHORIZONT_BEZEICHNUNG[horizont]} · überfällige Prüfungen
                erscheinen immer, die nächste zuerst.
              </CardDescription>
            </div>
            <ZeithorizontAuswahl aktuell={horizont} />
          </CardHeader>
          <CardContent className="space-y-2">
            {naechsteFaelligkeiten.length === 0 ? (
              <LeerHinweis
                text={
                  bewertet.length === 0
                    ? 'Derzeit ist keine Prüfung offen.'
                    : 'In diesem Zeitraum steht keine Prüfung an. Wählen Sie einen weiteren Zeitraum.'
                }
              />
            ) : (
              naechsteFaelligkeiten.map(({ occurrence, ampel }) => {
                const tage = differenceInDays(heute, occurrence.dueDate)
                return (
                  <div
                    key={occurrence.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/tasks/${occurrence.task.id}`}
                          className="font-medium hover:underline"
                        >
                          {occurrence.task.title}
                        </Link>
                        <AmpelBadge ampel={ampel} />
                        <KritikalitaetBadge
                          kritikalitaet={occurrence.task.criticality}
                        />
                      </div>
                      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <KategoriePunkt farbe={occurrence.task.category.color} />
                          {occurrence.task.category.name}
                        </span>
                        <span>{occurrence.task.owner.name}</span>
                        <span>
                          {formatDate(occurrence.dueDate)}
                          {tage === 0
                            ? ' · heute'
                            : tage > 0
                              ? ` · in ${tage} Tagen`
                              : ` · seit ${Math.abs(tage)} Tagen`}
                        </span>
                      </p>
                    </div>

                    {canExecute(benutzer.role) ? (
                      <ErledigenDialog
                        aufgabe={{
                          occurrenceId: occurrence.id,
                          aufgabenTitel: occurrence.task.title,
                          faelligAm: formatDate(occurrence.dueDate),
                          evidenceRequired: occurrence.task.evidenceRequired,
                        }}
                        boegen={boegenFuer(occurrence.task.id)}
                        nachweise={nachweisStand.filter(
                          (n) => n.occurrenceId === occurrence.id,
                        )}
                        personen={personen}
                        heute={toISODate(heute)}
                        standardFrist={toISODate(addDays(heute, 30))}
                      />
                    ) : null}
                  </div>
                )
              })
            )}

            {bewertet.length > naechsteFaelligkeiten.length ? (
              <Button variant="ghost" size="sm" asChild className="w-full">
                <Link href="/tasks?status=offen">
                  Alle {bewertet.length} offenen Fälligkeiten anzeigen
                </Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {/* --- Ampel je Kategorie --- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ampel je Kategorie</CardTitle>
              <CardDescription>
                Rot, sobald eine Prüfung der Kategorie überfällig ist.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {kategorieAmpel.map((kategorie) => (
                <Link
                  key={kategorie.id}
                  href={`/tasks?kategorie=${kategorie.id}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm transition-colors hover:bg-accent/60"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <KategoriePunkt farbe={kategorie.color} />
                    <span className="truncate">{kategorie.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {kategorie.offen} offen
                    </span>
                    <span
                      aria-label={
                        kategorie.ampel === 'ueberfaellig'
                          ? 'überfällig'
                          : kategorie.ampel === 'bald'
                            ? 'bald fällig'
                            : 'in Ordnung'
                      }
                      className={cn(
                        'size-3 rounded-full',
                        kategorie.ampel === 'ueberfaellig' && 'bg-status-danger',
                        kategorie.ampel === 'bald' && 'bg-status-warn',
                        kategorie.ampel === 'ok' && 'bg-status-ok',
                      )}
                    />
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Offene Abweichungen</CardTitle>
              <CardDescription>Die fünf dringendsten Fristen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {offeneAbweichungen.length === 0 ? (
                <LeerHinweis text="Keine offenen Abweichungen." />
              ) : (
                offeneAbweichungen.slice(0, 5).map((abweichung) => {
                  const ueber = compareDates(abweichung.dueDate, heute) < 0
                  return (
                    <div
                      key={abweichung.id}
                      className="rounded-md border border-border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{abweichung.title}</span>
                        {ueber ? (
                          <Badge variant="danger">Frist überschritten</Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {abweichung.responsible.name} · Frist{' '}
                        {formatDate(abweichung.dueDate)} ·{' '}
                        <Link
                          href={`/tasks/${abweichung.execution.occurrence.task.id}`}
                          className="underline hover:no-underline"
                        >
                          {abweichung.execution.occurrence.task.title}
                        </Link>
                      </p>
                    </div>
                  )
                })
              )}

              {offeneAbweichungen.length > 5 ? (
                <Button variant="ghost" size="sm" asChild className="w-full">
                  <Link href="/findings?status=unerledigt">
                    Alle {offeneAbweichungen.length} anzeigen
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kennzahl({
  titel,
  wert,
  hinweis,
  ton,
  icon,
  href,
}: {
  titel: string
  wert: number
  hinweis: string
  ton: 'ok' | 'warn' | 'danger' | 'neutral'
  icon: React.ReactNode
  href: string
}) {
  const farbe = {
    ok: 'text-status-ok',
    warn: 'text-status-warn',
    danger: 'text-status-danger',
    neutral: 'text-foreground',
  }[ton]

  return (
    <Link href={href} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardContent className="p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {titel}
            </span>
            <span className={cn('shrink-0', farbe)}>{icon}</span>
          </div>
          <p className={cn('mt-2 text-3xl font-semibold tabular-nums', farbe)}>
            {wert}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hinweis}</p>
        </CardContent>
      </Card>
    </Link>
  )
}
