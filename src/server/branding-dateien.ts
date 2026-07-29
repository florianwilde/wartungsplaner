/**
 * Datei-Ablage für Logos und Favicon.
 *
 * Bewusst getrennt von den Nachweis-Uploads: andere Dateitypen, andere
 * Größengrenze und keine Prüfsummenpflicht. Die Dateien liegen im selben
 * Volume unter `branding/`. Die Regeln selbst stehen in `@/lib/bilder`,
 * damit auch das Formular im Browser darauf zugreifen kann.
 */
import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import {
  ERLAUBTE_BILD_ENDUNGEN,
  MAX_LOGO_BYTES,
  BILD_ENDUNGEN_TEXT,
  bildEndung,
  type BrandingBildArt,
} from '@/lib/bilder'
import { absoluterPfad } from '@/server/dateiablage'

export type GespeichertesBild = {
  storedPath: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

/**
 * Speichert ein hochgeladenes Logo und liefert den relativen Pfad.
 * @throws mit deutschsprachigem Text bei unzulässigem Format oder Größe.
 */
export async function speichereBrandingBild(
  datei: File,
  art: BrandingBildArt,
): Promise<GespeichertesBild> {
  const endung = bildEndung(datei.name)

  if (!(endung in ERLAUBTE_BILD_ENDUNGEN)) {
    throw new Error(
      `Der Dateityp „.${endung || '?'}“ ist nicht zugelassen. Erlaubt sind: ${BILD_ENDUNGEN_TEXT}.`,
    )
  }

  const inhalt = Buffer.from(await datei.arrayBuffer())
  if (inhalt.byteLength === 0) {
    throw new Error('Die gewählte Datei ist leer.')
  }
  if (inhalt.byteLength > MAX_LOGO_BYTES) {
    throw new Error('Die Datei ist größer als 2 MB.')
  }

  // Der Dateiname enthält eine Zufallskennung, damit Browser und Zwischen-
  // speicher nach einem Wechsel garantiert die neue Datei laden.
  const relativerPfad = `branding/${art}-${randomUUID()}.${endung}`
  const ziel = absoluterPfad(relativerPfad)

  await mkdir(path.dirname(ziel), { recursive: true })
  await writeFile(ziel, inhalt, { flag: 'wx' })

  return {
    storedPath: relativerPfad,
    mimeType: ERLAUBTE_BILD_ENDUNGEN[endung],
    sizeBytes: inhalt.byteLength,
    sha256: createHash('sha256').update(inhalt).digest('hex'),
  }
}

/** Entfernt eine zuvor gespeicherte Branding-Datei (Fehler werden geloggt). */
export async function entferneBrandingBild(
  relativerPfad: string | null | undefined,
): Promise<void> {
  if (!relativerPfad) return
  try {
    await unlink(absoluterPfad(relativerPfad))
  } catch (error) {
    console.error(`Branding-Datei "${relativerPfad}" nicht entfernt:`, error)
  }
}
