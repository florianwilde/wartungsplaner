import { expect, test } from '@playwright/test'

import {
  KONTEN,
  PRAEFIX,
  legeAufgabeAn,
  legeKontenAn,
  meldeAn,
  prisma,
  raeumeAuf,
} from './hilfen'

/**
 * Mehrfachauswahl und Sammellöschen.
 *
 * Der Prüfpunkt ist nicht das Löschen, sondern die Grenze: Eine Aufgabe mit
 * protokollierter Durchführung darf über keinen Weg verschwinden. An ihr
 * hängt die Historie, und das Datenmodell räumt sie beim Löschen mit ab.
 */

let adminId = ''

test.beforeAll(async () => {
  await raeumeAuf()
  const { admin } = await legeKontenAn()
  adminId = admin.id
})

test.afterAll(async () => {
  await raeumeAuf()
  await prisma.$disconnect()
})

test('löscht mehrere Aufgaben ohne Historie', async ({ page }) => {
  const a = await legeAufgabeAn('Sammellöschen A', adminId)
  const b = await legeAufgabeAn('Sammellöschen B', adminId)

  await meldeAn(page, KONTEN.admin)
  await page.goto('/tasks?suche=' + encodeURIComponent(`${PRAEFIX}Sammellöschen`))

  await page.getByLabel(`„${a.aufgabe.title}" markieren`).click()
  await page.getByLabel(`„${b.aufgabe.title}" markieren`).click()

  await expect(page.getByText('2 Aufgaben markiert')).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Löschen', exact: true }).click()

  await expect
    .poll(async () =>
      prisma.task.count({ where: { id: { in: [a.aufgabe.id, b.aufgabe.id] } } }),
    )
    .toBe(0)
})

test('löscht keine Aufgabe, an der eine Durchführung hängt', async ({ page }) => {
  const ohne = await legeAufgabeAn('Ohne Historie', adminId)
  const mit = await legeAufgabeAn('Mit Historie', adminId)

  await prisma.execution.create({
    data: {
      occurrenceId: mit.occurrence.id,
      executedById: adminId,
      result: 'OK',
      comment: 'Geprüft.',
    },
  })

  await meldeAn(page, KONTEN.admin)
  await page.goto('/tasks?suche=' + encodeURIComponent(`${PRAEFIX}`))

  await page.getByLabel(`„${ohne.aufgabe.title}" markieren`).click()
  await page.getByLabel(`„${mit.aufgabe.title}" markieren`).click()

  // Die Schaltfläche ist gesperrt, und daneben steht warum – ein gesperrter
  // Knopf ohne Begründung ist eine Sackgasse.
  await expect(
    page.getByRole('button', { name: 'Löschen', exact: true }),
  ).toBeDisabled()
  await expect(page.getByText(/hat bereits Durchführungen/)).toBeVisible()

  // Beide Aufgaben stehen unverändert da.
  expect(
    await prisma.task.count({
      where: { id: { in: [ohne.aufgabe.id, mit.aufgabe.id] } },
    }),
  ).toBe(2)
})

test('deaktiviert mehrere Aufgaben auf einmal', async ({ page }) => {
  const a = await legeAufgabeAn('Deaktivieren A', adminId)
  const b = await legeAufgabeAn('Deaktivieren B', adminId)

  await meldeAn(page, KONTEN.admin)
  await page.goto('/tasks?suche=' + encodeURIComponent(`${PRAEFIX}Deaktivieren`))

  await page.getByLabel(`„${a.aufgabe.title}" markieren`).click()
  await page.getByLabel(`„${b.aufgabe.title}" markieren`).click()
  await page.getByRole('button', { name: 'Deaktivieren' }).click()

  await expect
    .poll(async () =>
      prisma.task.count({
        where: { id: { in: [a.aufgabe.id, b.aufgabe.id] }, active: false },
      }),
    )
    .toBe(2)
})

test('löscht eine Aufgabe mit Historie nur nach Begründung und Bestätigung', async ({
  page,
}) => {
  const mit = await legeAufgabeAn('Erzwungen zu löschen', adminId)
  await prisma.execution.create({
    data: {
      occurrenceId: mit.occurrence.id,
      executedById: adminId,
      result: 'OK',
      comment: 'Geprüft.',
    },
  })

  await meldeAn(page, KONTEN.admin)
  await page.goto(
    '/tasks?suche=' + encodeURIComponent(`${PRAEFIX}Erzwungen zu löschen`),
  )
  await page.getByLabel(`„${mit.aufgabe.title}" markieren`).click()

  await page.getByRole('button', { name: /Mit Nachweisen löschen/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  // Der Umfang steht vor der Bestätigung auf dem Bildschirm.
  await expect(dialog.getByText(/1 Durchführung/)).toBeVisible()

  // Ohne Begründung und Bestätigungswort bleibt die Schaltfläche gesperrt.
  const knopf = dialog.getByRole('button', { name: 'Endgültig löschen' })
  await expect(knopf).toBeDisabled()

  await dialog
    .getByLabel('Begründung')
    .fill('Testdaten aus der Einführung, mit der IT-Leitung abgestimmt.')
  await expect(knopf).toBeDisabled()

  // Ein falsches Wort genügt nicht.
  await dialog.getByLabel(/Bestätigung/).fill('ja')
  await expect(knopf).toBeDisabled()

  await dialog.getByLabel(/Bestätigung/).fill('LOESCHEN')
  await expect(knopf).toBeEnabled()
  await knopf.click()

  await expect
    .poll(async () => prisma.task.count({ where: { id: mit.aufgabe.id } }))
    .toBe(0)

  // Und das Protokoll hält fest, was verschwunden ist.
  const eintrag = await prisma.auditLog.findFirst({
    where: { action: 'TASK_ERZWUNGEN_GELOESCHT' },
    orderBy: { timestamp: 'desc' },
  })
  const inhalt = eintrag?.payloadJson as {
    begruendung?: string
    aufgaben?: string[]
  } | null
  expect(inhalt?.begruendung).toContain('IT-Leitung')
  expect(inhalt?.aufgaben).toContain(mit.aufgabe.title)
})
