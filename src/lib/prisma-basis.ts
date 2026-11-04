/**
 * Erzeugt einen Prisma-Client mit PostgreSQL-Treiber.
 *
 * Seit Prisma 7 gibt es keine eingebaute Query-Engine mehr; die Verbindung
 * läuft über den Treiber-Adapter `@prisma/adapter-pg`. Die Datei ist bewusst
 * frei von Next.js, damit Seed, Testskripte und die Anwendung denselben Weg
 * nehmen.
 *
 * Prisma 6 las die `.env` beim Erzeugen des Clients selbst. Für Seed und
 * Testskripte, die außerhalb von Next.js laufen, wird das hier nachgebildet;
 * bereits gesetzte Variablen überschreibt `loadEnvFile` nicht.
 */
import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client'

type ClientOptionen = Omit<
  NonNullable<ConstructorParameters<typeof PrismaClient>[0]>,
  'adapter' | 'accelerateUrl'
>

export function erzeugePrismaClient(optionen: ClientOptionen = {}): PrismaClient {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile('.env')
    } catch {
      // keine .env vorhanden – die Umgebung kommt von außen
    }
  }
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ ...optionen, adapter })
}

export { PrismaClient }
