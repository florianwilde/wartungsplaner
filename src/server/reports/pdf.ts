/**
 * PDF-Erzeugung mit pdfkit.
 *
 * Es werden ausschließlich die eingebauten Standardschriften (Helvetica)
 * verwendet. Deren WinAnsi-Kodierung deckt Umlaute und das Eszett ab, sodass
 * keine Schriftdateien mit ausgeliefert werden müssen.
 *
 * Aufbau und Umfang richten sich nach der gewählten Vorlage: Ausrichtung,
 * Spaltenauswahl, Deckblatt, Freitextblöcke und Unterschriftenfelder.
 * Jede Seite erhält einen Kopf und eine Fußzeile mit Seitenzahl.
 */
import PDFDocument from 'pdfkit'

import { formatDate, formatDateTime } from '@/lib/dates'
import { formatiereDateigroesse } from '@/lib/labels'
import {
  seitenMasse,
  spaltenAusSchluesseln,
  type ReportVorlage,
} from '@/lib/report-vorlagen'
import {
  formatiereProzent,
  type AbweichungZeile,
  type ComplianceReport,
  type HistorieAufgabe,
  type NachweisRegisterZeile,
  type ReportKopf,
  type VorschauZeile,
} from './daten'
import { zeichneLogo } from './logo'

const RAND = { oben: 92, unten: 62, links: 40, rechts: 40 }

const FARBE = {
  text: '#111827',
  schwach: '#6b7280',
  linie: '#d1d5db',
  kopfHintergrund: '#f3f4f6',
  zebra: '#fafafa',
  rot: '#b91c1c',
  gruen: '#15803d',
}

type Doc = PDFKit.PDFDocument

export type Spalte = {
  kopf: string
  breite: number
  ausrichtung?: 'left' | 'right' | 'center'
}

/** Zeichenkontext: Maße hängen von der Ausrichtung der Vorlage ab. */
type Kontext = {
  seite: { breite: number; hoehe: number }
  inhaltBreite: number
}

function kontextFuer(vorlage: ReportVorlage): Kontext {
  const seite = seitenMasse(vorlage.ausrichtung)
  return { seite, inhaltBreite: seite.breite - RAND.links - RAND.rechts }
}

/** Erzeugt das Dokument und liefert das fertige PDF als Buffer. */
async function baueDokument(
  kopf: ReportKopf,
  vorlage: ReportVorlage,
  zeichne: (doc: Doc, k: Kontext) => void,
): Promise<Buffer> {
  const k = kontextFuer(vorlage)

  const doc = new PDFDocument({
    size: [k.seite.breite, k.seite.hoehe],
    margins: {
      top: RAND.oben,
      bottom: RAND.unten,
      left: RAND.links,
      right: RAND.rechts,
    },
    bufferPages: true,
    info: {
      Title: `${kopf.anwendung} – ${kopf.titel}`,
      Author: kopf.erstelltVon,
      Creator: kopf.organisation || kopf.anwendung,
      Subject: `Zeitraum ${formatDate(kopf.zeitraum.von)} bis ${formatDate(kopf.zeitraum.bis)}`,
    },
  })

  const teile: Buffer[] = []
  doc.on('data', (teil: Buffer) => teile.push(teil))
  const fertig = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(teile)))
    doc.on('error', reject)
  })

  let ersteInhaltsseite = 0
  if (vorlage.mitDeckblatt) {
    zeichneDeckblatt(doc, k, kopf, vorlage)
    doc.addPage()
    ersteInhaltsseite = 1
  }

  doc.y = RAND.oben
  if (vorlage.einleitung) {
    absatz(doc, k, vorlage.einleitung, 9)
    doc.moveDown(0.5)
  }

  zeichne(doc, k)

  if (vorlage.schluss) {
    doc.moveDown(0.5)
    absatz(doc, k, vorlage.schluss, 9)
  }

  if (vorlage.mitUnterschriften) {
    zeichneUnterschriften(doc, k, vorlage)
  }

  zeichneKopfUndFuss(doc, k, kopf, ersteInhaltsseite)
  doc.end()

  return fertig
}

/** Deckblatt mit Titel, Zeitraum und Eckdaten. */
function zeichneDeckblatt(
  doc: Doc,
  k: Kontext,
  kopf: ReportKopf,
  vorlage: ReportVorlage,
) {
  const mitte = k.seite.hoehe / 2 - 120

  zeichneLogo(doc, kopf.logo, RAND.links, mitte - 90, 180, 50)

  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor(FARBE.schwach)
    .text(kopf.organisation || kopf.anwendung, RAND.links, mitte - 24, {
      width: k.inhaltBreite,
    })

  doc
    .font('Helvetica-Bold')
    .fontSize(28)
    .fillColor(FARBE.text)
    .text(kopf.titel, RAND.links, mitte, { width: k.inhaltBreite })

  if (vorlage.deckblattUntertitel) {
    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(kopf.markenfarbe)
      .text(vorlage.deckblattUntertitel, RAND.links, doc.y + 6, {
        width: k.inhaltBreite,
      })
  }

  doc
    .moveTo(RAND.links, doc.y + 18)
    .lineTo(RAND.links + 160, doc.y + 18)
    .lineWidth(2)
    .strokeColor(kopf.markenfarbe)
    .stroke()

  const eckdaten: [string, string][] = [
    [
      'Zeitraum',
      `${formatDate(kopf.zeitraum.von)} bis ${formatDate(kopf.zeitraum.bis)}`,
    ],
    ['Kategorien', kopf.kategorienText],
    ['Erstellt am', formatDateTime(kopf.erstelltAm)],
    ['Erstellt von', kopf.erstelltVon],
  ]

  let y = doc.y + 36
  for (const [bezeichnung, wert] of eckdaten) {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(FARBE.schwach)
      .text(bezeichnung, RAND.links, y, { width: 110, lineBreak: false })
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(FARBE.text)
      .text(wert, RAND.links + 120, y, { width: k.inhaltBreite - 120 })
    y = doc.y + 8
  }

  if (kopf.fussnote) {
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(FARBE.schwach)
      .text(kopf.fussnote, RAND.links, k.seite.hoehe - 120, {
        width: k.inhaltBreite,
      })
  }
}

/** Unterschriftenfelder am Ende des Berichts. */
function zeichneUnterschriften(doc: Doc, k: Kontext, vorlage: ReportVorlage) {
  const benoetigt = 90
  if (doc.y + benoetigt > k.seite.hoehe - RAND.unten) {
    doc.addPage()
    doc.y = RAND.oben
  }

  const y = doc.y + 40
  const breite = (k.inhaltBreite - 40) / 2

  const feld = (x: number, beschriftung: string) => {
    doc
      .moveTo(x, y)
      .lineTo(x + breite, y)
      .lineWidth(0.7)
      .strokeColor(FARBE.text)
      .stroke()

    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(FARBE.schwach)
      .text(beschriftung, x, y + 5, { width: breite, lineBreak: false })
  }

  feld(RAND.links, vorlage.unterschriftLinks || 'Datum, Unterschrift (Durchführung)')
  feld(
    RAND.links + breite + 40,
    vorlage.unterschriftRechts || 'Datum, Unterschrift (Prüfung)',
  )

  doc.y = y + 24
}

/** Zeichnet Kopf- und Fußzeile nachträglich auf alle Inhaltsseiten. */
function zeichneKopfUndFuss(
  doc: Doc,
  k: Kontext,
  kopf: ReportKopf,
  ersteInhaltsseite: number,
) {
  const bereich = doc.bufferedPageRange()
  const inhaltsseiten = bereich.count - ersteInhaltsseite

  for (let i = ersteInhaltsseite; i < bereich.count; i++) {
    doc.switchToPage(bereich.start + i)

    // Kopf- und Fußzeile liegen außerhalb des Satzspiegels. Ohne diese
    // Anpassung würde pdfkit beim Schreiben der Fußzeile eine weitere Seite
    // anlegen, weil der Text die untere Randgrenze überschreitet.
    const urspruenglicheRaender = { ...doc.page.margins }
    doc.page.margins = { top: 0, bottom: 0, left: RAND.links, right: RAND.rechts }

    // --- Kopfzeile ---
    // Die belegte Breite kommt zurück, damit der Text daneben passt, statt
    // einen festen Abstand zu raten.
    const logoBreite = zeichneLogo(doc, kopf.logo, RAND.links, 26, 130, 26)
    let textAbstand = logoBreite > 0 ? logoBreite + 10 : 0

    if (!textAbstand) {
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor(FARBE.text)
        .text(kopf.anwendung, RAND.links, 30, { lineBreak: false })
      textAbstand = 150
    }

    doc
      .font('Helvetica')
      .fontSize(14)
      .fillColor(kopf.markenfarbe)
      .text(kopf.titel, RAND.links + textAbstand, 30, {
        width: k.inhaltBreite - textAbstand,
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
        { width: k.inhaltBreite / 2, lineBreak: false },
      )
      .text(`Kategorien: ${kopf.kategorienText}`, RAND.links + k.inhaltBreite / 2, 54, {
        width: k.inhaltBreite / 2,
        align: 'right',
        lineBreak: false,
      })

    doc
      .moveTo(RAND.links, 70)
      .lineTo(k.seite.breite - RAND.rechts, 70)
      .lineWidth(1)
      .strokeColor(kopf.markenfarbe)
      .stroke()

    // --- Fußzeile ---
    const fussY = k.seite.hoehe - 44
    doc
      .moveTo(RAND.links, fussY - 8)
      .lineTo(k.seite.breite - RAND.rechts, fussY - 8)
      .lineWidth(0.5)
      .strokeColor(FARBE.linie)
      .stroke()

    const fussLinks = [
      kopf.organisation,
      `Erstellt am ${formatDateTime(kopf.erstelltAm)} von ${kopf.erstelltVon}`,
    ]
      .filter(Boolean)
      .join(' · ')

    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(FARBE.schwach)
      .text(fussLinks, RAND.links, fussY, {
        width: k.inhaltBreite * 0.7,
        lineBreak: false,
      })
      .text(
        `Seite ${i - ersteInhaltsseite + 1} von ${inhaltsseiten}`,
        RAND.links + k.inhaltBreite * 0.7,
        fussY,
        { width: k.inhaltBreite * 0.3, align: 'right', lineBreak: false },
      )

    if (kopf.fussnote) {
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(FARBE.schwach)
        .text(kopf.fussnote, RAND.links, fussY + 10, {
          width: k.inhaltBreite,
          align: 'center',
          lineBreak: false,
        })
    }

    doc.page.margins = urspruenglicheRaender
  }
}

/** Prüft den verbleibenden Platz und legt bei Bedarf eine neue Seite an. */
function sichereHoehe(doc: Doc, k: Kontext, benoetigt: number) {
  if (doc.y + benoetigt > k.seite.hoehe - RAND.unten) {
    doc.addPage()
    doc.y = RAND.oben
  }
}

function ueberschrift(doc: Doc, k: Kontext, text: string, groesse = 11) {
  sichereHoehe(doc, k, groesse + 14)
  doc
    .font('Helvetica-Bold')
    .fontSize(groesse)
    .fillColor(FARBE.text)
    .text(text, RAND.links, doc.y, { width: k.inhaltBreite })
  doc.moveDown(0.35)
}

function absatz(doc: Doc, k: Kontext, text: string, groesse = 8.5) {
  if (!text) return
  doc.font('Helvetica').fontSize(groesse)
  const hoehe = doc.heightOfString(text, { width: k.inhaltBreite })
  sichereHoehe(doc, k, hoehe)
  doc.fillColor(FARBE.schwach).text(text, RAND.links, doc.y, { width: k.inhaltBreite })
  doc.moveDown(0.4)
}

function absatzEingerueckt(doc: Doc, k: Kontext, text: string) {
  const breite = k.inhaltBreite - 16
  doc.font('Helvetica').fontSize(7)
  const hoehe = doc.heightOfString(text, { width: breite })
  sichereHoehe(doc, k, hoehe)
  doc.fillColor(FARBE.schwach).text(text, RAND.links + 16, doc.y, { width: breite })
}

/**
 * Zeichnet eine Tabelle mit automatischem Seitenumbruch und wiederholtem
 * Spaltenkopf. `zeilen` enthält je Zelle bereits formatierte Zeichenketten.
 */
function tabelle(
  doc: Doc,
  k: Kontext,
  spalten: Spalte[],
  zeilen: string[][],
  optionen: {
    zeilenFarbe?: (index: number) => string | undefined
    fettZeile?: (index: number) => boolean
    schriftgroesse?: number
  } = {},
) {
  if (spalten.length === 0) return

  const groesse = optionen.schriftgroesse ?? 8
  const polsterX = 4
  const polsterY = 4

  const zeichneKopf = () => {
    const hoehe = groesse + polsterY * 2
    sichereHoehe(doc, k, hoehe + 4)
    const y = doc.y

    doc
      .rect(RAND.links, y, k.inhaltBreite, hoehe)
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
    doc.font('Helvetica').fontSize(groesse)
    let zellenHoehe = groesse + 2
    spalten.forEach((spalte, s) => {
      const hoehe = doc.heightOfString(zeile[s] ?? '', {
        width: spalte.breite - polsterX * 2,
      })
      zellenHoehe = Math.max(zellenHoehe, hoehe)
    })
    const zeilenHoehe = zellenHoehe + polsterY * 2

    if (doc.y + zeilenHoehe > k.seite.hoehe - RAND.unten) {
      doc.addPage()
      doc.y = RAND.oben
      zeichneKopf()
    }

    const y = doc.y

    if (index % 2 === 1) {
      doc.rect(RAND.links, y, k.inhaltBreite, zeilenHoehe).fillColor(FARBE.zebra).fill()
    }

    const farbe = optionen.zeilenFarbe?.(index) ?? FARBE.text
    const fett = optionen.fettZeile?.(index) ?? false

    let x = RAND.links
    doc
      .font(fett ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(groesse)
      .fillColor(farbe)
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
      .lineTo(k.seite.breite - RAND.rechts, doc.y)
      .lineWidth(0.4)
      .strokeColor(FARBE.linie)
      .stroke()
  })

  doc.y += 10
}

/**
 * Baut die Spalten der Vorlage auf die verfügbare Breite um.
 * Die Anteile aus dem Katalog werden dabei auf 100 % normiert.
 */
function spaltenFuer(
  vorlage: ReportVorlage,
  k: Kontext,
): { spalten: Spalte[]; schluessel: string[] } {
  const definitionen = spaltenAusSchluesseln(vorlage.typ, vorlage.spalten)
  const summe = definitionen.reduce((s, d) => s + d.anteil, 0) || 1

  return {
    spalten: definitionen.map((d) => ({
      kopf: d.kopf,
      breite: (d.anteil / summe) * k.inhaltBreite,
      ausrichtung: d.ausrichtung,
    })),
    schluessel: definitionen.map((d) => d.key),
  }
}

/** Wählt aus einem Datensatz die Werte der gewählten Spalten. */
function zeileAus(werte: Record<string, string>, schluessel: string[]): string[] {
  return schluessel.map((k) => werte[k] ?? '')
}

// ---------------------------------------------------------------------------
// 1. Compliance-Übersicht
// ---------------------------------------------------------------------------

export function erzeugeCompliancePdf(
  kopf: ReportKopf,
  report: ComplianceReport,
  vorlage: ReportVorlage,
): Promise<Buffer> {
  return baueDokument(kopf, vorlage, (doc, k) => {
    ueberschrift(doc, k, 'Erfüllungsgrad gesamt')
    absatz(
      doc,
      k,
      `Im Zeitraum wurden ${report.gesamt.gesamt} Fälligkeiten betrachtet. ` +
        `Der Erfüllungsgrad beträgt ${formatiereProzent(report.gesamt.erfuellungsgrad)}; ` +
        `${formatiereProzent(report.gesamt.puenktlichkeitsquote)} der erledigten Prüfungen erfolgten pünktlich. ` +
        `Ausgesetzte Fälligkeiten (${report.gesamt.ausgesetzt}) bleiben bei der Berechnung unberücksichtigt.`,
    )

    const { spalten, schluessel } = spaltenFuer(vorlage, k)
    const alleZeilen = [...report.zeilen, report.gesamt]

    tabelle(
      doc,
      k,
      spalten,
      alleZeilen.map((zeile) =>
        zeileAus(
          {
            kategorie: zeile.kategorie,
            gesamt: String(zeile.gesamt),
            puenktlich: String(zeile.puenktlich),
            verspaetet: String(zeile.verspaetet),
            offen: String(zeile.offen),
            ueberfaellig: String(zeile.ueberfaellig),
            ausgesetzt: String(zeile.ausgesetzt),
            erfuellung: formatiereProzent(zeile.erfuellungsgrad),
            puenktlichkeit: formatiereProzent(zeile.puenktlichkeitsquote),
          },
          schluessel,
        ),
      ),
      {
        fettZeile: (index) => index === alleZeilen.length - 1,
        zeilenFarbe: (index) => {
          const zeile = alleZeilen[index]
          if (zeile.ueberfaellig > 0) return FARBE.rot
          if (zeile.gesamt > 0 && zeile.erfuellungsgrad === 1) return FARBE.gruen
          return undefined
        },
      },
    )

    absatz(
      doc,
      k,
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
  vorlage: ReportVorlage,
): Promise<Buffer> {
  return baueDokument(kopf, vorlage, (doc, k) => {
    if (aufgaben.length === 0) {
      absatz(doc, k, 'Im gewählten Zeitraum wurde keine Durchführung protokolliert.')
      return
    }

    const { spalten, schluessel } = spaltenFuer(vorlage, k)

    aufgaben.forEach((aufgabe, index) => {
      if (index > 0) doc.moveDown(0.5)
      ueberschrift(doc, k, aufgabe.titel)
      absatz(
        doc,
        k,
        `Kategorie: ${aufgabe.kategorie} · Verantwortlich: ${aufgabe.verantwortlich} · ` +
          `Intervall: ${aufgabe.intervall} · Audit-Referenz: ${aufgabe.auditReferenz}`,
      )

      tabelle(
        doc,
        k,
        spalten,
        aufgabe.durchfuehrungen.map((d) =>
          zeileAus(
            {
              soll: formatDate(d.sollDatum),
              ist: formatDate(d.istDatum),
              person: d.person,
              ergebnis: d.ergebnis,
              termintreue: d.puenktlich ? 'pünktlich' : 'verspätet',
              nachweise: String(d.nachweise.length),
              abweichungen: String(d.abweichungen),
              kommentar: d.kommentar,
            },
            schluessel,
          ),
        ),
        {
          zeilenFarbe: (i) =>
            aufgabe.durchfuehrungen[i].puenktlich ? undefined : FARBE.rot,
        },
      )

      // Nachweise mit Prüfsummen als Auflistung – für die Nachvollziehbarkeit
      // der Unverändertheit unverzichtbar.
      for (const durchfuehrung of aufgabe.durchfuehrungen) {
        if (durchfuehrung.nachweise.length === 0 && !durchfuehrung.kommentar) continue

        sichereHoehe(doc, k, 24)
        doc
          .font('Helvetica-Bold')
          .fontSize(7.5)
          .fillColor(FARBE.text)
          .text(
            `Durchführung vom ${formatDate(durchfuehrung.istDatum)} (Soll ${formatDate(durchfuehrung.sollDatum)})`,
            RAND.links + 8,
            doc.y,
            { width: k.inhaltBreite - 8 },
          )

        if (durchfuehrung.kommentar) {
          absatzEingerueckt(doc, k, `Kommentar: ${durchfuehrung.kommentar}`)
        }

        for (const nachweis of durchfuehrung.nachweise) {
          absatzEingerueckt(
            doc,
            k,
            `${nachweis.dateiname} (${formatiereDateigroesse(nachweis.groesseBytes)}) · SHA-256: ${nachweis.sha256}`,
          )
        }
        doc.moveDown(0.3)
      }
    })
  })
}

// ---------------------------------------------------------------------------
// 3. Abweichungsbericht
// ---------------------------------------------------------------------------

export function erzeugeAbweichungenPdf(
  kopf: ReportKopf,
  abweichungen: AbweichungZeile[],
  vorlage: ReportVorlage,
): Promise<Buffer> {
  return baueDokument(kopf, vorlage, (doc, k) => {
    const offen = abweichungen.filter((a) => a.status !== 'Geschlossen').length
    const ueberFrist = abweichungen.filter((a) => a.fristUeberschritten).length

    ueberschrift(doc, k, 'Zusammenfassung')
    absatz(
      doc,
      k,
      `${abweichungen.length} Abweichungen im Zeitraum, davon ${offen} nicht geschlossen ` +
        `und ${ueberFrist} mit überschrittener Frist.`,
    )

    if (abweichungen.length === 0) {
      absatz(doc, k, 'Im gewählten Zeitraum wurden keine Abweichungen festgestellt.')
      return
    }

    const { spalten, schluessel } = spaltenFuer(vorlage, k)

    tabelle(
      doc,
      k,
      spalten,
      abweichungen.map((a) =>
        zeileAus(
          {
            titel: a.titel,
            aufgabe: a.aufgabe,
            kategorie: a.kategorie,
            schwere: a.schwere,
            status: a.status,
            verantwortlich: a.verantwortlich,
            frist: formatDate(a.frist),
            festgestellt: formatDate(a.festgestelltAm),
            geschlossen: a.geschlossenAm ? formatDate(a.geschlossenAm) : '–',
            referenzen: a.referenzen || '–',
          },
          schluessel,
        ),
      ),
      {
        zeilenFarbe: (index) =>
          abweichungen[index].fristUeberschritten ? FARBE.rot : undefined,
      },
    )

    ueberschrift(doc, k, 'Feststellungen und Maßnahmen im Detail')
    for (const abweichung of abweichungen) {
      sichereHoehe(doc, k, 40)
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(FARBE.text)
        .text(
          `${abweichung.titel} (${abweichung.schwere}, ${abweichung.status})`,
          RAND.links,
          doc.y,
          { width: k.inhaltBreite },
        )

      absatzEingerueckt(
        doc,
        k,
        `Aufgabe: ${abweichung.aufgabe} · Kategorie: ${abweichung.kategorie} · ` +
          `Verantwortlich: ${abweichung.verantwortlich} · Frist: ${formatDate(abweichung.frist)}` +
          (abweichung.geschlossenAm
            ? ` · geschlossen am ${formatDate(abweichung.geschlossenAm)}`
            : ''),
      )
      if (abweichung.beschreibung) {
        absatzEingerueckt(doc, k, `Feststellung: ${abweichung.beschreibung}`)
      }
      if (abweichung.massnahme) {
        absatzEingerueckt(doc, k, `Umgesetzte Maßnahme: ${abweichung.massnahme}`)
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
  vorlage: ReportVorlage,
): Promise<Buffer> {
  return baueDokument(kopf, vorlage, (doc, k) => {
    ueberschrift(doc, k, 'Kommende Prüfungen')
    absatz(
      doc,
      k,
      `${zeilen.length} Termine im Vorschauzeitraum. Termine ohne bereits angelegte ` +
        'Fälligkeit sind als „geplant“ gekennzeichnet – sie ergeben sich rechnerisch ' +
        'aus dem hinterlegten Intervall.',
    )

    if (zeilen.length === 0) {
      absatz(doc, k, 'Im Vorschauzeitraum steht keine Prüfung an.')
      return
    }

    const { spalten, schluessel } = spaltenFuer(vorlage, k)

    tabelle(
      doc,
      k,
      spalten,
      zeilen.map((z) =>
        zeileAus(
          {
            termin: formatDate(z.datum),
            aufgabe: z.aufgabe,
            kategorie: z.kategorie,
            verantwortlich: z.verantwortlich,
            intervall: z.intervall,
            kritikalitaet: z.kritikalitaet,
            art: z.bestehend ? 'angelegt' : 'geplant',
            referenzen: z.referenzen || '–',
          },
          schluessel,
        ),
      ),
    )
  })
}

// ---------------------------------------------------------------------------
// 5. Nachweisregister
// ---------------------------------------------------------------------------

export function erzeugeNachweisregisterPdf(
  kopf: ReportKopf,
  nachweise: NachweisRegisterZeile[],
  vorlage: ReportVorlage,
): Promise<Buffer> {
  return baueDokument(kopf, vorlage, (doc, k) => {
    const mitFeststellung = nachweise.filter((n) => n.anzahlFeststellungen > 0)
    const feststellungen = nachweise.reduce(
      (summe, n) => summe + n.anzahlFeststellungen,
      0,
    )
    const gegengezeichnet = nachweise.filter((n) => n.vierAugen).length

    ueberschrift(doc, k, 'Zusammenfassung')
    absatz(
      doc,
      k,
      `${nachweise.length} abgeschlossene Prüfnachweise im Zeitraum, davon ` +
        `${gegengezeichnet} im Vier-Augen-Prinzip gegengezeichnet. ` +
        (mitFeststellung.length === 0
          ? 'Kein Nachweis enthält eine Feststellung.'
          : `${mitFeststellung.length} ${
              mitFeststellung.length === 1 ? 'Nachweis enthält' : 'Nachweise enthalten'
            } zusammen ${feststellungen} ${
              feststellungen === 1 ? 'Feststellung' : 'Feststellungen'
            }.`),
    )

    if (nachweise.length === 0) {
      absatz(doc, k, 'Im gewählten Zeitraum wurde kein Prüfnachweis abgeschlossen.')
      return
    }

    const { spalten, schluessel } = spaltenFuer(vorlage, k)

    tabelle(
      doc,
      k,
      spalten,
      nachweise.map((n) =>
        zeileAus(
          {
            pruefbogen: n.pruefbogen,
            aufgabe: n.aufgabe,
            kategorie: n.kategorie,
            faellig: formatDate(n.faelligAm),
            erfasstVon: n.erfasstVon,
            geprueftVon: n.geprueftVon,
            geprueftAm: n.geprueftAm ? formatDate(n.geprueftAm) : '–',
            vierAugen: n.vierAugen ? 'ja' : 'nein',
            punkte: String(n.anzahlPunkte + n.anzahlZeilen),
            feststellungen: String(n.anzahlFeststellungen),
            belege: String(n.anzahlBelege),
            referenzen: n.referenzen || '–',
            pruefsumme: n.pruefsumme ? n.pruefsumme.slice(0, 16) + '…' : '–',
          },
          schluessel,
        ),
      ),
      {
        zeilenFarbe: (index) =>
          nachweise[index].anzahlFeststellungen > 0 ? FARBE.rot : undefined,
      },
    )

    // Der Detailteil ist der eigentliche Zweck des Registers: Die Tabelle
    // nennt nur Zahlen, hier steht, worum es bei den Feststellungen ging und
    // mit welcher Prüfsumme der Nachweis belegt ist.
    ueberschrift(doc, k, 'Nachweise im Detail')
    for (const nachweis of nachweise) {
      sichereHoehe(doc, k, 40)
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(FARBE.text)
        .text(`${nachweis.pruefbogen} – ${nachweis.aufgabe}`, RAND.links, doc.y, {
          width: k.inhaltBreite,
        })

      absatzEingerueckt(
        doc,
        k,
        `Erfasst von ${nachweis.erfasstVon} am ${formatDate(nachweis.erfasstAm)}, ` +
          (nachweis.vierAugen
            ? `gegengezeichnet von ${nachweis.geprueftVon}`
            : 'ohne Gegenzeichnung abgeschlossen') +
          (nachweis.geprueftAm ? ` am ${formatDate(nachweis.geprueftAm)}` : '') +
          `. Soll-Fälligkeit ${formatDate(nachweis.faelligAm)}.`,
      )

      if (nachweis.feststellungen.length > 0) {
        for (const eintrag of nachweis.feststellungen) {
          absatzEingerueckt(doc, k, `Feststellung: ${eintrag}`)
        }
      } else {
        absatzEingerueckt(doc, k, 'Ohne Feststellung.')
      }

      if (nachweis.anzahlBelege > 0) {
        absatzEingerueckt(
          doc,
          k,
          `${nachweis.anzahlBelege} ${
            nachweis.anzahlBelege === 1 ? 'Beleg' : 'Belege'
          } beigefügt.`,
        )
      }

      absatzEingerueckt(
        doc,
        k,
        nachweis.pruefsumme
          ? `Prüfsumme des Nachweises (SHA-256): ${nachweis.pruefsumme}`
          : 'Kein PDF-Nachweis hinterlegt.',
      )

      doc.y += 4
    }
  })
}
