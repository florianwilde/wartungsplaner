/**
 * Füllt eine Demo-Instanz – für Bildschirmfotos und Vorführungen.
 *
 * Zwei Schritte:
 *
 * 1. **Der Ausgangsbestand wird eingespielt** – dieselben Dateien aus
 *    `beispiele/pruefplan/`, die auch eine echte Installation bekommt, und
 *    über dieselben Funktionen wie der Import in der Oberfläche. Damit
 *    zeigen die Bilder genau das, was eine Leserin nach dem Einspielen
 *    selbst vor sich hat.
 * 2. **Vergangenheit wird ergänzt** – erledigte Prüfungen, offene
 *    Abweichungen, ein gegengezeichneter Prüfbogen. Ein Bestand ohne
 *    Historie sagt über eine Nachweisverwaltung wenig aus.
 *
 * **Nur für Wegwerf-Instanzen.** Das Skript schreibt Durchführungen und
 * Abweichungen und ist auf einem Produktivbestand fehl am Platz; deshalb
 * verlangt es eine ausdrückliche Bestätigung über `DEMO_BESTAETIGT=ja`.
 *
 * Ausführen:  DEMO_BESTAETIGT=ja npx tsx scripts/demodaten.ts
 */
import { readFileSync } from 'node:fs'

import type { Prisma } from '../src/generated/prisma/client'
import { erzeugePrismaClient } from '../src/lib/prisma-basis'
import bcrypt from 'bcryptjs'

import { leseCsv } from '../src/lib/csv'
import { addDays, todayInBerlin } from '../src/lib/dates'
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

const prisma = erzeugePrismaClient()

const BEISPIELE = 'beispiele/pruefplan'
const lies = (datei: string) => leseCsv(readFileSync(`${BEISPIELE}/${datei}`, 'utf8'))

/** Zweite und dritte Person, damit Zuständigkeiten glaubhaft wirken. */
const ZWEITE = { email: 'm.berger@example.com', name: 'Martina Berger' }
const DRITTE = { email: 'j.kraus@example.com', name: 'Jens Kraus' }

/**
 * Spielt die vier Beispieldateien ein – in der Reihenfolge, in der sie
 * aufeinander aufbauen. Bricht ab, sobald eine Datei Fehler enthält: Ein
 * stiller Teilbestand wäre in den Bildern nicht zu erkennen.
 */
async function spieleBeispieldatenEin(adminId: string, adminEmail: string) {
  const meldeFehler = (
    bereich: string,
    fehler: { zeile: number; meldung: string }[],
  ) => {
    if (fehler.length === 0) return
    console.error(`Beispieldatei „${bereich}“ enthält Fehler:`)
    for (const eintrag of fehler.slice(0, 5)) {
      console.error(`  Zeile ${eintrag.zeile}: ${eintrag.meldung}`)
    }
    throw new Error(`Beispieldatei „${bereich}“ ist nicht einspielbar.`)
  }

  const kategorien = pruefeKategorien(lies('1-kategorien.csv'), [])
  meldeFehler('Kategorien', kategorien.fehler)
  await schreibeKategorien(kategorien, adminId)

  const referenzen = pruefeAuditReferenzen(lies('2-audit-referenzen.csv'), [])
  meldeFehler('Audit-Referenzen', referenzen.fehler)
  await schreibeAuditReferenzen(referenzen, adminId)

  const bekannteKategorien = (
    await prisma.category.findMany({ select: { name: true } })
  ).map((k) => k.name)
  const aufgaben = pruefeAufgaben(lies('3-aufgaben.csv'), [], bekannteKategorien, [
    adminEmail,
  ])
  meldeFehler('Aufgaben', aufgaben.fehler)
  await schreibeAufgaben(aufgaben, adminId)

  const bekannteAufgaben = (
    await prisma.task.findMany({ select: { title: true } })
  ).map((a) => a.title)
  const boegen = pruefePruefboegen(lies('4-pruefboegen.csv'), [], bekannteAufgaben)
  meldeFehler('Prüfbögen', boegen.fehler)
  await schreibePruefboegen(boegen, adminId)

  console.log(
    `  Eingespielt: ${kategorien.anlegen} Kategorien, ${referenzen.anlegen} Referenzen, ` +
      `${aufgaben.anlegen} Aufgaben, ${boegen.anlegen} Prüfbögen.`,
  )
}

/** Erzeugt zu einem Prüfpunkt eine plausible Antwort. */
function antwortZu(
  punkt: { id: string; art: string; position: number },
  heute: Date,
): Prisma.NachweisAntwortUncheckedCreateWithoutNachweisInput {
  switch (punkt.art) {
    case 'BEWERTUNG':
      // Ein Bogen, in dem alles erfüllt ist, zeigt nicht, wie eine
      // Feststellung aussieht.
      return punkt.position === 2
        ? {
            punktId: punkt.id,
            ergebnis: 'NICHT_ERFUELLT',
            wert: null,
            bemerkung: 'Ein Konto war noch aktiv, Entzug veranlasst.',
          }
        : { punktId: punkt.id, ergebnis: 'ERFUELLT', wert: null, bemerkung: null }
    case 'ZAHL':
      return { punktId: punkt.id, ergebnis: null, wert: '148', bemerkung: null }
    case 'DATUM':
      return {
        punktId: punkt.id,
        ergebnis: null,
        wert: addDays(heute, -5).toISOString().slice(0, 10),
        bemerkung: null,
      }
    case 'TEXT':
      return {
        punktId: punkt.id,
        ergebnis: null,
        wert: 'Auszug vom Monatsersten, gemeinsam mit der Fachbereichsleitung durchgesehen.',
        bemerkung: null,
      }
    default:
      // LISTE: Die Zeilen entstehen erst bei der Durchführung aus dem
      // Systemauszug – hier bleibt der Punkt leer.
      return { punktId: punkt.id, ergebnis: null, wert: null, bemerkung: null }
  }
}

async function main() {
  if (process.env.DEMO_BESTAETIGT !== 'ja') {
    console.error(
      'Dieses Skript schreibt Durchführungen und Abweichungen.\n' +
        'Nur auf einer Wegwerf-Instanz ausführen – dann mit DEMO_BESTAETIGT=ja.',
    )
    process.exitCode = 1
    return
  }

  const heute = todayInBerlin()
  const passwordHash = await bcrypt.hash('Demo!12345678', 12)

  const admin = await prisma.user.findFirstOrThrow({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

  const [zweite] = await Promise.all(
    [ZWEITE, DRITTE].map((person, index) =>
      prisma.user.upsert({
        where: { email: person.email },
        update: { name: person.name, active: true },
        create: {
          ...person,
          passwordHash,
          role: index === 0 ? 'EDITOR' : 'AUDITOR',
          active: true,
        },
      }),
    ),
  )

  // --- Ausgangsbestand ----------------------------------------------------
  console.log('Beispieldaten werden eingespielt …')
  await spieleBeispieldatenEin(admin.id, admin.email)

  // Der erzwungene Wechsel des Startpassworts ist im Betrieb richtig, für
  // eine Wegwerf-Instanz nur ein Umweg vor jeder Ansicht.
  await prisma.user.updateMany({ data: { mustChangePassword: false } })

  // Ein Teil der Aufgaben wandert an die Kollegin – eine Liste, in der alles
  // derselben Person gehört, sieht nach Testdaten aus.
  const aufgaben = await prisma.task.findMany({ orderBy: { title: 'asc' } })
  for (const [index, aufgabe] of aufgaben.entries()) {
    if (index % 3 === 1) {
      await prisma.task.update({
        where: { id: aufgabe.id },
        data: { ownerId: zweite.id },
      })
    }
  }

  // --- Vergangenheit: erledigte Fälligkeiten ------------------------------
  const ergebnisse = ['OK', 'OK', 'OK', 'OK_WITH_REMARKS', 'OK', 'DEVIATION'] as const
  let erledigt = 0

  for (const [index, aufgabe] of aufgaben.entries()) {
    // Zwei zurückliegende Termine je Aufgabe, damit die Historie trägt.
    for (const zurueck of [90, 180]) {
      const faellig = addDays(heute, -zurueck)
      const vorhanden = await prisma.occurrence.findFirst({
        where: { taskId: aufgabe.id, dueDate: faellig },
      })
      if (vorhanden) continue

      const ergebnis = ergebnisse[(index + zurueck) % ergebnisse.length]
      // Jede fünfte Durchführung war verspätet – eine Erfüllungsquote von
      // 100 Prozent glaubt niemand.
      const verspaetet = (index + zurueck) % 5 === 0

      const faelligkeit = await prisma.occurrence.create({
        data: { taskId: aufgabe.id, dueDate: faellig, status: 'DONE' },
      })

      await prisma.execution.create({
        data: {
          occurrenceId: faelligkeit.id,
          executedById: index % 3 === 1 ? zweite.id : admin.id,
          executedAt: addDays(faellig, verspaetet ? 6 : -1),
          result: ergebnis,
          comment:
            ergebnis === 'OK'
              ? 'Vollständig geprüft, keine Beanstandung.'
              : ergebnis === 'OK_WITH_REMARKS'
                ? 'Geprüft. Zwei Kleinigkeiten notiert, kein Handlungsbedarf mit Frist.'
                : 'Bei der Prüfung sind Abweichungen aufgefallen, siehe Eintrag.',
        },
      })
      erledigt++
    }
  }

  // --- Offene Abweichungen ------------------------------------------------
  const durchfuehrungen = await prisma.execution.findMany({
    where: { result: 'DEVIATION' },
    take: 4,
    orderBy: { executedAt: 'desc' },
  })

  const abweichungen = [
    {
      title: 'Zwei Firewall-Regeln ohne dokumentierte Begründung',
      description:
        'Die Regeln 42 und 57 stammen aus einer Migration und lassen sich keinem Antrag zuordnen. Mit dem Fachbereich klären oder entfernen.',
      severity: 'MEDIUM' as const,
      tage: 21,
      status: 'IN_PROGRESS' as const,
    },
    {
      title: 'Konto eines ausgeschiedenen Mitarbeiters noch aktiv',
      description:
        'Austritt zum Monatsende, Konto war zwei Wochen später noch anmeldefähig. Offboarding-Ablauf nachschärfen.',
      severity: 'HIGH' as const,
      tage: -4,
      status: 'OPEN' as const,
    },
    {
      title: 'Rücksicherung dauerte länger als die vereinbarte Wiederanlaufzeit',
      description:
        'Vier Stunden statt der zugesagten zwei. Ursache liegt an der Bandbreite zum Auslagerungsort.',
      severity: 'MEDIUM' as const,
      tage: 45,
      status: 'OPEN' as const,
    },
    {
      title: 'Zertifikat läuft in unter 30 Tagen ab',
      description: 'Erneuerung beauftragt, Einbau steht noch aus.',
      severity: 'LOW' as const,
      tage: 12,
      status: 'OPEN' as const,
    },
  ]

  let angelegt = 0
  for (const [index, vorlage] of abweichungen.entries()) {
    const durchfuehrung = durchfuehrungen[index % durchfuehrungen.length]
    if (!durchfuehrung) break

    const vorhanden = await prisma.finding.findFirst({
      where: { title: vorlage.title },
    })
    if (vorhanden) continue

    await prisma.finding.create({
      data: {
        executionId: durchfuehrung.id,
        title: vorlage.title,
        description: vorlage.description,
        severity: vorlage.severity,
        status: vorlage.status,
        responsibleId: index % 2 === 0 ? admin.id : zweite.id,
        dueDate: addDays(heute, vorlage.tage),
      },
    })
    angelegt++
  }

  // --- Zwei überfällige Termine -------------------------------------------
  // Ein Bestand, in dem alles im grünen Bereich liegt, zeigt nicht, wofür
  // die Anwendung da ist. Zwei Fälligkeiten stehen deshalb offen und über
  // der Karenzfrist.
  let ueberfaellig = 0
  for (const aufgabe of aufgaben.slice(0, 2)) {
    const faellig = addDays(heute, -(aufgabe.graceDays + 9))
    const vorhanden = await prisma.occurrence.findFirst({
      where: { taskId: aufgabe.id, dueDate: faellig },
    })
    if (vorhanden) continue

    await prisma.occurrence.create({
      data: { taskId: aufgabe.id, dueDate: faellig, status: 'OPEN' },
    })
    ueberfaellig++
  }

  // --- Prüfbögen in allen drei Zuständen ----------------------------------
  // Genommen werden die Vorlagen aus den Beispieldateien, nicht eigens
  // gebaute: Was auf dem Bild steht, soll auch nach dem Einspielen dastehen.
  //
  // Drei Stände, damit die Nachweisseite ihre drei Bereiche zeigt: ein
  // abgeschlossener Bogen, einer, der auf die Gegenzeichnung wartet, und
  // ein eigener Entwurf.
  const staende = [
    {
      suche: 'Rezertifizierung',
      status: 'GEGENGEZEICHNET' as const,
      erfasstVon: () => zweite.id,
      bemerkung:
        'Durchsicht mit dem Auszug vom Monatsersten. Ein Konto zum Entzug vorgemerkt.',
    },
    {
      // Von der Kollegin vorgelegt – erscheint beim Administrator unter
      // „Zur Gegenzeichnung“.
      suche: 'Firewall',
      status: 'VORGELEGT' as const,
      erfasstVon: () => zweite.id,
      bemerkung:
        'Regelwerk vom Wochenanfang durchgesehen. Zwei Regeln ohne Antrag, siehe Abweichung.',
    },
    {
      // Eigener Entwurf – erscheint unter „Meine offenen Nachweise“.
      suche: 'Privilegierte Konten',
      status: 'ENTWURF' as const,
      erfasstVon: () => admin.id,
      bemerkung: 'Auszug liegt vor, Rückmeldung der Fachbereiche steht noch aus.',
    },
  ]

  let boegenAngelegt = 0
  for (const stand of staende) {
    const vorlage = await prisma.pruefbogenVorlage.findFirst({
      where: { name: { contains: stand.suche } },
      include: { punkte: { orderBy: { position: 'asc' } } },
    })
    if (!vorlage?.taskId) continue

    const schonDa = await prisma.nachweis.findFirst({
      where: { vorlageId: vorlage.id },
    })
    if (schonDa) continue

    const offene = await prisma.occurrence.findFirst({
      where: { taskId: vorlage.taskId, status: 'OPEN' },
      orderBy: { dueDate: 'asc' },
    })
    if (!offene) continue

    const abgeschlossen = stand.status === 'GEGENGEZEICHNET'
    const vorgelegt = abgeschlossen || stand.status === 'VORGELEGT'

    await prisma.nachweis.create({
      data: {
        vorlageId: vorlage.id,
        occurrenceId: offene.id,
        status: stand.status,
        erfasstById: stand.erfasstVon(),
        erfasstAm: addDays(heute, -3),
        vorgelegtAm: vorgelegt ? addDays(heute, -2) : null,
        geprueftById: abgeschlossen ? admin.id : null,
        geprueftAm: abgeschlossen ? addDays(heute, -1) : null,
        bemerkung: stand.bemerkung,
        antworten: {
          create: vorlage.punkte.map((punkt) => antwortZu(punkt, heute)),
        },
      },
    })
    boegenAngelegt++
  }

  console.log(
    `Demodaten ergänzt: ${erledigt} Durchführungen, ${angelegt} Abweichungen, ` +
      `${ueberfaellig} überfällige Termine, 2 weitere Konten, ` +
      `${boegenAngelegt} Prüfbögen.`,
  )
}

main()
  .catch((error) => {
    console.error('Demodaten fehlgeschlagen:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
