import { erzeugePrismaClient, type PrismaClient } from '@/lib/prisma-basis'

// In der Entwicklung würde Hot-Reloading bei jedem Rebuild eine neue
// Verbindung öffnen – deshalb wird der Client am globalen Objekt gecacht.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  erzeugePrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
