import { NextResponse } from 'next/server'

import { istPasskeyTauglich } from '@/lib/webauthn'
import { appUrl, starteAnmeldung } from '@/server/passkeys'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Startet eine Anmeldung mit Passkey.
 *
 * Der Endpunkt ist bewusst ohne Anmeldung erreichbar – er wird ja gerade zum
 * Anmelden gebraucht. Er gibt keine Auskunft über vorhandene Konten: Die
 * Optionen enthalten keine Liste erlaubter Schlüssel, der Browser wählt aus
 * den auf dem Gerät hinterlegten Passkeys aus.
 */
export async function POST() {
  if (!istPasskeyTauglich(appUrl())) {
    return NextResponse.json(
      { fehler: 'Passkeys benötigen eine verschlüsselte Verbindung (HTTPS).' },
      { status: 400 },
    )
  }

  try {
    const { optionen, vorgangId } = await starteAnmeldung()
    return NextResponse.json({ optionen, vorgangId })
  } catch (error) {
    console.error('Passkey-Anmeldung konnte nicht gestartet werden:', error)
    return NextResponse.json(
      { fehler: 'Die Anmeldung mit Passkey ist derzeit nicht möglich.' },
      { status: 500 },
    )
  }
}
