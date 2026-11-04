import { expect, test, type Page } from '@playwright/test'

import { KONTEN, legeKontenAn, meldeAn, prisma, raeumeAuf } from './hilfen'

/**
 * Passkeys von Anfang bis Ende: hinterlegen, abmelden, mit dem Passkey wieder
 * anmelden.
 *
 * Statt eines echten Geräts dient der virtuelle Authenticator von Chromium.
 * Er rechnet die Kryptografie wirklich – geprüft wird also, ob Browser-Paket,
 * Server-Paket und Datenbank dieselben Formate sprechen. Genau das ändert
 * sich bei einem Versionssprung von SimpleWebAuthn, und kein Unit-Test sieht
 * es.
 */

async function virtuellerAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

async function entfernePasskeys() {
  await prisma.passkey.deleteMany({ where: { user: { email: KONTEN.admin } } })
}

test.beforeAll(async () => {
  await raeumeAuf()
  await legeKontenAn()
  await entfernePasskeys()
})

test.afterAll(async () => {
  await entfernePasskeys()
  await raeumeAuf()
  await prisma.$disconnect()
})

test('hinterlegt einen Passkey und meldet damit an', async ({ page }) => {
  await virtuellerAuthenticator(page)
  await meldeAn(page, KONTEN.admin)

  // Der Name wird per window.prompt erfragt.
  page.on('dialog', (dialog) => dialog.accept('E2E-Schlüssel'))

  await page.goto('/konto')
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(
    page.getByText('Passkey „E2E-Schlüssel“ wurde hinterlegt.'),
  ).toBeVisible()

  const hinterlegt = await prisma.passkey.findMany({
    where: { user: { email: KONTEN.admin } },
  })
  expect(hinterlegt).toHaveLength(1)
  // base64url wie in allen bisherigen Fassungen – sonst fände die Anmeldung
  // bereits hinterlegte Passkeys nicht mehr.
  expect(hinterlegt[0]?.credentialId).toMatch(/^[A-Za-z0-9_-]+$/)

  // Dasselbe Gerät ein zweites Mal: excludeCredentials muss greifen.
  await page.getByRole('button', { name: 'Passkey hinzufügen' }).click()
  await expect(page.getByRole('button', { name: 'Passkey hinzufügen' })).toBeEnabled()
  expect(await prisma.passkey.count({ where: { user: { email: KONTEN.admin } } })).toBe(
    1,
  )

  // Abmelden, ohne den Authenticator zu verlieren: nur die Cookies leeren.
  await page.context().clearCookies()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'))
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  const benutzt = await prisma.passkey.findFirstOrThrow({
    where: { user: { email: KONTEN.admin } },
  })
  expect(benutzt.lastUsedAt).not.toBeNull()
})
