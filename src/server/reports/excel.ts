/**
 * Excel-Erzeugung mit exceljs.
 *
 * Jede Mappe beginnt mit einem Kopfblock (Anwendung, Bericht, Zeitraum,
 * Kategorien, Erstellungsdatum und erstellende Person), damit ein exportiertes
 * Blatt auch losgelöst vom System eindeutig zuzuordnen ist.
 */
import ExcelJS from 'exceljs'

import { formatDate, formatDateTime } from '@/lib/dates'
import {
  type AbweichungZeile,
  type ComplianceReport,
  type HistorieAufgabe,
  type NachweisRegisterZeile,
  type ReportKopf,
  type VorschauZeile,
} from './daten'

const KOPF_FUELLUNG: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE5E7EB' },
}

function neueMappe(kopf: ReportKopf): ExcelJS.Workbook {
  const mappe = new ExcelJS.Workbook()
  mappe.creator = kopf.erstelltVon
  mappe.lastModifiedBy = kopf.erstelltVon
  mappe.created = kopf.erstelltAm
  mappe.modified = kopf.erstelltAm
  if (kopf.organisation) mappe.company = kopf.organisation
  mappe.title = `${kopf.anwendung} – ${kopf.titel}`
  return mappe
}

/** Schreibt den Kopfblock und liefert die erste freie Zeilennummer. */
function schreibeKopf(blatt: ExcelJS.Worksheet, kopf: ReportKopf): number {
  const zeilen: [string, string][] = [
    ['Anwendung', kopf.anwendung],
    ...(kopf.organisation
      ? ([['Organisation', kopf.organisation]] as [string, string][])
      : []),
    ['Bericht', kopf.titel],
    [
      'Zeitraum',
      `${formatDate(kopf.zeitraum.von)} bis ${formatDate(kopf.zeitraum.bis)}`,
    ],
    ['Kategorien', kopf.kategorienText],
    ['Erstellt am', formatDateTime(kopf.erstelltAm)],
    ['Erstellt von', kopf.erstelltVon],
    ...(kopf.fussnote ? ([['Hinweis', kopf.fussnote]] as [string, string][]) : []),
  ]

  zeilen.forEach(([bezeichnung, wert], index) => {
    const zeile = blatt.getRow(index + 1)
    zeile.getCell(1).value = bezeichnung
    zeile.getCell(1).font = { bold: true }
    zeile.getCell(2).value = wert
  })

  return zeilen.length + 2
}

function schreibeTabellenkopf(
  blatt: ExcelJS.Worksheet,
  zeilenNummer: number,
  spalten: string[],
) {
  const zeile = blatt.getRow(zeilenNummer)
  spalten.forEach((bezeichnung, index) => {
    const zelle = zeile.getCell(index + 1)
    zelle.value = bezeichnung
    zelle.font = { bold: true }
    zelle.fill = KOPF_FUELLUNG
    zelle.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } }
  })
  zeile.commit()
}

/** Setzt sinnvolle Spaltenbreiten. */
function setzeBreiten(blatt: ExcelJS.Worksheet, breiten: number[]) {
  breiten.forEach((breite, index) => {
    blatt.getColumn(index + 1).width = breite
  })
}

async function alsBuffer(mappe: ExcelJS.Workbook): Promise<Buffer> {
  const daten = await mappe.xlsx.writeBuffer()
  return Buffer.from(daten)
}

// ---------------------------------------------------------------------------
// 1. Compliance-Übersicht
// ---------------------------------------------------------------------------

export async function erzeugeComplianceExcel(
  kopf: ReportKopf,
  report: ComplianceReport,
): Promise<Buffer> {
  const mappe = neueMappe(kopf)
  const blatt = mappe.addWorksheet('Compliance')

  setzeBreiten(blatt, [28, 10, 12, 12, 10, 12, 12, 14, 16])
  let zeilenNummer = schreibeKopf(blatt, kopf)

  schreibeTabellenkopf(blatt, zeilenNummer, [
    'Kategorie',
    'Gesamt',
    'Pünktlich',
    'Verspätet',
    'Offen',
    'Überfällig',
    'Ausgesetzt',
    'Erfüllungsgrad',
    'Pünktlichkeitsquote',
  ])
  zeilenNummer++

  const alle = [...report.zeilen, report.gesamt]
  for (const [index, eintrag] of alle.entries()) {
    const zeile = blatt.getRow(zeilenNummer++)
    zeile.values = [
      eintrag.kategorie,
      eintrag.gesamt,
      eintrag.puenktlich,
      eintrag.verspaetet,
      eintrag.offen,
      eintrag.ueberfaellig,
      eintrag.ausgesetzt,
      eintrag.erfuellungsgrad,
      eintrag.puenktlichkeitsquote,
    ]
    zeile.getCell(8).numFmt = '0.0%'
    zeile.getCell(9).numFmt = '0.0%'
    if (index === alle.length - 1) zeile.font = { bold: true }
    zeile.commit()
  }

  return alsBuffer(mappe)
}

// ---------------------------------------------------------------------------
// 2. Aufgabenhistorie
// ---------------------------------------------------------------------------

export async function erzeugeHistorieExcel(
  kopf: ReportKopf,
  aufgaben: HistorieAufgabe[],
): Promise<Buffer> {
  const mappe = neueMappe(kopf)

  // Blatt 1: eine Zeile je Durchführung
  const blatt = mappe.addWorksheet('Durchführungen')
  setzeBreiten(blatt, [34, 18, 20, 14, 14, 20, 24, 14, 10, 40])
  let zeilenNummer = schreibeKopf(blatt, kopf)

  schreibeTabellenkopf(blatt, zeilenNummer, [
    'Aufgabe',
    'Kategorie',
    'Audit-Referenz',
    'Soll-Fälligkeit',
    'Durchgeführt am',
    'Durchgeführt von',
    'Ergebnis',
    'Termintreue',
    'Nachweise',
    'Kommentar',
  ])
  zeilenNummer++

  for (const aufgabe of aufgaben) {
    for (const durchfuehrung of aufgabe.durchfuehrungen) {
      const zeile = blatt.getRow(zeilenNummer++)
      zeile.values = [
        aufgabe.titel,
        aufgabe.kategorie,
        aufgabe.auditReferenz,
        formatDate(durchfuehrung.sollDatum),
        formatDate(durchfuehrung.istDatum),
        durchfuehrung.person,
        durchfuehrung.ergebnis,
        durchfuehrung.puenktlich ? 'pünktlich' : 'verspätet',
        durchfuehrung.nachweise.length,
        durchfuehrung.kommentar,
      ]
      zeile.commit()
    }
  }

  // Blatt 2: eine Zeile je Nachweis mit Prüfsumme
  const nachweisBlatt = mappe.addWorksheet('Nachweise')
  setzeBreiten(nachweisBlatt, [34, 16, 16, 36, 14, 68])
  let nachweisZeile = schreibeKopf(nachweisBlatt, kopf)

  schreibeTabellenkopf(nachweisBlatt, nachweisZeile, [
    'Aufgabe',
    'Soll-Fälligkeit',
    'Durchgeführt am',
    'Dateiname',
    'Größe (Bytes)',
    'SHA-256',
  ])
  nachweisZeile++

  for (const aufgabe of aufgaben) {
    for (const durchfuehrung of aufgabe.durchfuehrungen) {
      for (const nachweis of durchfuehrung.nachweise) {
        const zeile = nachweisBlatt.getRow(nachweisZeile++)
        zeile.values = [
          aufgabe.titel,
          formatDate(durchfuehrung.sollDatum),
          formatDate(durchfuehrung.istDatum),
          nachweis.dateiname,
          nachweis.groesseBytes,
          nachweis.sha256,
        ]
        zeile.getCell(6).font = { name: 'Consolas', size: 9 }
        zeile.commit()
      }
    }
  }

  return alsBuffer(mappe)
}

// ---------------------------------------------------------------------------
// 3. Abweichungsbericht
// ---------------------------------------------------------------------------

export async function erzeugeAbweichungenExcel(
  kopf: ReportKopf,
  abweichungen: AbweichungZeile[],
): Promise<Buffer> {
  const mappe = neueMappe(kopf)
  const blatt = mappe.addWorksheet('Abweichungen')

  setzeBreiten(blatt, [34, 30, 18, 12, 16, 20, 14, 14, 16, 14, 46, 46])
  let zeilenNummer = schreibeKopf(blatt, kopf)

  schreibeTabellenkopf(blatt, zeilenNummer, [
    'Abweichung',
    'Aufgabe',
    'Kategorie',
    'Schweregrad',
    'Status',
    'Verantwortlich',
    'Frist',
    'Frist überschritten',
    'Festgestellt am',
    'Geschlossen am',
    'Feststellung',
    'Umgesetzte Maßnahme',
    'Audit-Referenzen',
  ])
  zeilenNummer++

  for (const abweichung of abweichungen) {
    const zeile = blatt.getRow(zeilenNummer++)
    zeile.values = [
      abweichung.titel,
      abweichung.aufgabe,
      abweichung.kategorie,
      abweichung.schwere,
      abweichung.status,
      abweichung.verantwortlich,
      formatDate(abweichung.frist),
      abweichung.fristUeberschritten ? 'ja' : 'nein',
      formatDate(abweichung.festgestelltAm),
      abweichung.geschlossenAm ? formatDate(abweichung.geschlossenAm) : '',
      abweichung.beschreibung,
      abweichung.massnahme,
      abweichung.referenzen,
    ]
    if (abweichung.fristUeberschritten) {
      zeile.getCell(8).font = { color: { argb: 'FFB91C1C' }, bold: true }
    }
    zeile.commit()
  }

  return alsBuffer(mappe)
}

// ---------------------------------------------------------------------------
// 4. Fälligkeitsvorschau
// ---------------------------------------------------------------------------

export async function erzeugeVorschauExcel(
  kopf: ReportKopf,
  zeilen: VorschauZeile[],
): Promise<Buffer> {
  const mappe = neueMappe(kopf)
  const blatt = mappe.addWorksheet('Vorschau')

  setzeBreiten(blatt, [14, 40, 20, 22, 18, 14, 12])
  let zeilenNummer = schreibeKopf(blatt, kopf)

  schreibeTabellenkopf(blatt, zeilenNummer, [
    'Termin',
    'Aufgabe',
    'Kategorie',
    'Verantwortlich',
    'Intervall',
    'Kritikalität',
    'Art',
    'Audit-Referenzen',
  ])
  zeilenNummer++

  for (const eintrag of zeilen) {
    const zeile = blatt.getRow(zeilenNummer++)
    zeile.values = [
      formatDate(eintrag.datum),
      eintrag.aufgabe,
      eintrag.kategorie,
      eintrag.verantwortlich,
      eintrag.intervall,
      eintrag.kritikalitaet,
      eintrag.bestehend ? 'angelegt' : 'geplant',
      eintrag.referenzen,
    ]
    zeile.commit()
  }

  return alsBuffer(mappe)
}

// ---------------------------------------------------------------------------
// 5. Nachweisregister
// ---------------------------------------------------------------------------

export async function erzeugeNachweisregisterExcel(
  kopf: ReportKopf,
  nachweise: NachweisRegisterZeile[],
): Promise<Buffer> {
  const mappe = neueMappe(kopf)
  const blatt = mappe.addWorksheet('Nachweise')

  setzeBreiten(blatt, [32, 30, 18, 14, 22, 22, 16, 10, 10, 10, 10, 10, 70, 68])
  let zeilenNummer = schreibeKopf(blatt, kopf)

  schreibeTabellenkopf(blatt, zeilenNummer, [
    'Prüfbogen',
    'Aufgabe',
    'Kategorie',
    'Soll-Fälligkeit',
    'Erfasst von',
    'Gegengezeichnet von',
    'Gegengezeichnet am',
    'Vier-Augen',
    'Prüfpunkte',
    'Zeilen',
    'Feststellungen',
    'Belege',
    'Feststellungen im Klartext',
    'Audit-Referenzen',
    'Prüfsumme (SHA-256)',
  ])
  zeilenNummer++

  for (const nachweis of nachweise) {
    const zeile = blatt.getRow(zeilenNummer++)
    zeile.values = [
      nachweis.pruefbogen,
      nachweis.aufgabe,
      nachweis.kategorie,
      formatDate(nachweis.faelligAm),
      nachweis.erfasstVon,
      nachweis.geprueftVon,
      nachweis.geprueftAm ? formatDate(nachweis.geprueftAm) : '',
      nachweis.vierAugen ? 'ja' : 'nein',
      nachweis.anzahlPunkte,
      nachweis.anzahlZeilen,
      nachweis.anzahlFeststellungen,
      nachweis.anzahlBelege,
      nachweis.feststellungen.join('\n'),
      nachweis.referenzen,
      nachweis.pruefsumme,
    ]
    if (nachweis.anzahlFeststellungen > 0) {
      zeile.getCell(11).font = { color: { argb: 'FFB91C1C' }, bold: true }
    }
    // Die Prüfsumme ist zum Abgleich gedacht und soll sich unverfälscht
    // kopieren lassen – deshalb Festbreitenschrift statt Umbruch.
    zeile.getCell(14).font = { name: 'Consolas', size: 9 }
    zeile.getCell(13).alignment = { wrapText: true, vertical: 'top' }
    zeile.commit()
  }

  return alsBuffer(mappe)
}
