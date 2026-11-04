/**
 * Konfiguration der Prisma-CLI (generate, migrate, seed).
 *
 * Seit Prisma 7 liest die CLI die `.env` nicht mehr selbst und die
 * Verbindungsadresse steht hier statt im Schema. Im Container gibt es keine
 * `.env` – dort setzt Docker Compose die Umgebung, deshalb ist die Datei
 * optional.
 */
import { defineConfig } from 'prisma/config'

try {
  process.loadEnvFile('.env')
} catch {
  // keine .env vorhanden – die Umgebung kommt von außen
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` braucht keine Verbindung; ohne DATABASE_URL soll es
    // trotzdem laufen (Docker-Build, CI vor dem Start der Datenbank).
    url: process.env.DATABASE_URL ?? '',
  },
})
