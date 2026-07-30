/**
 * Integrationstest des Kalender-Abonnements.
 *
 * Der Feed ist ohne Anmeldung erreichbar – das Geheimnis in der Adresse ist
 * der ganze Zugang. Geprüft wird deshalb vor allem, dass niemand mehr sieht
 * als die eigenen Fälligkeiten und dass eine erneuerte Adresse die alte
 * wirklich entwertet.
 *
 * Ausführen:  npm run test:kalender
 *
 * Voraussetzung: Datenbank vom Host aus erreichbar:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 */
import { PrismaClient } from '@prisma/client'

import { addDays, todayInBerlin } from '../src/lib/dates'
import {
  baueKalenderFuerToken,
  entferneKalenderToken,
  erneuereKalenderToken,
} from '../src/server/kalender-abo'
import { setzeVertretung } from '../src/server/vertretung'

const prisma = new PrismaClient()

const PRAEFIX = '[Kalendertest] '
const MAILS = ['eigen@kalendertest.local', 'fremd@kalendertest.local']
const APP_URL = 'https://beispiel.local'
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
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({
    where: { id: { in: aufgaben.map((a) => a.id) } },
  })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })

  const personen = await prisma.user.findMany({
    where: { email: { in: MAILS } },
    select: { id: true },
  })
  if (personen.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: personen.map((p) => p.id) } },
      data: {
        kalenderToken: null,
        vertretungId: null,
        vertretungVon: null,
        vertretungBis: null,
        active: true,
      },
    })
  }
}

async function main() {
  console.log('Kalendertest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const [eigen, fremd] = await Promise.all(
    [
      { email: MAILS[0], name: 'Eigene Person' },
      { email: MAILS[1], name: 'Fremde Person' },
    ].map((angabe) =>
      prisma.user.upsert({
        where: { email: angabe.email },
        update: { ...angabe, active: true, role: 'EDITOR' },
        create: { ...angabe, active: true, role: 'EDITOR' },
      }),
    ),
  )

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Datensicherung`, color: '#0F5C9E' },
  })

  const eigeneAufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Restore-Test; wichtig`,
      categoryId: kategorie.id,
      ownerId: eigen.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      leadTimeDays: 7,
      criticality: 'HIGH',
      active: true,
    },
  })
  await prisma.occurrence.create({
    data: { taskId: eigeneAufgabe.id, dueDate: addDays(heute, 5), status: 'OPEN' },
  })

  const fremdeAufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Fremde Prüfung`,
      categoryId: kategorie.id,
      ownerId: fremd.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })
  const fremdeFaelligkeit = await prisma.occurrence.create({
    data: { taskId: fremdeAufgabe.id, dueDate: addDays(heute, 6), status: 'OPEN' },
  })

  // Eine bereits erledigte Fälligkeit gehört nicht in den Kalender.
  await prisma.occurrence.create({
    data: {
      taskId: eigeneAufgabe.id,
      dueDate: addDays(heute, -30),
      status: 'DONE',
    },
  })

  // --- Adresse einrichten -------------------------------------------------
  const token = await erneuereKalenderToken(eigen.id)
  pruefe(token.length === 64, 'Das Geheimnis ist ausreichend lang')

  const kalender = await baueKalenderFuerToken(token, APP_URL)
  pruefe(kalender !== null, 'Der Kalender wird zum Geheimnis geliefert')
  const inhalt = kalender?.inhalt ?? ''

  pruefe(
    inhalt.includes(`SUMMARY:${PRAEFIX}Restore-Test\\; wichtig`),
    'Die eigene Fälligkeit steht drin – mit maskiertem Semikolon',
  )
  pruefe(
    !inhalt.includes('Fremde Prüfung'),
    'Fremde Fälligkeiten stehen nicht drin',
  )
  pruefe(
    (inhalt.match(/BEGIN:VEVENT/g) ?? []).length === 1,
    'Die erledigte Fälligkeit erscheint nicht',
  )
  pruefe(
    inhalt.includes(`URL:${APP_URL}/tasks/${eigeneAufgabe.id}`),
    'Der Termin verweist auf die Aufgabe',
  )
  pruefe(
    inhalt.includes('TRIGGER:-P7D'),
    'Der Vorlauf der Aufgabe wird zur Erinnerung',
  )
  pruefe(
    inhalt.includes('X-WR-CALNAME:Wartungsplaner – Eigene Person'),
    'Der Kalender trägt den Namen der Person',
  )

  // --- Vertretung ---------------------------------------------------------
  await setzeVertretung(
    fremd.id,
    { vertretungId: eigen.id, von: null, bis: null },
    fremd.id,
    false,
  )
  const mitVertretung = await baueKalenderFuerToken(token, APP_URL)
  pruefe(
    (mitVertretung?.inhalt ?? '').includes('Fremde Prüfung'),
    'Wer vertritt, sieht auch die Termine der abwesenden Person',
  )
  pruefe(
    (mitVertretung?.inhalt ?? '').includes('In Vertretung für Fremde Person'),
    'Und erkennt an der Beschreibung, wessen Termin das ist',
  )

  await setzeVertretung(
    fremd.id,
    { vertretungId: null, von: null, bis: null },
    fremd.id,
    false,
  )

  // --- Zugang ------------------------------------------------------------
  pruefe(
    (await baueKalenderFuerToken('a'.repeat(64), APP_URL)) === null,
    'Ein unbekanntes Geheimnis liefert nichts',
  )
  pruefe(
    (await baueKalenderFuerToken('', APP_URL)) === null,
    'Ein leeres Geheimnis liefert nichts',
  )

  const neuerToken = await erneuereKalenderToken(eigen.id)
  pruefe(neuerToken !== token, 'Das Erneuern vergibt ein anderes Geheimnis')
  pruefe(
    (await baueKalenderFuerToken(token, APP_URL)) === null,
    'Die alte Adresse läuft danach ins Leere',
  )

  await prisma.user.update({ where: { id: eigen.id }, data: { active: false } })
  pruefe(
    (await baueKalenderFuerToken(neuerToken, APP_URL)) === null,
    'Ein gesperrtes Konto liefert keinen Kalender mehr',
  )
  await prisma.user.update({ where: { id: eigen.id }, data: { active: true } })

  await entferneKalenderToken(eigen.id)
  pruefe(
    (await baueKalenderFuerToken(neuerToken, APP_URL)) === null,
    'Nach dem Aufheben liefert die Adresse nichts mehr',
  )

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: eigen.id, action: 'KALENDER_ABO_AUFGEHOBEN' },
  })
  pruefe(audit !== null, 'Das Aufheben steht im Audit-Log')

  // Aufräumen: die fremde Fälligkeit wird mit der Aufgabe entfernt.
  void fremdeFaelligkeit
  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nKalendertest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
