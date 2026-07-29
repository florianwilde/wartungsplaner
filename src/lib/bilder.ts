/**
 * Regeln für Logo- und Favicon-Uploads.
 *
 * Bewusst frei von Node-Modulen, damit auch das Formular im Browser dieselben
 * Angaben verwenden kann wie die serverseitige Prüfung.
 */

/** Maximale Größe eines Logos oder Favicons: 2 MB. */
export const MAX_LOGO_BYTES = 2 * 1024 * 1024

/** Erlaubte Bildformate mit zugehörigem MIME-Typ. */
export const ERLAUBTE_BILD_ENDUNGEN: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  ico: 'image/x-icon',
}

export const BILD_ACCEPT_ATTRIBUT = '.svg,.png,.jpg,.jpeg,.webp,.ico'
export const BILD_ENDUNGEN_TEXT = 'svg, png, jpg, webp, ico'

export type BrandingBildArt = 'logo' | 'logo-dunkel' | 'favicon'

/** Kleingeschriebene Endung eines Dateinamens (ohne Punkt). */
export function bildEndung(dateiname: string): string {
  const name = dateiname.split(/[\\/]/).pop() ?? ''
  const punkt = name.lastIndexOf('.')
  return punkt > 0 ? name.slice(punkt + 1).toLowerCase() : ''
}

/** MIME-Typ anhand der Dateiendung eines gespeicherten Pfades. */
export function mimeTypFuerPfad(relativerPfad: string): string {
  return (
    ERLAUBTE_BILD_ENDUNGEN[bildEndung(relativerPfad)] ??
    'application/octet-stream'
  )
}
