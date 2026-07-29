import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { APP_GIT_COMMIT, APP_VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'

/**
 * Healthcheck für den Container: prüft, ob die Datenbank erreichbar ist, und
 * nennt die laufende Fassung. Das Update-Skript wertet die Version aus, um
 * den Erfolg einer Aktualisierung zu bestätigen.
 */
export async function GET() {
  const fassung = {
    version: APP_VERSION,
    commit: APP_GIT_COMMIT || null,
  }

  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({
      status: 'ok',
      datenbank: 'erreichbar',
      ...fassung,
    })
  } catch {
    return NextResponse.json(
      { status: 'fehler', datenbank: 'nicht erreichbar', ...fassung },
      { status: 503 },
    )
  }
}
