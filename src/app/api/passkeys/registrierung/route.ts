import { NextResponse, type NextRequest } from 'next/server'

import { schreibeAuditLeise } from '@/lib/audit'
import { holeBenutzer } from '@/lib/session'
import { istPasskeyTauglich, pruefePasskeyName, schlageNamenVor } from '@/lib/webauthn'
import {
  appUrl,
  schliesseRegistrierungAb,
  starteRegistrierung,
} from '@/server/passkeys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** Startet die Registrierung eines neuen Passkeys für das eigene Konto. */
export async function POST(request: NextRequest) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }
  if (benutzer.authProvider === 'OIDC') {
    return NextResponse.json(
      {
        fehler:
          'Dieses Konto wird über SSO verwaltet. Passkeys hinterlegen Sie beim Identity Provider.',
      },
      { status: 400 },
    )
  }
  if (!istPasskeyTauglich(appUrl())) {
    return NextResponse.json(
      { fehler: 'Passkeys benötigen eine verschlüsselte Verbindung (HTTPS).' },
      { status: 400 },
    )
  }

  try {
    const { optionen, vorgangId } = await starteRegistrierung(benutzer.id)
    return NextResponse.json({
      optionen,
      vorgangId,
      namensvorschlag: schlageNamenVor(request.headers.get('user-agent') ?? ''),
    })
  } catch (error) {
    return NextResponse.json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Die Registrierung konnte nicht gestartet werden.',
      },
      { status: 400 },
    )
  }
}

/** Schließt die Registrierung ab und legt den Passkey an. */
export async function PUT(request: NextRequest) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  let daten: { vorgangId?: string; antwort?: unknown; name?: string }
  try {
    daten = await request.json()
  } catch {
    return NextResponse.json({ fehler: 'Ungültige Anfrage.' }, { status: 400 })
  }

  const name = pruefePasskeyName(daten.name ?? '')
  if (!name) {
    return NextResponse.json(
      { fehler: 'Bitte einen Namen mit mindestens 2 Zeichen vergeben.' },
      { status: 400 },
    )
  }
  if (!daten.vorgangId || !daten.antwort) {
    return NextResponse.json({ fehler: 'Unvollständige Anfrage.' }, { status: 400 })
  }

  try {
    const passkey = await schliesseRegistrierungAb(
      benutzer.id,
      daten.vorgangId,
      // Die Antwort wird von der Bibliothek vollständig geprüft.
      daten.antwort as never,
      name,
    )

    await schreibeAuditLeise({
      userId: benutzer.id,
      action: 'PASSKEY_REGISTRIERT',
      entityType: 'Passkey',
      entityId: passkey.id,
      payload: { name: passkey.name },
    })

    return NextResponse.json({ status: 'ok', passkey })
  } catch (error) {
    return NextResponse.json(
      {
        fehler:
          error instanceof Error
            ? error.message
            : 'Der Passkey konnte nicht gespeichert werden.',
      },
      { status: 400 },
    )
  }
}
