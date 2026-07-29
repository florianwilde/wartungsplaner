/**
 * Integrationstest gegen eine laufende Postgres-Instanz.
 *
 * Prüft den Erledigen-Vorgang samt Nachweisen, Abweichungen, Folgeterminen
 * und Unveränderlichkeit. Legt eigene Testdaten an und räumt sie wieder auf.
 *
 * Ausführen:  npm run test:integration
 * Voraussetzung: `docker compose up -d db` und angewandte Migrationen.
 */
import { PrismaClient } from '@prisma/client'

import { addDays, dateOnly, toISODate, todayInBerlin } from '../src/lib/dates'
import {
  FachlicherFehler,
  protokolliereDurchfuehrung,
} from '../src/server/durchfuehrung-service'
import { fuehreTagesabgleichAus } from '../src/server/faelligkeiten'

const prisma = new PrismaClient()

const PRAEFIX = '[Integrationstest] '
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
    if (error instanceof FachlicherFehler && nachricht.includes(textteil)) {
      console.log(`  OK   ${beschreibung}`)
    } else {
      fehlerAnzahl++
      console.error(`  FEHL ${beschreibung} – unerwartet: ${nachricht}`)
    }
  }
}

const TEST_EMAIL = 'test@integrationstest.local'

/**
 * Entfernt die Testaufgaben (Kaskade über Fälligkeiten, Durchführungen,
 * Nachweise und Abweichungen).
 *
 * Der Testbenutzer bleibt bestehen: Er wird vom Audit-Log referenziert, und
 * Protokolleinträge dürfen weder geändert noch gelöscht werden. Deshalb wird
 * er bei jedem Lauf wiederverwendet statt neu angelegt.
 */
async function raeumeAuf() {
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  if (aufgaben.length > 0) {
    await prisma.task.deleteMany({
      where: { id: { in: aufgaben.map((a) => a.id) } },
    })
  }
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
}

async function main() {
  console.log('Integrationstest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const benutzer = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: { active: true },
    create: {
      name: 'Testperson (Integrationstest)',
      email: TEST_EMAIL,
      authProvider: 'LOCAL',
      role: 'EDITOR',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#123456', sortOrder: 999 },
  })

  // ---------------------------------------------------------------------
  console.log('1) Erledigen mit fester Taktung (FIXED, vierteljährlich)')
  // ---------------------------------------------------------------------
  const fixTask = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Fester Rhythmus`,
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'QUARTERLY',
      scheduleMode: 'FIXED',
      startDate: dateOnly(2026, 1, 15),
      leadTimeDays: 14,
      graceDays: 7,
      evidenceRequired: false,
      criticality: 'HIGH',
      active: true,
      occurrences: { create: { dueDate: dateOnly(2026, 1, 15), status: 'OPEN' } },
    },
    include: { occurrences: true },
  })

  const ergebnisFix = await protokolliereDurchfuehrung(
    {
      occurrenceId: fixTask.occurrences[0].id,
      result: 'OK',
      comment: 'Alles in Ordnung.',
      durchgefuehrtAm: dateOnly(2026, 2, 3),
      abweichungen: [],
      nachweise: [],
    },
    benutzer.id,
  )

  pruefe(
    toISODate(ergebnisFix.naechsteFaelligkeit!) === '2026-04-15',
    'FIXED rechnet ab der Soll-Fälligkeit (15.01. + 3 Monate = 15.04.)',
  )

  const fixOccurrences = await prisma.occurrence.findMany({
    where: { taskId: fixTask.id },
    orderBy: { dueDate: 'asc' },
  })
  pruefe(fixOccurrences.length === 2, 'Es existiert genau ein Folgetermin')
  pruefe(fixOccurrences[0].status === 'DONE', 'Erledigte Fälligkeit steht auf DONE')
  pruefe(fixOccurrences[1].status === 'OPEN', 'Folgetermin steht auf OPEN')

  await erwarteFehler(
    () =>
      protokolliereDurchfuehrung(
        {
          occurrenceId: fixTask.occurrences[0].id,
          result: 'OK',
          durchgefuehrtAm: heute,
          abweichungen: [],
          nachweise: [],
        },
        benutzer.id,
      ),
    'unveränderlich',
    'Eine bereits erledigte Fälligkeit lässt sich nicht erneut erledigen',
  )

  // ---------------------------------------------------------------------
  console.log('\n2) Erledigen ab Erledigungsdatum (AFTER_COMPLETION, jährlich)')
  // ---------------------------------------------------------------------
  const nachTask = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Ab Erledigung`,
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'ANNUAL',
      scheduleMode: 'AFTER_COMPLETION',
      startDate: dateOnly(2026, 3, 1),
      leadTimeDays: 30,
      graceDays: 21,
      evidenceRequired: false,
      criticality: 'MEDIUM',
      active: true,
      occurrences: { create: { dueDate: dateOnly(2026, 3, 1), status: 'OVERDUE' } },
    },
    include: { occurrences: true },
  })

  const ergebnisNach = await protokolliereDurchfuehrung(
    {
      occurrenceId: nachTask.occurrences[0].id,
      result: 'OK_WITH_REMARKS',
      comment: 'Mit Anmerkungen erledigt.',
      durchgefuehrtAm: dateOnly(2026, 4, 20),
      abweichungen: [],
      nachweise: [],
    },
    benutzer.id,
  )
  pruefe(
    toISODate(ergebnisNach.naechsteFaelligkeit!) === '2027-04-20',
    'AFTER_COMPLETION rechnet ab dem Erledigungsdatum (20.04. + 12 Monate)',
  )

  // ---------------------------------------------------------------------
  console.log('\n3) Nachweispflicht und Abweichungspflicht')
  // ---------------------------------------------------------------------
  const nachweisTask = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Mit Nachweispflicht`,
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: addDays(heute, -3),
      leadTimeDays: 7,
      graceDays: 0,
      evidenceRequired: true,
      criticality: 'HIGH',
      active: true,
      occurrences: { create: { dueDate: addDays(heute, -3), status: 'OVERDUE' } },
    },
    include: { occurrences: true },
  })

  await erwarteFehler(
    () =>
      protokolliereDurchfuehrung(
        {
          occurrenceId: nachweisTask.occurrences[0].id,
          result: 'OK',
          durchgefuehrtAm: heute,
          abweichungen: [],
          nachweise: [],
        },
        benutzer.id,
      ),
    'Nachweis verpflichtend',
    'Ohne Nachweis wird die Durchführung abgelehnt',
  )

  await erwarteFehler(
    () =>
      protokolliereDurchfuehrung(
        {
          occurrenceId: nachweisTask.occurrences[0].id,
          result: 'DEVIATION',
          durchgefuehrtAm: heute,
          abweichungen: [],
          nachweise: [
            {
              filename: 'protokoll.pdf',
              storedPath: '2026/07/test.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1234,
              sha256: 'a'.repeat(64),
            },
          ],
        },
        benutzer.id,
      ),
    'mindestens eine Abweichung',
    'Ergebnis „Abweichung“ ohne Abweichung wird abgelehnt',
  )

  await erwarteFehler(
    () =>
      protokolliereDurchfuehrung(
        {
          occurrenceId: nachweisTask.occurrences[0].id,
          result: 'OK',
          durchgefuehrtAm: addDays(heute, 1),
          abweichungen: [],
          nachweise: [
            {
              filename: 'protokoll.pdf',
              storedPath: '2026/07/test2.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1234,
              sha256: 'b'.repeat(64),
            },
          ],
        },
        benutzer.id,
      ),
    'Zukunft',
    'Ein Durchführungsdatum in der Zukunft wird abgelehnt',
  )

  // Erfolgreicher Durchlauf mit Nachweis und Abweichung
  const ergebnisAbweichung = await protokolliereDurchfuehrung(
    {
      occurrenceId: nachweisTask.occurrences[0].id,
      result: 'DEVIATION',
      comment: 'Zwei Systeme ohne aktuelles Patchlevel.',
      durchgefuehrtAm: heute,
      abweichungen: [
        {
          title: 'Patchstand Server SRV-07 veraltet',
          description: 'Nachinstallation im nächsten Wartungsfenster.',
          severity: 'HIGH',
          responsibleId: benutzer.id,
          dueDate: addDays(heute, 30),
        },
      ],
      nachweise: [
        {
          filename: 'patch-report.pdf',
          storedPath: '2026/07/patch-report.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 54321,
          sha256: 'c'.repeat(64),
        },
      ],
    },
    benutzer.id,
  )

  const execution = await prisma.execution.findUniqueOrThrow({
    where: { id: ergebnisAbweichung.executionId },
    include: { attachments: true, findings: true },
  })
  pruefe(execution.attachments.length === 1, 'Der Nachweis wurde gespeichert')
  pruefe(
    execution.attachments[0].sha256.length === 64,
    'Die SHA-256-Prüfsumme wurde übernommen',
  )
  pruefe(execution.findings.length === 1, 'Die Abweichung wurde angelegt')
  pruefe(execution.findings[0].status === 'OPEN', 'Neue Abweichungen sind offen')

  // ---------------------------------------------------------------------
  console.log('\n4) Ausgesetzte Fälligkeit')
  // ---------------------------------------------------------------------
  const ausgesetzt = await prisma.occurrence.findFirstOrThrow({
    where: { taskId: nachweisTask.id, status: 'OPEN' },
  })
  await prisma.occurrence.update({
    where: { id: ausgesetzt.id },
    data: { status: 'SUSPENDED', suspendedReason: 'Systemumstellung' },
  })

  await erwarteFehler(
    () =>
      protokolliereDurchfuehrung(
        {
          occurrenceId: ausgesetzt.id,
          result: 'OK',
          durchgefuehrtAm: heute,
          abweichungen: [],
          nachweise: [
            {
              filename: 'x.pdf',
              storedPath: '2026/07/x.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              sha256: 'd'.repeat(64),
            },
          ],
        },
        benutzer.id,
      ),
    'ausgesetzt',
    'Eine ausgesetzte Fälligkeit kann nicht erledigt werden',
  )

  // ---------------------------------------------------------------------
  console.log('\n5) Audit-Protokoll')
  // ---------------------------------------------------------------------
  const auditEintraege = await prisma.auditLog.count({
    where: {
      userId: benutzer.id,
      action: { in: ['EXECUTION_CREATED', 'ATTACHMENT_UPLOADED', 'FINDING_CREATED'] },
    },
  })
  pruefe(
    auditEintraege >= 5,
    `Jede schreibende Aktion erzeugt einen Audit-Eintrag (${auditEintraege} gefunden)`,
  )

  // ---------------------------------------------------------------------
  console.log('\n6) Tagesabgleich')
  // ---------------------------------------------------------------------
  const abgleich = await fuehreTagesabgleichAus(null)
  pruefe(abgleich.geprueft > 0, 'Der Tagesabgleich prüft offene Fälligkeiten')

  const ohneOffene = await prisma.task.findMany({
    where: {
      active: true,
      occurrences: { none: { status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] } } },
    },
    select: { id: true },
  })
  pruefe(
    ohneOffene.length === 0,
    'Nach dem Abgleich hat jede aktive Aufgabe eine unerledigte Fälligkeit',
  )

  // ---------------------------------------------------------------------
  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nIntegrationstest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
