'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { normalisiereHex } from '@/lib/farben'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { holeBranding, speichereBranding } from '@/server/branding'
import type { BrandingBildArt } from '@/lib/bilder'
import {
  entferneBrandingBild,
  speichereBrandingBild,
} from '@/server/branding-dateien'

export type ErscheinungsbildStatus = { fehler?: string; erfolg?: string }

const einstellungenSchema = z.object({
  appName: z
    .string()
    .trim()
    .min(2, 'Der Anwendungsname muss mindestens 2 Zeichen haben.')
    .max(60),
  organisation: z.string().trim().max(120),
  primaryColor: z.string().trim(),
  accentColor: z.string().trim(),
  reportFooter: z.string().trim().max(200),
})

const BILD_FELDER: { feld: string; art: BrandingBildArt; spalte: 'logoPath' | 'logoDarkPath' | 'faviconPath' }[] = [
  { feld: 'logo', art: 'logo', spalte: 'logoPath' },
  { feld: 'logoDunkel', art: 'logo-dunkel', spalte: 'logoDarkPath' },
  { feld: 'favicon', art: 'favicon', spalte: 'faviconPath' },
]

/**
 * Speichert Farben, Bezeichnungen und – sofern ausgewählt – neue Logodateien.
 *
 * Ersetzte Dateien werden erst nach erfolgreichem Speichern entfernt, damit
 * bei einem Fehler weiterhin das bisherige Logo ausgeliefert wird.
 */
export async function erscheinungsbildSpeichern(
  _status: ErscheinungsbildStatus,
  formData: FormData,
): Promise<ErscheinungsbildStatus> {
  const neuGeschrieben: string[] = []

  try {
    const admin = await benutzerFuerAktion(canAdminister)
    const vorher = await holeBranding()

    const eingabe = einstellungenSchema.safeParse({
      appName: String(formData.get('appName') ?? ''),
      organisation: String(formData.get('organisation') ?? ''),
      primaryColor: String(formData.get('primaryColor') ?? ''),
      accentColor: String(formData.get('accentColor') ?? ''),
      reportFooter: String(formData.get('reportFooter') ?? ''),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }

    const primaer = normalisiereHex(eingabe.data.primaryColor)
    const akzent = normalisiereHex(eingabe.data.accentColor)
    if (!primaer) return { fehler: 'Die Primärfarbe ist keine gültige Hex-Farbe.' }
    if (!akzent) return { fehler: 'Die Akzentfarbe ist keine gültige Hex-Farbe.' }

    const aenderung: Record<string, string | null> = {
      appName: eingabe.data.appName,
      organisation: eingabe.data.organisation,
      primaryColor: primaer,
      accentColor: akzent,
      reportFooter: eingabe.data.reportFooter || null,
    }

    // --- Dateien: neu hochladen oder gezielt entfernen --------------------
    const zuLoeschen: (string | null)[] = []

    for (const { feld, art, spalte } of BILD_FELDER) {
      const entfernen = formData.get(`${feld}Entfernen`) === 'on'
      const datei = formData.get(feld)

      if (entfernen) {
        zuLoeschen.push(vorher[spalte])
        aenderung[spalte] = null
        continue
      }

      if (datei instanceof File && datei.size > 0) {
        const gespeichert = await speichereBrandingBild(datei, art)
        neuGeschrieben.push(gespeichert.storedPath)
        zuLoeschen.push(vorher[spalte])
        aenderung[spalte] = gespeichert.storedPath
      }
    }

    await prisma.$transaction(async (tx) => {
      await speichereBranding(aenderung, admin.id, tx)
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'BRANDING_UPDATED',
          entityType: 'Branding',
          entityId: 'singleton',
          payload: {
            anwendungsname: aenderung.appName,
            organisation: aenderung.organisation,
            primaerfarbe: primaer,
            akzentfarbe: akzent,
            logoGeaendert: aenderung.logoPath !== undefined,
            faviconGeaendert: aenderung.faviconPath !== undefined,
          },
        },
        tx,
      )
    })

    // Erst jetzt die ersetzten Dateien entfernen.
    for (const pfad of zuLoeschen) {
      await entferneBrandingBild(pfad)
    }
  } catch (error) {
    // Bereits geschriebene Dateien wieder aufräumen.
    for (const pfad of neuGeschrieben) {
      await entferneBrandingBild(pfad)
    }
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/', 'layout')
  return { erfolg: 'Das Erscheinungsbild wurde gespeichert.' }
}

/** Setzt Farben und Bezeichnungen auf den Auslieferungszustand zurück. */
export async function erscheinungsbildZuruecksetzen(): Promise<ErscheinungsbildStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)
    const vorher = await holeBranding()

    await prisma.$transaction(async (tx) => {
      await speichereBranding(
        {
          appName: 'Wartungsplaner',
          organisation: 'Beispiel GmbH',
          primaryColor: '#1b7cb5',
          accentColor: '#2f9bd8',
          logoPath: null,
          logoDarkPath: null,
          faviconPath: null,
          reportFooter: null,
        },
        admin.id,
        tx,
      )
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'BRANDING_RESET',
          entityType: 'Branding',
          entityId: 'singleton',
          payload: { hinweis: 'Auslieferungszustand wiederhergestellt' },
        },
        tx,
      )
    })

    await entferneBrandingBild(vorher.logoPath)
    await entferneBrandingBild(vorher.logoDarkPath)
    await entferneBrandingBild(vorher.faviconPath)
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/', 'layout')
  return { erfolg: 'Das Erscheinungsbild wurde zurückgesetzt.' }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler beim Erscheinungsbild:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
