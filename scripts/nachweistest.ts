/**
 * Integrationstest des Nachweismoduls gegen eine laufende Postgres-Instanz.
 *
 * Prüft den Vier-Augen-Ablauf: erfassen, Pflichtangaben, Vorlegen,
 * Zurückweisung, Gegenzeichnung durch eine zweite Person, das erzeugte
 * PDF am Vorgang und die Unveränderlichkeit danach.
 *
 * Ausführen:  npx tsx scripts/nachweistest.ts
 * Voraussetzung: `docker compose up -d db` und angewandte Migrationen.
 */
import { PrismaClient } from '@prisma/client'

import { addDays, todayInBerlin } from '../src/lib/dates'
import {
  fuehreUebergangAus,
  ladeNachweis,
  ladeOffeneGegenzeichnungen,
  speichereAntworten,
  starteNachweis,
} from '../src/server/nachweise'

const prisma = new PrismaClient()

const PRAEFIX = '[Nachweistest] '
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
      console.error(`  FEHL ${beschreibung} – unerwartet: ${nachricht}`)
    }
  }
}

const EMAIL_ERFASSER = 'erfasser@nachweistest.local'
const EMAIL_PRUEFER = 'pruefer@nachweistest.local'

async function raeumeAuf() {
  const nachweise = await prisma.nachweis.findMany({
    where: { vorlage: { name: { startsWith: PRAEFIX } } },
    select: { id: true, attachmentId: true },
  })
  await prisma.nachweis.deleteMany({
    where: { id: { in: nachweise.map((n) => n.id) } },
  })
  await prisma.attachment.deleteMany({
    where: {
      id: {
        in: nachweise
          .map((n) => n.attachmentId)
          .filter((id): id is string => id !== null),
      },
    },
  })
  await prisma.pruefbogenVorlage.deleteMany({
    where: { name: { startsWith: PRAEFIX } },
  })
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({
    where: { id: { in: aufgaben.map((a) => a.id) } },
  })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
}

async function main() {
  console.log('Nachweistest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const erfasser = await prisma.user.upsert({
    where: { email: EMAIL_ERFASSER },
    update: { active: true },
    create: {
      name: 'Erfassende Person (Nachweistest)',
      email: EMAIL_ERFASSER,
      role: 'EDITOR',
      active: true,
    },
  })
  const pruefer = await prisma.user.upsert({
    where: { email: EMAIL_PRUEFER },
    update: { active: true },
    create: {
      name: 'Prüfende Person (Nachweistest)',
      email: EMAIL_PRUEFER,
      role: 'EDITOR',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Rezertifizierung`, color: '#0F5C9E' },
  })

  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Berechtigungsprüfung Fachanwendung`,
      categoryId: kategorie.id,
      ownerId: erfasser.id,
      intervalType: 'SEMIANNUAL',
      scheduleMode: 'FIXED',
      startDate: heute,
      graceDays: 7,
      active: true,
    },
  })

  const faelligkeit = await prisma.occurrence.create({
    data: {
      taskId: aufgabe.id,
      dueDate: addDays(heute, 3),
      status: 'OPEN',
    },
  })

  const vorlage = await prisma.pruefbogenVorlage.create({
    data: {
      name: `${PRAEFIX}Rezertifizierung Berechtigungen`,
      beschreibung: 'Prüfbogen des Integrationstests',
      taskId: aufgabe.id,
      vierAugen: true,
      aktiv: true,
      punkte: {
        create: [
          {
            position: 1,
            frage: 'Ist die Benutzerliste vollständig übernommen?',
            art: 'BEWERTUNG',
            pflicht: true,
          },
          {
            position: 2,
            frage: 'Entscheidung zu den Berechtigungen von M. Müller',
            art: 'ENTSCHEIDUNG',
            pflicht: true,
          },
          {
            position: 3,
            frage: 'Ergänzende Bemerkungen',
            art: 'TEXT',
            pflicht: false,
          },
        ],
      },
    },
    include: { punkte: { orderBy: { position: 'asc' } } },
  })

  // --- Erfassen -----------------------------------------------------------
  const nachweisId = await starteNachweis(
    faelligkeit.id,
    vorlage.id,
    erfasser.id,
  )
  const frisch = await ladeNachweis(nachweisId)
  pruefe(frisch?.status === 'ENTWURF', 'Ein neuer Nachweis ist ein Entwurf')
  pruefe(
    frisch?.vorlage.punkte.length === 3,
    'Der Nachweis führt alle Prüfpunkte des Bogens',
  )

  const nochmal = await starteNachweis(faelligkeit.id, vorlage.id, erfasser.id)
  pruefe(
    nochmal === nachweisId,
    'Ein zweiter Start liefert denselben Nachweis statt eines Duplikats',
  )

  // --- Pflichtangaben -----------------------------------------------------
  await erwarteFehler(
    () => fuehreUebergangAus(nachweisId, 'vorlegen', erfasser.id, null),
    'Pflicht',
    'Vorlegen ohne Pflichtangaben wird abgelehnt',
  )

  await speichereAntworten(nachweisId, erfasser.id, 'Lauf im Test', [
    {
      punktId: vorlage.punkte[0].id,
      ergebnis: 'ERFUELLT',
      wert: null,
      bemerkung: null,
    },
    {
      punktId: vorlage.punkte[1].id,
      ergebnis: 'ENTZIEHEN',
      wert: null,
      bemerkung: 'Abteilungswechsel zum Monatsende',
    },
    {
      punktId: vorlage.punkte[2].id,
      ergebnis: null,
      wert: 'Stichprobe über zehn Konten',
      bemerkung: null,
    },
  ])

  // --- Vorlegen -----------------------------------------------------------
  const vorgelegt = await fuehreUebergangAus(
    nachweisId,
    'vorlegen',
    erfasser.id,
    null,
  )
  pruefe(
    vorgelegt.neuerStatus === 'VORGELEGT',
    'Mit allen Pflichtangaben lässt sich der Nachweis vorlegen',
  )

  // --- Vier-Augen-Prinzip -------------------------------------------------
  await erwarteFehler(
    () => fuehreUebergangAus(nachweisId, 'gegenzeichnen', erfasser.id, null),
    'Vier-Augen',
    'Die erfassende Person kann ihren Nachweis nicht selbst gegenzeichnen',
  )

  const offene = await ladeOffeneGegenzeichnungen(pruefer.id)
  pruefe(
    offene.some((n) => n.id === nachweisId),
    'Der vorgelegte Nachweis erscheint bei der zweiten Person zur Gegenzeichnung',
  )
  const eigene = await ladeOffeneGegenzeichnungen(erfasser.id)
  pruefe(
    !eigene.some((n) => n.id === nachweisId),
    'Bei der erfassenden Person erscheint er dort nicht',
  )

  // --- Zurückweisen und erneut vorlegen -----------------------------------
  await erwarteFehler(
    () => fuehreUebergangAus(nachweisId, 'zurueckweisen', pruefer.id, null),
    'begründen',
    'Eine Zurückweisung ohne Begründung wird abgelehnt',
  )

  const zurueck = await fuehreUebergangAus(
    nachweisId,
    'zurueckweisen',
    pruefer.id,
    'Bitte die Stichprobe auf zwanzig Konten erweitern.',
  )
  pruefe(
    zurueck.neuerStatus === 'ZURUECKGEWIESEN',
    'Die prüfende Person kann mit Begründung zurückweisen',
  )

  await speichereAntworten(nachweisId, erfasser.id, 'Stichprobe erweitert', [
    {
      punktId: vorlage.punkte[2].id,
      ergebnis: null,
      wert: 'Stichprobe über zwanzig Konten',
      bemerkung: null,
    },
  ])
  await fuehreUebergangAus(nachweisId, 'vorlegen', erfasser.id, null)

  // --- Gegenzeichnen ------------------------------------------------------
  const fertig = await fuehreUebergangAus(
    nachweisId,
    'gegenzeichnen',
    pruefer.id,
    null,
  )
  pruefe(
    fertig.neuerStatus === 'GEGENGEZEICHNET',
    'Die zweite Person zeichnet gegen',
  )
  pruefe(
    fertig.attachmentId !== null,
    'Beim Gegenzeichnen entsteht der PDF-Nachweis',
  )
  pruefe(
    fertig.feststellungen.some((f) => f.ergebnis === 'ENTZIEHEN'),
    'Die Feststellung „entziehen“ wird im Ergebnis ausgewiesen',
  )

  const anhang = await prisma.attachment.findUnique({
    where: { id: fertig.attachmentId! },
  })
  pruefe(
    anhang?.mimeType === 'application/pdf',
    'Der Anhang ist als PDF hinterlegt',
  )
  pruefe(
    (anhang?.sha256?.length ?? 0) === 64,
    'Der Anhang trägt eine SHA-256-Prüfsumme',
  )
  const erledigt = await prisma.occurrence.findUnique({
    where: { id: faelligkeit.id },
    include: { execution: { select: { id: true, result: true } } },
  })
  pruefe(
    erledigt?.status === 'DONE',
    'Mit der Gegenzeichnung gilt die Fälligkeit als erledigt',
  )
  pruefe(
    anhang?.executionId === erledigt?.execution?.id,
    'Der Nachweis hängt an der Durchführung dieser Fälligkeit',
  )
  pruefe(
    erledigt?.execution?.result === 'OK_WITH_REMARKS',
    'Eine Feststellung führt zum Ergebnis „in Ordnung mit Bemerkungen“',
  )
  const folge = await prisma.occurrence.findFirst({
    where: { taskId: aufgabe.id, status: 'OPEN' },
  })
  pruefe(folge !== null, 'Der Folgetermin entsteht wie bei jeder Erledigung')

  // --- Unveränderlichkeit -------------------------------------------------
  await erwarteFehler(
    () =>
      speichereAntworten(nachweisId, erfasser.id, null, [
        {
          punktId: vorlage.punkte[0].id,
          ergebnis: 'NICHT_ERFUELLT',
          wert: null,
          bemerkung: null,
        },
      ]),
    'nicht',
    'Ein gegengezeichneter Nachweis lässt sich nicht mehr ändern',
  )
  await erwarteFehler(
    () => fuehreUebergangAus(nachweisId, 'vorlegen', erfasser.id, null),
    'nicht',
    'Ein gegengezeichneter Nachweis lässt sich nicht erneut vorlegen',
  )

  // --- Protokoll ----------------------------------------------------------
  const eintraege = await prisma.auditLog.findMany({
    where: { entityType: 'Nachweis', entityId: nachweisId },
    select: { action: true, userId: true },
  })
  pruefe(
    eintraege.length >= 4,
    'Jeder Schritt erscheint im Audit-Log (erfassen, vorlegen, zurückweisen, gegenzeichnen)',
  )
  pruefe(
    eintraege.some((e) => e.userId === pruefer.id),
    'Die Gegenzeichnung ist der zweiten Person zugeordnet',
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
    console.error('\nNachweistest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
