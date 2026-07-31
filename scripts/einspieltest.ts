/**
 * Spielt die Beispieldateien in eine leere Datenbank ein und prüft das
 * Ergebnis. Wird von `scripts/einspieltest.sh` aufgerufen, das die
 * Wegwerf-Datenbank bereitstellt.
 */
import { readFileSync } from 'node:fs'

import { PrismaClient } from '@prisma/client'

import { leseCsv } from '../src/lib/csv'
import {
  pruefeAufgaben,
  pruefeAuditReferenzen,
  pruefeKategorien,
  pruefePruefboegen,
} from '../src/lib/import-export'
import {
  schreibeAufgaben,
  schreibeAuditReferenzen,
  schreibeKategorien,
  schreibePruefboegen,
} from '../src/server/import'

const prisma = new PrismaClient()
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

const lies = (datei: string) => leseCsv(readFileSync(`${ORDNER}/${datei}`, 'utf8'))

async function main() {
  const benutzer = await prisma.user.create({
    data: {
      name: 'Administrator',
      email: 'admin@example.com',
      role: 'ADMIN',
      active: true,
    },
  })

  // --- 1. Kategorien ------------------------------------------------------
  const kategorieVorschau = pruefeKategorien(lies('1-kategorien.csv'), [])
  pruefe(kategorieVorschau.fehler.length === 0, 'Kategorien: Vorschau ohne Fehler')
  const kategorien = await schreibeKategorien(kategorieVorschau, benutzer.id)
  pruefe(kategorien.angelegt === 6, `Kategorien: 6 angelegt (${kategorien.angelegt})`)

  // --- 2. Audit-Referenzen ------------------------------------------------
  const referenzVorschau = pruefeAuditReferenzen(lies('2-audit-referenzen.csv'), [])
  pruefe(referenzVorschau.fehler.length === 0, 'Referenzen: Vorschau ohne Fehler')
  const referenzen = await schreibeAuditReferenzen(referenzVorschau, benutzer.id)
  pruefe(
    referenzen.angelegt === 49,
    `Referenzen: 49 angelegt (${referenzen.angelegt})`,
  )

  // --- 3. Aufgaben --------------------------------------------------------
  const aufgabenVorschau = pruefeAufgaben(
    lies('3-aufgaben.csv'),
    [],
    (await prisma.category.findMany({ select: { name: true } })).map((k) => k.name),
    [benutzer.email],
  )
  pruefe(aufgabenVorschau.fehler.length === 0, 'Aufgaben: Vorschau ohne Fehler')
  if (aufgabenVorschau.fehler.length > 0) {
    for (const fehler of aufgabenVorschau.fehler.slice(0, 5)) {
      console.error(`         Zeile ${fehler.zeile}: ${fehler.meldung}`)
    }
  }
  const aufgaben = await schreibeAufgaben(aufgabenVorschau, benutzer.id)
  pruefe(aufgaben.angelegt === 30, `Aufgaben: 30 angelegt (${aufgaben.angelegt})`)

  // --- 4. Prüfbögen -------------------------------------------------------
  const bogenVorschau = pruefePruefboegen(
    lies('4-pruefboegen.csv'),
    [],
    (await prisma.task.findMany({ select: { title: true } })).map((a) => a.title),
  )
  pruefe(bogenVorschau.fehler.length === 0, 'Prüfbögen: Vorschau ohne Fehler')
  if (bogenVorschau.fehler.length > 0) {
    for (const fehler of bogenVorschau.fehler.slice(0, 5)) {
      console.error(`         Zeile ${fehler.zeile}: ${fehler.meldung}`)
    }
  }
  const boegen = await schreibePruefboegen(bogenVorschau, benutzer.id)
  pruefe(boegen.angelegt === 9, `Prüfbögen: 9 angelegt (${boegen.angelegt})`)

  const gespeicherteBoegen = await prisma.pruefbogenVorlage.findMany({
    include: { punkte: true, task: true },
  })
  pruefe(
    gespeicherteBoegen.every((b) => b.punkte.length >= 6),
    'Jeder Bogen hat mindestens sechs Prüfpunkte',
  )
  pruefe(
    gespeicherteBoegen.every((b) => b.taskId !== null),
    'Jeder Bogen ist einer Aufgabe zugeordnet',
  )
  pruefe(
    gespeicherteBoegen.some((b) => b.punkte.some((p) => p.art === 'LISTE')),
    'Zeilenlisten für Rezertifizierungen sind dabei',
  )
  pruefe(
    gespeicherteBoegen.filter((b) => b.vierAugen).length >= 6,
    'Die meisten Bögen verlangen eine Gegenzeichnung',
  )

  // --- Ergebnis prüfen ----------------------------------------------------
  const gespeichert = await prisma.task.findMany({
    include: {
      auditReferenzen: { include: { referenz: true } },
      occurrences: true,
      category: true,
    },
  })

  pruefe(
    gespeichert.every((a) => a.occurrences.length === 1),
    'Jede Aufgabe hat genau eine erste Fälligkeit',
  )
  pruefe(
    gespeichert.every((a) => a.auditReferenzen.length > 0),
    'Jede Aufgabe hat mindestens eine Audit-Referenz',
  )

  // Der entscheidende Punkt: Der Aufgabenimport legt unbekannte Referenzen
  // still an. Wären die Namen nicht deckungsgleich, stünden hier mehr als 49.
  const anzahlReferenzen = await prisma.auditReferenz.count()
  pruefe(
    anzahlReferenzen === 49,
    `Keine Referenz doppelt angelegt (${anzahlReferenzen} statt 49)`,
  )

  const ohneRahmenwerk = await prisma.auditReferenz.count({
    where: { rahmenwerk: null },
  })
  pruefe(
    ohneRahmenwerk === 0,
    `Alle Referenzen haben ein Rahmenwerk (${ohneRahmenwerk} ohne)`,
  )

  const mitBezeichnung = await prisma.auditReferenz.count({
    where: { NOT: { bezeichnung: { equals: prisma.auditReferenz.fields.kuerzel } } },
  })
  pruefe(
    mitBezeichnung === 49,
    `Alle Referenzen haben eine echte Bezeichnung (${mitBezeichnung} von 49)`,
  )

  const intervalle = new Set(gespeichert.map((a) => a.intervalType))
  pruefe(
    intervalle.has('ANNUAL') &&
      intervalle.has('QUARTERLY') &&
      intervalle.has('MONTHLY') &&
      intervalle.has('SEMIANNUAL'),
    'Alle vier Intervalle des Prüfplans sind vertreten',
  )

  const proKategorie = new Map<string, number>()
  for (const aufgabe of gespeichert) {
    proKategorie.set(
      aufgabe.category.name,
      (proKategorie.get(aufgabe.category.name) ?? 0) + 1,
    )
  }
  pruefe(proKategorie.size === 6, 'Alle sechs Kategorien sind belegt')

  console.log('\n  Verteilung je Kategorie:')
  for (const [name, anzahl] of [...proKategorie].sort()) {
    console.log(`    ${anzahl.toString().padStart(2)} × ${name}`)
  }

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch((error) => {
    console.error('\nEinspieltest abgebrochen:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
