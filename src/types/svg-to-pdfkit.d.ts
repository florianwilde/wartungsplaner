/**
 * Typen für `svg-to-pdfkit`; das Paket bringt keine mit.
 *
 * Beschrieben ist nur, was hier verwendet wird – eine vollständige
 * Nachbildung der Schnittstelle wäre Pflegeaufwand ohne Gegenwert.
 */
declare module 'svg-to-pdfkit' {
  type Optionen = {
    width?: number
    height?: number
    preserveAspectRatio?: string
    /** Liefert den Namen der Schrift, die für Text im SVG genutzt wird. */
    fontCallback?: (familie: string, fett: boolean, kursiv: boolean) => string
    /** Längen ohne Einheit als Punkt statt Pixel auffassen. */
    assumePt?: boolean
  }

  export default function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x?: number,
    y?: number,
    optionen?: Optionen,
  ): void
}
