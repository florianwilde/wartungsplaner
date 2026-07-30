/**
 * Logo für die PDF-Berichte.
 *
 * pdfkit bettet von Haus aus nur PNG und JPEG ein. Ein SVG – das übliche
 * Format für ein Firmenlogo – blieb deshalb bisher der Oberfläche
 * vorbehalten, und die Berichte trugen nur den Namen der Organisation.
 *
 * `svg-to-pdfkit` zeichnet die Pfade unmittelbar in das Dokument: Das Logo
 * bleibt eine Vektorgrafik und ist auch im Ausdruck scharf.
 */
import { readFile } from 'node:fs/promises'

import SVGtoPDF from 'svg-to-pdfkit'

import { ermittleSvgGroesse, passeEin, siehtNachSvgAus } from '@/lib/svg'

/** Was das PDF zum Zeichnen des Logos braucht. */
export type ReportLogo =
  | { art: 'bild'; pfad: string }
  | { art: 'svg'; quelltext: string; breite: number; hoehe: number }

/**
 * Liest das hinterlegte Logo.
 *
 * Ein Fehler darf den Bericht nie verhindern – ohne Logo trägt er den Namen
 * der Organisation, und das genügt.
 */
export async function ladeReportLogo(
  absoluterPfad: string | null,
): Promise<ReportLogo | null> {
  if (!absoluterPfad) return null

  if (/\.(png|jpe?g)$/i.test(absoluterPfad)) {
    return { art: 'bild', pfad: absoluterPfad }
  }

  if (!/\.svg$/i.test(absoluterPfad)) return null

  try {
    const quelltext = await readFile(absoluterPfad, 'utf8')
    // Auf den Inhalt sehen, nicht auf die Endung: Ein umbenanntes PNG würde
    // die Erzeugung sonst mitten im Lauf abbrechen.
    if (!siehtNachSvgAus(quelltext)) return null

    const groesse = ermittleSvgGroesse(quelltext)
    return { art: 'svg', quelltext, breite: groesse.breite, hoehe: groesse.hoehe }
  } catch (error) {
    console.error('Logo nicht lesbar:', error)
    return null
  }
}

/**
 * Zeichnet das Logo in einen Kasten und meldet die belegte Breite.
 *
 * Die Rückgabe erlaubt es der Kopfzeile, den Text daneben zu setzen, statt
 * einen festen Abstand zu raten.
 */
export function zeichneLogo(
  doc: PDFKit.PDFDocument,
  logo: ReportLogo | null,
  x: number,
  y: number,
  maxBreite: number,
  maxHoehe: number,
): number {
  if (!logo) return 0

  try {
    if (logo.art === 'bild') {
      doc.image(logo.pfad, x, y, { fit: [maxBreite, maxHoehe] })
      return maxBreite
    }

    const { breite, hoehe } = passeEin(
      { breite: logo.breite, hoehe: logo.hoehe },
      { breite: maxBreite, hoehe: maxHoehe },
    )
    SVGtoPDF(doc, logo.quelltext, x, y, {
      width: breite,
      height: hoehe,
      preserveAspectRatio: 'xMinYMin meet',
      // Schriften im SVG werden nicht nachgeladen; verlässlich ist nur, was
      // als Pfad vorliegt. Text im Logo bleibt in der Standardschrift.
      fontCallback: () => 'Helvetica',
      assumePt: true,
    })
    return breite
  } catch (error) {
    console.error('Logo konnte nicht eingebettet werden:', error)
    return 0
  }
}
