import 'server-only'

import type { Prisma } from '@prisma/client'

import { schreibeAudit, schreibeAuditLeise } from '@/lib/audit'
import { compareDates, formatDate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import {
  ersteFaelligkeit,
  faelligkeitNachrollen,
  naechsteFaelligkeit,
  statusNachTagesabgleich,
  type IntervallTyp,
  type PlanungsModus,
} from '@/lib/scheduling'

/** Status, die eine Fälligkeit als „noch nicht abgeschlossen“ kennzeichnen. */
const UNERLEDIGT = ['OPEN', 'OVERDUE', 'SUSPENDED'] as const

type Tx = Prisma.TransactionClient

/**
 * Legt die erste Fälligkeit einer neu angelegten Aufgabe an (zum Startdatum).
 * Wird direkt beim Anlegen aufgerufen.
 */
export async function erzeugeErsteFaelligkeit(
  tx: Tx,
  taskId: string,
  startDatum: Date,
  benutzerId: string | null,
): Promise<void> {
  const dueDate = ersteFaelligkeit(startDatum)

  await tx.occurrence.create({
    data: { taskId, dueDate, status: 'OPEN' },
  })
  await schreibeAudit(
    {
      userId: benutzerId,
      action: 'OCCURRENCE_CREATED',
      entityType: 'Occurrence',
      entityId: taskId,
      payload: { faelligAm: formatDate(dueDate), anlass: 'Aufgabe angelegt' },
    },
    tx,
  )
}

/**
 * Erzeugt nach einer Erledigung die nächste Fälligkeit.
 * Existiert der Termin bereits, passiert nichts (Idempotenz durch den
 * eindeutigen Index auf `taskId + dueDate`).
 */
export async function erzeugeFolgeFaelligkeit(
  tx: Tx,
  task: {
    id: string
    intervalType: IntervallTyp
    intervalValue: number | null
    scheduleMode: PlanungsModus
    active: boolean
  },
  letzteSollFaelligkeit: Date,
  erledigtAm: Date,
  benutzerId: string | null,
): Promise<Date | null> {
  if (!task.active) return null

  const dueDate = naechsteFaelligkeit({
    intervalType: task.intervalType,
    intervalValue: task.intervalValue,
    scheduleMode: task.scheduleMode,
    letzteSollFaelligkeit,
    erledigtAm,
  })

  const vorhanden = await tx.occurrence.findUnique({
    where: { taskId_dueDate: { taskId: task.id, dueDate } },
    select: { id: true },
  })
  if (vorhanden) return dueDate

  await tx.occurrence.create({
    data: { taskId: task.id, dueDate, status: 'OPEN' },
  })
  await schreibeAudit(
    {
      userId: benutzerId,
      action: 'OCCURRENCE_CREATED',
      entityType: 'Occurrence',
      entityId: task.id,
      payload: {
        faelligAm: formatDate(dueDate),
        anlass: 'Folgetermin nach Erledigung',
      },
    },
    tx,
  )

  return dueDate
}

export type TagesabgleichErgebnis = {
  geprueft: number
  aufUeberfaelligGesetzt: number
  zurueckAufOffen: number
  neueFaelligkeiten: number
  dauerMs: number
  stichtag: string
}

/**
 * Täglicher Abgleich.
 *
 * 1. Setzt unerledigte Fälligkeiten auf ÜBERFÄLLIG, sobald
 *    `dueDate + graceDays < heute` (und umgekehrt zurück auf OFFEN, falls sich
 *    Termin oder Karenz geändert haben).
 * 2. Stellt sicher, dass jede aktive Aufgabe genau eine unerledigte
 *    Fälligkeit besitzt.
 *
 * Der Lauf ist idempotent und kann gefahrlos mehrfach am Tag erfolgen.
 */
export async function fuehreTagesabgleichAus(
  ausgeloestVon: string | null = null,
): Promise<TagesabgleichErgebnis> {
  const beginn = Date.now()
  const heute = todayInBerlin()

  let aufUeberfaelligGesetzt = 0
  let zurueckAufOffen = 0
  let neueFaelligkeiten = 0

  // --- 1. Statusabgleich ---------------------------------------------------
  const offene = await prisma.occurrence.findMany({
    where: { status: { in: ['OPEN', 'OVERDUE'] } },
    select: {
      id: true,
      dueDate: true,
      status: true,
      taskId: true,
      task: { select: { graceDays: true, title: true } },
    },
  })

  for (const occurrence of offene) {
    const neuerStatus = statusNachTagesabgleich(
      occurrence.status,
      occurrence.dueDate,
      occurrence.task.graceDays,
      heute,
    )
    if (neuerStatus === occurrence.status) continue

    await prisma.$transaction(async (tx) => {
      await tx.occurrence.update({
        where: { id: occurrence.id },
        data: { status: neuerStatus },
      })
      await schreibeAudit(
        {
          userId: ausgeloestVon,
          action:
            neuerStatus === 'OVERDUE' ? 'OCCURRENCE_OVERDUE' : 'OCCURRENCE_RESUMED',
          entityType: 'Occurrence',
          entityId: occurrence.id,
          payload: {
            aufgabe: occurrence.task.title,
            faelligAm: formatDate(occurrence.dueDate),
            vorher: occurrence.status,
            nachher: neuerStatus,
            quelle: 'Täglicher Job',
          },
        },
        tx,
      )
    })

    if (neuerStatus === 'OVERDUE') aufUeberfaelligGesetzt++
    else zurueckAufOffen++
  }

  // --- 2. Fehlende Fälligkeiten nachziehen ---------------------------------
  const aktiveAufgaben = await prisma.task.findMany({
    where: { active: true },
    select: {
      id: true,
      title: true,
      startDate: true,
      intervalType: true,
      intervalValue: true,
      scheduleMode: true,
      _count: { select: { occurrences: { where: { status: { in: [...UNERLEDIGT] } } } } },
    },
  })

  for (const aufgabe of aktiveAufgaben) {
    if (aufgabe._count.occurrences > 0) continue

    const letzte = await prisma.occurrence.findFirst({
      where: { taskId: aufgabe.id },
      orderBy: { dueDate: 'desc' },
      select: {
        dueDate: true,
        execution: { select: { executedAt: true } },
      },
    })

    let dueDate: Date
    let anlass: string

    if (!letzte) {
      // Aufgabe ohne jede Fälligkeit: beim Startdatum beginnen.
      dueDate = ersteFaelligkeit(aufgabe.startDate)
      anlass = 'Erste Fälligkeit nachgezogen'
    } else {
      const basis =
        aufgabe.scheduleMode === 'AFTER_COMPLETION' && letzte.execution
          ? letzte.execution.executedAt
          : letzte.dueDate
      // Bis mindestens heute vorrollen, damit nach einer Reaktivierung nicht
      // rückwirkend eine Kette vergangener Termine entsteht.
      dueDate = faelligkeitNachrollen(
        basis,
        aufgabe.intervalType,
        aufgabe.intervalValue,
        heute,
      )
      anlass = 'Fehlende offene Fälligkeit nachgezogen'
    }

    try {
      await prisma.$transaction(async (tx) => {
        await tx.occurrence.create({
          data: { taskId: aufgabe.id, dueDate, status: 'OPEN' },
        })
        await schreibeAudit(
          {
            userId: ausgeloestVon,
            action: 'OCCURRENCE_CREATED',
            entityType: 'Occurrence',
            entityId: aufgabe.id,
            payload: {
              aufgabe: aufgabe.title,
              faelligAm: formatDate(dueDate),
              anlass,
              quelle: 'Täglicher Job',
            },
          },
          tx,
        )
      })
      neueFaelligkeiten++
    } catch (error) {
      // Kann auftreten, wenn parallel bereits derselbe Termin angelegt wurde.
      console.error(
        `Fälligkeit für Aufgabe "${aufgabe.title}" konnte nicht angelegt werden:`,
        error,
      )
    }
  }

  const ergebnis: TagesabgleichErgebnis = {
    geprueft: offene.length,
    aufUeberfaelligGesetzt,
    zurueckAufOffen,
    neueFaelligkeiten,
    dauerMs: Date.now() - beginn,
    stichtag: formatDate(heute),
  }

  await schreibeAuditLeise({
    userId: ausgeloestVon,
    action: 'CRON_RUN',
    entityType: 'System',
    entityId: null,
    payload: { ...ergebnis },
  })

  return ergebnis
}

/**
 * Prüft, ob eine Fälligkeit erledigt werden darf.
 * Bereits erledigte oder ausgesetzte Termine sind gesperrt.
 */
export function darfErledigtWerden(status: string): boolean {
  return status === 'OPEN' || status === 'OVERDUE'
}

/** Sortierhilfe: nächste Fälligkeit zuerst. */
export function nachFaelligkeitSortieren<T extends { dueDate: Date }>(
  eintraege: T[],
): T[] {
  return [...eintraege].sort((a, b) => compareDates(a.dueDate, b.dueDate))
}
