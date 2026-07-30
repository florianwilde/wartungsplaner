'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { parseISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canManageTasks } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { erzeugeErsteFaelligkeit } from '@/server/faelligkeiten'

export type AktionsStatus = { fehler?: string; erfolg?: string }

const aufgabenSchema = z
  .object({
    title: z.string().trim().min(3, 'Der Titel muss mindestens 3 Zeichen haben.').max(200),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    instructionsMd: z.string().trim().max(20000).optional().or(z.literal('')),
    categoryId: z.string().trim().min(1, 'Bitte eine Kategorie wählen.'),
    ownerId: z.string().trim().min(1, 'Bitte eine verantwortliche Person wählen.'),
    intervalType: z.enum([
      'DAILY',
      'WEEKLY',
      'MONTHLY',
      'QUARTERLY',
      'SEMIANNUAL',
      'ANNUAL',
      'EVERY_N_DAYS',
    ]),
    intervalValue: z.number().int().min(1).max(3650).nullable(),
    scheduleMode: z.enum(['FIXED', 'AFTER_COMPLETION']),
    startDate: z.string().trim().min(1, 'Bitte ein Startdatum angeben.'),
    leadTimeDays: z.number().int().min(0).max(365),
    graceDays: z.number().int().min(0).max(365),
    evidenceRequired: z.boolean(),
    criticality: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    auditReferenzen: z.string().trim().max(2000).optional().or(z.literal('')),
    active: z.boolean(),
  })
  .refine(
    (daten) => daten.intervalType !== 'EVERY_N_DAYS' || daten.intervalValue !== null,
    {
      message: 'Für „Alle N Tage“ muss die Anzahl der Tage angegeben werden.',
      path: ['intervalValue'],
    },
  )

function leseFormular(formData: FormData) {
  const zahl = (schluessel: string, standard: number) => {
    const wert = formData.get(schluessel)
    if (wert === null || String(wert).trim() === '') return standard
    const zahlwert = Number(String(wert))
    return Number.isFinite(zahlwert) ? Math.trunc(zahlwert) : standard
  }

  const intervalType = String(formData.get('intervalType') ?? 'MONTHLY')
  const rohIntervalValue = String(formData.get('intervalValue') ?? '').trim()

  return {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    instructionsMd: String(formData.get('instructionsMd') ?? ''),
    categoryId: String(formData.get('categoryId') ?? ''),
    ownerId: String(formData.get('ownerId') ?? ''),
    intervalType,
    intervalValue:
      intervalType === 'EVERY_N_DAYS' && rohIntervalValue !== ''
        ? Number(rohIntervalValue)
        : null,
    scheduleMode: String(formData.get('scheduleMode') ?? 'FIXED'),
    startDate: String(formData.get('startDate') ?? ''),
    leadTimeDays: zahl('leadTimeDays', 7),
    graceDays: zahl('graceDays', 0),
    evidenceRequired: formData.get('evidenceRequired') === 'on',
    criticality: String(formData.get('criticality') ?? 'MEDIUM'),
    auditReferenzen: String(formData.get('auditReferenzen') ?? ''),
    active: formData.get('active') !== 'off',
  }
}

/** Legt eine neue Aufgabe an und erzeugt sofort die erste Fälligkeit. */
export async function aufgabeAnlegen(
  _status: AktionsStatus,
  formData: FormData,
): Promise<AktionsStatus> {
  let neueId: string
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)
    const ergebnis = aufgabenSchema.safeParse(leseFormular(formData))
    if (!ergebnis.success) {
      return { fehler: ergebnis.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = ergebnis.data

    let startDate: Date
    try {
      startDate = parseISODate(daten.startDate)
    } catch {
      return { fehler: 'Das Startdatum ist ungültig.' }
    }

    await pruefeStammdaten(daten.categoryId, daten.ownerId)
    const referenzIds = await pruefeReferenzen(daten.auditReferenzen ?? '')

    const aufgabe = await prisma.$transaction(async (tx) => {
      const erstellt = await tx.task.create({
        data: {
          title: daten.title,
          description: daten.description || null,
          instructionsMd: daten.instructionsMd || null,
          categoryId: daten.categoryId,
          ownerId: daten.ownerId,
          intervalType: daten.intervalType,
          intervalValue: daten.intervalValue,
          scheduleMode: daten.scheduleMode,
          startDate,
          leadTimeDays: daten.leadTimeDays,
          graceDays: daten.graceDays,
          evidenceRequired: daten.evidenceRequired,
          criticality: daten.criticality,
          active: daten.active,
          auditReferenzen: {
            create: referenzIds.map((referenzId) => ({ referenzId })),
          },
        },
      })

      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'TASK_CREATED',
          entityType: 'Task',
          entityId: erstellt.id,
          payload: {
            titel: erstellt.title,
            intervall: erstellt.intervalType,
            planungsmodus: erstellt.scheduleMode,
            aktiv: erstellt.active,
          },
        },
        tx,
      )

      // Regel: Beim Anlegen einer aktiven Aufgabe entsteht die erste
      // Fälligkeit zum Startdatum.
      if (erstellt.active) {
        await erzeugeErsteFaelligkeit(tx, erstellt.id, startDate, benutzer.id)
      }

      return erstellt
    })

    neueId = aufgabe.id
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/tasks')
  revalidatePath('/')
  return { erfolg: neueId }
}

/**
 * Ändert die Stammdaten einer Aufgabe.
 * Bereits protokollierte Durchführungen bleiben unberührt.
 */
export async function aufgabeAendern(
  taskId: string,
  _status: AktionsStatus,
  formData: FormData,
): Promise<AktionsStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)
    const ergebnis = aufgabenSchema.safeParse(leseFormular(formData))
    if (!ergebnis.success) {
      return { fehler: ergebnis.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = ergebnis.data

    let startDate: Date
    try {
      startDate = parseISODate(daten.startDate)
    } catch {
      return { fehler: 'Das Startdatum ist ungültig.' }
    }

    const vorher = await prisma.task.findUnique({ where: { id: taskId } })
    if (!vorher) return { fehler: 'Die Aufgabe wurde nicht gefunden.' }

    await pruefeStammdaten(daten.categoryId, daten.ownerId)
    const referenzIds = await pruefeReferenzen(daten.auditReferenzen ?? '')

    await prisma.$transaction(async (tx) => {
      const aktualisiert = await tx.task.update({
        where: { id: taskId },
        data: {
          title: daten.title,
          description: daten.description || null,
          instructionsMd: daten.instructionsMd || null,
          categoryId: daten.categoryId,
          ownerId: daten.ownerId,
          intervalType: daten.intervalType,
          intervalValue: daten.intervalValue,
          scheduleMode: daten.scheduleMode,
          startDate,
          leadTimeDays: daten.leadTimeDays,
          graceDays: daten.graceDays,
          evidenceRequired: daten.evidenceRequired,
          criticality: daten.criticality,
          active: daten.active,
          // Ersetzen statt abgleichen: Die Auswahl im Formular ist der
          // vollstaendige gewuenschte Stand.
          auditReferenzen: {
            deleteMany: {},
            create: referenzIds.map((referenzId) => ({ referenzId })),
          },
        },
      })

      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'TASK_UPDATED',
          entityType: 'Task',
          entityId: taskId,
          payload: {
            titel: aktualisiert.title,
            aenderungen: ermittleAenderungen(vorher, aktualisiert),
          },
        },
        tx,
      )

      // Wird eine zuvor deaktivierte Aufgabe wieder aktiviert und hat keine
      // unerledigte Fälligkeit, entsteht sofort wieder eine.
      if (!vorher.active && aktualisiert.active) {
        const offene = await tx.occurrence.count({
          where: {
            taskId,
            status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] },
          },
        })
        if (offene === 0) {
          await erzeugeErsteFaelligkeit(tx, taskId, startDate, benutzer.id)
        }
      }
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/')
  return { erfolg: 'Die Aufgabe wurde gespeichert.' }
}

/** Aktiviert bzw. deaktiviert eine Aufgabe. */
export async function aufgabeAktivierungUmschalten(
  taskId: string,
  aktiv: boolean,
): Promise<AktionsStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)

    const aufgabe = await prisma.task.findUnique({ where: { id: taskId } })
    if (!aufgabe) return { fehler: 'Die Aufgabe wurde nicht gefunden.' }

    await prisma.$transaction(async (tx) => {
      await tx.task.update({ where: { id: taskId }, data: { active: aktiv } })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: aktiv ? 'TASK_ACTIVATED' : 'TASK_DEACTIVATED',
          entityType: 'Task',
          entityId: taskId,
          payload: { titel: aufgabe.title },
        },
        tx,
      )

      if (aktiv) {
        const offene = await tx.occurrence.count({
          where: { taskId, status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] } },
        })
        if (offene === 0) {
          await erzeugeErsteFaelligkeit(
            tx,
            taskId,
            aufgabe.startDate,
            benutzer.id,
          )
        }
      }
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/tasks')
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath('/')
  return {
    erfolg: aktiv ? 'Die Aufgabe ist wieder aktiv.' : 'Die Aufgabe wurde deaktiviert.',
  }
}

/** Setzt eine Fälligkeit mit Begründung aus bzw. hebt die Aussetzung auf. */
export async function faelligkeitAussetzen(
  occurrenceId: string,
  grund: string,
): Promise<AktionsStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)

    const begruendung = grund.trim()
    if (begruendung.length < 5) {
      return { fehler: 'Bitte begründen Sie die Aussetzung (mindestens 5 Zeichen).' }
    }

    const occurrence = await prisma.occurrence.findUnique({
      where: { id: occurrenceId },
      include: { task: { select: { title: true } } },
    })
    if (!occurrence) return { fehler: 'Die Fälligkeit wurde nicht gefunden.' }
    if (occurrence.status === 'DONE') {
      return { fehler: 'Erledigte Fälligkeiten können nicht ausgesetzt werden.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.occurrence.update({
        where: { id: occurrenceId },
        data: { status: 'SUSPENDED', suspendedReason: begruendung },
      })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'OCCURRENCE_SUSPENDED',
          entityType: 'Occurrence',
          entityId: occurrenceId,
          payload: { aufgabe: occurrence.task.title, begruendung },
        },
        tx,
      )
    })

    revalidatePath(`/tasks/${occurrence.taskId}`)
    revalidatePath('/')
    return { erfolg: 'Die Fälligkeit wurde ausgesetzt.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Hebt eine Aussetzung wieder auf. */
export async function aussetzungAufheben(
  occurrenceId: string,
): Promise<AktionsStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)

    const occurrence = await prisma.occurrence.findUnique({
      where: { id: occurrenceId },
      include: { task: { select: { title: true } } },
    })
    if (!occurrence) return { fehler: 'Die Fälligkeit wurde nicht gefunden.' }
    if (occurrence.status !== 'SUSPENDED') {
      return { fehler: 'Diese Fälligkeit ist nicht ausgesetzt.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.occurrence.update({
        where: { id: occurrenceId },
        data: { status: 'OPEN', suspendedReason: null },
      })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'OCCURRENCE_RESUMED',
          entityType: 'Occurrence',
          entityId: occurrenceId,
          payload: { aufgabe: occurrence.task.title },
        },
        tx,
      )
    })

    revalidatePath(`/tasks/${occurrence.taskId}`)
    revalidatePath('/')
    return { erfolg: 'Die Aussetzung wurde aufgehoben.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

// --- Hilfsfunktionen -------------------------------------------------------

/**
 * Prüft die gewählten Audit-Referenzen und liefert die gültigen Kennungen.
 *
 * Unbekannte Kennungen werden abgewiesen statt stillschweigend verworfen:
 * Eine Zuordnung, die niemand mitbekommt, wäre schlimmer als eine
 * Fehlermeldung.
 */
async function pruefeReferenzen(roh: string): Promise<string[]> {
  const ids = [
    ...new Set(roh.split(',').map((eintrag) => eintrag.trim()).filter(Boolean)),
  ]
  if (ids.length === 0) return []

  const gefunden = await prisma.auditReferenz.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
  if (gefunden.length !== ids.length) {
    throw new Error(
      'Mindestens eine gewählte Audit-Referenz existiert nicht mehr. Bitte die Seite neu laden.',
    )
  }
  return ids
}

async function pruefeStammdaten(categoryId: string, ownerId: string) {
  const [kategorie, besitzer] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
    prisma.user.findUnique({ where: { id: ownerId }, select: { id: true, active: true } }),
  ])
  if (!kategorie) throw new Error('Die gewählte Kategorie existiert nicht.')
  if (!besitzer) throw new Error('Die gewählte verantwortliche Person existiert nicht.')
  if (!besitzer.active) {
    throw new Error('Die gewählte verantwortliche Person ist deaktiviert.')
  }
}

type AufgabenDatensatz = Record<string, unknown>

/** Ermittelt geänderte Felder für das Audit-Log (ohne lange Textinhalte). */
function ermittleAenderungen(
  vorher: AufgabenDatensatz,
  nachher: AufgabenDatensatz,
): Record<string, { vorher: string; nachher: string }> {
  const felder = [
    'title',
    'categoryId',
    'ownerId',
    'intervalType',
    'intervalValue',
    'scheduleMode',
    'startDate',
    'leadTimeDays',
    'graceDays',
    'evidenceRequired',
    'criticality',
    'auditReference',
    'active',
  ]

  const aenderungen: Record<string, { vorher: string; nachher: string }> = {}
  for (const feld of felder) {
    const alt = normalisiere(vorher[feld])
    const neu = normalisiere(nachher[feld])
    if (alt !== neu) aenderungen[feld] = { vorher: alt, nachher: neu }
  }

  // Änderungen an Beschreibung und Prüfanleitung werden nur als Kennzeichen
  // vermerkt, damit das Protokoll lesbar bleibt.
  if (vorher.description !== nachher.description) {
    aenderungen.description = { vorher: '(geändert)', nachher: '(geändert)' }
  }
  if (vorher.instructionsMd !== nachher.instructionsMd) {
    aenderungen.instructionsMd = { vorher: '(geändert)', nachher: '(geändert)' }
  }

  return aenderungen
}

/** Wandelt einen Feldwert in eine kurze, JSON-taugliche Textdarstellung um. */
function normalisiere(wert: unknown): string {
  if (wert === null || wert === undefined) return '–'
  if (wert instanceof Date) return wert.toISOString().slice(0, 10)
  return String(wert)
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler in einer Aufgaben-Aktion:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
