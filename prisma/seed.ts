/**
 * Seed-Daten für den Wartungsplaner.
 *
 * Das Skript ist idempotent: Es kann mehrfach ausgeführt werden, ohne
 * Duplikate zu erzeugen. Bereits vorhandene Aufgaben werden nicht überschrieben.
 *
 * Ausführen:  npm run db:seed
 */
import { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { addDays, todayInBerlin } from '../src/lib/dates'

const prisma = new PrismaClient()

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Start!1234'

const CATEGORIES = [
  { name: 'Backup & Restore', color: '#0ea5e9', sortOrder: 10 },
  { name: 'Berechtigungen', color: '#8b5cf6', sortOrder: 20 },
  { name: 'Zutritt', color: '#f59e0b', sortOrder: 30 },
  { name: 'Infrastruktur', color: '#10b981', sortOrder: 40 },
  { name: 'Sicherheit', color: '#ef4444', sortOrder: 50 },
  { name: 'Dokumentation', color: '#64748b', sortOrder: 60 },
]

type SeedTask = {
  title: string
  description: string
  instructionsMd: string
  category: string
  intervalType: Prisma.TaskCreateInput['intervalType']
  intervalValue?: number
  scheduleMode: Prisma.TaskCreateInput['scheduleMode']
  leadTimeDays: number
  graceDays: number
  evidenceRequired: boolean
  criticality: Prisma.TaskCreateInput['criticality']
  auditReference?: string
  /** Startdatum relativ zu heute in Tagen (negativ = in der Vergangenheit) */
  startOffsetDays: number
}

const TASKS: SeedTask[] = [
  {
    title: 'Restore-Test ERP-System',
    description:
      'Vollständige Rücksicherung der ERP-Datenbank in die Testumgebung inkl. Funktionsprüfung durch den Fachbereich.',
    instructionsMd: `## Ziel
Nachweis, dass die Sicherung des ERP-Systems tatsächlich wiederherstellbar ist.

## Durchführung
1. Aktuellen Sicherungssatz im Backup-System auswählen (nicht älter als 7 Tage).
2. Rücksicherung in die Testinstanz \`erp-test\` starten.
3. Nach Abschluss: Anmeldung, Öffnen eines Belegs, Stichprobe von drei Buchungen.
4. Fachbereich bestätigt die Plausibilität der Daten.

## Nachweise
- Screenshot des Restore-Protokolls (Start-/Endzeit, Ergebnis)
- Kurzbestätigung des Fachbereichs

## Bewertung
- **OK** – Rücksicherung vollständig, Daten plausibel
- **Mit Anmerkungen** – erfolgreich, aber Laufzeit über Zielvorgabe
- **Abweichung** – Rücksicherung fehlgeschlagen oder Daten unvollständig`,
    category: 'Backup & Restore',
    intervalType: 'QUARTERLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 14,
    graceDays: 7,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.8.13',
    startOffsetDays: -12,
  },
  {
    title: 'Restore-Test Fileserver',
    description:
      'Stichprobenhafte Wiederherstellung von Dateien und Verzeichnissen aus der Sicherung des Fileservers.',
    instructionsMd: `## Durchführung
1. Drei Verzeichnisse aus unterschiedlichen Freigaben auswählen.
2. Rücksicherung an einen Ausweichpfad durchführen.
3. Dateien öffnen und Zeitstempel/Berechtigungen prüfen.

## Nachweise
- Restore-Protokoll
- Liste der geprüften Pfade`,
    category: 'Backup & Restore',
    intervalType: 'QUARTERLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 14,
    graceDays: 7,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.8.13',
    startOffsetDays: 9,
  },
  {
    title: 'Prüfung der Sicherungsprotokolle',
    description:
      'Wöchentliche Kontrolle aller Backup-Jobs auf Fehler, Warnungen und ausgelassene Läufe.',
    instructionsMd: `## Durchführung
1. Backup-Konsole öffnen, Zeitraum der letzten 7 Tage einstellen.
2. Alle Jobs mit Status *Fehler* oder *Warnung* dokumentieren.
3. Fehlgeschlagene Jobs nachziehen oder Ursache festhalten.

## Nachweise
- Export der Job-Übersicht (CSV oder PDF)`,
    category: 'Backup & Restore',
    intervalType: 'WEEKLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 2,
    graceDays: 2,
    evidenceRequired: true,
    criticality: 'MEDIUM',
    auditReference: 'ISO 27001 A.8.13',
    startOffsetDays: -3,
  },
  {
    title: 'Review der Zugriffsberechtigungen (AD, Fileserver, ERP)',
    description:
      'Halbjährliche Rezertifizierung der Benutzer- und Gruppenberechtigungen gemeinsam mit den Fachbereichsleitungen.',
    instructionsMd: `## Ziel
Sicherstellen, dass nur berechtigte Personen Zugriff auf Systeme und Daten haben.

## Durchführung
1. Export der AD-Gruppenmitgliedschaften erstellen.
2. Export der Freigabe- und NTFS-Berechtigungen des Fileservers erstellen.
3. Rollenzuordnungen im ERP exportieren.
4. Listen an die jeweiligen Fachbereichsleitungen zur Bestätigung geben.
5. Rückmeldungen umsetzen, entzogene Rechte dokumentieren.

## Besonders prüfen
- Konten ausgeschiedener Mitarbeitender
- Administrative Konten und Dienstkonten
- Direktberechtigungen außerhalb von Gruppen

## Nachweise
- Exportlisten
- Freigaben der Fachbereiche
- Protokoll der umgesetzten Änderungen`,
    category: 'Berechtigungen',
    intervalType: 'SEMIANNUAL',
    scheduleMode: 'FIXED',
    leadTimeDays: 30,
    graceDays: 14,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.5.18',
    startOffsetDays: -30,
  },
  {
    title: 'Offboarding-Stichprobe',
    description:
      'Stichprobenprüfung, ob bei ausgeschiedenen Mitarbeitenden alle Konten und Zugänge fristgerecht deaktiviert wurden.',
    instructionsMd: `## Durchführung
1. Von der Personalabteilung die Austritte des letzten Quartals anfordern.
2. Stichprobe von mindestens fünf Personen ziehen.
3. Je Person prüfen: AD-Konto, E-Mail-Postfach, ERP-Zugang, VPN, Schlüssel/Transponder, Mobilgerät.
4. Zeitpunkt der Deaktivierung mit dem Austrittsdatum abgleichen.

## Nachweise
- Ausgefüllte Prüfmatrix`,
    category: 'Berechtigungen',
    intervalType: 'QUARTERLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 14,
    graceDays: 7,
    evidenceRequired: true,
    criticality: 'MEDIUM',
    auditReference: 'ISO 27001 A.5.11',
    startOffsetDays: 21,
  },
  {
    title: 'Review der Zutrittsberechtigungen (Schließanlage, Serverraum)',
    description:
      'Halbjährlicher Abgleich der ausgegebenen Schlüssel und Transponder sowie der Zutrittsrechte zum Serverraum.',
    instructionsMd: `## Durchführung
1. Aktuelle Schließplan-/Transponderliste aus der Schließanlagenverwaltung exportieren.
2. Abgleich mit der Personalliste (Eintritte, Austritte, Abteilungswechsel).
3. Zutrittsrechte zum Serverraum auf das notwendige Minimum prüfen.
4. Nicht mehr benötigte Transponder sperren und Rückgabe dokumentieren.

## Nachweise
- Transponderliste mit Prüfvermerken
- Nachweis gesperrter Transponder`,
    category: 'Zutritt',
    intervalType: 'SEMIANNUAL',
    scheduleMode: 'FIXED',
    leadTimeDays: 30,
    graceDays: 14,
    evidenceRequired: true,
    criticality: 'MEDIUM',
    auditReference: 'ISO 27001 A.7.2',
    startOffsetDays: 45,
  },
  {
    title: 'Patch-Status-Review',
    description:
      'Monatliche Auswertung des Patch-Standes aller Server und Clients inkl. Nachsteuerung offener kritischer Updates.',
    instructionsMd: `## Durchführung
1. Bericht aus der Patch-Management-Lösung für den Vormonat erzeugen.
2. Systeme mit fehlenden kritischen Updates auflisten.
3. Für jedes System Ursache klären (Wartungsfenster, Inkompatibilität, offline).
4. Nachinstallation planen oder Ausnahme begründet dokumentieren.

## Zielwert
Mindestens 95 % der Systeme ohne offene kritische Updates.

## Nachweise
- Patch-Report (PDF)`,
    category: 'Infrastruktur',
    intervalType: 'MONTHLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 7,
    graceDays: 5,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.8.8',
    startOffsetDays: -5,
  },
  {
    title: 'Zertifikats-Check (TLS/Code-Signing)',
    description:
      'Monatliche Prüfung aller eingesetzten Zertifikate auf Restlaufzeit; Erneuerung spätestens 30 Tage vor Ablauf.',
    instructionsMd: `## Durchführung
1. Zertifikatsinventar öffnen (Webserver, Reverse Proxy, VPN, Code-Signing, interne CA).
2. Restlaufzeit je Zertifikat ermitteln.
3. Alle Zertifikate mit Restlaufzeit < 60 Tage zur Erneuerung einplanen.
4. Inventar bei Änderungen aktualisieren.

## Nachweise
- Zertifikatsübersicht mit Ablaufdaten`,
    category: 'Sicherheit',
    intervalType: 'MONTHLY',
    scheduleMode: 'FIXED',
    leadTimeDays: 7,
    graceDays: 5,
    evidenceRequired: false,
    criticality: 'MEDIUM',
    auditReference: 'ISO 27001 A.8.24',
    startOffsetDays: 4,
  },
  {
    title: 'Firewall-Regel-Review',
    description:
      'Jährliche Überprüfung aller Firewall-Regeln auf Notwendigkeit, Wirksamkeit und Dokumentation.',
    instructionsMd: `## Durchführung
1. Regelwerk exportieren.
2. Je Regel prüfen: Zweck dokumentiert? Antragsteller bekannt? Noch benötigt?
3. Regeln ohne Treffer der letzten 12 Monate identifizieren.
4. Nicht mehr benötigte Regeln nach Rücksprache deaktivieren (zunächst 4 Wochen, danach löschen).
5. "Any-Any"-Regeln gesondert begründen.

## Nachweise
- Regelwerk-Export vor und nach der Bereinigung
- Änderungsprotokoll`,
    category: 'Sicherheit',
    intervalType: 'ANNUAL',
    scheduleMode: 'FIXED',
    leadTimeDays: 30,
    graceDays: 14,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.8.20',
    startOffsetDays: 75,
  },
  {
    title: 'USV-Test Serverraum',
    description:
      'Jährlicher Belastungstest der unterbrechungsfreien Stromversorgung inkl. Batteriezustand und Notabschaltung.',
    instructionsMd: `## Vorbereitung
- Termin außerhalb der Kernzeit abstimmen und ankündigen.
- Aktuelle Sicherung aller Systeme sicherstellen.

## Durchführung
1. Batteriezustand und Alter der Akkus prüfen.
2. Selbsttest der USV auslösen und Protokoll sichern.
3. Netztrennung simulieren, Überbrückungszeit messen.
4. Geordnetes Herunterfahren der angeschlossenen Systeme prüfen.
5. Wiederanlauf kontrollieren.

## Nachweise
- USV-Testprotokoll
- Messwerte der Überbrückungszeit`,
    category: 'Infrastruktur',
    intervalType: 'ANNUAL',
    scheduleMode: 'AFTER_COMPLETION',
    leadTimeDays: 30,
    graceDays: 21,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.7.11',
    startOffsetDays: 120,
  },
  {
    title: 'Review Notfallplan / Notfallhandbuch',
    description:
      'Jährliche Aktualisierung des IT-Notfallhandbuchs inkl. Erreichbarkeiten, Wiederanlaufreihenfolge und Eskalationswegen.',
    instructionsMd: `## Durchführung
1. Notfallhandbuch auf Aktualität prüfen (Systeme, Ansprechpartner, Dienstleister).
2. Telefonnummern und Vertragsnummern der Dienstleister verifizieren.
3. Wiederanlaufreihenfolge mit der aktuellen Systemlandschaft abgleichen.
4. Änderungen einarbeiten, Version und Freigabedatum erhöhen.
5. Aktuelle Fassung verteilen (digital und ausgedruckt im Serverraum).

## Nachweise
- Freigegebene Fassung des Notfallhandbuchs
- Verteilnachweis`,
    category: 'Dokumentation',
    intervalType: 'ANNUAL',
    scheduleMode: 'FIXED',
    leadTimeDays: 45,
    graceDays: 30,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReference: 'ISO 27001 A.5.29',
    startOffsetDays: 150,
  },
]

async function main() {
  console.log('Seed wird ausgeführt …')

  // --- Administrator -------------------------------------------------------
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12)
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      name: 'Administrator',
      email: ADMIN_EMAIL,
      passwordHash,
      authProvider: 'LOCAL',
      role: 'ADMIN',
      active: true,
      mustChangePassword: true,
    },
  })
  console.log(`  Administrator: ${admin.email}`)

  // --- Kategorien ----------------------------------------------------------
  const categoryByName = new Map<string, string>()
  for (const category of CATEGORIES) {
    const saved = await prisma.category.upsert({
      where: { name: category.name },
      update: { color: category.color, sortOrder: category.sortOrder },
      create: category,
    })
    categoryByName.set(saved.name, saved.id)
  }
  console.log(`  Kategorien: ${CATEGORIES.length}`)

  // --- Aufgaben inkl. erster Fälligkeit ------------------------------------
  const today = todayInBerlin()
  let createdTasks = 0

  for (const seed of TASKS) {
    const existing = await prisma.task.findFirst({ where: { title: seed.title } })
    if (existing) continue

    const categoryId = categoryByName.get(seed.category)
    if (!categoryId) throw new Error(`Kategorie fehlt: ${seed.category}`)

    const startDate = addDays(today, seed.startOffsetDays)

    const task = await prisma.task.create({
      data: {
        title: seed.title,
        description: seed.description,
        instructionsMd: seed.instructionsMd,
        categoryId,
        ownerId: admin.id,
        intervalType: seed.intervalType,
        intervalValue: seed.intervalValue ?? null,
        scheduleMode: seed.scheduleMode,
        startDate,
        leadTimeDays: seed.leadTimeDays,
        graceDays: seed.graceDays,
        evidenceRequired: seed.evidenceRequired,
        criticality: seed.criticality,
        auditReference: seed.auditReference ?? null,
        active: true,
      },
    })

    // Regel: Beim Anlegen einer aktiven Aufgabe entsteht die erste
    // Fälligkeit zum Startdatum.
    await prisma.occurrence.create({
      data: { taskId: task.id, dueDate: startDate, status: 'OPEN' },
    })

    await prisma.auditLog.create({
      data: {
        userId: admin.id,
        action: 'TASK_CREATED',
        entityType: 'Task',
        entityId: task.id,
        payloadJson: { quelle: 'seed', titel: task.title },
      },
    })

    createdTasks++
  }

  console.log(`  Aufgaben neu angelegt: ${createdTasks}`)
  console.log(
    `Seed abgeschlossen. Anmeldung: ${ADMIN_EMAIL} – das Startpasswort muss beim ersten Login geändert werden.`,
  )

  // Hinweis: die nächste Fälligkeit nach einer Erledigung erzeugt der
  // tägliche Job bzw. der Erledigen-Vorgang selbst.
}

main()
  .catch((error) => {
    console.error('Seed fehlgeschlagen:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
