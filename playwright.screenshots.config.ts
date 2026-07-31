import { defineConfig, devices } from '@playwright/test'

/**
 * Eigene Konfiguration für die Bildschirmfotos.
 *
 * Getrennt von `playwright.config.ts`, damit `npm run test:e2e` sie nicht
 * mitausführt: Die Bilder entstehen gegen eine eigens gestartete
 * Demo-Instanz, nicht gegen die Anwendung, an der gerade gearbeitet wird.
 *
 * Aufruf über `npm run screenshots` – das Skript startet die Instanz,
 * befüllt sie und räumt hinterher auf.
 */
export default defineConfig({
  testDir: './screenshots',
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.DEMO_BASIS_URL?.trim() || 'http://localhost:3009',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    // Ein Bildschirmfoto darf nicht unscharf sein, sobald es jemand in einem
    // README auf einem hochauflösenden Gerät ansieht.
    deviceScaleFactor: 2,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
