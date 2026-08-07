/**
 * Füllt eine Demo-Instanz mit Historie – für Bildschirmfotos und Vorführungen.
 *
 * Der Seed legt Kategorien, Aufgaben und je eine erste Fälligkeit an. Für ein
 * aussagekräftiges Bild fehlt die Vergangenheit: erledigte Prüfungen, offene
 * Abweichungen, ein gegengezeichneter Prüfbogen. Genau das ergänzt dieses
 * Skript.
 *
 * **Nur für Wegwerf-Instanzen.** Es schreibt Durchführungen und Abweichungen
 * und ist auf einem Produktivbestand fehl am Platz; deshalb verlangt es eine
 * ausdrückliche Bestätigung über `DEMO_BESTAETIGT=ja`.
 *
 * Ausführen:  DEMO_BESTAETIGT=ja npx tsx scripts/demodaten.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { addDays, todayInBerlin } from '../src/lib/dates'

const prisma = new PrismaClient()

/** Zweite Person, damit Gegenzeichnung und Zuständigkeiten glaubhaft wirken. */
const ZWEITE = {
  email: 'm.berger@example.com',
  name: 'Martina Berger',
}
const DRITTE = {
  email: 'j.kraus@example.com',
  name: 'Jens Kraus',
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

  const [zweite, dritte] = await Promise.all(
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

  const admin = await prisma.user.findFirstOrThrow({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  })

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
    include: { occurrence: { select: { task: { select: { title: true } } } } },
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

  // --- Audit-Referenzen ---------------------------------------------------
  const referenzen = [
    {
      rahmenwerk: 'ISO 27001',
      kuerzel: 'A.8.13',
      bezeichnung: 'Sicherung von Informationen',
    },
    { rahmenwerk: 'ISO 27001', kuerzel: 'A.5.18', bezeichnung: 'Zugangsrechte' },
    {
      rahmenwerk: 'ISO 27001',
      kuerzel: 'A.8.8',
      bezeichnung: 'Umgang mit technischen Schwachstellen',
    },
    {
      rahmenwerk: 'ISO 27001',
      kuerzel: 'A.7.2',
      bezeichnung: 'Physische Zutrittssteuerung',
    },
  ]
  for (const referenz of referenzen) {
    const gespeichert = await prisma.auditReferenz.upsert({
      where: {
        rahmenwerk_kuerzel: {
          rahmenwerk: referenz.rahmenwerk,
          kuerzel: referenz.kuerzel,
        },
      },
      update: {},
      create: { ...referenz, aktiv: true },
    })

    // Jeder Referenz ein paar Aufgaben zuordnen, damit der Filter etwas zeigt.
    for (const aufgabe of aufgaben.filter(
      (_, i) => i % referenzen.length === referenzen.indexOf(referenz),
    )) {
      await prisma.taskAuditReferenz.upsert({
        where: {
          taskId_referenzId: { taskId: aufgabe.id, referenzId: gespeichert.id },
        },
        update: {},
        create: { taskId: aufgabe.id, referenzId: gespeichert.id },
      })
    }
  }

  // --- Ein gegengezeichneter Prüfbogen ------------------------------------
  const rezertifizierung = aufgaben.find((a) =>
    a.title.includes('Zugriffsberechtigungen'),
  )
  if (rezertifizierung) {
    const vorlage = await prisma.pruefbogenVorlage.upsert({
      where: { name: 'Rezertifizierung Zugriffsberechtigungen' },
      update: {},
      create: {
        name: 'Rezertifizierung Zugriffsberechtigungen',
        beschreibung:
          'Prüfpunkte für die halbjährliche Durchsicht der Berechtigungen in AD, Fileserver und ERP.',
        taskId: rezertifizierung.id,
        vierAugen: true,
        aktiv: true,
        punkte: {
          create: [
            {
              position: 1,
              frage: 'Sind alle privilegierten Konten begründet?',
              hinweis: 'Domänen-Admins, Backup-Operatoren, Datenbank-Administratoren',
              art: 'BEWERTUNG',
              pflicht: true,
            },
            {
              position: 2,
              frage: 'Wurden Konten ausgeschiedener Personen entfernt?',
              art: 'BEWERTUNG',
              pflicht: true,
            },
            {
              position: 3,
              frage: 'Anzahl geprüfter Konten',
              art: 'ZAHL',
              pflicht: true,
            },
            {
              position: 4,
              frage: 'Stichtag des Auszugs',
              art: 'DATUM',
              pflicht: false,
            },
          ],
        },
      },
      include: { punkte: true },
    })

    const offene = await prisma.occurrence.findFirst({
      where: { taskId: rezertifizierung.id, status: 'OPEN' },
      orderBy: { dueDate: 'asc' },
    })

    const schonDa = await prisma.nachweis.findFirst({
      where: { vorlageId: vorlage.id },
    })

    if (offene && !schonDa) {
      const punkte = await prisma.pruefbogenPunkt.findMany({
        where: { vorlageId: vorlage.id },
        orderBy: { position: 'asc' },
      })

      await prisma.nachweis.create({
        data: {
          vorlageId: vorlage.id,
          occurrenceId: offene.id,
          status: 'GEGENGEZEICHNET',
          erfasstById: zweite.id,
          erfasstAm: addDays(heute, -3),
          vorgelegtAm: addDays(heute, -2),
          geprueftById: admin.id,
          geprueftAm: addDays(heute, -1),
          bemerkung:
            'Durchsicht mit dem Auszug vom Monatsersten. Ein Konto zum Entzug vorgemerkt.',
          antworten: {
            create: [
              {
                punktId: punkte[0].id,
                ergebnis: 'ERFUELLT',
                wert: null,
                bemerkung: null,
              },
              {
                punktId: punkte[1].id,
                ergebnis: 'NICHT_ERFUELLT',
                wert: null,
                bemerkung: 'Ein Konto war noch aktiv, Entzug veranlasst.',
              },
              { punktId: punkte[2].id, ergebnis: null, wert: '148', bemerkung: null },
              {
                punktId: punkte[3].id,
                ergebnis: null,
                wert: addDays(heute, -5).toISOString().slice(0, 10),
                bemerkung: null,
              },
            ],
          },
        },
      })
    }
  }

  console.log(
    `Demodaten ergänzt: ${erledigt} Durchführungen, ${angelegt} Abweichungen, ` +
      `${referenzen.length} Audit-Referenzen, 2 weitere Konten, 1 Prüfbogen.`,
  )
  void dritte
}

main()
  .catch((error) => {
    console.error('Demodaten fehlgeschlagen:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
