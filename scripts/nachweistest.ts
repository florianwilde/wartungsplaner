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
  entferneBeleg,
  erzeugeAbweichungAusFeststellung,
  fuegeBelegeHinzu,
  fuehreUebergangAus,
  ladeFeststellungen,
  ladeNachweis,
  ladeOffeneGegenzeichnungen,
  speichereAntworten,
  speichereZeilen,
  starteNachweis,
  uebernehmeZeilen,
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

  // --- Belege -------------------------------------------------------------
  const adExport = new File(
    ['sAMAccountName;Gruppe\r\nmmueller;Fachanwendung-Admins\r\n'],
    'AD-Export Fachanwendung.csv',
    { type: 'text/csv' },
  )
  const screenshot = new File([Buffer.from('89504e470d0a1a0a', 'hex')], 'screenshot.png', {
    type: 'image/png',
  })

  const anzahl = await fuegeBelegeHinzu(
    nachweisId,
    erfasser.id,
    [adExport, screenshot],
    vorlage.punkte[1].id,
  )
  pruefe(anzahl === 2, 'Mehrere Belege lassen sich in einem Zug hinzufügen')

  const mitBelegen = await ladeNachweis(nachweisId)
  pruefe(
    mitBelegen?.belege.length === 2,
    'Die Belege hängen am Prüfbogen',
  )
  pruefe(
    mitBelegen!.belege.every((b) => b.sha256.length === 64),
    'Jeder Beleg trägt eine SHA-256-Prüfsumme',
  )
  pruefe(
    mitBelegen!.belege.every((b) => b.punktId === vorlage.punkte[1].id),
    'Belege lassen sich einem einzelnen Prüfpunkt zuordnen',
  )
  const nochOhneDurchfuehrung = await prisma.attachment.findMany({
    where: { nachweisId },
    select: { executionId: true },
  })
  pruefe(
    nochOhneDurchfuehrung.every((b) => b.executionId === null),
    'Vor dem Abschluss hängen sie an keiner Durchführung',
  )

  await erwarteFehler(
    () => fuegeBelegeHinzu(nachweisId, pruefer.id, [screenshot], null),
    'erfassende Person',
    'Eine fremde Person kann keine Belege hinzufügen',
  )

  const ueberzaehlig = new File(['x'], 'skript.exe', { type: 'application/octet-stream' })
  await erwarteFehler(
    () => fuegeBelegeHinzu(nachweisId, erfasser.id, [ueberzaehlig], null),
    'nicht zugelassen',
    'Nicht zugelassene Dateitypen werden abgewiesen',
  )

  const zuEntfernen = mitBelegen!.belege[1]
  await entferneBeleg(nachweisId, zuEntfernen.id, erfasser.id)
  const nachEntfernen = await ladeNachweis(nachweisId)
  pruefe(
    nachEntfernen?.belege.length === 1,
    'Ein Beleg lässt sich vor dem Abschluss wieder entfernen',
  )

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

  const belegeDanach = await prisma.attachment.findMany({
    where: { nachweisId },
    select: { executionId: true, filename: true },
  })
  pruefe(
    belegeDanach.length === 1 &&
      belegeDanach[0].executionId === erledigt?.execution?.id,
    'Die Belege wandern mit dem Abschluss an die Durchführung',
  )
  const anDerDurchfuehrung = await prisma.attachment.count({
    where: { executionId: erledigt?.execution?.id },
  })
  pruefe(
    anDerDurchfuehrung === 2,
    'An der Durchführung hängen Beleg und PDF-Nachweis gemeinsam',
  )

  await erwarteFehler(
    () => fuegeBelegeHinzu(nachweisId, erfasser.id, [adExport], null),
    'nicht mehr änderbar',
    'Nach dem Abschluss lassen sich keine Belege mehr hinzufügen',
  )
  await erwarteFehler(
    () => entferneBeleg(nachweisId, zuEntfernen.id, erfasser.id),
    'nicht mehr änderbar',
    'Nach dem Abschluss lässt sich kein Beleg mehr entfernen',
  )

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

  // --- Feststellungen in Abweichungen überführen ---------------------------
  const feststellungen = await ladeFeststellungen(nachweisId)
  pruefe(
    feststellungen.length === 1 && feststellungen[0].position === 2,
    'Der auffällige Prüfpunkt erscheint als Feststellung',
  )
  pruefe(
    feststellungen[0]?.findingId === null,
    'Vor dem Überführen gibt es dazu noch keine Abweichung',
  )

  const findingId = await erzeugeAbweichungAusFeststellung(
    nachweisId,
    {
      punktId: feststellungen[0].punktId,
      title: 'Berechtigungen von M. Müller entziehen',
      description: 'Aus dem Prüfbogen übernommen.',
      severity: 'HIGH',
      responsibleId: erfasser.id,
      dueDate: addDays(heute, 30),
    },
    pruefer.id,
  )
  const abweichung = await prisma.finding.findUnique({
    where: { id: findingId },
    select: { punktId: true, executionId: true, severity: true, status: true },
  })
  pruefe(
    abweichung?.punktId === feststellungen[0].punktId,
    'Die Abweichung verweist auf den Prüfpunkt, aus dem sie stammt',
  )
  pruefe(
    abweichung?.executionId === erledigt?.execution?.id,
    'Sie hängt an der Durchführung dieser Fälligkeit',
  )
  pruefe(
    abweichung?.status === 'OPEN' && abweichung.severity === 'HIGH',
    'Schwere und Status werden übernommen',
  )

  const danach = await ladeFeststellungen(nachweisId)
  pruefe(
    danach[0]?.findingId === findingId,
    'Die Feststellung weist die angelegte Abweichung aus',
  )

  await erwarteFehler(
    () =>
      erzeugeAbweichungAusFeststellung(
        nachweisId,
        {
          punktId: feststellungen[0].punktId,
          title: 'Zweiter Versuch',
          description: null,
          severity: 'LOW',
          responsibleId: erfasser.id,
          dueDate: addDays(heute, 30),
        },
        pruefer.id,
      ),
    'bereits eine Abweichung',
    'Aus derselben Feststellung entsteht keine zweite Abweichung',
  )

  // --- Zeilenlisten -------------------------------------------------------
  const listenAufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Rezertifizierung Konten`,
      categoryId: kategorie.id,
      ownerId: erfasser.id,
      intervalType: 'ANNUAL',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })
  const listenFaelligkeit = await prisma.occurrence.create({
    data: { taskId: listenAufgabe.id, dueDate: addDays(heute, 7), status: 'OPEN' },
  })
  const listenVorlage = await prisma.pruefbogenVorlage.create({
    data: {
      name: `${PRAEFIX}Kontenliste`,
      taskId: listenAufgabe.id,
      vierAugen: false,
      aktiv: true,
      punkte: {
        create: [
          {
            position: 1,
            frage: 'Sind die Berechtigungen weiterhin erforderlich?',
            art: 'LISTE',
            pflicht: true,
          },
        ],
      },
    },
    include: { punkte: true },
  })
  const listenPunkt = listenVorlage.punkte[0]
  const listenNachweis = await starteNachweis(
    listenFaelligkeit.id,
    listenVorlage.id,
    erfasser.id,
  )

  await erwarteFehler(
    () => fuehreUebergangAus(listenNachweis, 'abschliessen', erfasser.id, null),
    'Pflicht',
    'Eine Liste ohne Zeilen gilt als unbeantwortet',
  )

  const csv = [
    'sAMAccountName;Gruppe',
    'mmueller;Fachanwendung-Admins',
    'sschmidt;Buchhaltung',
    'kklein;Vertrieb',
    'mmueller;Fachanwendung-Admins',
    ';ohne Namen',
  ].join('\r\n')

  const uebernahme = await uebernehmeZeilen(
    listenNachweis,
    listenPunkt.id,
    csv,
    erfasser.id,
    true,
  )
  pruefe(uebernahme.uebernommen === 3, 'Der AD-Export wird zeilenweise übernommen')
  pruefe(uebernahme.kopfzeileErkannt, 'Die Kopfzeile wird als solche erkannt')
  pruefe(
    uebernahme.uebersprungen.length === 2,
    'Doppelte und namenlose Zeilen werden gemeldet statt still verworfen',
  )

  await erwarteFehler(
    () => fuehreUebergangAus(listenNachweis, 'abschliessen', erfasser.id, null),
    'Pflicht',
    'Solange Zeilen offen sind, bleibt die Liste unbeantwortet',
  )

  const mitZeilen = await ladeNachweis(listenNachweis)
  const zeilen = mitZeilen!.zeilen
  pruefe(
    zeilen.length === 3 && zeilen.every((z) => z.ergebnis === null),
    'Übernommene Zeilen sind zunächst ohne Entscheidung',
  )
  pruefe(
    zeilen[0].bezeichnung === 'mmueller' &&
      zeilen[0].zusatz === 'Fachanwendung-Admins',
    'Bezeichnung und Zusatz stammen aus den ersten beiden Spalten',
  )

  // Sammelentscheidung: alles belassen, eine Ausnahme entziehen.
  await speichereZeilen(
    listenNachweis,
    erfasser.id,
    zeilen.map((z) => ({
      id: z.id,
      ergebnis: z.bezeichnung === 'kklein' ? 'ENTZIEHEN' : 'BELASSEN',
      bemerkung: z.bezeichnung === 'kklein' ? 'Austritt zum Monatsende' : null,
    })),
  )

  const listenErgebnis = await fuehreUebergangAus(
    listenNachweis,
    'abschliessen',
    erfasser.id,
    null,
  )
  pruefe(
    listenErgebnis.neuerStatus === 'GEGENGEZEICHNET',
    'Mit entschiedenen Zeilen lässt sich der Bogen abschließen',
  )
  pruefe(
    listenErgebnis.feststellungen.some((f) => f.frage.includes('kklein')),
    'Die entzogene Zeile erscheint als Feststellung',
  )
  pruefe(
    listenErgebnis.feststellungen.length === 1,
    'Belassene Zeilen sind keine Feststellung',
  )

  const listenErledigt = await prisma.occurrence.findUnique({
    where: { id: listenFaelligkeit.id },
    include: { execution: { select: { result: true } } },
  })
  pruefe(
    listenErledigt?.execution?.result === 'OK_WITH_REMARKS',
    'Eine Zeile mit Befund färbt das Ergebnis der Durchführung',
  )

  await erwarteFehler(
    () =>
      uebernehmeZeilen(listenNachweis, listenPunkt.id, csv, erfasser.id, true),
    'nicht mehr änderbar',
    'Nach dem Abschluss lassen sich keine Zeilen mehr übernehmen',
  )

  // --- Ohne Vier-Augen-Prinzip: abschließen in einem Zug ------------------
  const soloAufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Firewall-Regel-Review`,
      categoryId: kategorie.id,
      ownerId: erfasser.id,
      intervalType: 'QUARTERLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      graceDays: 0,
      active: true,
    },
  })
  const soloFaelligkeit = await prisma.occurrence.create({
    data: { taskId: soloAufgabe.id, dueDate: addDays(heute, 5), status: 'OPEN' },
  })
  const soloVorlage = await prisma.pruefbogenVorlage.create({
    data: {
      name: `${PRAEFIX}Regelprüfung ohne Gegenzeichnung`,
      taskId: soloAufgabe.id,
      vierAugen: false,
      aktiv: true,
      punkte: {
        create: [
          {
            position: 1,
            frage: 'Sind alle Regeln noch begründet?',
            art: 'BEWERTUNG',
            pflicht: true,
          },
        ],
      },
    },
    include: { punkte: true },
  })

  const soloId = await starteNachweis(
    soloFaelligkeit.id,
    soloVorlage.id,
    erfasser.id,
  )

  // Genau der Fall aus der Oberfläche: Die Antwort steht noch im Browser,
  // der Server kennt sie nicht. Erst speichern, dann abschließen.
  await erwarteFehler(
    () => fuehreUebergangAus(soloId, 'abschliessen', erfasser.id, null),
    'Pflicht',
    'Abschließen ohne gespeicherte Antworten wird abgelehnt',
  )

  await speichereAntworten(soloId, erfasser.id, null, [
    {
      punktId: soloVorlage.punkte[0].id,
      ergebnis: 'ERFUELLT',
      wert: null,
      bemerkung: null,
    },
  ])
  const solo = await fuehreUebergangAus(soloId, 'abschliessen', erfasser.id, null)
  pruefe(
    solo.neuerStatus === 'GEGENGEZEICHNET',
    'Ohne Vier-Augen-Prinzip schließt die erfassende Person selbst ab',
  )
  pruefe(
    solo.attachmentId !== null,
    'Auch dabei entsteht der PDF-Nachweis an der Durchführung',
  )
  const soloErledigt = await prisma.occurrence.findUnique({
    where: { id: soloFaelligkeit.id },
    include: { execution: { select: { result: true } } },
  })
  pruefe(
    soloErledigt?.status === 'DONE' && soloErledigt.execution?.result === 'OK',
    'Ohne Feststellung lautet das Ergebnis „in Ordnung“',
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
