'use server'

import { revalidatePath } from 'next/cache'

import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import {
  entferneKalenderToken,
  erneuereKalenderToken,
} from '@/server/kalender-abo'

export type KalenderStatus = { fehler?: string; erfolg?: string }

/**
 * Richtet das Abonnement ein oder erzeugt ein neues Geheimnis.
 *
 * Beides ist derselbe Vorgang: Wer den Verdacht hat, die Adresse sei in
 * falsche Hände geraten, erneuert sie – die alte läuft dann ins Leere.
 */
export async function kalenderAboErneuern(): Promise<KalenderStatus> {
  try {
    // Jede angemeldete Person darf ihren eigenen Kalender abonnieren.
    const benutzer = await benutzerFuerAktion(() => true)
    await erneuereKalenderToken(benutzer.id)
    revalidatePath('/konto')
    return { erfolg: 'Die Kalenderadresse ist bereit.' }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Kalender-Abo konnte nicht erneuert werden:', error)
    return { fehler: 'Die Kalenderadresse konnte nicht erzeugt werden.' }
  }
}

export async function kalenderAboAufheben(): Promise<KalenderStatus> {
  try {
    const benutzer = await benutzerFuerAktion(() => true)
    await entferneKalenderToken(benutzer.id)
    revalidatePath('/konto')
    return { erfolg: 'Das Abonnement wurde aufgehoben.' }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Kalender-Abo konnte nicht aufgehoben werden:', error)
    return { fehler: 'Das Abonnement konnte nicht aufgehoben werden.' }
  }
}
