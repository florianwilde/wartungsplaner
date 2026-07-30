'use server'

import { revalidatePath } from 'next/cache'

import { parseISODate } from '@/lib/dates'
import { canAdminister, canExecute } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { VertretungsFehler, setzeVertretung } from '@/server/vertretung'

export type VertretungsStatus = { fehler?: string; erfolg?: string }

/** Liest ein optionales Datumsfeld; leer bedeutet „offen“. */
function optionalesDatum(wert: FormDataEntryValue | null): Date | null {
  const text = String(wert ?? '').trim()
  return text ? parseISODate(text) : null
}

/**
 * Hinterlegt oder entfernt eine Vertretung.
 *
 * Für sich selbst darf das jede Person mit Ausführungsrecht; für andere nur
 * die Verwaltung – wer im Urlaub ist, kann die Angabe sonst nicht mehr
 * nachtragen lassen.
 */
export async function vertretungSpeichern(
  _status: VertretungsStatus,
  formData: FormData,
): Promise<VertretungsStatus> {
  try {
    // Wer keine Prüfungen durchführt, hat auch nichts zu vertreten.
    const benutzer = await benutzerFuerAktion(canExecute)
    const personId = String(formData.get('personId') ?? '').trim() || benutzer.id
    const vertretungId = String(formData.get('vertretungId') ?? '').trim()

    await setzeVertretung(
      personId,
      {
        vertretungId: vertretungId || null,
        von: optionalesDatum(formData.get('von')),
        bis: optionalesDatum(formData.get('bis')),
      },
      benutzer.id,
      canAdminister(benutzer.role),
    )

    revalidatePath('/konto')
    revalidatePath('/admin/benutzer')
    revalidatePath('/')

    return {
      erfolg: vertretungId
        ? 'Die Vertretung ist hinterlegt.'
        : 'Die Vertretung wurde aufgehoben.',
    }
  } catch (error) {
    if (error instanceof VertretungsFehler) return { fehler: error.message }
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    if (error instanceof Error && error.message.startsWith('Ungültiges Datum')) {
      return { fehler: 'Bitte geben Sie ein gültiges Datum an.' }
    }
    console.error('Vertretung konnte nicht gespeichert werden:', error)
    return { fehler: 'Die Vertretung konnte nicht gespeichert werden.' }
  }
}
