/**
 * PDF-Erzeugung mit pdfkit.
 *
 * Es werden ausschließlich die eingebauten Standardschriften (Helvetica)
 * verwendet. Deren WinAnsi-Kodierung deckt Umlaute und das Eszett ab, sodass
 * keine Schriftdateien mit ausgeliefert werden müssen.
 *
 * Jede Seite erhält einen Kopf (Anwendung, Bericht, Zeitraum, Filter) und
 * eine Fußzeile mit Erstellungsdatum, erstellender Person und Seitenzahl.
 */
import PDFDocument from 'pdfkit'

import { formatDate, formatDateTime } from '@/lib/dates'
import { formatiereDateigroesse } from '@/lib/labels'
import {
  formatiereProzent,
  type AbweichungZeile,
  type ComplianceReport,
  type HistorieAufgabe,
  type ReportKopf,
  type VorschauZeile,
} from './daten'

const SEITE = { breite: 595.28, hoehe: 841.89 } // A4 Hochformat
const RAND = { oben: 92, unten: 62, links: 40, rechts: 40 }
const INHALT_BREITE = SEITE.breite - RAND.links - RAND.rechts

const FARBE = {
  text: '#111827',
  schwach: '#6b7280',
  linie: '#d1d5db',
  kopfHintergrund: '#f3f4f6',
  akzent: '#1d4ed8',
  rot: '#b91c1c',
  gruen: '#15803d',
}

type Doc = PDFKit.PDFDocument

export type Spalte = {
  kopf: string
  breite: number
  ausrichtung?: 'left' | 'right' | 'center'
}

/** Erzeugt das Dokument und liefert das fertige PDF als Buffer. */
async function baueDokument(
  kopf: ReportKopf,
  zeichne: (doc: Doc) => void,
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
      Title: `Wartungsplaner – ${kopf.titel}`,
      Author: kopf.erstelltVon,
      Creator: 'Wartungsplaner',
      Subject: `Zeitraum ${formatDate(kopf.zeitraum.von)} bis ${formatDate(kopf.zeitraum.bis)}`,
    },
  })

  const teile: Buffer[] = []
  doc.on('data', (teil: Buffer) => teile.push(teil))
  const fertig = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(teile)))
    doc.on('error', reject)
  })

  zeichne(doc)
  zeichneKopfUndFuss(doc, kopf)
  doc.end()

  return fertig
}

/** Zeichnet Kopf- und Fußzeile nachträglich auf alle Seiten. */
function zeichneKopfUndFuss(doc: Doc, kopf: ReportKopf) {
  const bereich = doc.bufferedPageRange()

  for (let i = 0; i < bereich.count; i++) {
    doc.switchToPage(bereich.start + i)

    // Kopf- und Fußzeile liegen außerhalb des Satzspiegels. Ohne diese
    // Anpassung würde pdfkit beim Schreiben der Fußzeile eine weitere Seite
    // anlegen, weil der Text die untere Randgrenze überschreitet.
    const urspruenglicheRaender = { ...doc.page.margins }
    doc.page.margins = { top: 0, bottom: 0, left: RAND.links, right: RAND.rechts }

    // --- Kopfzeile ---
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(FARBE.text)
      .text('Wartungsplaner', RAND.links, 34, { lineBreak: false })

    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(FARBE.akzent)
      .text(kopf.titel, RAND.links + 110, 34, {
        width: INHALT_BREITE - 110,
        align: 'right',
        lineBreak: false,
      })

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(FARBE.schwach)
      .text(
        `Zeitraum ${formatDate(kopf.zeitraum.von)} – ${formatDate(kopf.zeitraum.bis)}`,
        RAND.links,
        54,
        { width: INHALT_BREITE / 2, lineBreak: false },
      )
      .text(`Kategorien: ${kopf.kategorienText}`, RAND.links + INHALT_BREITE / 2, 54, {
        width: INHALT_BREITE / 2,
        align: 'right',
        lineBreak: false,
      })

    doc
      .moveTo(RAND.links, 70)
      .lineTo(SEITE.breite - RAND.rechts, 70)
      .lineWidth(0.5)
      .strokeColor(FARBE.linie)
      .stroke()

    // --- Fußzeile ---
    const fussY = SEITE.hoehe - 44
    doc
      .moveTo(RAND.links, fussY - 8)
      .lineTo(SEITE.breite - RAND.rechts, fussY - 8)
      .lineWidth(0.5)
      .strokeColor(FARBE.linie)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(FARBE.schwach)
      .text(
        `Erstellt am ${formatDateTime(kopf.erstelltAm)} von ${kopf.erstelltVon}`,
        RAND.links,
        fussY,
        { width: INHALT_BREITE * 0.7, lineBreak: false },
      )
      .text(`Seite ${i + 1} von ${bereich.count}`, RAND.links + INHALT_BREITE * 0.7, fussY, {
        width: INHALT_BREITE * 0.3,
        align: 'right',
        lineBreak: false,
      })

    doc.page.margins = urspruenglicheRaender
  }
}

/** Prüft den verbleibenden Platz und legt bei Bedarf eine neue Seite an. */
function sichereHoehe(doc: Doc, benoetigt: number) {
  if (doc.y + benoetigt > SEITE.hoehe - RAND.unten) {
    doc.addPage()
    doc.y = RAND.oben
  }
}

function ueberschrift(doc: Doc, text: string, groesse = 11) {
  sichereHoehe(doc, groesse + 14)
  doc
    .font('Helvetica-Bold')
    .fontSize(groesse)
    .fillColor(FARBE.text)
    .text(text, RAND.links, doc.y, { width: INHALT_BREITE })
  doc.moveDown(0.35)
}

function absatz(doc: Doc, text: string, groesse = 8.5) {
  if (!text) return
  const hoehe = doc.heightOfString(text, { width: INHALT_BREITE })
  sichereHoehe(doc, hoehe)
  doc
    .font('Helvetica')
    .fontSize(groesse)
    .fillColor(FARBE.schwach)
    .text(text, RAND.links, doc.y, { width: INHALT_BREITE })
  doc.moveDown(0.4)
}

/**
 * Zeichnet eine Tabelle mit automatischem Seitenumbruch und wiederholtem
 * Spaltenkopf. `zeilen` enthält je Zelle bereits formatierte Zeichenketten.
 */
function tabelle(
  doc: Doc,
  spalten: Spalte[],
  zeilen: string[][],
  optionen: {
    zeilenFarbe?: (index: number) => string | undefined
    fettZeile?: (index: number) => boolean
    schriftgroesse?: number
  } = {},
) {
  const groesse = optionen.schriftgroesse ?? 8
  const polsterX = 4
  const polsterY = 4

  const zeichneKopf = () => {
    const hoehe = groesse + polsterY * 2
    sichereHoehe(doc, hoehe + 4)
    const y = doc.y

    doc
      .rect(RAND.links, y, INHALT_BREITE, hoehe)
      .fillColor(FARBE.kopfHintergrund)
      .fill()

    let x = RAND.links
    doc.font('Helvetica-Bold').fontSize(groesse).fillColor(FARBE.text)
    for (const spalte of spalten) {
      doc.text(spalte.kopf, x + polsterX, y + polsterY, {
        width: spalte.breite - polsterX * 2,
        align: spalte.ausrichtung ?? 'left',
        lineBreak: false,
        ellipsis: true,
      })
      x += spalte.breite
    }

    doc.y = y + hoehe
  }

  zeichneKopf()

  zeilen.forEach((zeile, index) => {
    // Benötigte Zeilenhöhe anhand der höchsten Zelle bestimmen.
    doc.font('Helvetica').fontSize(groesse)
    let zellenHoehe = groesse + 2
    spalten.forEach((spalte, s) => {
      const hoehe = doc.heightOfString(zeile[s] ?? '', {
        width: spalte.breite - polsterX * 2,
      })
      zellenHoehe = Math.max(zellenHoehe, hoehe)
    })
    const zeilenHoehe = zellenHoehe + polsterY * 2

    if (doc.y + zeilenHoehe > SEITE.hoehe - RAND.unten) {
      doc.addPage()
      doc.y = RAND.oben
      zeichneKopf()
    }

    const y = doc.y

    if (index % 2 === 1) {
      doc
        .rect(RAND.links, y, INHALT_BREITE, zeilenHoehe)
        .fillColor('#fafafa')
        .fill()
    }

    const farbe = optionen.zeilenFarbe?.(index) ?? FARBE.text
    const fett = optionen.fettZeile?.(index) ?? false

    let x = RAND.links
    doc.font(fett ? 'Helvetica-Bold' : 'Helvetica').fontSize(groesse).fillColor(farbe)
    spalten.forEach((spalte, s) => {
      doc.text(zeile[s] ?? '', x + polsterX, y + polsterY, {
        width: spalte.breite - polsterX * 2,
        align: spalte.ausrichtung ?? 'left',
      })
      x += spalte.breite
    })

    doc.y = y + zeilenHoehe
    doc
      .moveTo(RAND.links, doc.y)
      .lineTo(SEITE.breite - RAND.rechts, doc.y)
      .lineWidth(0.4)
      .strokeColor(FARBE.linie)
      .stroke()
  })

  doc.y += 10
}

/** Skaliert Spaltenanteile auf die verfügbare Inhaltsbreite. */
function spalten(
  definition: { kopf: string; anteil: number; ausrichtung?: Spalte['ausrichtung'] }[],
): Spalte[] {
  const summe = definition.reduce((s, d) => s + d.anteil, 0)
  return definition.map((d) => ({
    kopf: d.kopf,
    breite: (d.anteil / summe) * INHALT_BREITE,
    ausrichtung: d.ausrichtung,
  }))
}

// ---------------------------------------------------------------------------
// 1. Compliance-Übersicht
// ---------------------------------------------------------------------------

export function erzeugeCompliancePdf(
  kopf: ReportKopf,
  report: ComplianceReport,
): Promise<Buffer> {
  return baueDokument(kopf, (doc) => {
    doc.y = RAND.oben

    ueberschrift(doc, 'Erfüllungsgrad gesamt')
    absatz(
      doc,
      `Im Zeitraum wurden ${report.gesamt.gesamt} Fälligkeiten betrachtet. ` +
        `Der Erfüllungsgrad beträgt ${formatiereProzent(report.gesamt.erfuellungsgrad)}; ` +
        `${formatiereProzent(report.gesamt.puenktlichkeitsquote)} der erledigten Prüfungen erfolgten pünktlich. ` +
        `Ausgesetzte Fälligkeiten (${report.gesamt.ausgesetzt}) bleiben bei der Berechnung unberücksichtigt.`,
    )

    const spaltenDef = spalten([
      { kopf: 'Kategorie', anteil: 22 },
      { kopf: 'Gesamt', anteil: 9, ausrichtung: 'right' },
      { kopf: 'Pünktlich', anteil: 10, ausrichtung: 'right' },
      { kopf: 'Verspätet', anteil: 10, ausrichtung: 'right' },
      { kopf: 'Offen', anteil: 9, ausrichtung: 'right' },
      { kopf: 'Überfällig', anteil: 11, ausrichtung: 'right' },
      { kopf: 'Ausgesetzt', anteil: 11, ausrichtung: 'right' },
      { kopf: 'Erfüllung', anteil: 9, ausrichtung: 'right' },
      { kopf: 'Pünktl.', anteil: 9, ausrichtung: 'right' },
    ])

    const alleZeilen = [...report.zeilen, report.gesamt]
    const daten = alleZeilen.map((zeile) => [
      zeile.kategorie,
      String(zeile.gesamt),
      String(zeile.puenktlich),
      String(zeile.verspaetet),
      String(zeile.offen),
      String(zeile.ueberfaellig),
      String(zeile.ausgesetzt),
      formatiereProzent(zeile.erfuellungsgrad),
      formatiereProzent(zeile.puenktlichkeitsquote),
    ])

    tabelle(doc, spaltenDef, daten, {
      fettZeile: (index) => index === alleZeilen.length - 1,
      zeilenFarbe: (index) => {
        const zeile = alleZeilen[index]
        if (zeile.ueberfaellig > 0) return FARBE.rot
        if (zeile.gesamt > 0 && zeile.erfuellungsgrad === 1) return FARBE.gruen
        return undefined
      },
    })

    absatz(
      doc,
      'Lesehilfe: „Erfüllung“ ist der Anteil erledigter Fälligkeiten an allen bewertbaren ' +
        'Fälligkeiten des Zeitraums. „Pünktl.“ ist der Anteil der innerhalb von Termin und ' +
        'Karenzfrist erledigten Prüfungen an allen erledigten Prüfungen.',
    )
  })
}

// ---------------------------------------------------------------------------
// 2. Aufgabenhistorie
// ---------------------------------------------------------------------------

export function erzeugeHistoriePdf(
  kopf: ReportKopf,
  aufgaben: HistorieAufgabe[],
): Promise<Buffer> {
  return baueDokument(kopf, (doc) => {
    doc.y = RAND.oben

    if (aufgaben.length === 0) {
      absatz(doc, 'Im gewählten Zeitraum wurde keine Durchführung protokolliert.')
      return
    }

    const spaltenDef = spalten([
      { kopf: 'Soll', anteil: 10 },
      { kopf: 'Durchgeführt', anteil: 12 },
      { kopf: 'Person', anteil: 16 },
      { kopf: 'Ergebnis', anteil: 18 },
      { kopf: 'Termintreue', anteil: 11 },
      { kopf: 'Nachweise', anteil: 10, ausrichtung: 'right' },
      { kopf: 'Abw.', anteil: 7, ausrichtung: 'right' },
    ])

    aufgaben.forEach((aufgabe, index) => {
      if (index > 0) doc.moveDown(0.5)
      ueberschrift(doc, aufgabe.titel)
      absatz(
        doc,
        `Kategorie: ${aufgabe.kategorie} · Verantwortlich: ${aufgabe.verantwortlich} · ` +
          `Intervall: ${aufgabe.intervall} · Audit-Referenz: ${aufgabe.auditReferenz}`,
      )

      tabelle(
        doc,
        spaltenDef,
        aufgabe.durchfuehrungen.map((durchfuehrung) => [
          formatDate(durchfuehrung.sollDatum),
          formatDate(durchfuehrung.istDatum),
          durchfuehrung.person,
          durchfuehrung.ergebnis,
          durchfuehrung.puenktlich ? 'pünktlich' : 'verspätet',
          String(durchfuehrung.nachweise.length),
          String(durchfuehrung.abweichungen),
        ]),
        {
          zeilenFarbe: (i) =>
            aufgabe.durchfuehrungen[i].puenktlich ? undefined : FARBE.rot,
        },
      )

      // Nachweise mit Prüfsummen als Auflistung – für die Nachvollziehbarkeit
      // der Unverändertheit unverzichtbar.
      for (const durchfuehrung of aufgabe.durchfuehrungen) {
        if (durchfuehrung.nachweise.length === 0 && !durchfuehrung.kommentar) continue

        sichereHoehe(doc, 24)
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(FARBE.text)
          .text(
            `Durchführung vom ${formatDate(durchfuehrung.istDatum)} (Soll ${formatDate(durchfuehrung.sollDatum)})`,
            RAND.links + 8,
            doc.y,
            { width: INHALT_BREITE - 8 },
          )

        if (durchfuehrung.kommentar) {
          absatzEingerueckt(doc, `Kommentar: ${durchfuehrung.kommentar}`)
        }

        for (const nachweis of durchfuehrung.nachweise) {
          absatzEingerueckt(
            doc,
            `${nachweis.dateiname} (${formatiereDateigroesse(nachweis.groesseBytes)}) · SHA-256: ${nachweis.sha256}`,
          )
        }
        doc.moveDown(0.3)
      }
    })
  })
}

function absatzEingerueckt(doc: Doc, text: string) {
  const breite = INHALT_BREITE - 16
  const hoehe = doc.heightOfString(text, { width: breite })
  sichereHoehe(doc, hoehe)
  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(FARBE.schwach)
    .text(text, RAND.links + 16, doc.y, { width: breite })
}

// ---------------------------------------------------------------------------
// 3. Abweichungsbericht
// ---------------------------------------------------------------------------

export function erzeugeAbweichungenPdf(
  kopf: ReportKopf,
  abweichungen: AbweichungZeile[],
): Promise<Buffer> {
  return baueDokument(kopf, (doc) => {
    doc.y = RAND.oben

    const offen = abweichungen.filter((a) => a.status !== 'Geschlossen').length
    const ueberFrist = abweichungen.filter((a) => a.fristUeberschritten).length

    ueberschrift(doc, 'Zusammenfassung')
    absatz(
      doc,
      `${abweichungen.length} Abweichungen im Zeitraum, davon ${offen} nicht geschlossen ` +
        `und ${ueberFrist} mit überschrittener Frist.`,
    )

    if (abweichungen.length === 0) {
      absatz(doc, 'Im gewählten Zeitraum wurden keine Abweichungen festgestellt.')
      return
    }

    const spaltenDef = spalten([
      { kopf: 'Abweichung', anteil: 26 },
      { kopf: 'Aufgabe', anteil: 20 },
      { kopf: 'Schwere', anteil: 9 },
      { kopf: 'Status', anteil: 12 },
      { kopf: 'Verantwortlich', anteil: 15 },
      { kopf: 'Frist', anteil: 9 },
      { kopf: 'Festgestellt', anteil: 9 },
    ])

    tabelle(
      doc,
      spaltenDef,
      abweichungen.map((abweichung) => [
        abweichung.titel,
        abweichung.aufgabe,
        abweichung.schwere,
        abweichung.status,
        abweichung.verantwortlich,
        formatDate(abweichung.frist),
        formatDate(abweichung.festgestelltAm),
      ]),
      {
        zeilenFarbe: (index) =>
          abweichungen[index].fristUeberschritten ? FARBE.rot : undefined,
      },
    )

    ueberschrift(doc, 'Feststellungen und Maßnahmen im Detail')
    for (const abweichung of abweichungen) {
      sichereHoehe(doc, 40)
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(FARBE.text)
        .text(`${abweichung.titel} (${abweichung.schwere}, ${abweichung.status})`, RAND.links, doc.y, {
          width: INHALT_BREITE,
        })

      absatzEingerueckt(
        doc,
        `Aufgabe: ${abweichung.aufgabe} · Kategorie: ${abweichung.kategorie} · ` +
          `Verantwortlich: ${abweichung.verantwortlich} · Frist: ${formatDate(abweichung.frist)}` +
          (abweichung.geschlossenAm
            ? ` · geschlossen am ${formatDate(abweichung.geschlossenAm)}`
            : ''),
      )
      if (abweichung.beschreibung) {
        absatzEingerueckt(doc, `Feststellung: ${abweichung.beschreibung}`)
      }
      if (abweichung.massnahme) {
        absatzEingerueckt(doc, `Umgesetzte Maßnahme: ${abweichung.massnahme}`)
      }
      doc.moveDown(0.5)
    }
  })
}

// ---------------------------------------------------------------------------
// 4. Fälligkeitsvorschau
// ---------------------------------------------------------------------------

export function erzeugeVorschauPdf(
  kopf: ReportKopf,
  zeilen: VorschauZeile[],
): Promise<Buffer> {
  return baueDokument(kopf, (doc) => {
    doc.y = RAND.oben

    ueberschrift(doc, 'Kommende Prüfungen')
    absatz(
      doc,
      `${zeilen.length} Termine im Vorschauzeitraum. Termine ohne bereits angelegte ` +
        'Fälligkeit sind als „geplant“ gekennzeichnet – sie ergeben sich rechnerisch ' +
        'aus dem hinterlegten Intervall.',
    )

    if (zeilen.length === 0) {
      absatz(doc, 'Im Vorschauzeitraum steht keine Prüfung an.')
      return
    }

    const spaltenDef = spalten([
      { kopf: 'Termin', anteil: 10 },
      { kopf: 'Aufgabe', anteil: 30 },
      { kopf: 'Kategorie', anteil: 15 },
      { kopf: 'Verantwortlich', anteil: 16 },
      { kopf: 'Intervall', anteil: 14 },
      { kopf: 'Kritikalität', anteil: 9 },
      { kopf: 'Art', anteil: 8 },
    ])

    tabelle(
      doc,
      spaltenDef,
      zeilen.map((zeile) => [
        formatDate(zeile.datum),
        zeile.aufgabe,
        zeile.kategorie,
        zeile.verantwortlich,
        zeile.intervall,
        zeile.kritikalitaet,
        zeile.bestehend ? 'angelegt' : 'geplant',
      ]),
    )
  })
}
