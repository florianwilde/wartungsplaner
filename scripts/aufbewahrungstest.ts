/**
 * Integrationstest der Aufbewahrungsfristen.
 *
 * Bei einer löschenden Funktion ist das die wichtigste Absicherung. Geprüft
 * wird, dass genau das Abgelaufene entfernt wird, der Eintrag erhalten
 * bleibt, die Vorschau nichts anfasst und der Prüfsummenlauf entfernte
 * Nachweise nicht als Verlust meldet.
 *
 * Ausführen:  npm run test:aufbewahrung
 *
 * Voraussetzungen:
 *   - Datenbank vom Host aus erreichbar:
 *     docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 *   - Beschreibbares Upload-Verzeichnis (der Test weicht auf ./uploads aus)
 */
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || './uploads'

import { createHash } from 'node:crypto'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { addMonths, dateOnly, todayInBerlin } from '../src/lib/dates'
import {
  EINSTELLUNGEN_ID,
  ermittleFaellige,
  fuehreAufbewahrungAus,
} from '../src/server/aufbewahrung'
import { absoluterPfad, uploadVerzeichnis } from '../src/server/dateiablage'
import { pruefeNachweise } from '../src/server/integritaet'

const prisma = new PrismaClient()

const PRAEFIX = '[Aufbewahrungstest] '
const TESTORDNER = 'aufbewahrungstest'
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

async function existiert(relativ: string): Promise<boolean> {
  try {
    await access(absoluterPfad(relativ))
    return true
  } catch {
    return false
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

async function legeDateiAn(name: string, inhalt: string) {
  const relativ = `${TESTORDNER}/${name}`
  const absolut = absoluterPfad(relativ)
  await mkdir(path.dirname(absolut), { recursive: true })
  await writeFile(absolut, inhalt)
  return {
    relativ,
    sha256: createHash('sha256').update(inhalt).digest('hex'),
    groesse: Buffer.byteLength(inhalt),
  }
}

async function main() {
  console.log('Aufbewahrungstest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const benutzer = await prisma.user.upsert({
    where: { email: 'aufbewahrung@test.local' },
    update: { active: true },
    create: {
      name: 'Testperson (Aufbewahrung)',
      email: 'aufbewahrung@test.local',
      role: 'EDITOR',
      active: true,
    },
  })

  // Zwei Kategorien: eine mit kurzer eigener Frist, eine mit der Vorgabe.
  const kurz = await prisma.category.create({
    data: { name: `${PRAEFIX}Kurz`, color: '#0F5C9E', aufbewahrungMonate: 12 },
  })
  const lang = await prisma.category.create({
    data: { name: `${PRAEFIX}Lang`, color: '#0F5C9E', aufbewahrungMonate: null },
  })

  await prisma.aufbewahrungsEinstellung.upsert({
    where: { id: EINSTELLUNGEN_ID },
    update: { aktiv: true, standardMonate: 120 },
    create: { id: EINSTELLUNGEN_ID, aktiv: true, standardMonate: 120 },
  })

  /** Legt Aufgabe, Fälligkeit, Durchführung und Nachweis an. */
  async function baueNachweis(
    kategorieId: string,
    titel: string,
    durchgefuehrtAm: Date,
    dateiname: string,
  ) {
    const aufgabe = await prisma.task.create({
      data: {
        title: `${PRAEFIX}${titel}`,
        categoryId: kategorieId,
        ownerId: benutzer.id,
        intervalType: 'ANNUAL',
        scheduleMode: 'FIXED',
        startDate: dateOnly(2016, 1, 1),
        active: true,
      },
    })
    const faelligkeit = await prisma.occurrence.create({
      data: { taskId: aufgabe.id, dueDate: durchgefuehrtAm, status: 'DONE' },
    })
    const durchfuehrung = await prisma.execution.create({
      data: {
        occurrenceId: faelligkeit.id,
        executedById: benutzer.id,
        executedAt: durchgefuehrtAm,
        result: 'OK',
      },
    })
    const datei = await legeDateiAn(dateiname, `Inhalt von ${dateiname}`)
    const anhang = await prisma.attachment.create({
      data: {
        executionId: durchfuehrung.id,
        filename: dateiname,
        storedPath: datei.relativ,
        mimeType: 'text/plain',
        sizeBytes: datei.groesse,
        sha256: datei.sha256,
        uploadedById: benutzer.id,
      },
    })
    return { anhangId: anhang.id, ...datei }
  }

  // Kurze Frist (12 Monate): zwei Jahre alt -> fällig
  const alt = await baueNachweis(
    kurz.id,
    'Alt in kurzer Frist',
    addMonths(heute, -24),
    'alt.txt',
  )
  // Kurze Frist: einen Monat alt -> bleibt
  const jung = await baueNachweis(
    kurz.id,
    'Jung in kurzer Frist',
    addMonths(heute, -1),
    'jung.txt',
  )
  // Vorgabe (120 Monate): zwei Jahre alt -> bleibt
  const langsam = await baueNachweis(
    lang.id,
    'Alt in langer Frist',
    addMonths(heute, -24),
    'lang.txt',
  )

  // --- Ermittlung ---------------------------------------------------------
  const { faellig } = await ermittleFaellige(heute)
  const meine = faellig.filter((f) => f.storedPath.startsWith(`${TESTORDNER}/`))

  pruefe(
    meine.length === 1 && meine[0].storedPath === alt.relativ,
    'Nur der Nachweis jenseits seiner Frist gilt als fällig',
  )
  pruefe(meine[0]?.fristMonate === 12, 'Die Frist der Kategorie geht der Vorgabe vor')

  // --- Vorschau fasst nichts an -------------------------------------------
  const vorschau = await fuehreAufbewahrungAus(benutzer.id, true, heute)
  pruefe(vorschau.entfernt >= 1, 'Die Vorschau nennt die fälligen Nachweise')
  pruefe(await existiert(alt.relativ), 'Nach der Vorschau ist die Datei noch da')
  pruefe(
    (await prisma.attachment.findUnique({ where: { id: alt.anhangId } }))
      ?.archiviertAm === null,
    'Und der Eintrag unverändert',
  )

  // --- Tatsächlicher Lauf --------------------------------------------------
  await fuehreAufbewahrungAus(benutzer.id, false, heute)

  pruefe(!(await existiert(alt.relativ)), 'Der abgelaufene Nachweis ist entfernt')
  pruefe(await existiert(jung.relativ), 'Der junge Nachweis bleibt')
  pruefe(
    await existiert(langsam.relativ),
    'Der Nachweis unter der langen Frist bleibt ebenfalls',
  )

  const eintrag = await prisma.attachment.findUnique({
    where: { id: alt.anhangId },
  })
  pruefe(eintrag !== null, 'Der Eintrag bleibt bestehen')
  pruefe(eintrag?.archiviertAm !== null, 'Er ist als entfernt gekennzeichnet')
  pruefe(
    eintrag?.sha256 === alt.sha256 && eintrag.filename === 'alt.txt',
    'Dateiname und Prüfsumme belegen weiterhin, was der Nachweis war',
  )

  const durchfuehrungNochDa = await prisma.execution.findFirst({
    where: { attachments: { some: { id: alt.anhangId } } },
  })
  pruefe(durchfuehrungNochDa !== null, 'Die Durchführung bleibt vollständig erhalten')

  // --- Kein zweites Entfernen ---------------------------------------------
  const nochmal = await fuehreAufbewahrungAus(benutzer.id, false, heute)
  const nochmalMeine = (await ermittleFaellige(heute)).faellig.filter((f) =>
    f.storedPath.startsWith(`${TESTORDNER}/`),
  )
  pruefe(nochmalMeine.length === 0, 'Ein zweiter Lauf findet nichts mehr zu entfernen')
  pruefe(nochmal.fehlgeschlagen === 0, 'Und meldet keine Fehlschläge')

  // --- Zusammenspiel mit dem Prüfsummenlauf --------------------------------
  const integritaet = await pruefeNachweise()
  const beanstandet = integritaet.befunde.filter((b) => b.pfad === alt.relativ)
  pruefe(
    beanstandet.length === 0,
    'Der Prüfsummenlauf meldet den entfernten Nachweis weder als fehlend noch als verwaist',
  )

  await raeumeAuf()
  await prisma.aufbewahrungsEinstellung.update({
    where: { id: EINSTELLUNGEN_ID },
    data: { aktiv: false },
  })

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nAufbewahrungstest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
