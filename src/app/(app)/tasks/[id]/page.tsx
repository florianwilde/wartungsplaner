import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText, Paperclip, Pencil } from 'lucide-react'

import { ErledigenDialog } from '@/components/erledigen-dialog'
import { MarkdownAnzeige } from '@/components/markdown-anzeige'
import { LeerHinweis, SeitenKopf } from '@/components/seiten-kopf'
import {
  AbweichungStatusBadge,
  AmpelBadge,
  ErgebnisBadge,
  FaelligkeitsStatusBadge,
  KategoriePunkt,
  KritikalitaetBadge,
  SchwereBadge,
} from '@/components/status-anzeigen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { anzeigeName, langName } from '@/lib/audit-referenzen'
import { addDays, formatDate, formatDateTime, toISODate, todayInBerlin } from '@/lib/dates'
import { formatiereDateigroesse } from '@/lib/labels'
import { prisma } from '@/lib/prisma'
import { canExecute, canManageTasks } from '@/lib/rbac'
import {
  PLANUNGSMODUS_BEZEICHNUNG,
  bewerteAmpel,
  intervallText,
  verzugInTagen,
  warPuenktlich,
} from '@/lib/scheduling'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeVerfuegbareVorlagen } from '@/server/nachweise'
import { NachweisStarten } from './nachweis-starten'
import {
  AktivierungSchalter,
  AussetzenDialog,
  AussetzungAufhebenButton,
} from './aufgaben-aktionen'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const aufgabe = await prisma.task.findUnique({
    where: { id },
    select: { title: true },
  })
  return { title: aufgabe?.title ?? 'Aufgabe' }
}

export default async function AufgabenDetailSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const benutzer = await erforderlicherBenutzer()
  const { id } = await params
  const heute = todayInBerlin()

  const aufgabe = await prisma.task.findUnique({
    where: { id },
    include: {
      category: true,
      owner: { select: { id: true, name: true, email: true } },
      auditReferenzen: {
        select: {
          referenzId: true,
          referenz: {
            select: { kuerzel: true, bezeichnung: true, rahmenwerk: true },
          },
        },
      },
      occurrences: {
        orderBy: { dueDate: 'desc' },
        include: {
          execution: {
            include: {
              executedBy: { select: { name: true } },
              attachments: { orderBy: { uploadedAt: 'asc' } },
              findings: {
                orderBy: { createdAt: 'asc' },
                include: { responsible: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  })

  if (!aufgabe) notFound()

  const pruefboegen = await ladeVerfuegbareVorlagen(aufgabe.id)

  const personen = await prisma.user.findMany({
    where: { active: true, role: { in: ['ADMIN', 'EDITOR'] } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })

  const offene = aufgabe.occurrences.filter(
    (o) => o.status === 'OPEN' || o.status === 'OVERDUE',
  )
  const ausgesetzte = aufgabe.occurrences.filter((o) => o.status === 'SUSPENDED')
  const historie = aufgabe.occurrences.filter((o) => o.execution !== null)

  const darfErledigen = canExecute(benutzer.role)
  const darfVerwalten = canManageTasks(benutzer.role)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="kein-druck -ml-2">
        <Link href="/tasks">
          <ArrowLeft className="size-4" />
          Zurück zur Übersicht
        </Link>
      </Button>

      <SeitenKopf
        titel={aufgabe.title}
        beschreibung={aufgabe.description ?? undefined}
        aktionen={
          darfVerwalten ? (
            <>
              <AktivierungSchalter taskId={aufgabe.id} aktiv={aufgabe.active} />
              <Button variant="outline" size="sm" asChild>
                <Link href={`/tasks/${aufgabe.id}/bearbeiten`}>
                  <Pencil className="size-4" />
                  Bearbeiten
                </Link>
              </Button>
            </>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-sm">
          <KategoriePunkt farbe={aufgabe.category.color} />
          {aufgabe.category.name}
        </span>
        <KritikalitaetBadge kritikalitaet={aufgabe.criticality} />
        {!aufgabe.active ? <Badge variant="secondary">Deaktiviert</Badge> : null}
        {aufgabe.evidenceRequired ? (
          <Badge variant="outline">Nachweis verpflichtend</Badge>
        ) : null}
        {aufgabe.auditReferenzen.map((zuordnung) => (
          <Badge
            key={zuordnung.referenzId}
            variant="outline"
            title={langName(zuordnung.referenz)}
          >
            {anzeigeName(zuordnung.referenz)}
          </Badge>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* --- Linke Spalte: Stammdaten und Anleitung --- */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Offene Fälligkeiten</CardTitle>
              <CardDescription>
                {offene.length === 0 && ausgesetzte.length === 0
                  ? 'Derzeit steht keine Durchführung an.'
                  : 'Anstehende Termine dieser Aufgabe.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {offene.length === 0 && ausgesetzte.length === 0 ? (
                <LeerHinweis text="Keine offene Fälligkeit vorhanden." />
              ) : null}

              {offene.map((occurrence) => (
                <div
                  key={occurrence.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatDate(occurrence.dueDate)}
                      </span>
                      <AmpelBadge
                        ampel={bewerteAmpel(
                          occurrence.dueDate,
                          aufgabe.leadTimeDays,
                          aufgabe.graceDays,
                          heute,
                        )}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Karenz bis {formatDate(addDays(occurrence.dueDate, aufgabe.graceDays))}
                    </p>
                  </div>

                  <div className="kein-druck flex flex-wrap items-center gap-2">
                    {darfErledigen ? (
                      <NachweisStarten
                        occurrenceId={occurrence.id}
                        faelligAm={formatDate(occurrence.dueDate)}
                        boegen={pruefboegen.map((bogen) => ({
                          id: bogen.id,
                          name: bogen.name,
                          beschreibung: bogen.beschreibung,
                          vierAugen: bogen.vierAugen,
                          anzahlPunkte: bogen._count.punkte,
                          zugeordnet: bogen.taskId === aufgabe.id,
                        }))}
                      />
                    ) : null}
                    {darfVerwalten ? (
                      <AussetzenDialog
                        occurrenceId={occurrence.id}
                        faelligAm={formatDate(occurrence.dueDate)}
                      />
                    ) : null}
                    {darfErledigen ? (
                      <ErledigenDialog
                        aufgabe={{
                          occurrenceId: occurrence.id,
                          aufgabenTitel: aufgabe.title,
                          faelligAm: formatDate(occurrence.dueDate),
                          evidenceRequired: aufgabe.evidenceRequired,
                        }}
                        boegen={pruefboegen.map((bogen) => ({
                          id: bogen.id,
                          name: bogen.name,
                          beschreibung: bogen.beschreibung,
                          vierAugen: bogen.vierAugen,
                          anzahlPunkte: bogen._count.punkte,
                          zugeordnet: bogen.taskId === aufgabe.id,
                        }))}
                        personen={personen}
                        heute={toISODate(heute)}
                        standardFrist={toISODate(addDays(heute, 30))}
                      />
                    ) : null}
                  </div>
                </div>
              ))}

              {ausgesetzte.map((occurrence) => (
                <div
                  key={occurrence.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-border p-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatDate(occurrence.dueDate)}
                      </span>
                      <FaelligkeitsStatusBadge status="SUSPENDED" />
                    </div>
                    {occurrence.suspendedReason ? (
                      <p className="text-xs text-muted-foreground">
                        Begründung: {occurrence.suspendedReason}
                      </p>
                    ) : null}
                  </div>
                  {darfVerwalten ? (
                    <AussetzungAufhebenButton occurrenceId={occurrence.id} />
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prüfanleitung</CardTitle>
            </CardHeader>
            <CardContent>
              {aufgabe.instructionsMd?.trim() ? (
                <MarkdownAnzeige inhalt={aufgabe.instructionsMd} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Für diese Aufgabe ist keine Prüfanleitung hinterlegt.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historie der Durchführungen</CardTitle>
              <CardDescription>
                Vollständige, unveränderliche Nachweiskette dieser Aufgabe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {historie.length === 0 ? (
                <LeerHinweis text="Für diese Aufgabe wurde noch keine Durchführung protokolliert." />
              ) : (
                historie.map((occurrence) => {
                  const execution = occurrence.execution!
                  const puenktlich = warPuenktlich(
                    occurrence.dueDate,
                    execution.executedAt,
                    aufgabe.graceDays,
                  )
                  const verzug = verzugInTagen(occurrence.dueDate, execution.executedAt)

                  return (
                    <div
                      key={occurrence.id}
                      className="space-y-3 rounded-lg border border-border p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <ErgebnisBadge ergebnis={execution.result} />
                          <Badge variant={puenktlich ? 'ok' : 'danger'}>
                            {puenktlich
                              ? 'Pünktlich'
                              : `${verzug} Tage nach Termin`}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Soll: {formatDate(occurrence.dueDate)} · Durchgeführt:{' '}
                          {formatDate(execution.executedAt)}
                        </span>
                      </div>

                      <p className="text-sm">
                        <span className="text-muted-foreground">Durch: </span>
                        {execution.executedBy.name}
                        <span className="text-muted-foreground">
                          {' '}
                          · protokolliert am {formatDateTime(execution.createdAt)}
                        </span>
                      </p>

                      {execution.comment ? (
                        <p className="whitespace-pre-wrap rounded-md bg-muted/60 p-3 text-sm">
                          {execution.comment}
                        </p>
                      ) : null}

                      {execution.attachments.length > 0 ? (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <Paperclip className="size-3.5" />
                            Nachweise
                          </p>
                          <ul className="space-y-1.5">
                            {execution.attachments.map((anhang) => (
                              <li
                                key={anhang.id}
                                className="rounded-md border border-border px-3 py-2 text-sm"
                              >
                                <a
                                  href={`/api/attachments/${anhang.id}`}
                                  className="flex items-center gap-2 font-medium hover:underline"
                                >
                                  <FileText className="size-4 shrink-0" />
                                  {anhang.filename}
                                </a>
                                <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                                  {formatiereDateigroesse(anhang.sizeBytes)} · SHA-256:{' '}
                                  {anhang.sha256}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {darfErledigen ? (
                        <div className="kein-druck">
                          {/* Ein Prüfbogen lässt sich auch nachreichen: Sein PDF
                              kommt dann zur bestehenden Durchführung. */}
                          <NachweisStarten
                            occurrenceId={occurrence.id}
                            faelligAm={formatDate(occurrence.dueDate)}
                            nachreichen
                            boegen={pruefboegen.map((bogen) => ({
                              id: bogen.id,
                              name: bogen.name,
                              beschreibung: bogen.beschreibung,
                              vierAugen: bogen.vierAugen,
                              anzahlPunkte: bogen._count.punkte,
                              zugeordnet: bogen.taskId === aufgabe.id,
                            }))}
                          />
                        </div>
                      ) : null}

                      {execution.findings.length > 0 ? (
                        <div className="space-y-2">
                          <Separator />
                          <p className="text-xs font-medium text-muted-foreground">
                            Abweichungen
                          </p>
                          {execution.findings.map((abweichung) => (
                            <div
                              key={abweichung.id}
                              className="rounded-md bg-muted/60 p-3 text-sm"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{abweichung.title}</span>
                                <SchwereBadge schwere={abweichung.severity} />
                                <AbweichungStatusBadge status={abweichung.status} />
                              </div>
                              {abweichung.description ? (
                                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                  {abweichung.description}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs text-muted-foreground">
                                Verantwortlich: {abweichung.responsible.name} · Frist:{' '}
                                {formatDate(abweichung.dueDate)}
                                {abweichung.closedAt
                                  ? ` · geschlossen am ${formatDate(abweichung.closedAt)}`
                                  : ''}
                              </p>
                              {abweichung.closingComment ? (
                                <p className="mt-1 text-xs">
                                  <span className="text-muted-foreground">
                                    Maßnahme:{' '}
                                  </span>
                                  {abweichung.closingComment}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- Rechte Spalte: Kenndaten --- */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Planung</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <Kennwert
                  label="Intervall"
                  wert={intervallText(aufgabe.intervalType, aufgabe.intervalValue)}
                />
                <Kennwert
                  label="Rhythmus"
                  wert={PLANUNGSMODUS_BEZEICHNUNG[aufgabe.scheduleMode]}
                />
                <Kennwert label="Startdatum" wert={formatDate(aufgabe.startDate)} />
                <Kennwert
                  label="Vorlaufzeit"
                  wert={`${aufgabe.leadTimeDays} Tage`}
                />
                <Kennwert label="Karenz" wert={`${aufgabe.graceDays} Tage`} />
                <Kennwert
                  label="Verantwortlich"
                  wert={`${aufgabe.owner.name} (${aufgabe.owner.email})`}
                />
                <Kennwert
                  label="Angelegt"
                  wert={formatDateTime(aufgabe.createdAt)}
                />
                <Kennwert
                  label="Zuletzt geändert"
                  wert={formatDateTime(aufgabe.updatedAt)}
                />
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bilanz</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <Kennwert
                  label="Durchführungen gesamt"
                  wert={String(historie.length)}
                />
                <Kennwert
                  label="davon pünktlich"
                  wert={String(
                    historie.filter((o) =>
                      warPuenktlich(
                        o.dueDate,
                        o.execution!.executedAt,
                        aufgabe.graceDays,
                      ),
                    ).length,
                  )}
                />
                <Kennwert
                  label="mit Abweichung"
                  wert={String(
                    historie.filter((o) => o.execution!.result === 'DEVIATION').length,
                  )}
                />
                <Kennwert
                  label="Offene Abweichungen"
                  wert={String(
                    historie
                      .flatMap((o) => o.execution!.findings)
                      .filter((f) => f.status !== 'CLOSED').length,
                  )}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Kennwert({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{wert}</dd>
    </div>
  )
}
