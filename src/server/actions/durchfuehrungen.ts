'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { parseISODate } from '@/lib/dates'
import { canExecute } from '@/lib/rbac'
import { benutzerFuerAktion } from '@/lib/session'
import {
  entferneDateien,
  speichereDatei,
  type GespeicherteDatei,
} from '@/server/dateiablage'
import { fehlerbehandlung } from '@/lib/fehler'
import {
  protokolliereDurchfuehrung,
  type AbweichungEingabe,
} from '@/server/durchfuehrung-service'

const fehlertext = fehlerbehandlung(
  'Unerwarteter Fehler beim Erledigen',
  'Die Durchführung konnte nicht gespeichert werden.',
)

export type ErledigenStatus = { fehler?: string; erfolg?: string }

const abweichungSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Jede Abweichung braucht einen Titel (mindestens 3 Zeichen).')
    .max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  responsibleId: z
    .string()
    .trim()
    .min(1, 'Bitte eine verantwortliche Person für die Abweichung wählen.'),
  dueDate: z.string().trim().min(1, 'Bitte eine Frist für die Abweichung angeben.'),
})

const erledigenSchema = z.object({
  occurrenceId: z.string().trim().min(1),
  result: z.enum(['OK', 'OK_WITH_REMARKS', 'DEVIATION']),
  comment: z.string().trim().max(4000).optional().or(z.literal('')),
  executedOn: z.string().trim().min(1, 'Bitte das Durchführungsdatum angeben.'),
  abweichungen: z.array(abweichungSchema),
})

/**
 * Protokolliert die Durchführung einer Fälligkeit.
 *
 * Die Nachweise werden vor der Transaktion auf die Platte geschrieben.
 * Schlägt die Transaktion fehl, werden sie wieder entfernt, damit keine
 * verwaisten Dateien zurückbleiben.
 */
export async function faelligkeitErledigen(
  _status: ErledigenStatus,
  formData: FormData,
): Promise<ErledigenStatus> {
  const geschriebeneDateien: GespeicherteDatei[] = []
  let taskId: string | undefined

  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    let abweichungenRoh: unknown
    try {
      abweichungenRoh = JSON.parse(String(formData.get('abweichungen') ?? '[]'))
    } catch {
      return { fehler: 'Die erfassten Abweichungen konnten nicht gelesen werden.' }
    }

    const eingabe = erledigenSchema.safeParse({
      occurrenceId: String(formData.get('occurrenceId') ?? ''),
      result: String(formData.get('result') ?? ''),
      comment: String(formData.get('comment') ?? ''),
      executedOn: String(formData.get('executedOn') ?? ''),
      abweichungen: abweichungenRoh,
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    let durchgefuehrtAm: Date
    try {
      durchgefuehrtAm = parseISODate(daten.executedOn)
    } catch {
      return { fehler: 'Das Durchführungsdatum ist ungültig.' }
    }

    const abweichungen: AbweichungEingabe[] = []
    for (const abweichung of daten.abweichungen) {
      try {
        abweichungen.push({
          title: abweichung.title,
          description: abweichung.description || undefined,
          severity: abweichung.severity,
          responsibleId: abweichung.responsibleId,
          dueDate: parseISODate(abweichung.dueDate),
        })
      } catch {
        return {
          fehler: `Die Frist der Abweichung „${abweichung.title}“ ist ungültig.`,
        }
      }
    }

    const dateien = formData
      .getAll('nachweise')
      .filter((eintrag): eintrag is File => eintrag instanceof File && eintrag.size > 0)

    for (const datei of dateien) {
      geschriebeneDateien.push(await speichereDatei(datei))
    }

    const ergebnis = await protokolliereDurchfuehrung(
      {
        occurrenceId: daten.occurrenceId,
        result: daten.result,
        comment: daten.comment || undefined,
        durchgefuehrtAm,
        abweichungen,
        nachweise: geschriebeneDateien,
      },
      benutzer.id,
    )
    taskId = ergebnis.taskId
  } catch (error) {
    if (geschriebeneDateien.length > 0) {
      await entferneDateien(geschriebeneDateien.map((d) => d.storedPath))
    }
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/')
  revalidatePath('/tasks')
  revalidatePath('/findings')
  revalidatePath('/calendar')
  if (taskId) revalidatePath(`/tasks/${taskId}`)

  return { erfolg: 'Die Durchführung wurde protokolliert.' }
}
