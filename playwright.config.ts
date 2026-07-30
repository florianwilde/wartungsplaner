import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-End-Tests gegen eine laufende Anwendung.
 *
 * Warum überhaupt: Beide Fehler, die in 1.6.0 auffielen, lagen zwischen
 * Oberfläche und Server – der Prüfbogen meldete sich als vollständig,
 * während der Server einen leeren Stand bewertete. Solche Fehler bestehen
 * jede Typprüfung und jeden Unit-Test; nur ein Test, der die Anwendung
 * tatsächlich bedient, findet sie.
 *
 * Voraussetzungen:
 *   - Die Anwendung läuft (docker compose up -d) und ist unter E2E_BASIS_URL
 *     erreichbar; ohne Angabe wird http://localhost:3007 verwendet.
 *   - Die Datenbank ist vom Host aus erreichbar (docker-compose.dev.yml),
 *     weil die Tests ihre Konten unmittelbar anlegen.
 *
 * Ausführen:  npm run test:e2e
 */
export default defineConfig({
  testDir: './e2e',
  // Ein Arbeiter, keine Parallelität: Alle Tests teilen sich eine Datenbank.
  // Nebenläufige Läufe würden sich gegenseitig die Stammdaten umschreiben.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // In der Entwicklung soll ein Fehlschlag ein Fehlschlag bleiben; eine
  // Wiederholung würde Flackern verdecken, statt es zu zeigen.
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASIS_URL?.trim() || 'http://localhost:3007',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
