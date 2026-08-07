import { NextResponse, type NextRequest } from 'next/server'

import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Abmelden.
 *
 * Warum ein eigener Endpunkt statt einer Server Action: Der Auth.js-Wrapper
 * in `proxy.ts` stellt das Sitzungs-Cookie bei jeder Anfrage neu aus, die
 * durch ihn läuft – auch bei der Abmeldung. Die Löschung wurde dadurch
 * unmittelbar wieder überschrieben, und die Sitzung blieb gültig, obwohl die
 * Anmeldeseite erschien. Dieser Pfad ist von der Middleware ausgenommen;
 * damit bleibt die Löschung bestehen.
 *
 * Zusätzlich wird die Sitzung serverseitig entwertet: Next.js lädt Seiten im
 * Voraus, und jeder dieser Aufrufe stellt das Cookie wieder aus. Ein Wettlauf
 * um Cookies ist nicht zu gewinnen – der Vermerk in der Datenbank schon.
 *
 * Gefunden hat beides ein End-to-End-Test – Typprüfung und Unit-Tests waren
 * grün.
 */
export async function POST(request: NextRequest) {
  const ursprung = anfrageUrsprung(request)

  // Ohne Server Action fehlt deren Ursprungsprüfung; sie wird hier
  // nachgeholt, damit eine fremde Seite niemanden abmelden kann.
  const abgesendetVon = request.headers.get('origin')
  if (abgesendetVon && abgesendetVon !== ursprung) {
    return new NextResponse('Ungültiger Ursprung', { status: 403 })
  }

  // Das Cookie zu löschen genügt nicht: Next.js lädt Seiten im Voraus, und
  // jeder dieser Aufrufe lässt die Middleware das Sitzungs-Cookie neu
  // ausstellen. Erst der höhere Sitzungsstand macht das Token wertlos.
  const sitzung = await auth()
  const benutzerId = sitzung?.user?.id
  if (benutzerId) {
    await prisma.user.update({
      where: { id: benutzerId },
      data: { sitzungsstand: { increment: 1 } },
    })
  }

  await signOut({ redirect: false })

  // 303: Der Browser holt die Anmeldeseite danach mit GET.
  return NextResponse.redirect(new URL('/login', ursprung), 303)
}

/** Schema und Host der Anfrage – auch hinter einem Reverse Proxy. */
function anfrageUrsprung(request: NextRequest): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!host) return request.nextUrl.origin

  const protokoll =
    request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${protokoll}://${host}`
}
