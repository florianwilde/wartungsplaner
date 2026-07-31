/**
 * Integrationstest des erzwungenen Löschens.
 *
 * Der Vorgang vernichtet Nachweise – das ist gewollt, aber nur unter
 * Bedingungen. Geprüft wird deshalb weniger, dass gelöscht wird, als was
 * dabei bestehen bleibt: Der Audit-Eintrag muss die Löschung überleben und
 * festhalten, was es gab. Und die Dateien müssen tatsächlich von der Platte
 * verschwinden, sonst meldet sie der nächste Prüfsummenlauf als herrenlos.
 *
 * Ausführen:  npm run test:erzwingen
 *
 * Voraussetzungen:
 *   - Datenbank vom Host aus erreichbar (docker-compose.dev.yml)
 *   - beschreibbares Upload-Verzeichnis
 */
process.env.UPLOAD_DIR = process.env.UPLOAD_DIR?.trim() || './uploads'

import { createHash } from 'node:crypto'
import { access, mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { PrismaClient } from '@prisma/client'

import { todayInBerlin } from '../src/lib/dates'
import { absoluterPfad, uploadVerzeichnis } from '../src/server/dateiablage'

const prisma = new PrismaClient()

const PRAEFIX = '[Erzwingentest] '
const TESTORDNER = 'erzwingentest'
const EMAIL = 'erzwingen@test.local'
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

async function existiert(relativ: string): Promise<boolean> {
  try {
    await access(absoluterPfad(relativ))
    return true
  } catch {
    return false
  }
}

async function legeDateiAn(name: string, inhalt: string) {
  const relativ = `${TESTORDNER}/${name}`
  const absolut = absoluterPfad(relativ)
  await mkdir(path.dirname(absolut), { recursive: true })
  await writeFile(absolut, inhalt)
  return {
    relativ,
    sha256: createHash('sha256').update(inhalt).digest('hex'),
    groesse: Buffer.byteLength(inhalt),
  }
}

async function raeumeAuf() {
  await prisma.attachment.deleteMany({
    where: { storedPath: { startsWith: `${TESTORDNER}/` } },
  })
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  await prisma.task.deleteMany({ where: { id: { in: aufgaben.map((a) => a.id) } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })
  await rm(path.join(uploadVerzeichnis(), TESTORDNER), {
    recursive: true,
    force: true,
  })
}

async function main() {
  console.log('Erzwingentest startet …\n')
  await raeumeAuf()

  const heute = todayInBerlin()

  const admin = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { active: true, role: 'ADMIN' },
    create: {
      name: 'Testperson (Erzwingen)',
      email: EMAIL,
      role: 'ADMIN',
      active: true,
    },
  })

  const kategorie = await prisma.category.create({
    data: { name: `${PRAEFIX}Kategorie`, color: '#2563eb' },
  })

  // --- Eine Aufgabe mit vollständiger Historie ----------------------------
  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}Aufgabe mit Historie`,
      categoryId: kategorie.id,
      ownerId: admin.id,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: heute,
      active: true,
    },
  })

  const faelligkeit = await prisma.occurrence.create({
    data: { taskId: aufgabe.id, dueDate: heute, status: 'DONE' },
  })

  const durchfuehrung = await prisma.execution.create({
    data: {
      occurrenceId: faelligkeit.id,
      executedById: admin.id,
      result: 'DEVIATION',
      comment: 'Geprüft, mit Befund.',
      findings: {
        create: {
          title: `${PRAEFIX}Eine Abweichung`,
          severity: 'MEDIUM',
          status: 'OPEN',
          responsibleId: admin.id,
          dueDate: heute,
        },
      },
    },
  })

  const datei = await legeDateiAn('nachweis.txt', 'Inhalt des Nachweises')
  await prisma.attachment.create({
    data: {
      executionId: durchfuehrung.id,
      filename: 'nachweis.txt',
      storedPath: datei.relativ,
      mimeType: 'text/plain',
      sizeBytes: datei.groesse,
      sha256: datei.sha256,
      uploadedById: admin.id,
    },
  })

  pruefe(await existiert(datei.relativ), 'Die Nachweisdatei liegt auf der Platte')

  // --- Der Vorgang --------------------------------------------------------
  // Nachgebaut wie in der Server-Aktion: Eintrag vor dem Löschen, danach die
  // Dateien. Der Test prüft die Zusage, nicht den Aufruf.
  const { schreibeAudit } = await import('../src/lib/audit')
  const { entferneDateien } = await import('../src/server/dateiablage')

  const dateien = await prisma.attachment.findMany({
    where: { execution: { occurrence: { taskId: aufgabe.id } } },
    select: { storedPath: true, filename: true, sha256: true },
  })

  const begruendung = 'Testdaten aus der Einführungsphase, abgestimmt mit der IT-Leitung.'

  await prisma.$transaction(async (tx) => {
    await schreibeAudit(
      {
        userId: admin.id,
        action: 'TASK_ERZWUNGEN_GELOESCHT',
        entityType: 'Task',
        entityId: null,
        payload: {
          begruendung,
          aufgaben: [aufgabe.title],
          verlust: {
            aufgaben: 1,
            faelligkeiten: 1,
            durchfuehrungen: 1,
            nachweisdateien: 1,
            abweichungen: 1,
            pruefnachweise: 0,
            pruefboegen: 0,
          },
          dateien: dateien.map((d) => ({ name: d.filename, sha256: d.sha256 })),
        },
      },
      tx,
    )
    await tx.task.deleteMany({ where: { id: aufgabe.id } })
  })

  await entferneDateien(dateien.map((d) => d.storedPath))

  // --- Was verschwunden ist ------------------------------------------------
  pruefe(
    (await prisma.task.count({ where: { id: aufgabe.id } })) === 0,
    'Die Aufgabe ist gelöscht',
  )
  pruefe(
    (await prisma.execution.count({ where: { id: durchfuehrung.id } })) === 0,
    'Die Durchführung ist mitgelöscht',
  )
  pruefe(
    (await prisma.finding.count({ where: { title: { startsWith: PRAEFIX } } })) === 0,
    'Die Abweichung ist mitgelöscht',
  )
  pruefe(
    (await prisma.attachment.count({
      where: { storedPath: datei.relativ },
    })) === 0,
    'Der Eintrag der Nachweisdatei ist mitgelöscht',
  )
  pruefe(
    !(await existiert(datei.relativ)),
    'Die Datei ist auch von der Platte entfernt – kein herrenloser Rest',
  )

  // --- Was bestehen bleibt -------------------------------------------------
  const eintrag = await prisma.auditLog.findFirst({
    where: { action: 'TASK_ERZWUNGEN_GELOESCHT', userId: admin.id },
    orderBy: { timestamp: 'desc' },
  })
  pruefe(eintrag !== null, 'Der Audit-Eintrag überlebt die Löschung')

  const inhalt = eintrag?.payloadJson as {
    begruendung?: string
    aufgaben?: string[]
    verlust?: { durchfuehrungen?: number }
    dateien?: { name: string; sha256: string }[]
  } | null

  pruefe(inhalt?.begruendung === begruendung, 'Die Begründung steht im Protokoll')
  pruefe(
    inhalt?.aufgaben?.[0] === aufgabe.title,
    'Der Titel der gelöschten Aufgabe steht im Protokoll',
  )
  pruefe(
    inhalt?.verlust?.durchfuehrungen === 1,
    'Der Umfang des Verlusts steht im Protokoll',
  )
  pruefe(
    inhalt?.dateien?.[0]?.sha256 === datei.sha256,
    'Die Prüfsumme der entfernten Datei steht im Protokoll',
  )

  // Der Trigger auf dem Audit-Log gilt auch hier: Der Eintrag über die
  // Löschung lässt sich selbst nicht löschen.
  let unveraenderlich = false
  try {
    await prisma.auditLog.delete({ where: { id: eintrag!.id } })
  } catch {
    unveraenderlich = true
  }
  pruefe(unveraenderlich, 'Der Eintrag über die Löschung ist selbst unlöschbar')

  await raeumeAuf()

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main()
  .catch(async (error) => {
    console.error('\nErzwingentest abgebrochen:', error)
    await raeumeAuf().catch(() => {})
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
