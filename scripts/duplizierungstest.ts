/**
 * Integrationstest des Duplizierens von Aufgaben.
 *
 * Wichtig ist weniger, dass eine Kopie entsteht, als was *nicht* mitkommt:
 * Fälligkeiten, Durchführungen und Nachweise der Vorlage. Eine Kopie mit
 * fremder Historie wäre in jedem Bericht eine Falschaussage.
 *
 * Ausführen:  npm run test:duplizieren
 *
 * Voraussetzung: Datenbank vom Host aus erreichbar:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 */
import { PrismaClient } from '@prisma/client'

import { addDays, todayInBerlin } from '../src/lib/dates'
import { dupliziereAufgabe } from '../src/server/duplizieren'

const prisma = new PrismaClient()

const PRAEFIX = '[Duplizierungstest] '
const EMAIL = 'duplizieren@test.local'
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

async function erwarteFehler(
  aktion: () => Promise<unknown>,
  textteil: string,
  beschreibung: string,
) {
  testAnzahl++
  try {
    await aktion()
    fehlerAnzahl++
    console.error(`  FEHL ${beschreibung} (kein Fehler ausgelöst)`)
  } catch (error) {
    const nachricht = error instanceof Error ? error.message : String(error)
    if (nachricht.includes(textteil)) {
      console.log(`  OK   ${beschreibung}`)
    } else {
      fehlerAnzahl++
      console.error(`  FEHL ${beschreibung} (unerwartet: ${nachricht})`)
    }
  }
}

async function raeumeAuf() {
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  const ids = aufgaben.map((a) => a.id)

  await prisma.pruefbogenVorlage.deleteMany({
    where: {
      OR: [{ name: { startsWith: PRAEFIX } }, { taskId: { in: ids } }],
    },
  })
  await prisma.task.deleteMany({ where: { id: { in: ids } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
}

async function main() {
  console.log('Duplizierungstest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const benutzer = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { active: true },
    create: {
      name: 'Testperson (Duplizieren)',
      email: EMAIL,
      role: 'ADMIN',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#0F5C9E' },
  })

  const referenz = await prisma.auditReferenz.upsert({
    where: { rahmenwerk_kuerzel: { rahmenwerk: 'ISO 27001', kuerzel: 'A.8.13' } },
    update: {},
    create: {
      rahmenwerk: 'ISO 27001',
      kuerzel: 'A.8.13',
      bezeichnung: 'Sicherung von Informationen',
      aktiv: true,
    },
  })

  // --- Vorlage mit Historie und Prüfbogen ---------------------------------
  const vorlage = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Restore-Test`,
      description: 'Wiederherstellung stichprobenartig prüfen',
      instructionsMd: '## Ablauf\n\n1. Sicherung wählen',
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'QUARTERLY',
      scheduleMode: 'AFTER_COMPLETION',
      startDate: addDays(heute, -180),
      leadTimeDays: 14,
      graceDays: 3,
      evidenceRequired: true,
      criticality: 'HIGH',
      active: true,
      auditReferenzen: { create: [{ referenzId: referenz.id }] },
    },
  })

  await prisma.pruefbogenVorlage.create({
    data: {
      name: `${PRAEFIX}Wiederherstellung`,
      beschreibung: 'Punkte der Rücksicherung',
      taskId: vorlage.id,
      vierAugen: true,
      aktiv: true,
      punkte: {
        create: [
          { position: 1, frage: 'Sicherung lesbar?', art: 'BEWERTUNG', pflicht: true },
          { position: 2, frage: 'Dauer der Rücksicherung', art: 'TEXT', pflicht: false },
        ],
      },
    },
  })

  // Vergangenheit an der Vorlage: Fälligkeit mit Durchführung.
  const alteFaelligkeit = await prisma.occurrence.create({
    data: { taskId: vorlage.id, dueDate: addDays(heute, -90), status: 'DONE' },
  })
  await prisma.execution.create({
    data: {
      occurrenceId: alteFaelligkeit.id,
      executedById: benutzer.id,
      executedAt: addDays(heute, -90),
      result: 'OK',
      comment: 'Alles in Ordnung',
    },
  })

  // --- Einfaches Duplizieren ----------------------------------------------
  const einzeln = await dupliziereAufgabe(
    vorlage.id,
    {
      titel: [`${PRAEFIX}Restore-Test (Kopie)`],
      startDate: addDays(heute, 7),
      mitBoegen: false,
      aktiv: true,
    },
    benutzer.id,
  )
  pruefe(einzeln.ids.length === 1, 'Eine Kopie entsteht')

  const kopie = await prisma.task.findUniqueOrThrow({
    where: { id: einzeln.ids[0] },
    include: {
      auditReferenzen: true,
      occurrences: { include: { execution: true } },
      pruefboegen: true,
    },
  })

  pruefe(
    kopie.intervalType === 'QUARTERLY' &&
      kopie.scheduleMode === 'AFTER_COMPLETION' &&
      kopie.leadTimeDays === 14 &&
      kopie.graceDays === 3 &&
      kopie.criticality === 'HIGH' &&
      kopie.evidenceRequired,
    'Alle Einstellungen kommen mit',
  )
  pruefe(
    kopie.description === vorlage.description &&
      kopie.instructionsMd === vorlage.instructionsMd,
    'Beschreibung und Prüfanleitung kommen mit',
  )
  pruefe(
    kopie.auditReferenzen.length === 1 &&
      kopie.auditReferenzen[0].referenzId === referenz.id,
    'Die Audit-Referenzen kommen mit',
  )
  pruefe(
    kopie.occurrences.length === 1 && kopie.occurrences[0].execution === null,
    'Die Vergangenheit der Vorlage kommt nicht mit – nur die erste Fälligkeit',
  )
  pruefe(
    kopie.occurrences[0].dueDate.getTime() === addDays(heute, 7).getTime(),
    'Die erste Fälligkeit liegt auf dem gewählten Startdatum',
  )
  pruefe(
    kopie.pruefboegen.length === 0,
    'Ohne Haken bleibt der Prüfbogen bei der Vorlage',
  )

  const unberuehrt = await prisma.task.findUniqueOrThrow({
    where: { id: vorlage.id },
    include: { occurrences: true, pruefboegen: true },
  })
  pruefe(
    unberuehrt.occurrences.length === 1 && unberuehrt.pruefboegen.length === 1,
    'Die Vorlage selbst bleibt unberührt',
  )

  // --- Mehrfach ausrollen, mit Prüfbögen ----------------------------------
  const mehrere = await dupliziereAufgabe(
    vorlage.id,
    {
      titel: [
        `${PRAEFIX}Restore-Test DC01`,
        `${PRAEFIX}Restore-Test DC02`,
        `${PRAEFIX}Restore-Test DC03`,
      ],
      startDate: addDays(heute, 14),
      mitBoegen: true,
      aktiv: true,
    },
    benutzer.id,
  )
  pruefe(mehrere.ids.length === 3, 'Drei Titel ergeben drei Aufgaben')
  pruefe(mehrere.boegen === 3, 'Jede Kopie bekommt ihren eigenen Prüfbogen')

  const boegen = await prisma.pruefbogenVorlage.findMany({
    where: { taskId: { in: mehrere.ids } },
    include: { punkte: true },
  })
  pruefe(
    new Set(boegen.map((b) => b.name)).size === 3,
    'Die Namen der Bögen bleiben eindeutig',
  )
  pruefe(
    boegen.every((b) => b.name.includes('DC0')),
    'Der Name der Aufgabe steht im Namen des Bogens',
  )
  pruefe(
    boegen.every((b) => b.punkte.length === 2 && b.vierAugen),
    'Prüfpunkte und Vier-Augen-Pflicht kommen mit',
  )
  pruefe(
    boegen.every((b) => b.punkte.some((p) => p.art === 'TEXT')),
    'Auch die Art der Prüfpunkte bleibt erhalten',
  )

  // --- Still anlegen ------------------------------------------------------
  const still = await dupliziereAufgabe(
    vorlage.id,
    {
      titel: [`${PRAEFIX}Restore-Test Entwurf`],
      startDate: addDays(heute, 30),
      mitBoegen: false,
      aktiv: false,
    },
    benutzer.id,
  )
  const stille = await prisma.task.findUniqueOrThrow({
    where: { id: still.ids[0] },
    include: { occurrences: true },
  })
  pruefe(
    !stille.active && stille.occurrences.length === 0,
    'Ohne „sofort aktiv“ entsteht noch keine Fälligkeit',
  )

  // --- Fehlerfälle --------------------------------------------------------
  await erwarteFehler(
    () =>
      dupliziereAufgabe(
        'nicht-vorhanden',
        {
          titel: ['Egal'],
          startDate: heute,
          mitBoegen: false,
          aktiv: true,
        },
        benutzer.id,
      ),
    'nicht gefunden',
    'Eine unbekannte Vorlage wird abgewiesen',
  )

  const gesperrt = await prisma.user.upsert({
    where: { email: 'gesperrt@duplizieren.test.local' },
    update: { active: false },
    create: {
      name: 'Gesperrte Person',
      email: 'gesperrt@duplizieren.test.local',
      role: 'EDITOR',
      active: false,
    },
  })
  const mitGesperrtem = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Verwaiste Aufgabe`,
      categoryId: kategorie.id,
      ownerId: gesperrt.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })
  await erwarteFehler(
    () =>
      dupliziereAufgabe(
        mitGesperrtem.id,
        { titel: ['Neue Aufgabe'], startDate: heute, mitBoegen: false, aktiv: true },
        benutzer.id,
      ),
    'deaktiviert',
    'Eine Kopie mit deaktivierter zuständiger Person wird abgelehnt',
  )

  // --- Audit --------------------------------------------------------------
  const eintrag = await prisma.auditLog.findFirst({
    where: { entityId: mehrere.ids[0], action: 'TASK_CREATED' },
  })
  pruefe(
    (eintrag?.payloadJson as { dupliziertVon?: string } | null)?.dupliziertVon ===
      vorlage.title,
    'Das Audit-Log nennt die Vorlage, aus der kopiert wurde',
  )

  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nDuplizierungstest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
