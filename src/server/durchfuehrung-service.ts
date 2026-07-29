/**
 * Fachlogik des Erledigen-Vorgangs – bewusst ohne Next.js-Abhängigkeiten
 * (keine Server Action, kein `revalidatePath`), damit sie direkt gegen eine
 * Datenbank testbar ist. Die Server Action in
 * `src/server/actions/durchfuehrungen.ts` übernimmt Authentifizierung,
 * Formularauswertung und Cache-Invalidierung.
 */
import { schreibeAudit } from '@/lib/audit'
import { compareDates, formatDate, todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { darfErledigtWerden, erzeugeFolgeFaelligkeit } from '@/server/faelligkeiten'
import type { GespeicherteDatei } from '@/server/dateiablage'

/** Fachlicher Fehler, dessen Text unverändert in der Oberfläche erscheint. */
export class FachlicherFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'FachlicherFehler'
  }
}

export type AbweichungEingabe = {
  title: string
  description?: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  responsibleId: string
  /** Frist als Kalendertag. */
  dueDate: Date
}

export type DurchfuehrungEingabe = {
  occurrenceId: string
  result: 'OK' | 'OK_WITH_REMARKS' | 'DEVIATION'
  comment?: string
  /** Durchführungsdatum als Kalendertag. */
  durchgefuehrtAm: Date
  abweichungen: AbweichungEingabe[]
  /** Bereits auf die Platte geschriebene Nachweise. */
  nachweise: GespeicherteDatei[]
}

export type DurchfuehrungErgebnis = {
  executionId: string
  taskId: string
  naechsteFaelligkeit: Date | null
}

/**
 * Prüft alle fachlichen Regeln und schreibt Durchführung, Nachweise,
 * Abweichungen, Statuswechsel und Folgetermin in einer Transaktion.
 *
 * Regeln:
 *  - Eine Fälligkeit kann nur einmal erledigt werden (Unveränderlichkeit).
 *  - Ausgesetzte oder bereits erledigte Fälligkeiten sind gesperrt.
 *  - Bei `evidenceRequired` ist mindestens ein Nachweis nötig.
 *  - Bei Ergebnis `DEVIATION` ist mindestens eine Abweichung nötig.
 *  - Das Durchführungsdatum darf nicht in der Zukunft liegen.
 */
export async function protokolliereDurchfuehrung(
  eingabe: DurchfuehrungEingabe,
  benutzerId: string,
  heute: Date = todayInBerlin(),
): Promise<DurchfuehrungErgebnis> {
  const occurrence = await prisma.occurrence.findUnique({
    where: { id: eingabe.occurrenceId },
    include: {
      execution: { select: { id: true } },
      task: {
        select: {
          id: true,
          title: true,
          active: true,
          evidenceRequired: true,
          intervalType: true,
          intervalValue: true,
          scheduleMode: true,
        },
      },
    },
  })

  if (!occurrence) {
    throw new FachlicherFehler('Die Fälligkeit wurde nicht gefunden.')
  }
  if (occurrence.execution) {
    throw new FachlicherFehler(
      'Für diese Fälligkeit wurde bereits eine Durchführung protokolliert. Abgeschlossene Durchführungen sind unveränderlich.',
    )
  }
  if (!darfErledigtWerden(occurrence.status)) {
    throw new FachlicherFehler(
      occurrence.status === 'SUSPENDED'
        ? 'Diese Fälligkeit ist ausgesetzt und kann nicht erledigt werden.'
        : 'Diese Fälligkeit kann nicht mehr erledigt werden.',
    )
  }
  if (compareDates(eingabe.durchgefuehrtAm, heute) > 0) {
    throw new FachlicherFehler(
      'Das Durchführungsdatum darf nicht in der Zukunft liegen.',
    )
  }
  if (eingabe.result === 'DEVIATION' && eingabe.abweichungen.length === 0) {
    throw new FachlicherFehler(
      'Beim Ergebnis „Abweichung“ muss mindestens eine Abweichung mit Maßnahme erfasst werden.',
    )
  }
  if (occurrence.task.evidenceRequired && eingabe.nachweise.length === 0) {
    throw new FachlicherFehler(
      'Für diese Aufgabe ist ein Nachweis verpflichtend. Bitte laden Sie mindestens eine Datei hoch.',
    )
  }

  if (eingabe.abweichungen.length > 0) {
    const ids = [...new Set(eingabe.abweichungen.map((a) => a.responsibleId))]
    const gefunden = await prisma.user.count({
      where: { id: { in: ids }, active: true },
    })
    if (gefunden !== ids.length) {
      throw new FachlicherFehler(
        'Mindestens eine verantwortliche Person für die Abweichungen ist unbekannt oder deaktiviert.',
      )
    }
  }

  // Uhrzeit bewusst auf 12:00 UTC, damit der Kalendertag in jeder Zeitzone
  // derselbe bleibt.
  const executedAt = new Date(
    Date.UTC(
      eingabe.durchgefuehrtAm.getUTCFullYear(),
      eingabe.durchgefuehrtAm.getUTCMonth(),
      eingabe.durchgefuehrtAm.getUTCDate(),
      12,
      0,
      0,
    ),
  )

  return prisma.$transaction(async (tx) => {
    const execution = await tx.execution.create({
      data: {
        occurrenceId: occurrence.id,
        executedById: benutzerId,
        executedAt,
        result: eingabe.result,
        comment: eingabe.comment?.trim() || null,
      },
    })

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'EXECUTION_CREATED',
        entityType: 'Execution',
        entityId: execution.id,
        payload: {
          aufgabe: occurrence.task.title,
          faelligAm: formatDate(occurrence.dueDate),
          durchgefuehrtAm: formatDate(eingabe.durchgefuehrtAm),
          ergebnis: eingabe.result,
          nachweise: eingabe.nachweise.length,
          abweichungen: eingabe.abweichungen.length,
        },
      },
      tx,
    )

    for (const datei of eingabe.nachweise) {
      const attachment = await tx.attachment.create({
        data: {
          executionId: execution.id,
          filename: datei.filename,
          storedPath: datei.storedPath,
          mimeType: datei.mimeType,
          sizeBytes: datei.sizeBytes,
          sha256: datei.sha256,
          uploadedById: benutzerId,
        },
      })
      await schreibeAudit(
        {
          userId: benutzerId,
          action: 'ATTACHMENT_UPLOADED',
          entityType: 'Attachment',
          entityId: attachment.id,
          payload: {
            dateiname: datei.filename,
            groesseBytes: datei.sizeBytes,
            sha256: datei.sha256,
          },
        },
        tx,
      )
    }

    for (const abweichung of eingabe.abweichungen) {
      const finding = await tx.finding.create({
        data: {
          executionId: execution.id,
          title: abweichung.title,
          description: abweichung.description?.trim() || null,
          severity: abweichung.severity,
          responsibleId: abweichung.responsibleId,
          dueDate: abweichung.dueDate,
          status: 'OPEN',
        },
      })
      await schreibeAudit(
        {
          userId: benutzerId,
          action: 'FINDING_CREATED',
          entityType: 'Finding',
          entityId: finding.id,
          payload: {
            titel: finding.title,
            schwere: finding.severity,
            frist: formatDate(finding.dueDate),
          },
        },
        tx,
      )
    }

    await tx.occurrence.update({
      where: { id: occurrence.id },
      data: { status: 'DONE' },
    })

    const naechste = await erzeugeFolgeFaelligkeit(
      tx,
      {
        id: occurrence.task.id,
        intervalType: occurrence.task.intervalType,
        intervalValue: occurrence.task.intervalValue,
        scheduleMode: occurrence.task.scheduleMode,
        active: occurrence.task.active,
      },
      occurrence.dueDate,
      eingabe.durchgefuehrtAm,
      benutzerId,
    )

    return {
      executionId: execution.id,
      taskId: occurrence.taskId,
      naechsteFaelligkeit: naechste,
    }
  })
}
