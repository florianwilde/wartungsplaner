/**
 * Laden und Speichern des Erscheinungsbilds.
 *
 * Die Konfiguration liegt als einzelner Datensatz in der Tabelle `Branding`.
 * Existiert noch keiner (frische Installation), werden die Standardwerte
 * verwendet, ohne dass ein Datensatz angelegt werden muss.
 */
import { cache } from 'react'

import { STANDARD_BRANDING, type Branding } from '@/lib/branding'
import { normalisiereHex } from '@/lib/farben'
import { prisma } from '@/lib/prisma'

/** Feste ID des Konfigurationsdatensatzes. */
export const BRANDING_ID = 'singleton'

/**
 * Liest das Erscheinungsbild. `cache()` sorgt dafür, dass die Abfrage je
 * Server-Anfrage nur einmal erfolgt, auch wenn mehrere Komponenten sie
 * benötigen.
 */
export const holeBranding = cache(async (): Promise<Branding> => {
  try {
    const datensatz = await prisma.branding.findUnique({
      where: { id: BRANDING_ID },
    })
    if (!datensatz) return STANDARD_BRANDING

    return {
      appName: datensatz.appName.trim() || STANDARD_BRANDING.appName,
      organisation: datensatz.organisation,
      // Sollte in der Datenbank je ein ungültiger Wert stehen, greift der
      // Standard – die Oberfläche bleibt dadurch immer benutzbar.
      primaryColor:
        normalisiereHex(datensatz.primaryColor) ?? STANDARD_BRANDING.primaryColor,
      accentColor:
        normalisiereHex(datensatz.accentColor) ?? STANDARD_BRANDING.accentColor,
      logoPath: datensatz.logoPath,
      logoDarkPath: datensatz.logoDarkPath,
      faviconPath: datensatz.faviconPath,
      reportFooter: datensatz.reportFooter,
    }
  } catch (error) {
    // Etwa während einer noch nicht angewendeten Migration: lieber mit den
    // Standardwerten weiterarbeiten als die gesamte Oberfläche zu blockieren.
    console.error('Erscheinungsbild konnte nicht geladen werden:', error)
    return STANDARD_BRANDING
  }
})

export type BrandingAenderung = Partial<{
  appName: string
  organisation: string
  primaryColor: string
  accentColor: string
  logoPath: string | null
  logoDarkPath: string | null
  faviconPath: string | null
  reportFooter: string | null
}>

/** Schreibt das Erscheinungsbild (legt den Datensatz bei Bedarf an). */
export async function speichereBranding(
  aenderung: BrandingAenderung,
  benutzerId: string,
  client: { branding: typeof prisma.branding } = prisma,
) {
  return client.branding.upsert({
    where: { id: BRANDING_ID },
    update: { ...aenderung, updatedById: benutzerId },
    create: {
      id: BRANDING_ID,
      appName: aenderung.appName ?? STANDARD_BRANDING.appName,
      organisation: aenderung.organisation ?? STANDARD_BRANDING.organisation,
      primaryColor: aenderung.primaryColor ?? STANDARD_BRANDING.primaryColor,
      accentColor: aenderung.accentColor ?? STANDARD_BRANDING.accentColor,
      logoPath: aenderung.logoPath ?? null,
      logoDarkPath: aenderung.logoDarkPath ?? null,
      faviconPath: aenderung.faviconPath ?? null,
      reportFooter: aenderung.reportFooter ?? null,
      updatedById: benutzerId,
    },
  })
}
