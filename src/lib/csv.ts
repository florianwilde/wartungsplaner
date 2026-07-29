/**
 * Lesen und Schreiben von CSV-Dateien.
 *
 * Bewusst eine eigene, kleine Umsetzung statt einer Fremdbibliothek: Das
 * Format ist überschaubar, und die Eigenheiten deutscher Excel-Installationen
 * (Semikolon als Trennzeichen, BOM für die Zeichensatzerkennung) lassen sich
 * so gezielt bedienen.
 *
 * Alle Funktionen sind rein und damit vollständig testbar.
 */

/** Trennzeichen. Semikolon, weil Excel in deutscher Einstellung das erwartet. */
export const TRENNZEICHEN = ';'

/** Byte Order Mark – ohne diese Kennung zeigt Excel Umlaute falsch an. */
export const BOM = '﻿'

export type CsvZeile = Record<string, string>

/**
 * Zerlegt CSV-Text in Zeilen mit benannten Spalten.
 *
 * Erwartet eine Kopfzeile. Unterstützt Anführungszeichen, darin enthaltene
 * Trennzeichen, Zeilenumbrüche und verdoppelte Anführungszeichen.
 *
 * @throws wenn die Kopfzeile fehlt oder Spaltennamen doppelt vorkommen.
 */
export function leseCsv(text: string): CsvZeile[] {
  const felder = zerlege(text.startsWith(BOM) ? text.slice(1) : text)
  if (felder.length === 0) return []

  const kopf = felder[0].map((spalte) => spalte.trim())
  if (kopf.length === 0 || kopf.every((spalte) => spalte === '')) {
    throw new Error('Die Datei enthält keine Kopfzeile.')
  }

  const doppelt = kopf.filter((spalte, index) => kopf.indexOf(spalte) !== index)
  if (doppelt.length > 0) {
    throw new Error(
      `Die Kopfzeile enthält doppelte Spalten: ${[...new Set(doppelt)].join(', ')}`,
    )
  }

  const zeilen: CsvZeile[] = []
  for (const rohzeile of felder.slice(1)) {
    // Vollständig leere Zeilen überspringen (typisch am Dateiende).
    if (rohzeile.every((wert) => wert.trim() === '')) continue

    const zeile: CsvZeile = {}
    kopf.forEach((spalte, index) => {
      zeile[spalte] = (rohzeile[index] ?? '').trim()
    })
    zeilen.push(zeile)
  }

  return zeilen
}

/** Zerlegt den Text in ein Feld-Raster (Zeilen × Spalten). */
function zerlege(text: string): string[][] {
  const zeilen: string[][] = []
  let zeile: string[] = []
  let feld = ''
  let inAnfuehrung = false

  for (let i = 0; i < text.length; i++) {
    const zeichen = text[i]

    if (inAnfuehrung) {
      if (zeichen === '"') {
        // Verdoppeltes Anführungszeichen steht für ein echtes Anführungszeichen
        if (text[i + 1] === '"') {
          feld += '"'
          i++
        } else {
          inAnfuehrung = false
        }
      } else {
        feld += zeichen
      }
      continue
    }

    if (zeichen === '"') {
      inAnfuehrung = true
    } else if (zeichen === TRENNZEICHEN) {
      zeile.push(feld)
      feld = ''
    } else if (zeichen === '\n') {
      zeile.push(feld)
      zeilen.push(zeile)
      zeile = []
      feld = ''
    } else if (zeichen === '\r') {
      // Wagenrücklauf vor dem Zeilenumbruch übergehen
    } else {
      feld += zeichen
    }
  }

  // Letztes Feld bzw. letzte Zeile ohne abschließenden Umbruch
  if (feld !== '' || zeile.length > 0) {
    zeile.push(feld)
    zeilen.push(zeile)
  }

  return zeilen
}

/** Maskiert einen Wert für die Ausgabe. */
export function maskiereCsvFeld(wert: string): string {
  // Ein führendes =, +, - oder @ könnte von Excel als Formel gedeutet werden.
  // Ein vorangestelltes Apostroph verhindert das ("CSV Injection").
  const entschaerft = /^[=+\-@\t\r]/.test(wert) ? `'${wert}` : wert

  const brauchtAnfuehrung =
    entschaerft.includes(TRENNZEICHEN) ||
    entschaerft.includes('"') ||
    entschaerft.includes('\n') ||
    entschaerft.includes('\r')

  return brauchtAnfuehrung
    ? `"${entschaerft.replace(/"/g, '""')}"`
    : entschaerft
}

/**
 * Erzeugt CSV-Text aus Kopfzeile und Datenzeilen.
 * Die Ausgabe beginnt mit einem BOM und verwendet CRLF als Zeilenende.
 */
export function schreibeCsv(spalten: string[], zeilen: CsvZeile[]): string {
  const ausgabe: string[] = [spalten.map(maskiereCsvFeld).join(TRENNZEICHEN)]

  for (const zeile of zeilen) {
    ausgabe.push(
      spalten.map((spalte) => maskiereCsvFeld(zeile[spalte] ?? '')).join(TRENNZEICHEN),
    )
  }

  return BOM + ausgabe.join('\r\n') + '\r\n'
}

/** Wandelt einen Wahrheitswert in die Textform für den Export. */
export function jaNein(wert: boolean): string {
  return wert ? 'ja' : 'nein'
}

/**
 * Liest einen Wahrheitswert aus dem Import.
 * Akzeptiert die gängigen deutschen und englischen Schreibweisen.
 */
export function leseJaNein(wert: string, standard: boolean): boolean {
  const text = wert.trim().toLowerCase()
  if (text === '') return standard
  if (['ja', 'j', 'wahr', 'true', '1', 'x', 'yes', 'y'].includes(text)) return true
  if (['nein', 'n', 'falsch', 'false', '0', '', 'no'].includes(text)) return false
  return standard
}
