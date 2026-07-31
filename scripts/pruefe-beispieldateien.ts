/**
 * Prüft die Beispiel-Importdateien mit den Funktionen der Anwendung.
 *
 * Eine Importdatei sieht schnell richtig aus und ist es nicht: Ein
 * Semikolon in einem Text zerlegt die Zeile, ein Tippfehler im
 * Kategorienamen bricht den Lauf erst beim Einspielen. Dieses Skript liest
 * die Dateien mit demselben Parser wie die Anwendung und lässt dieselbe
 * Prüfung darüberlaufen – ohne Datenbank.
 *
 * Ausführen:  npm run test:beispiele
 */
import { readFileSync } from 'node:fs'

import { leseCsv } from '../src/lib/csv'
import {
  pruefeAufgaben,
  pruefeAuditReferenzen,
  pruefeKategorien,
  pruefePruefboegen,
  type ImportFehler,
} from '../src/lib/import-export'

const ORDNER = 'beispiele/pruefplan'
let fehlerAnzahl = 0
let testAnzahl = 0

function pruefe(bedingung: boolean, beschreibung: string) {
  testAnzahl++
  if (bedingung) {
    console.log(`  OK   ${beschreibung}`)
  } else {
    fehlerAnzahl++
    console.error(`  FEHL ${beschreibung}`)
  }
}

function zeigeFehler(fehler: ImportFehler[]) {
  for (const eintrag of fehler.slice(0, 10)) {
    console.error(
      `         Zeile ${eintrag.zeile}${eintrag.spalte ? `, Spalte ${eintrag.spalte}` : ''}: ${eintrag.meldung}`,
    )
  }
  if (fehler.length > 10) console.error(`         … und ${fehler.length - 10} weitere`)
}

function lies(datei: string) {
  return leseCsv(readFileSync(`${ORDNER}/${datei}`, 'utf8'))
}

function main() {
  console.log('Beispieldateien werden geprüft …\n')

  // --- Kategorien ---------------------------------------------------------
  const kategorien = lies('1-kategorien.csv')
  const kategorieVorschau = pruefeKategorien(kategorien, [])
  pruefe(
    kategorieVorschau.fehler.length === 0,
    `Kategorien ohne Fehler (${kategorien.length} Zeilen)`,
  )
  if (kategorieVorschau.fehler.length > 0) zeigeFehler(kategorieVorschau.fehler)

  // --- Audit-Referenzen ---------------------------------------------------
  const referenzen = lies('2-audit-referenzen.csv')
  const referenzVorschau = pruefeAuditReferenzen(referenzen, [])
  pruefe(
    referenzVorschau.fehler.length === 0,
    `Audit-Referenzen ohne Fehler (${referenzen.length} Zeilen)`,
  )
  if (referenzVorschau.fehler.length > 0) zeigeFehler(referenzVorschau.fehler)

  // --- Aufgaben -----------------------------------------------------------
  const aufgaben = lies('3-aufgaben.csv')
  const aufgabenVorschau = pruefeAufgaben(
    aufgaben,
    [],
    kategorieVorschau.eintraege.map((e) => e.daten.name),
    ['admin@example.com'],
  )
  pruefe(
    aufgabenVorschau.fehler.length === 0,
    `Aufgaben ohne Fehler (${aufgaben.length} Zeilen)`,
  )
  if (aufgabenVorschau.fehler.length > 0) zeigeFehler(aufgabenVorschau.fehler)

  // --- Prüfbögen ----------------------------------------------------------
  const boegen = lies('4-pruefboegen.csv')
  const bogenVorschau = pruefePruefboegen(
    boegen,
    [],
    aufgabenVorschau.eintraege.map((e) => e.daten.title),
  )
  pruefe(
    bogenVorschau.fehler.length === 0,
    `Prüfbögen ohne Fehler (${boegen.length} Zeilen, ${bogenVorschau.anlegen} Bögen)`,
  )
  if (bogenVorschau.fehler.length > 0) zeigeFehler(bogenVorschau.fehler)

  // --- Verweise zwischen den Dateien --------------------------------------
  // Der Import legt unbekannte Referenzen stillschweigend an. Ein Tippfehler
  // erzeugte dann eine zweite, fast gleich heißende Referenz – auffallen
  // würde er erst beim Filtern.
  const bekannt = new Set(
    referenzVorschau.eintraege.map((e) => e.schluessel.toLowerCase()),
  )
  const unbekannt = new Set<string>()
  for (const eintrag of aufgabenVorschau.eintraege) {
    for (const name of eintrag.daten.auditReferenzen.split(',')) {
      const gekuerzt = name.trim()
      if (gekuerzt && !bekannt.has(gekuerzt.toLowerCase())) unbekannt.add(gekuerzt)
    }
  }
  pruefe(
    unbekannt.size === 0,
    'Alle Audit-Referenzen der Aufgaben stehen in der Referenzdatei',
  )
  if (unbekannt.size > 0) {
    console.error(`         Unbekannt: ${[...unbekannt].join(', ')}`)
  }

  // --- Startdaten liegen in der Zukunft -----------------------------------
  // Ein Startdatum in der Vergangenheit erzeugt sofort eine überfällige
  // Fälligkeit – kein guter erster Eindruck nach dem Einspielen.
  const heute = new Date().toISOString().slice(0, 10)
  const vergangen = aufgaben.filter((zeile) => (zeile.startdatum ?? '') < heute)
  pruefe(
    vergangen.length === 0,
    'Kein Startdatum liegt in der Vergangenheit',
  )
  if (vergangen.length > 0) {
    console.error(
      `         Betroffen: ${vergangen.map((z) => `${z.titel} (${z.startdatum})`).join(', ')}`,
    )
  }

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
