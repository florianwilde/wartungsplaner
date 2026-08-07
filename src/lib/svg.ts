/**
 * Größenbestimmung von SVG-Grafiken.
 *
 * Ein SVG hat keine Pixelgröße, sondern ein Koordinatensystem. Damit das
 * Logo im PDF-Kopf weder verzerrt noch über den Rand hinausragt, muss aus
 * `width`/`height` oder dem `viewBox` ein Seitenverhältnis gewonnen und in
 * den vorgesehenen Kasten eingepasst werden.
 *
 * Reine Funktionen ohne Dateizugriff, damit die Rechnung prüfbar bleibt.
 */

export type Groesse = { breite: number; hoehe: number }

/** Übliches Seitenverhältnis, wenn sich aus der Datei keines ergibt. */
const NOTGROESSE: Groesse = { breite: 300, hoehe: 100 }

/** Liest eine Längenangabe; Einheiten wie px oder pt werden abgeschnitten. */
function alsZahl(wert: string | undefined): number | null {
  if (!wert) return null
  // Prozentangaben beziehen sich auf den Elternrahmen und sagen hier nichts.
  if (wert.includes('%')) return null
  const zahl = Number.parseFloat(wert)
  return Number.isFinite(zahl) && zahl > 0 ? zahl : null
}

/**
 * Ermittelt die natürliche Größe eines SVG.
 *
 * Vorrang hat `viewBox`: `width`/`height` werden von Zeichenprogrammen oft
 * mit einer Anzeigegröße gefüllt, die nichts über das Verhältnis aussagt.
 */
export function ermittleSvgGroesse(quelltext: string): Groesse {
  const anfang = quelltext.slice(0, 4000)

  const viewBox = /viewBox\s*=\s*["']([^"']+)["']/i.exec(anfang)
  if (viewBox) {
    const teile = viewBox[1].trim().split(/[\s,]+/)
    if (teile.length === 4) {
      const breite = Number.parseFloat(teile[2])
      const hoehe = Number.parseFloat(teile[3])
      if (
        Number.isFinite(breite) &&
        Number.isFinite(hoehe) &&
        breite > 0 &&
        hoehe > 0
      ) {
        return { breite, hoehe }
      }
    }
  }

  const breite = alsZahl(/\bwidth\s*=\s*["']([^"']+)["']/i.exec(anfang)?.[1])
  const hoehe = alsZahl(/\bheight\s*=\s*["']([^"']+)["']/i.exec(anfang)?.[1])
  if (breite && hoehe) return { breite, hoehe }

  return NOTGROESSE
}

/**
 * Passt eine Grafik in einen Kasten ein, ohne sie zu verzerren.
 *
 * Kleinere Grafiken werden nicht vergrößert: Ein Logo, das den Kasten nicht
 * füllt, ist besser als eines, das ausfranst.
 */
export function passeEin(natuerlich: Groesse, kasten: Groesse): Groesse {
  if (natuerlich.breite <= 0 || natuerlich.hoehe <= 0) return kasten

  const faktor = Math.min(
    kasten.breite / natuerlich.breite,
    kasten.hoehe / natuerlich.hoehe,
    1,
  )
  return {
    breite: natuerlich.breite * faktor,
    hoehe: natuerlich.hoehe * faktor,
  }
}

/**
 * Sieht der Inhalt nach SVG aus?
 *
 * Geprüft wird der Anfang der Datei, nicht die Endung: Ein umbenanntes PNG
 * würde die Erzeugung des PDF sonst mitten im Lauf scheitern lassen.
 */
export function siehtNachSvgAus(quelltext: string): boolean {
  return /<svg[\s>]/i.test(quelltext.slice(0, 4000))
}
