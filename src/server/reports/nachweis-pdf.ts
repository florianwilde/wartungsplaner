/**
 * PDF-Nachweis eines ausgefüllten Prüfbogens.
 *
 * Das Ergebnis wird als Anhang an der Durchführung hinterlegt und ist damit
 * Teil der Nachweiskette. Der Aufbau ist bewusst schlicht und vollständig:
 * Kopfdaten, jeder Prüfpunkt mit Befund, Feststellungen und
 * Unterschriftenfelder beider Personen.
 */
import PDFDocument from 'pdfkit'

import { formatDate, formatDateTime } from '@/lib/dates'
import {
  ERGEBNIS_BEZEICHNUNG,
  type PruefpunktArt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'

const SEITE = { breite: 595.28, hoehe: 841.89 }
const RAND = { oben: 56, unten: 56, links: 46, rechts: 46 }
const BREITE = SEITE.breite - RAND.links - RAND.rechts

const FARBE = {
  text: '#111827',
  schwach: '#6b7280',
  linie: '#d1d5db',
  rot: '#b91c1c',
  gruen: '#15803d',
}

export type NachweisPunkt = {
  position: number
  frage: string
  hinweis: string | null
  art: PruefpunktArt
  ergebnis: PruefpunktErgebnis | null
  wert: string | null
  bemerkung: string | null
}

export type NachweisPdfEingabe = {
  anwendung: string
  organisation: string
  markenfarbe: string
  aufgabe: string
  kategorie: string
  faelligAm: Date
  pruefbogen: string
  beschreibung: string | null
  erfasstVon: string
  erfasstAm: Date
  geprueftVon: string | null
  geprueftAm: Date | null
  bemerkung: string | null
  punkte: NachweisPunkt[]
}

type Doc = PDFKit.PDFDocument

/** Legt bei Bedarf eine neue Seite an. */
function platz(doc: Doc, benoetigt: number) {
  if (doc.y + benoetigt > SEITE.hoehe - RAND.unten) {
    doc.addPage()
    doc.y = RAND.oben
  }
}

/** Farbe für ein Ergebnis: Feststellungen fallen ins Auge. */
function ergebnisFarbe(ergebnis: PruefpunktErgebnis | null): string {
  if (ergebnis === 'NICHT_ERFUELLT' || ergebnis === 'ENTZIEHEN') return FARBE.rot
  if (ergebnis === 'ERFUELLT' || ergebnis === 'BELASSEN') return FARBE.gruen
  return FARBE.text
}

/** Lesbare Antwort eines Prüfpunkts. */
function antwortText(punkt: NachweisPunkt): string {
  if (punkt.ergebnis) return ERGEBNIS_BEZEICHNUNG[punkt.ergebnis]
  if (punkt.wert && punkt.wert.trim()) return punkt.wert.trim()
  return 'ohne Angabe'
}

export async function erzeugeNachweisPdf(
  eingabe: NachweisPdfEingabe,
): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: {
      top: RAND.oben,
      bottom: RAND.unten,
      left: RAND.links,
      right: RAND.rechts,
    },
    bufferPages: true,
    info: {
      Title: `Nachweis ${eingabe.pruefbogen} – ${eingabe.aufgabe}`,
      Author: eingabe.erfasstVon,
      Creator: eingabe.organisation || eingabe.anwendung,
      Subject: `Prüfnachweis zur Fälligkeit vom ${formatDate(eingabe.faelligAm)}`,
    },
  })

  const teile: Buffer[] = []
  doc.on('data', (teil: Buffer) => teile.push(teil))
  const fertig = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(teile)))
    doc.on('error', reject)
  })

  // --- Titel -----------------------------------------------------------
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(FARBE.schwach)
    .text(eingabe.organisation || eingabe.anwendung, RAND.links, RAND.oben)

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor(FARBE.text)
    .text('Prüfnachweis', RAND.links, doc.y + 2)

  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(eingabe.markenfarbe)
    .text(eingabe.pruefbogen, RAND.links, doc.y + 2)

  doc
    .moveTo(RAND.links, doc.y + 8)
    .lineTo(RAND.links + BREITE, doc.y + 8)
    .lineWidth(1)
    .strokeColor(eingabe.markenfarbe)
    .stroke()

  doc.y += 18

  // --- Kopfdaten -------------------------------------------------------
  const kopfdaten: [string, string][] = [
    ['Aufgabe', eingabe.aufgabe],
    ['Kategorie', eingabe.kategorie],
    ['Soll-Fälligkeit', formatDate(eingabe.faelligAm)],
    ['Erfasst von', `${eingabe.erfasstVon} · ${formatDateTime(eingabe.erfasstAm)}`],
    [
      'Gegengezeichnet von',
      eingabe.geprueftVon && eingabe.geprueftAm
        ? `${eingabe.geprueftVon} · ${formatDateTime(eingabe.geprueftAm)}`
        : 'ohne Gegenzeichnung',
    ],
  ]

  for (const [bezeichnung, wert] of kopfdaten) {
    platz(doc, 16)
    const y = doc.y
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(FARBE.schwach)
      .text(bezeichnung, RAND.links, y, { width: 130, lineBreak: false })
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(FARBE.text)
      .text(wert, RAND.links + 135, y, { width: BREITE - 135 })
    doc.y += 3
  }

  if (eingabe.beschreibung) {
    doc.y += 6
    platz(doc, 30)
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(FARBE.schwach)
      .text(eingabe.beschreibung, RAND.links, doc.y, { width: BREITE })
  }

  doc.y += 16

  // --- Prüfpunkte ------------------------------------------------------
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor(FARBE.text)
    .text('Prüfpunkte', RAND.links, doc.y, { width: BREITE })
  doc.y += 6

  for (const punkt of eingabe.punkte) {
    // Höhe grob abschätzen, damit ein Punkt nicht mitten im Satz umbricht.
    doc.font('Helvetica').fontSize(9)
    const frageHoehe = doc.heightOfString(`${punkt.position}. ${punkt.frage}`, {
      width: BREITE - 130,
    })
    platz(doc, frageHoehe + 34)

    const y = doc.y

    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(FARBE.text)
      .text(`${punkt.position}. ${punkt.frage}`, RAND.links, y, {
        width: BREITE - 130,
      })

    doc
      .font('Helvetica-Bold')
      .fontSize(9.5)
      .fillColor(ergebnisFarbe(punkt.ergebnis))
      .text(antwortText(punkt), RAND.links + BREITE - 125, y, {
        width: 125,
        align: 'right',
      })

    // Der tiefere der beiden Blöcke bestimmt die neue Position.
    doc.y = Math.max(doc.y, y + frageHoehe)

    if (punkt.hinweis) {
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(FARBE.schwach)
        .text(punkt.hinweis, RAND.links + 12, doc.y + 2, { width: BREITE - 140 })
    }

    if (punkt.bemerkung) {
      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(FARBE.text)
        .text(`Bemerkung: ${punkt.bemerkung}`, RAND.links + 12, doc.y + 2, {
          width: BREITE - 24,
        })
    }

    doc.y += 8
    doc
      .moveTo(RAND.links, doc.y)
      .lineTo(RAND.links + BREITE, doc.y)
      .lineWidth(0.4)
      .strokeColor(FARBE.linie)
      .stroke()
    doc.y += 6
  }

  // --- Zusammenfassende Bemerkung --------------------------------------
  if (eingabe.bemerkung) {
    doc.y += 8
    platz(doc, 50)
    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(FARBE.text)
      .text('Bemerkung zur Durchführung', RAND.links, doc.y, { width: BREITE })
    doc.y += 4
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(FARBE.text)
      .text(eingabe.bemerkung, RAND.links, doc.y, { width: BREITE })
  }

  // --- Unterschriften --------------------------------------------------
  platz(doc, 110)
  const unterschriftY = doc.y + 46
  const feldBreite = (BREITE - 40) / 2

  const feld = (x: number, beschriftung: string, person: string | null) => {
    doc
      .moveTo(x, unterschriftY)
      .lineTo(x + feldBreite, unterschriftY)
      .lineWidth(0.7)
      .strokeColor(FARBE.text)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(FARBE.schwach)
      .text(beschriftung, x, unterschriftY + 5, { width: feldBreite, lineBreak: false })

    if (person) {
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(FARBE.text)
        .text(person, x, unterschriftY - 14, { width: feldBreite, lineBreak: false })
    }
  }

  feld(RAND.links, 'Datum, Unterschrift (Durchführung)', eingabe.erfasstVon)
  feld(
    RAND.links + feldBreite + 40,
    'Datum, Unterschrift (Gegenzeichnung)',
    eingabe.geprueftVon,
  )

  doc.y = unterschriftY + 26

  // --- Fußzeile auf allen Seiten ---------------------------------------
  const bereich = doc.bufferedPageRange()
  for (let i = 0; i < bereich.count; i++) {
    doc.switchToPage(bereich.start + i)
    const raender = { ...doc.page.margins }
    doc.page.margins = { top: 0, bottom: 0, left: RAND.links, right: RAND.rechts }

    const fussY = SEITE.hoehe - 38
    doc
      .moveTo(RAND.links, fussY - 8)
      .lineTo(RAND.links + BREITE, fussY - 8)
      .lineWidth(0.4)
      .strokeColor(FARBE.linie)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(FARBE.schwach)
      .text(
        `${eingabe.anwendung} · Prüfnachweis „${eingabe.pruefbogen}“ zur Fälligkeit vom ${formatDate(eingabe.faelligAm)}`,
        RAND.links,
        fussY,
        { width: BREITE * 0.75, lineBreak: false },
      )
      .text(`Seite ${i + 1} von ${bereich.count}`, RAND.links + BREITE * 0.75, fussY, {
        width: BREITE * 0.25,
        align: 'right',
        lineBreak: false,
      })

    doc.page.margins = raender
  }

  doc.end()
  return fertig
}
