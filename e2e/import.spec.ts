import { expect, test } from '@playwright/test'

import { KONTEN, PRAEFIX, legeKontenAn, meldeAn, prisma, raeumeAuf } from './hilfen'

/**
 * Import zweier Dateien nacheinander.
 *
 * Genau daran hakte es: Nach dem ersten Import blieb die Erfolgsmeldung des
 * Vorgangs stehen. Die Vorschau der zweiten Datei zeigte sie erneut – statt
 * des Übernehmen-Knopfes. Wer den Prüfplan mit drei Dateien einspielt, musste
 * zwischendurch die Seite neu laden.
 */

test.beforeAll(async () => {
  await raeumeAuf()
  await legeKontenAn()
})

test.afterAll(async () => {
  await raeumeAuf()
  await prisma.$disconnect()
})

/** Legt eine CSV-Datei im Browser an, ohne Datei auf der Platte. */
async function waehleDatei(
  page: import('@playwright/test').Page,
  name: string,
  inhalt: string,
) {
  await page.setInputFiles('#datei', {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from(inhalt, 'utf8'),
  })
}

const ERSTE = ['name;farbe;reihenfolge', `${PRAEFIX}Kategorie A;#2563eb;10`].join('\n')

const ZWEITE = ['name;farbe;reihenfolge', `${PRAEFIX}Kategorie B;#0ea5e9;20`].join('\n')

test('spielt zwei Dateien nacheinander ein, ohne Neuladen', async ({ page }) => {
  await meldeAn(page, KONTEN.admin)
  await page.goto('/admin/import-export')

  // --- Erste Datei --------------------------------------------------------
  await waehleDatei(page, 'erste.csv', ERSTE)
  await page.getByRole('button', { name: 'Datei prüfen' }).click()

  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible()
  await page.getByRole('button', { name: /Änderungen übernehmen/ }).click()

  // Nach dem Schreiben ist die Vorschau verbraucht und verschwindet.
  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeHidden()
  await expect
    .poll(async () =>
      prisma.category.count({ where: { name: `${PRAEFIX}Kategorie A` } }),
    )
    .toBe(1)

  // --- Zweite Datei, ohne Neuladen ---------------------------------------
  await waehleDatei(page, 'zweite.csv', ZWEITE)
  await page.getByRole('button', { name: 'Datei prüfen' }).click()

  await expect(page.getByRole('heading', { name: 'Vorschau' })).toBeVisible()

  // Der entscheidende Punkt: Der Knopf ist wieder da.
  const uebernehmen = page.getByRole('button', { name: /Änderungen übernehmen/ })
  await expect(uebernehmen).toBeVisible()
  await uebernehmen.click()

  await expect
    .poll(async () =>
      prisma.category.count({ where: { name: { startsWith: PRAEFIX } } }),
    )
    .toBe(2)
})
