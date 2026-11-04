/**
 * Gemeinsame Hilfen der End-to-End-Tests.
 *
 * Konten und Stammdaten werden unmittelbar in der Datenbank angelegt: Über
 * die Oberfläche wäre der Aufbau langsam und würde bei jedem Test dieselben
 * Klickwege prüfen, statt den eigentlichen Gegenstand.
 *
 * Alles Erzeugte trägt ein Präfix und wird danach wieder entfernt – die
 * Tests laufen gegen dieselbe Instanz wie die tägliche Arbeit.
 */
import { erzeugePrismaClient } from '../src/lib/prisma-basis'
import bcrypt from 'bcryptjs'
import type { Page } from '@playwright/test'

export const PRAEFIX = '[E2E] '
export const PASSWORT = 'E2E-Testkonto-2026!'

export const KONTEN = {
  admin: `e2e-admin@test.local`,
  pruefer: `e2e-pruefer@test.local`,
} as const

export const prisma = erzeugePrismaClient()

/**
 * Stellt sicher, dass Anwendung und Datenbank zusammengehören.
 *
 * Die Testkonten entstehen unmittelbar über `DATABASE_URL`, geprüft wird
 * die Anwendung unter `E2E_BASIS_URL`. Zeigen beide auf verschiedene
 * Instanzen, legt der Test seine Konten in die eine Datenbank und meldet
 * sich gegen die andere an – die Fehlermeldung lautet dann „Zeitüberschreitung
 * beim Warten auf die Navigation“ und sagt über die Ursache nichts.
 *
 * Deshalb vorab der Abgleich der Portnummern.
 */
function pruefeUmgebung() {
  const basis = process.env.E2E_BASIS_URL?.trim()
  if (!basis) return

  const erwartet = process.env.APP_PORT?.trim() || '3000'
  const tatsaechlich = new URL(basis).port || '80'
  if (erwartet !== tatsaechlich) {
    throw new Error(
      `E2E_BASIS_URL zeigt auf Port ${tatsaechlich}, APP_PORT lautet aber ` +
        `${erwartet}. Die Testkonten landen dann in einer anderen Datenbank ` +
        `als die geprüfte Anwendung. Bitte beides auf dieselbe Instanz ` +
        `richten – oder E2E_BASIS_URL weglassen.`,
    )
  }
}

/** Legt die beiden Testkonten an bzw. setzt sie zurück. */
export async function legeKontenAn() {
  pruefeUmgebung()
  const passwordHash = await bcrypt.hash(PASSWORT, 12)

  const admin = await prisma.user.upsert({
    where: { email: KONTEN.admin },
    update: {
      name: `${PRAEFIX}Adminkonto`,
      role: 'ADMIN',
      active: true,
      passwordHash,
      mustChangePassword: false,
    },
    create: {
      email: KONTEN.admin,
      name: `${PRAEFIX}Adminkonto`,
      role: 'ADMIN',
      active: true,
      passwordHash,
    },
  })

  const pruefer = await prisma.user.upsert({
    where: { email: KONTEN.pruefer },
    update: {
      name: `${PRAEFIX}Prüferkonto`,
      role: 'EDITOR',
      active: true,
      passwordHash,
      mustChangePassword: false,
    },
    create: {
      email: KONTEN.pruefer,
      name: `${PRAEFIX}Prüferkonto`,
      role: 'EDITOR',
      active: true,
      passwordHash,
    },
  })

  return { admin, pruefer }
}

/** Entfernt alles, was ein Testlauf angelegt hat. */
export async function raeumeAuf() {
  const aufgaben = await prisma.task.findMany({
    where: { title: { startsWith: PRAEFIX } },
    select: { id: true },
  })
  const taskIds = aufgaben.map((a) => a.id)

  // Nachweise hängen an Fälligkeiten, Anhänge an Nachweisen – die Kaskaden
  // des Schemas erledigen das, sobald die Aufgabe fällt.
  await prisma.pruefbogenVorlage.deleteMany({
    where: {
      OR: [{ name: { startsWith: PRAEFIX } }, { taskId: { in: taskIds } }],
    },
  })
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } })
  await prisma.category.deleteMany({ where: { name: { startsWith: PRAEFIX } } })

  // Die Konten bleiben stehen: Am Audit-Log hängen Einträge, und das ist
  // revisionssicher – es lässt sich nicht löschen, auch nicht für einen Test.
  await prisma.user.updateMany({
    where: { email: { in: Object.values(KONTEN) } },
    data: { vertretungId: null, kalenderToken: null },
  })
}

/** Meldet sich über das Formular an – bewusst über die Oberfläche. */
export async function meldeAn(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(email)
  await page.getByLabel('Passwort').fill(PASSWORT)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
}

/** Kategorie und Aufgabe für einen Test, unmittelbar in der Datenbank. */
export async function legeAufgabeAn(
  titel: string,
  besitzerId: string,
  zusatz: {
    faelligIn?: number
    evidenceRequired?: boolean
  } = {},
) {
  const kategorie = await prisma.category.upsert({
    where: { name: `${PRAEFIX}Kategorie` },
    update: {},
    create: { name: `${PRAEFIX}Kategorie`, color: '#0F5C9E' },
  })

  const heute = new Date()
  const faellig = new Date(
    Date.UTC(
      heute.getUTCFullYear(),
      heute.getUTCMonth(),
      heute.getUTCDate() + (zusatz.faelligIn ?? 3),
    ),
  )

  const aufgabe = await prisma.task.create({
    data: {
      title: `${PRAEFIX}${titel}`,
      categoryId: kategorie.id,
      ownerId: besitzerId,
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      startDate: faellig,
      leadTimeDays: 7,
      graceDays: 0,
      evidenceRequired: zusatz.evidenceRequired ?? false,
      criticality: 'MEDIUM',
      active: true,
      occurrences: { create: { dueDate: faellig, status: 'OPEN' } },
    },
    include: { occurrences: true },
  })

  return { kategorie, aufgabe, occurrence: aufgabe.occurrences[0] }
}
