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
 * Der Erledigen-Vorgang von der Oberfläche aus.
 *
 * Genau hier lagen die Fehler aus 1.6.0: Der Browser meldete einen Zustand,
 * den der Server nicht kannte. Beides bestand jede Typprüfung.
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

test('protokolliert eine Durchführung mit Abweichung', async ({ page }) => {
  const { aufgabe } = await legeAufgabeAn('Firewall-Regelwerk prüfen', adminId)

  await meldeAn(page, KONTEN.admin)
  await page.goto(`/tasks/${aufgabe.id}`)

  await page.getByRole('button', { name: 'Erledigen' }).first().click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()

  await dialog.getByLabel('Ergebnis', { exact: true }).selectOption('DEVIATION')
  await dialog
    .getByRole('textbox', { name: 'Kommentar' })
    .fill('Zwei Regeln ohne Begründung vorgefunden.')

  await dialog.getByRole('button', { name: 'Hinzufügen' }).click()
  await dialog
    .getByPlaceholder('Titel der Abweichung')
    .fill(`${PRAEFIX}Regel 42 ohne Begründung`)
  await dialog
    .getByPlaceholder('Feststellung und geplante Maßnahme')
    .fill('Mit dem Fachbereich klären oder entfernen.')

  await dialog.getByRole('button', { name: 'Durchführung protokollieren' }).click()

  // Der Dialog schließt erst, wenn der Server bestätigt hat.
  await expect(dialog).toBeHidden()

  // Und die Durchführung steht tatsächlich in der Datenbank – nicht nur
  // als Meldung in der Oberfläche.
  await expect
    .poll(
      async () =>
        prisma.execution.count({
          where: { occurrence: { taskId: aufgabe.id } },
        }),
      { timeout: 10_000 },
    )
    .toBe(1)

  const durchfuehrung = await prisma.execution.findFirstOrThrow({
    where: { occurrence: { taskId: aufgabe.id } },
    include: { findings: true },
  })
  expect(durchfuehrung.result).toBe('DEVIATION')
  expect(durchfuehrung.findings).toHaveLength(1)
  expect(durchfuehrung.findings[0].title).toContain('Regel 42')

  // Die Fälligkeit gilt als erledigt, und ein Folgetermin ist entstanden.
  const faelligkeiten = await prisma.occurrence.findMany({
    where: { taskId: aufgabe.id },
    orderBy: { dueDate: 'asc' },
  })
  expect(faelligkeiten.filter((f) => f.status === 'DONE')).toHaveLength(1)
  expect(faelligkeiten.filter((f) => f.status === 'OPEN')).toHaveLength(1)

  // Die Abweichung erscheint in der Liste.
  await page.goto('/findings')
  await expect(page.getByText(`${PRAEFIX}Regel 42 ohne Begründung`)).toBeVisible()
})

test('besteht auf einer Abweichung, wenn das Ergebnis eine verlangt', async ({
  page,
}) => {
  // Eine Feststellung ohne Verantwortlichkeit und Frist verliert sich –
  // deshalb weist der Server das ab, auch wenn die Oberfläche absendet.
  const { aufgabe } = await legeAufgabeAn('Zutrittsliste prüfen', adminId)

  await meldeAn(page, KONTEN.admin)
  await page.goto(`/tasks/${aufgabe.id}`)

  await page.getByRole('button', { name: 'Erledigen' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Ergebnis', { exact: true }).selectOption('DEVIATION')
  await dialog.getByRole('button', { name: 'Durchführung protokollieren' }).click()

  await expect(dialog.getByRole('alert')).toBeVisible()
  expect(
    await prisma.execution.count({
      where: { occurrence: { taskId: aufgabe.id } },
    }),
  ).toBe(0)
})

test('verlangt einen Nachweis, wo er vorgeschrieben ist', async ({ page }) => {
  const { aufgabe } = await legeAufgabeAn('Datensicherung prüfen', adminId, {
    evidenceRequired: true,
  })

  await meldeAn(page, KONTEN.admin)
  await page.goto(`/tasks/${aufgabe.id}`)

  await page.getByRole('button', { name: 'Erledigen' }).first().click()
  const dialog = page.getByRole('dialog')

  // Das Feld ist als verpflichtend gekennzeichnet, und der Browser lässt das
  // Formular ohne Datei nicht abschicken.
  await expect(dialog.getByText('(verpflichtend)')).toBeVisible()
  await dialog.getByRole('button', { name: 'Durchführung protokollieren' }).click()

  expect(
    await prisma.execution.count({
      where: { occurrence: { taskId: aufgabe.id } },
    }),
  ).toBe(0)
})
