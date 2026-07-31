import { expect, test } from '@playwright/test'

import { KONTEN, legeKontenAn, meldeAn, prisma, raeumeAuf } from './hilfen'

test.beforeAll(async () => {
  await raeumeAuf()
  await legeKontenAn()
})

test.afterAll(async () => {
  await raeumeAuf()
  await prisma.$disconnect()
})

test('führt Unangemeldete zur Anmeldung und danach zurück', async ({ page }) => {
  // Der Weg zurück ist der eigentliche Prüfpunkt: Wer einen Verweis aus einer
  // Mail öffnet, soll nach dem Anmelden dort landen und nicht auf dem
  // Dashboard.
  await page.goto('/tasks')
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel('E-Mail-Adresse').fill(KONTEN.admin)
  await page.getByLabel('Passwort').fill('E2E-Testkonto-2026!')
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

  await expect(page).toHaveURL(/\/tasks/)
})

test('weist falsche Anmeldedaten ab, ohne den Grund zu verraten', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(KONTEN.admin)
  await page.getByLabel('Passwort').fill('falsches-passwort')
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()

  const meldung = page.getByRole('alert')
  await expect(meldung).toBeVisible()
  // Die Meldung darf nicht sagen, ob die Adresse existiert.
  await expect(meldung).not.toContainText('unbekannt')
  await expect(page).toHaveURL(/\/login/)
})

test('meldet an und wieder ab', async ({ page }) => {
  await meldeAn(page, KONTEN.admin)
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const vorher = await prisma.user.findUniqueOrThrow({
    where: { email: KONTEN.admin },
    select: { sitzungsstand: true },
  })

  await page.getByRole('button', { name: /Adminkonto/ }).click()
  await page.getByRole('menuitem', { name: /Abmelden/ }).click()

  await expect(page).toHaveURL(/\/login/)

  // Der Sitzungsstand ist die serverseitige Hälfte der Abmeldung: Ohne ihn
  // könnte ein vorgeladener Seitenaufruf das Cookie wieder ausstellen.
  // Getrennt geprüft, damit ein Fehlschlag zeigt, welche Hälfte versagt hat.
  const nachher = await prisma.user.findUniqueOrThrow({
    where: { email: KONTEN.admin },
    select: { sitzungsstand: true },
  })
  expect(nachher.sitzungsstand).toBeGreaterThan(vorher.sitzungsstand)

  // Nach dem Abmelden darf die geschützte Seite nicht mehr aufgehen.
  await page.goto('/')
  await expect(page).toHaveURL(/\/login/)
})

test('hält die Verwaltung von der Prüferrolle fern', async ({ page }) => {
  await meldeAn(page, KONTEN.pruefer)
  await page.goto('/admin/benutzer')

  // Entweder Weiterleitung oder deutliche Absage – beides ist zulässig,
  // die Benutzerliste darf nur nicht erscheinen.
  await expect(
    page.getByRole('heading', { name: 'Benutzer', exact: true }),
  ).toHaveCount(0)
})
