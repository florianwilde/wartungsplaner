import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/** Healthcheck für den Container: prüft, ob die Datenbank erreichbar ist. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ status: 'ok', datenbank: 'erreichbar' })
  } catch {
    return NextResponse.json(
      { status: 'fehler', datenbank: 'nicht erreichbar' },
      { status: 503 },
    )
  }
}
