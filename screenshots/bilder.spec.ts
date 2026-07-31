import { expect, test } from '@playwright/test'

/**
 * Erzeugt die Bildschirmfotos für README und Handbuch.
 *
 * Läuft **nicht** im normalen Testlauf, sondern über
 * `npm run screenshots` gegen eine eigens gestartete Demo-Instanz. Das ist
 * Absicht: Bilder aus einem Produktivbestand zeigen echte Aufgaben, echte
 * Namen und ein fremdes Firmenlogo.
 */

const KONTO = process.env.DEMO_EMAIL ?? 'admin@example.com'
const PASSWORT = process.env.DEMO_PASSWORT ?? 'Start!1234'

/** Breite Ansicht: Ein Bildschirmfoto soll die Oberfläche zeigen, nicht Umbrüche. */
test.use({ viewport: { width: 1440, height: 900 } })

test.beforeEach(async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('E-Mail-Adresse').fill(KONTO)
  await page.getByLabel('Passwort').fill(PASSWORT)
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
})

/**
 * Wartet, bis die Seite zur Ruhe gekommen ist.
 *
 * Ohne das erwischt man gern den Moment, in dem noch ein Platzhalter steht
 * oder eine Schrift nachlädt.
 */
async function beruhigen(page: import('@playwright/test').Page) {
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(300)
}

const SEITEN = [
  { pfad: '/', name: 'dashboard', ueberschrift: 'Dashboard' },
  { pfad: '/tasks', name: 'aufgaben', ueberschrift: 'Aufgaben' },
  { pfad: '/findings', name: 'abweichungen', ueberschrift: 'Abweichungen' },
  { pfad: '/nachweise', name: 'nachweise', ueberschrift: 'Prüfnachweise' },
  { pfad: '/reports', name: 'reports', ueberschrift: 'Reports' },
  { pfad: '/calendar', name: 'kalender', ueberschrift: 'Kalender' },
]

for (const seite of SEITEN) {
  test(`Bildschirmfoto: ${seite.name}`, async ({ page }) => {
    await page.goto(seite.pfad)

    // Erst prüfen, dann aufnehmen. Andernfalls entsteht klaglos ein Bild der
    // falschen Seite – etwa wenn die Anwendung zum Passwortwechsel umleitet.
    await expect(
      page.getByRole('heading', { name: seite.ueberschrift, level: 1 }),
    ).toBeVisible()

    await beruhigen(page)
    await page.screenshot({
      path: `docs/bilder/${seite.name}.png`,
      fullPage: false,
    })
  })
}

test('Bildschirmfoto: dunkles Farbschema', async ({ page }) => {
  await page.goto('/')
  // Das Farbschema steckt in einem Cookie, damit der Server es schon beim
  // Rendern kennt – deshalb hier setzen und neu laden.
  await page.context().addCookies([
    {
      name: 'farbschema',
      value: 'dunkel',
      url: page.url(),
    },
  ])
  await page.reload()
  await beruhigen(page)
  await page.screenshot({ path: 'docs/bilder/dashboard-dunkel.png' })
})

test('Bildschirmfoto: Anmeldeseite', async ({ page, context }) => {
  await context.clearCookies()
  await page.goto('/login')
  await expect(
    page.getByRole('button', { name: 'Anmelden', exact: true }),
  ).toBeVisible()
  await beruhigen(page)
  await page.screenshot({ path: 'docs/bilder/anmeldung.png' })
})
