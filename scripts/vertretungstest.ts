/**
 * Integrationstest der Vertretung bei Abwesenheit.
 *
 * Der Kern ist nicht das Speichern, sondern die Wirkung: Landen die
 * Erinnerungen tatsächlich bei der vertretenden Person, und bleibt die
 * Zuständigkeit unberührt? Beides lässt sich nur mit echter Datenbank prüfen.
 *
 * Ausführen:  npm run test:vertretung
 *
 * Voraussetzung: Datenbank vom Host aus erreichbar:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 */
import { PrismaClient } from '@prisma/client'

import { addDays, todayInBerlin } from '../src/lib/dates'
import { loeseVertretung } from '../src/lib/vertretung'
import { baueVertretungsAufloesung } from '../src/server/benachrichtigungen'
import {
  VertretungsFehler,
  ladeVertretung,
  ladeVertretungenFuer,
  ladeVertretungsKarte,
  setzeVertretung,
} from '../src/server/vertretung'

const prisma = new PrismaClient()

const PRAEFIX = '[Vertretungstest] '
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

const MAILS = [
  'abwesend@vertretungstest.local',
  'vertretung@vertretungstest.local',
  'dritte@vertretungstest.local',
  'lesend@vertretungstest.local',
]

async function raeumeAuf() {
  const personen = await prisma.user.findMany({
    where: { email: { in: MAILS } },
    select: { id: true },
  })
  const ids = personen.map((p) => p.id)

  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({ where: { id: { in: aufgaben.map((a) => a.id) } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })

  // Die Konten bleiben stehen: Am Audit-Log hängen Einträge, und das ist
  // revisionssicher – es lässt sich nicht löschen, auch nicht für einen Test.
  if (ids.length > 0) {
    await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { vertretungId: null, vertretungVon: null, vertretungBis: null },
    })
  }
}

async function main() {
  console.log('Vertretungstest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const [abwesend, vertretung, dritte, lesend] = await Promise.all(
    [
      { email: MAILS[0], name: 'Abwesende Person', role: 'EDITOR' as const },
      { email: MAILS[1], name: 'Vertretende Person', role: 'EDITOR' as const },
      { email: MAILS[2], name: 'Dritte Person', role: 'ADMIN' as const },
      { email: MAILS[3], name: 'Nur lesend', role: 'AUDITOR' as const },
    ].map((angabe) =>
      prisma.user.upsert({
        where: { email: angabe.email },
        update: { ...angabe, active: true, notifyByEmail: true },
        create: { ...angabe, active: true, notifyByEmail: true },
      }),
    ),
  )

  // --- Regeln beim Setzen -------------------------------------------------
  await erwarteFehler(
    () =>
      setzeVertretung(
        abwesend.id,
        { vertretungId: abwesend.id, von: null, bis: null },
        abwesend.id,
        false,
      ),
    'selbst vertreten',
    'Selbstvertretung wird abgelehnt',
  )

  await erwarteFehler(
    () =>
      setzeVertretung(
        abwesend.id,
        { vertretungId: lesend.id, von: null, bis: null },
        abwesend.id,
        false,
      ),
    'durchführen dürfen',
    'Eine nur lesende Person kann nicht vertreten',
  )

  await erwarteFehler(
    () =>
      setzeVertretung(
        abwesend.id,
        { vertretungId: vertretung.id, von: null, bis: null },
        vertretung.id,
        false,
      ),
    'Verwaltung',
    'Ohne Verwaltungsrecht wird keine fremde Vertretung gesetzt',
  )

  await erwarteFehler(
    () =>
      setzeVertretung(
        abwesend.id,
        {
          vertretungId: vertretung.id,
          von: addDays(heute, 10),
          bis: addDays(heute, 3),
        },
        abwesend.id,
        false,
      ),
    'Ende darf nicht vor dem Beginn',
    'Ein Ende vor dem Beginn wird abgelehnt',
  )

  // --- Setzen und Wirkung -------------------------------------------------
  await setzeVertretung(
    abwesend.id,
    { vertretungId: vertretung.id, von: null, bis: addDays(heute, 14) },
    abwesend.id,
    false,
  )

  const stand = await ladeVertretung(abwesend.id, heute)
  pruefe(
    stand?.vertretungName === 'Vertretende Person' && stand.aktiv,
    'Die Vertretung ist hinterlegt und gilt heute',
  )

  const uebernommen = await ladeVertretungenFuer(vertretung.id, heute)
  pruefe(
    uebernommen.length === 1 && uebernommen[0].personId === abwesend.id,
    'Die vertretende Person sieht, wen sie vertritt',
  )

  const audit = await prisma.auditLog.findFirst({
    where: { entityId: abwesend.id, action: 'VERTRETUNG_GESETZT' },
    orderBy: { timestamp: 'desc' },
  })
  pruefe(audit !== null, 'Das Setzen steht im Audit-Log')

  // --- Kette und Ring -----------------------------------------------------
  await setzeVertretung(
    vertretung.id,
    { vertretungId: dritte.id, von: null, bis: null },
    vertretung.id,
    false,
  )
  const karte = await ladeVertretungsKarte()
  pruefe(
    loeseVertretung(abwesend.id, karte, heute).empfaengerId === dritte.id,
    'Ist auch die Vertretung abwesend, geht die Meldung weiter',
  )

  await erwarteFehler(
    () =>
      setzeVertretung(
        dritte.id,
        { vertretungId: abwesend.id, von: null, bis: null },
        dritte.id,
        false,
      ),
    'Kreis',
    'Ein Kreis wird vor dem Speichern abgelehnt',
  )

  // --- Zeitraum -----------------------------------------------------------
  await setzeVertretung(
    vertretung.id,
    { vertretungId: null, von: null, bis: null },
    vertretung.id,
    false,
  )
  await setzeVertretung(
    abwesend.id,
    {
      vertretungId: vertretung.id,
      von: addDays(heute, 5),
      bis: addDays(heute, 10),
    },
    abwesend.id,
    false,
  )
  const spaeter = await ladeVertretungsKarte()
  pruefe(
    loeseVertretung(abwesend.id, spaeter, heute).empfaengerId === abwesend.id,
    'Vor dem Beginn bleibt die Meldung bei der zuständigen Person',
  )
  pruefe(
    loeseVertretung(abwesend.id, spaeter, addDays(heute, 7)).empfaengerId ===
      vertretung.id,
    'Im Zeitraum greift die Vertretung',
  )
  pruefe(
    loeseVertretung(abwesend.id, spaeter, addDays(heute, 11)).empfaengerId ===
      abwesend.id,
    'Danach endet sie von selbst – ohne dass jemand aufräumen muss',
  )

  // --- Wirkung auf die Benachrichtigungen ---------------------------------
  await setzeVertretung(
    abwesend.id,
    { vertretungId: vertretung.id, von: null, bis: null },
    abwesend.id,
    false,
  )

  const aufloesen = await baueVertretungsAufloesung(heute)
  const umgeleitet = aufloesen({
    id: abwesend.id,
    name: abwesend.name,
    email: abwesend.email,
    notifyByEmail: true,
  })
  pruefe(
    umgeleitet.email === vertretung.email &&
      umgeleitet.inVertretungFuer === abwesend.name,
    'Die Erinnerung geht an die Vertretung und nennt, für wen',
  )
  pruefe(
    aufloesen({
      id: dritte.id,
      name: dritte.name,
      email: dritte.email,
      notifyByEmail: true,
    }).inVertretungFuer === null,
    'Wer anwesend ist, bekommt seine Post unverändert',
  )

  // Ein gesperrtes Konto liest keine Post: Dann lieber bei der zuständigen
  // Person bleiben, als die Meldung ins Leere laufen zu lassen.
  await prisma.user.update({
    where: { id: vertretung.id },
    data: { active: false },
  })
  const nachSperre = await baueVertretungsAufloesung(heute)
  pruefe(
    nachSperre({
      id: abwesend.id,
      name: abwesend.name,
      email: abwesend.email,
      notifyByEmail: true,
    }).email === abwesend.email,
    'Ist die Vertretung gesperrt, bleibt die Meldung bei der zuständigen Person',
  )
  await prisma.user.update({
    where: { id: vertretung.id },
    data: { active: true },
  })

  // --- Zuständigkeit bleibt -----------------------------------------------
  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#0F5C9E' },
  })
  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Datensicherung prüfen`,
      categoryId: kategorie.id,
      ownerId: abwesend.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })
  const nachher = await prisma.task.findUniqueOrThrow({
    where: { id: aufgabe.id },
    select: { ownerId: true },
  })
  pruefe(
    nachher.ownerId === abwesend.id,
    'Die Zuständigkeit für die Aufgabe bleibt bei der abwesenden Person',
  )

  // --- Aufheben -----------------------------------------------------------
  await setzeVertretung(
    abwesend.id,
    { vertretungId: null, von: null, bis: null },
    dritte.id,
    true,
  )
  const aufgehoben = await ladeVertretung(abwesend.id, heute)
  pruefe(
    aufgehoben?.vertretungId === null &&
      aufgehoben.von === null &&
      aufgehoben.bis === null,
    'Beim Aufheben verschwindet auch der Zeitraum',
  )
  const aufhebung = await prisma.auditLog.findFirst({
    where: { entityId: abwesend.id, action: 'VERTRETUNG_AUFGEHOBEN' },
    orderBy: { timestamp: 'desc' },
  })
  pruefe(
    (aufhebung?.payloadJson as { fuerAndere?: boolean } | null)?.fuerAndere ===
      true,
    'Das Audit-Log hält fest, dass die Verwaltung für jemand anderen gehandelt hat',
  )

  const unbekannt = 'nicht-vorhanden'
  await erwarteFehler(
    () =>
      setzeVertretung(
        abwesend.id,
        { vertretungId: unbekannt, von: null, bis: null },
        abwesend.id,
        false,
      ),
    'nicht gefunden',
    'Eine unbekannte Person wird abgewiesen',
  )

  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    if (error instanceof VertretungsFehler) {
      console.error('\nUnerwarteter Fachfehler:', error.message)
    } else {
      console.error('\nVertretungstest abgebrochen:', error)
    }
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
