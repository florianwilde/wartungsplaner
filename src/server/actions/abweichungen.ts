'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { formatDate, parseISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canManageFindings } from '@/lib/rbac'
import { fehlerbehandlung } from '@/lib/fehler'
import { benutzerFuerAktion } from '@/lib/session'

const fehlertext = fehlerbehandlung('Unerwarteter Fehler in einer Abweichungs-Aktion')

export type AbweichungStatus = { fehler?: string; erfolg?: string }

const bearbeitenSchema = z.object({
  findingId: z.string().trim().min(1),
  title: z.string().trim().min(3, 'Der Titel muss mindestens 3 Zeichen haben.').max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  responsibleId: z.string().trim().min(1, 'Bitte eine verantwortliche Person wählen.'),
  dueDate: z.string().trim().min(1, 'Bitte eine Frist angeben.'),
  status: z.enum(['OPEN', 'IN_PROGRESS']),
})

/**
 * Ändert eine offene Abweichung.
 * Geschlossene Abweichungen sind gesperrt – sie werden bei Bedarf über eine
 * neue Durchführung erneut erfasst.
 */
export async function abweichungBearbeiten(
  _status: AbweichungStatus,
  formData: FormData,
): Promise<AbweichungStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageFindings)

    const eingabe = bearbeitenSchema.safeParse({
      findingId: String(formData.get('findingId') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      severity: String(formData.get('severity') ?? 'MEDIUM'),
      responsibleId: String(formData.get('responsibleId') ?? ''),
      dueDate: String(formData.get('dueDate') ?? ''),
      status: String(formData.get('status') ?? 'OPEN'),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    let frist: Date
    try {
      frist = parseISODate(daten.dueDate)
    } catch {
      return { fehler: 'Die Frist ist ungültig.' }
    }

    const vorhanden = await prisma.finding.findUnique({
      where: { id: daten.findingId },
      select: { id: true, status: true, title: true, severity: true, dueDate: true, responsibleId: true },
    })
    if (!vorhanden) return { fehler: 'Die Abweichung wurde nicht gefunden.' }
    if (vorhanden.status === 'CLOSED') {
      return { fehler: 'Geschlossene Abweichungen können nicht mehr geändert werden.' }
    }

    const verantwortlich = await prisma.user.findFirst({
      where: { id: daten.responsibleId, active: true },
      select: { id: true },
    })
    if (!verantwortlich) {
      return { fehler: 'Die gewählte verantwortliche Person ist unbekannt oder deaktiviert.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.finding.update({
        where: { id: daten.findingId },
        data: {
          title: daten.title,
          description: daten.description || null,
          severity: daten.severity,
          responsibleId: daten.responsibleId,
          dueDate: frist,
          status: daten.status,
        },
      })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'FINDING_UPDATED',
          entityType: 'Finding',
          entityId: daten.findingId,
          payload: {
            titel: daten.title,
            statusVorher: vorhanden.status,
            statusNachher: daten.status,
            fristVorher: formatDate(vorhanden.dueDate),
            fristNachher: formatDate(frist),
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/findings')
  revalidatePath('/')
  return { erfolg: 'Die Abweichung wurde gespeichert.' }
}

const schliessenSchema = z.object({
  findingId: z.string().trim().min(1),
  closingComment: z
    .string()
    .trim()
    .min(10, 'Bitte beschreiben Sie die umgesetzte Maßnahme (mindestens 10 Zeichen).')
    .max(4000),
})

/** Schließt eine Abweichung mit Abschlusskommentar. */
export async function abweichungSchliessen(
  _status: AbweichungStatus,
  formData: FormData,
): Promise<AbweichungStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageFindings)

    const eingabe = schliessenSchema.safeParse({
      findingId: String(formData.get('findingId') ?? ''),
      closingComment: String(formData.get('closingComment') ?? ''),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    const vorhanden = await prisma.finding.findUnique({
      where: { id: daten.findingId },
      select: { id: true, status: true, title: true },
    })
    if (!vorhanden) return { fehler: 'Die Abweichung wurde nicht gefunden.' }
    if (vorhanden.status === 'CLOSED') {
      return { fehler: 'Diese Abweichung ist bereits geschlossen.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.finding.update({
        where: { id: daten.findingId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closingComment: daten.closingComment,
        },
      })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'FINDING_CLOSED',
          entityType: 'Finding',
          entityId: daten.findingId,
          payload: { titel: vorhanden.title, abschlusskommentar: daten.closingComment },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/findings')
  revalidatePath('/')
  return { erfolg: 'Die Abweichung wurde geschlossen.' }
}
