/**
 * Erscheinungsbild: Standardwerte und Ableitung der CSS-Variablen.
 *
 * Der Auslieferungszustand ist bewusst neutral gehalten: ein sachliches Blau
 * und kein Organisationsname. Beides gehört unter
 * `/admin/erscheinungsbild` auf die eigene Marke gesetzt. Dieses Modul
 * enthält bewusst keine Datenbankzugriffe, damit die Ableitung testbar
 * bleibt.
 */
import { leiteFarbschemaAb } from '@/lib/farben'

export type Branding = {
  appName: string
  organisation: string
  primaryColor: string
  accentColor: string
  logoPath: string | null
  logoDarkPath: string | null
  faviconPath: string | null
  reportFooter: string | null
}

/**
 * Auslieferungszustand: neutral.
 *
 * Ohne Organisationsnamen – der Platz gehört der eigenen Firma, und ein
 * fremder Name in Berichten wäre schlimmer als gar keiner. Die Farben sind
 * ein sachliches Blau ohne Markenbezug.
 */
export const STANDARD_BRANDING: Branding = {
  appName: 'Wartungsplaner',
  organisation: '',
  primaryColor: '#2563eb',
  accentColor: '#0ea5e9',
  logoPath: null,
  logoDarkPath: null,
  faviconPath: null,
  reportFooter: null,
}

/** Mitgelieferte Standardlogos (statische Dateien unter /public). */
export const STANDARD_LOGO = '/marke-wortmarke.svg'
export const STANDARD_BILDMARKE = '/marke.svg'

/**
 * Erzeugt den CSS-Block, der die Farbvariablen des Designsystems mit den
 * konfigurierten Markenfarben überschreibt.
 *
 * Die Ausgabe wird im Layout in ein `<style>`-Element geschrieben. Sämtliche
 * Werte durchlaufen vorher `normalisiereHex`, sodass ausschließlich
 * `#rrggbb`-Zeichenketten eingesetzt werden – ein Einschleusen von CSS ist
 * damit ausgeschlossen.
 */
export function baueMarkenCss(primaer: string, akzent: string): string {
  const schema = leiteFarbschemaAb(primaer, akzent)

  return [
    ':root{',
    `--primary:${schema.hell.primary};`,
    `--primary-foreground:${schema.hell.primaryForeground};`,
    `--ring:${schema.hell.ring};`,
    `--accent:${schema.hell.accentSoft};`,
    `--accent-foreground:${schema.hell.accentSoftForeground};`,
    `--marke-primaer:${primaer};`,
    `--marke-akzent:${akzent};`,
    '}',
    '.dark{',
    `--primary:${schema.dunkel.primary};`,
    `--primary-foreground:${schema.dunkel.primaryForeground};`,
    `--ring:${schema.dunkel.ring};`,
    `--accent:${schema.dunkel.accentSoft};`,
    `--accent-foreground:${schema.dunkel.accentSoftForeground};`,
    '}',
  ].join('')
}
