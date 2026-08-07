import 'server-only'

import cron, { type ScheduledTask } from 'node-cron'

import { schreibeAuditLeise } from '@/lib/audit'
import { APP_TIME_ZONE, todayInBerlin } from '@/lib/dates'
import {
  fasseErgebnisZusammen,
  versendeBenachrichtigungen,
} from '@/server/benachrichtigungen'
import { fuehreTagesabgleichAus } from '@/server/faelligkeiten'
import {
  fasseAufbewahrungZusammen,
  fuehreAufbewahrungAus,
  holeAufbewahrungsEinstellungen,
} from '@/server/aufbewahrung'
import { fasseLaufZusammen, fuehreIntegritaetslaufAus } from '@/server/integritaet'

const STANDARD_ZEITPLAN = '15 2 * * *'
// Benachrichtigungen bewusst später am Morgen: Der Abgleich soll vorher
// gelaufen sein, und Post um 2 Uhr nachts liest niemand gern.
const STANDARD_MAIL_ZEITPLAN = '0 7 * * *'

// Am globalen Objekt gehalten, damit ein Hot-Reload in der Entwicklung nicht
// mehrere Zeitpläne parallel registriert.
const globalForCron = globalThis as unknown as {
  wartungsplanerCron: ScheduledTask | undefined
  wartungsplanerMailCron: ScheduledTask | undefined
  wartungsplanerCronLaeuft: boolean | undefined
  wartungsplanerMailLaeuft: boolean | undefined
  wartungsplanerIntegritaetLaeuft: boolean | undefined
  wartungsplanerAufbewahrungLaeuft: boolean | undefined
}

/** Führt den Tagesabgleich aus und verhindert überlappende Läufe. */
export async function starteTagesabgleich(ausgeloestVon: string | null = null) {
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
 * Führt den Benachrichtigungslauf aus und verhindert Überschneidungen.
 * Fehler werden protokolliert, aber nicht weitergereicht – der Versand darf
 * den Betrieb nicht stören.
 */
export async function starteBenachrichtigungen(ausgeloestVon: string | null = null) {
  if (globalForCron.wartungsplanerMailLaeuft) {
    console.warn('Benachrichtigungslauf läuft bereits – Aufruf wird übersprungen.')
    return null
  }

  globalForCron.wartungsplanerMailLaeuft = true
  try {
    const heute = todayInBerlin()
    const ergebnis = await versendeBenachrichtigungen(heute)
    console.log(`[Wartungsplaner] ${fasseErgebnisZusammen(ergebnis, heute)}`)

    await schreibeAuditLeise({
      userId: ausgeloestVon,
      action: 'NOTIFICATION_RUN',
      entityType: 'System',
      entityId: null,
      payload: { ...ergebnis },
    })

    return ergebnis
  } finally {
    globalForCron.wartungsplanerMailLaeuft = false
  }
}

/**
 * Prüft die Unversehrtheit der abgelegten Nachweise.
 *
 * Läuft im Anschluss an den Tagesabgleich mit, ohne ihn zu blockieren: Der
 * Abgleich ist für den Betrieb wichtig, die Integritätsprüfung für die
 * Beweiskraft – beides soll unabhängig voneinander gelingen können.
 */
export async function starteIntegritaetslauf(ausgeloestVon: string | null = null) {
  if (globalForCron.wartungsplanerIntegritaetLaeuft) {
    console.warn('Integritätslauf läuft bereits – Aufruf wird übersprungen.')
    return null
  }

  globalForCron.wartungsplanerIntegritaetLaeuft = true
  try {
    const ergebnis = await fuehreIntegritaetslaufAus(ausgeloestVon)
    console.log(`[Wartungsplaner] Nachweise: ${fasseLaufZusammen(ergebnis)}`)
    return ergebnis
  } finally {
    globalForCron.wartungsplanerIntegritaetLaeuft = false
  }
}

/**
 * Wendet die Aufbewahrungsfristen an.
 *
 * Läuft nur, wenn sie ausdrücklich eingeschaltet sind. Der Auslieferungs-
 * zustand ist aus: Gelöscht wird nie ungefragt.
 */
export async function starteAufbewahrung(
  ausgeloestVon: string | null = null,
  nurVorschau = false,
) {
  if (globalForCron.wartungsplanerAufbewahrungLaeuft) {
    console.warn('Aufbewahrungslauf läuft bereits – Aufruf wird übersprungen.')
    return null
  }

  if (!nurVorschau) {
    const einstellungen = await holeAufbewahrungsEinstellungen()
    if (!einstellungen.aktiv) return null
  }

  globalForCron.wartungsplanerAufbewahrungLaeuft = true
  try {
    const ergebnis = await fuehreAufbewahrungAus(ausgeloestVon, nurVorschau)
    console.log(
      `[Wartungsplaner] Aufbewahrung: ${fasseAufbewahrungZusammen(
        ergebnis,
        nurVorschau,
      )}`,
    )
    return ergebnis
  } finally {
    globalForCron.wartungsplanerAufbewahrungLaeuft = false
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
      void starteTagesabgleich(null)
        .catch((error) => {
          console.error('[Wartungsplaner] Tagesabgleich fehlgeschlagen:', error)
        })
        .finally(() => {
          // Unabhängig vom Ausgang des Abgleichs: Die Unversehrtheit der
          // Nachweise soll täglich geprüft werden.
          void starteIntegritaetslauf(null)
            .catch((error) => {
              console.error('[Wartungsplaner] Integritätslauf fehlgeschlagen:', error)
            })
            .finally(() => {
              // Zuletzt: Erst prüfen, dann entfernen – so erfasst der
              // Integritätslauf den Bestand, wie er vor dem Aufräumen war.
              void starteAufbewahrung(null).catch((error) => {
                console.error(
                  '[Wartungsplaner] Aufbewahrungslauf fehlgeschlagen:',
                  error,
                )
              })
            })
        })
    },
    { timezone: APP_TIME_ZONE },
  )

  console.log(
    `[Wartungsplaner] Hintergrundjob registriert: "${gueltigerZeitplan}" (${APP_TIME_ZONE}).`,
  )

  registriereBenachrichtigungsJob()
}

/** Eigener Zeitplan für den E-Mail-Versand. */
function registriereBenachrichtigungsJob(): void {
  if (globalForCron.wartungsplanerMailCron) return

  const zeitplan = process.env.MAIL_CRON_SCHEDULE?.trim() || STANDARD_MAIL_ZEITPLAN

  if (!cron.validate(zeitplan)) {
    console.error(
      `[Wartungsplaner] Ungültiger MAIL_CRON_SCHEDULE "${zeitplan}" – es wird "${STANDARD_MAIL_ZEITPLAN}" verwendet.`,
    )
  }
  const gueltigerZeitplan = cron.validate(zeitplan) ? zeitplan : STANDARD_MAIL_ZEITPLAN

  globalForCron.wartungsplanerMailCron = cron.schedule(
    gueltigerZeitplan,
    () => {
      void starteBenachrichtigungen(null).catch((error) => {
        console.error('[Wartungsplaner] Benachrichtigungslauf fehlgeschlagen:', error)
      })
    },
    { timezone: APP_TIME_ZONE },
  )

  console.log(
    `[Wartungsplaner] Benachrichtigungen registriert: "${gueltigerZeitplan}" (${APP_TIME_ZONE}).`,
  )
}
