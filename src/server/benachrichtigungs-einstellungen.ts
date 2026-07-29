/**
 * Laden und Speichern der Benachrichtigungseinstellungen.
 *
 * Wie beim Erscheinungsbild liegt genau ein Datensatz vor. Fehlt er (frische
 * Installation), gelten die Standardwerte, ohne dass etwas angelegt wird.
 */
import { cache } from 'react'

import { prisma } from '@/lib/prisma'

export const EINSTELLUNGEN_ID = 'singleton'

export type BenachrichtigungsEinstellungen = {
  enabled: boolean
  aufgabenAktiv: boolean
  abweichungenAktiv: boolean
  abweichungVorlaufTage: number
  eskalationAktiv: boolean
  eskalationAbTagen: number
  eskalationUserId: string | null
  wochenuebersichtAktiv: boolean
  /** 1 = Montag … 7 = Sonntag */
  wochenuebersichtTag: number
}

/** Auslieferungszustand: Versand aus, bis er bewusst eingeschaltet wird. */
export const STANDARD_EINSTELLUNGEN: BenachrichtigungsEinstellungen = {
  enabled: false,
  aufgabenAktiv: true,
  abweichungenAktiv: true,
  abweichungVorlaufTage: 7,
  eskalationAktiv: false,
  eskalationAbTagen: 7,
  eskalationUserId: null,
  wochenuebersichtAktiv: false,
  wochenuebersichtTag: 1,
}

export const holeBenachrichtigungsEinstellungen = cache(
  async (): Promise<BenachrichtigungsEinstellungen> => {
    try {
      const datensatz = await prisma.notificationSetting.findUnique({
        where: { id: EINSTELLUNGEN_ID },
      })
      if (!datensatz) return STANDARD_EINSTELLUNGEN

      return {
        enabled: datensatz.enabled,
        aufgabenAktiv: datensatz.aufgabenAktiv,
        abweichungenAktiv: datensatz.abweichungenAktiv,
        abweichungVorlaufTage: datensatz.abweichungVorlaufTage,
        eskalationAktiv: datensatz.eskalationAktiv,
        eskalationAbTagen: datensatz.eskalationAbTagen,
        eskalationUserId: datensatz.eskalationUserId,
        wochenuebersichtAktiv: datensatz.wochenuebersichtAktiv,
        wochenuebersichtTag: datensatz.wochenuebersichtTag,
      }
    } catch (error) {
      console.error(
        'Benachrichtigungseinstellungen konnten nicht geladen werden:',
        error,
      )
      return STANDARD_EINSTELLUNGEN
    }
  },
)

export type EinstellungsAenderung = Partial<BenachrichtigungsEinstellungen>

export async function speichereBenachrichtigungsEinstellungen(
  aenderung: EinstellungsAenderung,
  benutzerId: string,
  client: { notificationSetting: typeof prisma.notificationSetting } = prisma,
) {
  return client.notificationSetting.upsert({
    where: { id: EINSTELLUNGEN_ID },
    update: { ...aenderung, updatedById: benutzerId },
    create: {
      id: EINSTELLUNGEN_ID,
      ...STANDARD_EINSTELLUNGEN,
      ...aenderung,
      updatedById: benutzerId,
    },
  })
}

/** Beschriftungen der Wochentage für die Auswahl im Admin-Bereich. */
export const WOCHENTAGE: { wert: number; label: string }[] = [
  { wert: 1, label: 'Montag' },
  { wert: 2, label: 'Dienstag' },
  { wert: 3, label: 'Mittwoch' },
  { wert: 4, label: 'Donnerstag' },
  { wert: 5, label: 'Freitag' },
  { wert: 6, label: 'Samstag' },
  { wert: 7, label: 'Sonntag' },
]
