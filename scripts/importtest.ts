/**
 * Integrationstest für den Import von Audit-Referenzen und Prüfbögen.
 *
 * Der Kern ist nicht das Anlegen, sondern die Grenze: Ein Prüfbogen, mit dem
 * bereits geprüft wurde, darf seine Prüfpunkte nicht mehr verlieren. An ihnen
 * hängen Antworten und Belege geführter Nachweise – ein Austausch würde sie
 * über die Fremdschlüssel mitlöschen und damit einen abgeschlossenen Nachweis
 * nachträglich verändern.
 *
 * Ausführen:  npm run test:import
 *
 * Voraussetzung: Datenbank vom Host aus erreichbar:
 *   docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
 */
import { PrismaClient } from '@prisma/client'

import { leseCsv } from '../src/lib/csv'
import { todayInBerlin } from '../src/lib/dates'
import {
  pruefeAuditReferenzen,
  pruefePruefboegen,
  type PruefbogenBestand,
  type ReferenzDaten,
} from '../src/lib/import-export'
import { schreibeAuditReferenzen, schreibePruefboegen } from '../src/server/import'

const prisma = new PrismaClient()

const PRAEFIX = '[Importtest] '
const EMAIL = 'import@test.local'
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

/** Liest den aktuellen Bestand so, wie die Prüffunktionen ihn erwarten. */
async function bestandReferenzen(): Promise<ReferenzDaten[]> {
  return prisma.auditReferenz.findMany({
    select: {
      kuerzel: true,
      bezeichnung: true,
      rahmenwerk: true,
      beschreibung: true,
      aktiv: true,
      sortOrder: true,
    },
  })
}

async function bestandBoegen(): Promise<PruefbogenBestand[]> {
  const boegen = await prisma.pruefbogenVorlage.findMany({
    include: {
      punkte: { orderBy: { position: 'asc' } },
      task: { select: { title: true } },
      _count: { select: { nachweise: true } },
    },
  })

  return boegen.map((bogen) => ({
    name: bogen.name,
    beschreibung: bogen.beschreibung,
    aufgabe: bogen.task?.title ?? null,
    vierAugen: bogen.vierAugen,
    aktiv: bogen.aktiv,
    punkte: bogen.punkte.map((p) => ({
      position: p.position,
      frage: p.frage,
      hinweis: p.hinweis,
      art: p.art,
      pflicht: p.pflicht,
    })),
    hatNachweise: bogen._count.nachweise > 0,
  }))
}

const REFERENZ_KOPF =
  'rahmenwerk;kuerzel;bezeichnung;beschreibung;aktiv;reihenfolge'
const BOGEN_KOPF =
  'pruefbogen;beschreibung;aufgabe;vier_augen;aktiv;position;frage;hinweis;art;pflicht'

async function raeumeAuf() {
  const boegen = await prisma.pruefbogenVorlage.findMany({
    where: { name: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.nachweis.deleteMany({
    where: { vorlageId: { in: boegen.map((b) => b.id) } },
  })
  await prisma.pruefbogenVorlage.deleteMany({
    where: { name: { startsWith: PRAEFIX } },
  })

  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({ where: { id: { in: aufgaben.map((a) => a.id) } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
  await prisma.auditReferenz.deleteMany({ where: { rahmenwerk: `${PRAEFIX}Norm` } })
}

async function main() {
  console.log('Importtest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const benutzer = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { active: true },
    create: {
      name: 'Testperson (Import)',
      email: EMAIL,
      role: 'ADMIN',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#2563eb' },
  })
  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Rezertifizierung`,
      categoryId: kategorie.id,
      ownerId: benutzer.id,
      intervalType: 'SEMIANNUAL',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })

  // --- Audit-Referenzen ---------------------------------------------------
  const referenzDatei = [
    REFERENZ_KOPF,
    `${PRAEFIX}Norm;A.1;Erste Anforderung;;ja;10`,
    `${PRAEFIX}Norm;A.2;Zweite Anforderung;Mit Erläuterung;ja;20`,
  ].join('\n')

  const referenzVorschau = pruefeAuditReferenzen(
    leseCsv(referenzDatei),
    await bestandReferenzen(),
  )
  pruefe(
    referenzVorschau.fehler.length === 0 && referenzVorschau.anlegen === 2,
    'Zwei neue Referenzen werden erkannt',
  )

  const referenzErgebnis = await schreibeAuditReferenzen(referenzVorschau, benutzer.id)
  pruefe(referenzErgebnis.angelegt === 2, 'Beide Referenzen werden geschrieben')

  const gespeichert = await prisma.auditReferenz.findFirst({
    where: { rahmenwerk: `${PRAEFIX}Norm`, kuerzel: 'A.2' },
  })
  pruefe(
    gespeichert?.beschreibung === 'Mit Erläuterung' && gespeichert.sortOrder === 20,
    'Beschreibung und Reihenfolge kommen mit',
  )

  // Zweiter Lauf mit derselben Datei: nichts darf sich ändern.
  const nochmal = pruefeAuditReferenzen(
    leseCsv(referenzDatei),
    await bestandReferenzen(),
  )
  pruefe(
    nochmal.unveraendert === 2 && nochmal.anlegen === 0,
    'Ein zweiter Lauf derselben Datei ändert nichts',
  )

  // --- Prüfbögen ----------------------------------------------------------
  const bogenName = `${PRAEFIX}Berechtigungen`
  const bogenDatei = (frage: string) =>
    [
      BOGEN_KOPF,
      `${bogenName};Durchsicht der Konten;${aufgabe.title};ja;ja;1;${frage};Hinweis dazu;BEWERTUNG;ja`,
      `${bogenName};Durchsicht der Konten;${aufgabe.title};ja;ja;2;Anzahl geprüfter Konten;;ZAHL;ja`,
    ].join('\n')

  const bogenVorschau = pruefePruefboegen(
    leseCsv(bogenDatei('Sind alle Konten begründet?')),
    await bestandBoegen(),
    [aufgabe.title],
  )
  pruefe(
    bogenVorschau.fehler.length === 0 && bogenVorschau.anlegen === 1,
    'Zwei Zeilen ergeben einen Prüfbogen',
  )

  await schreibePruefboegen(bogenVorschau, benutzer.id)

  const bogen = await prisma.pruefbogenVorlage.findFirstOrThrow({
    where: { name: bogenName },
    include: { punkte: { orderBy: { position: 'asc' } }, task: true },
  })
  pruefe(bogen.punkte.length === 2, 'Beide Prüfpunkte werden angelegt')
  pruefe(
    bogen.vierAugen && bogen.taskId === aufgabe.id,
    'Vier-Augen-Pflicht und Aufgabenzuordnung kommen mit',
  )
  pruefe(
    bogen.punkte[1].art === 'ZAHL' && bogen.punkte[0].hinweis === 'Hinweis dazu',
    'Art und Hinweis der Prüfpunkte kommen mit',
  )

  // Änderung an einem noch unbenutzten Bogen: Punkte dürfen ersetzt werden.
  const geaendert = pruefePruefboegen(
    leseCsv(bogenDatei('Ganz andere Frage?')),
    await bestandBoegen(),
    [aufgabe.title],
  )
  pruefe(
    geaendert.fehler.length === 0 &&
      geaendert.eintraege[0].aenderungen.includes('Prüfpunkte'),
    'Bei einem unbenutzten Bogen gilt die Änderung der Prüfpunkte',
  )
  await schreibePruefboegen(geaendert, benutzer.id)

  const nachAenderung = await prisma.pruefbogenVorlage.findFirstOrThrow({
    where: { name: bogenName },
    include: { punkte: { orderBy: { position: 'asc' } } },
  })
  pruefe(
    nachAenderung.punkte[0].frage === 'Ganz andere Frage?',
    'Die neuen Prüfpunkte sind gespeichert',
  )

  // --- Die Grenze: ein benutzter Bogen ------------------------------------
  const faelligkeit = await prisma.occurrence.create({
    data: { taskId: aufgabe.id, dueDate: heute, status: 'OPEN' },
  })
  const nachweis = await prisma.nachweis.create({
    data: {
      vorlageId: nachAenderung.id,
      occurrenceId: faelligkeit.id,
      erfasstById: benutzer.id,
      status: 'ENTWURF',
      antworten: {
        create: [
          {
            punktId: nachAenderung.punkte[0].id,
            ergebnis: 'ERFUELLT',
            wert: null,
            bemerkung: 'Geprüft am Stichtag.',
          },
        ],
      },
    },
    include: { antworten: true },
  })
  pruefe(nachweis.antworten.length === 1, 'Ein Nachweis mit einer Antwort steht')

  const verboten = pruefePruefboegen(
    leseCsv(bogenDatei('Wieder eine andere Frage?')),
    await bestandBoegen(),
    [aufgabe.title],
  )
  pruefe(
    verboten.fehler.length === 1 &&
      verboten.fehler[0].meldung.includes('bereits geprüft'),
    'Geänderte Prüfpunkte eines benutzten Bogens werden abgelehnt',
  )

  // Nur die Angaben zum Bogen ändern – das muss weiterhin gehen.
  const nurKopf = pruefePruefboegen(
    leseCsv(
      [
        BOGEN_KOPF,
        `${bogenName};Neue Beschreibung;${aufgabe.title};ja;nein;1;Ganz andere Frage?;Hinweis dazu;BEWERTUNG;ja`,
        `${bogenName};Neue Beschreibung;${aufgabe.title};ja;nein;2;Anzahl geprüfter Konten;;ZAHL;ja`,
      ].join('\n'),
    ),
    await bestandBoegen(),
    [aufgabe.title],
  )
  pruefe(
    nurKopf.fehler.length === 0 && nurKopf.aktualisieren === 1,
    'Beschreibung und Status eines benutzten Bogens lassen sich ändern',
  )
  await schreibePruefboegen(nurKopf, benutzer.id)

  const unversehrt = await prisma.pruefbogenVorlage.findFirstOrThrow({
    where: { name: bogenName },
    include: { punkte: true, nachweise: { include: { antworten: true } } },
  })
  pruefe(
    unversehrt.beschreibung === 'Neue Beschreibung' && !unversehrt.aktiv,
    'Die geänderten Angaben sind gespeichert',
  )
  pruefe(
    unversehrt.punkte.length === 2 &&
      unversehrt.nachweise[0].antworten.length === 1,
    'Prüfpunkte und die daran hängende Antwort sind unversehrt',
  )

  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nImporttest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
