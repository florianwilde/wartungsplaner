'use server'

import { revalidatePath } from 'next/cache'

import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { fasseLaufZusammen } from '@/lib/integritaet'
import { fuehreIntegritaetslaufAus } from '@/server/integritaet'

export type IntegritaetsStatus = { fehler?: string; erfolg?: string }

/** Startet den Integritätslauf von Hand aus dem Administrationsbereich. */
export async function integritaetslaufStarten(): Promise<IntegritaetsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)
    const ergebnis = await fuehreIntegritaetslaufAus(admin.id)

    revalidatePath('/admin/integritaet')
    return { erfolg: fasseLaufZusammen(ergebnis) }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Integritätslauf fehlgeschlagen:', error)
    return {
      fehler:
        error instanceof Error
          ? `Der Lauf konnte nicht abgeschlossen werden: ${error.message}`
          : 'Der Lauf konnte nicht abgeschlossen werden.',
    }
  }
}
