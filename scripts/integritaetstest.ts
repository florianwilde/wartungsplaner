/**
 * Integrationstest des Integritätslaufs.
 *
 * Prüft, dass der Lauf eine veränderte, eine fehlende und eine verwaiste
 * Datei tatsächlich erkennt – und dass ein unversehrter Bestand als solcher
 * gemeldet wird. Legt eigene Testdaten an und räumt sie wieder auf.
 *
 * Ausführen:  npm run test:integritaet
 *
 * Voraussetzungen:
 *   - Datenbank vom Host aus erreichbar. Im Standard-Stack ist der Port
 *     bewusst nicht veröffentlicht; für die Entwicklung:
 *     docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 *   - Beschreibbares Upload-Verzeichnis. Ohne gesetztes UPLOAD_DIR wäre das
 *     der Container-Pfad /app/uploads, den es auf dem Rechner nicht gibt –
 *     der Test weicht deshalb auf ./uploads aus.
 */

// Vor allen Importen, die das Upload-Verzeichnis auflösen.
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || './uploads'

import { createHash } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { istUnversehrt } from '../src/lib/integritaet'
import { absoluterPfad, uploadVerzeichnis } from '../src/server/dateiablage'
import { pruefeNachweise } from '../src/server/integritaet'

const prisma = new PrismaClient()

const PRAEFIX = '[Integritaetstest] '
const TESTORDNER = 'integritaetstest'
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

async function raeumeAuf() {
  await prisma.attachment.deleteMany({
    where: { storedPath: { startsWith: `${TESTORDNER}/` } },
  })
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({ where: { id: { in: aufgaben.map((a) => a.id) } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
  await rm(path.join(uploadVerzeichnis(), TESTORDNER), {
    recursive: true,
    force: true,
  })
}

/** Legt eine Datei an und liefert Pfad und Prüfsumme. */
async function legeDateiAn(name: string, inhalt: string) {
  const relativ = `${TESTORDNER}/${name}`
  const absolut = absoluterPfad(relativ)
  await mkdir(path.dirname(absolut), { recursive: true })
  await writeFile(absolut, inhalt)
  return {
    relativ,
    absolut,
    sha256: createHash('sha256').update(inhalt).digest('hex'),
    groesse: Buffer.byteLength(inhalt),
  }
}

async function main() {
  console.log('Integritätstest startet …\n')
  await raeumeAuf()

  const benutzer = await prisma.user.upsert({
    where: { email: 'integritaet@test.local' },
    update: { active: true },
    create: {
      name: 'Testperson (Integritätstest)',
      email: 'integritaet@test.local',
      role: 'EDITOR',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#0F5C9E' },
  })
  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Aufgabe`,
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'ANNUAL',
      scheduleMode: 'FIXED',
      startDate: new Date(Date.UTC(2026, 0, 1)),
      active: true,
    },
  })
  const faelligkeit = await prisma.occurrence.create({
    data: {
      taskId: aufgabe.id,
      dueDate: new Date(Date.UTC(2026, 0, 1)),
      status: 'DONE',
    },
  })
  const durchfuehrung = await prisma.execution.create({
    data: {
      occurrenceId: faelligkeit.id,
      executedById: benutzer.id,
      result: 'OK',
    },
  })

  // --- Drei Nachweise: einer bleibt heil, einer wird verändert, einer entfernt
  const heil = await legeDateiAn('heil.txt', 'Unveränderter Nachweis')
  const veraendert = await legeDateiAn('veraendert.txt', 'Ursprünglicher Inhalt')
  const verschwunden = await legeDateiAn('verschwunden.txt', 'Wird gelöscht')

  for (const [name, datei] of [
    ['heil.txt', heil],
    ['veraendert.txt', veraendert],
    ['verschwunden.txt', verschwunden],
  ] as const) {
    await prisma.attachment.create({
      data: {
        executionId: durchfuehrung.id,
        filename: name,
        storedPath: datei.relativ,
        mimeType: 'text/plain',
        sizeBytes: datei.groesse,
        sha256: datei.sha256,
        uploadedById: benutzer.id,
      },
    })
  }

  // --- Erster Lauf: alles in Ordnung ---------------------------------------
  const sauber = await pruefeNachweise()
  const eigene = (art: string) =>
    sauber.befunde.filter(
      (b) => b.art === art && b.pfad.startsWith(`${TESTORDNER}/`),
    )

  pruefe(
    eigene('ABWEICHEND').length === 0 && eigene('FEHLEND').length === 0,
    'Ein unversehrter Bestand wird nicht beanstandet',
  )
  pruefe(sauber.geprueft >= 3, 'Alle hinterlegten Nachweise werden geprüft')

  // --- Bestand beschädigen -------------------------------------------------
  await writeFile(veraendert.absolut, 'Nachträglich verändert')
  await rm(verschwunden.absolut)
  await legeDateiAn('ohne-eintrag.txt', 'Datei ohne Datenbankeintrag')

  const beschaedigt = await pruefeNachweise()
  const meine = (art: string) =>
    beschaedigt.befunde.filter(
      (b) => b.art === art && b.pfad.startsWith(`${TESTORDNER}/`),
    )

  const abweichend = meine('ABWEICHEND')
  pruefe(
    abweichend.length === 1 && abweichend[0].pfad === veraendert.relativ,
    'Eine nachträglich veränderte Datei wird erkannt',
  )
  pruefe(
    abweichend[0]?.erwartet === veraendert.sha256 &&
      abweichend[0]?.gefunden !== veraendert.sha256,
    'Der Befund nennt erwartete und tatsächliche Prüfsumme',
  )

  const fehlend = meine('FEHLEND')
  pruefe(
    fehlend.length === 1 && fehlend[0].pfad === verschwunden.relativ,
    'Eine gelöschte Datei wird erkannt',
  )

  const verwaist = meine('VERWAIST')
  pruefe(
    verwaist.length === 1 && verwaist[0].pfad.endsWith('ohne-eintrag.txt'),
    'Eine Datei ohne Eintrag wird erkannt',
  )

  pruefe(
    !istUnversehrt(beschaedigt),
    'Der Bestand gilt damit nicht mehr als unversehrt',
  )

  // Der heile Nachweis darf nicht mit beanstandet werden.
  pruefe(
    !beschaedigt.befunde.some((b) => b.pfad === heil.relativ),
    'Der unveränderte Nachweis bleibt unbeanstandet',
  )

  // --- Verwaiste allein sind kein Schaden ----------------------------------
  const nurVerwaist = {
    fehlend: 0,
    abweichend: 0,
    unlesbar: 0,
  }
  pruefe(
    istUnversehrt(nurVerwaist),
    'Eine verwaiste Datei allein mindert die Beweiskraft nicht',
  )

  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nIntegritätstest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
