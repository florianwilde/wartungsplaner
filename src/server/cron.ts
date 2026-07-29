import 'server-only'

import cron, { type ScheduledTask } from 'node-cron'

import { APP_TIME_ZONE } from '@/lib/dates'
import { fuehreTagesabgleichAus } from '@/server/faelligkeiten'

const STANDARD_ZEITPLAN = '15 2 * * *'

// Am globalen Objekt gehalten, damit ein Hot-Reload in der Entwicklung nicht
// mehrere Zeitpläne parallel registriert.
const globalForCron = globalThis as unknown as {
  wartungsplanerCron: ScheduledTask | undefined
  wartungsplanerCronLaeuft: boolean | undefined
}

/** Führt den Tagesabgleich aus und verhindert überlappende Läufe. */
export async function starteTagesabgleich(
  ausgeloestVon: string | null = null,
) {
  if (globalForCron.wartungsplanerCronLaeuft) {
    console.warn('Tagesabgleich läuft bereits – Aufruf wird übersprungen.')
    return null
  }

  globalForCron.wartungsplanerCronLaeuft = true
  try {
    const ergebnis = await fuehreTagesabgleichAus(ausgeloestVon)
    console.log(
      `[Wartungsplaner] Tagesabgleich ${ergebnis.stichtag}: ` +
        `${ergebnis.geprueft} Fälligkeiten geprüft, ` +
        `${ergebnis.aufUeberfaelligGesetzt} überfällig, ` +
        `${ergebnis.neueFaelligkeiten} neu erzeugt ` +
        `(${ergebnis.dauerMs} ms).`,
    )
    return ergebnis
  } finally {
    globalForCron.wartungsplanerCronLaeuft = false
  }
}

/**
 * Registriert den täglichen Hintergrundjob.
 * Aufruf ausschließlich über `src/instrumentation.ts` beim Serverstart.
 */
export function registriereTaeglichenJob(): void {
  if (process.env.CRON_ENABLED === 'false') {
    console.log('[Wartungsplaner] Hintergrundjob ist deaktiviert (CRON_ENABLED=false).')
    return
  }

  if (globalForCron.wartungsplanerCron) return

  const zeitplan = process.env.CRON_SCHEDULE?.trim() || STANDARD_ZEITPLAN

  if (!cron.validate(zeitplan)) {
    console.error(
      `[Wartungsplaner] Ungültiger CRON_SCHEDULE "${zeitplan}" – es wird "${STANDARD_ZEITPLAN}" verwendet.`,
    )
  }

  const gueltigerZeitplan = cron.validate(zeitplan) ? zeitplan : STANDARD_ZEITPLAN

  globalForCron.wartungsplanerCron = cron.schedule(
    gueltigerZeitplan,
    () => {
      void starteTagesabgleich(null).catch((error) => {
        console.error('[Wartungsplaner] Tagesabgleich fehlgeschlagen:', error)
      })
    },
    { timezone: APP_TIME_ZONE },
  )

  console.log(
    `[Wartungsplaner] Hintergrundjob registriert: "${gueltigerZeitplan}" (${APP_TIME_ZONE}).`,
  )
}
