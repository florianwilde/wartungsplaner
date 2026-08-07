/**
 * Sicherheitseinstellungen: Passkey-Pflicht je Rolle.
 *
 * Getrennt von der Sitzungsprüfung gehalten, damit die Regel an einer Stelle
 * steht und sich prüfen lässt.
 */
import type { Role } from '@prisma/client'

import { mussEinrichten, type Lage } from '@/lib/passkey-pflicht'
import { prisma } from '@/lib/prisma'
import { istPasskeyTauglich } from '@/lib/webauthn'

export const EINSTELLUNGEN_ID = 'singleton'

export type SicherheitsEinstellungen = {
  passkeyPflichtRollen: Role[]
}

export const STANDARD_SICHERHEIT: SicherheitsEinstellungen = {
  passkeyPflichtRollen: [],
}

export async function holeSicherheitsEinstellungen(): Promise<SicherheitsEinstellungen> {
  try {
    const datensatz = await prisma.sicherheitsEinstellung.findUnique({
      where: { id: EINSTELLUNGEN_ID },
    })
    if (!datensatz) return STANDARD_SICHERHEIT
    return { passkeyPflichtRollen: datensatz.passkeyPflichtRollen }
  } catch (error) {
    console.error('Sicherheitseinstellungen nicht lesbar:', error)
    return STANDARD_SICHERHEIT
  }
}

/** Basisadresse der Anwendung – entscheidet, ob Passkeys möglich sind. */
export function appUrl(): string {
  return (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

/**
 * Muss diese Person vor allem anderen einen Passkey einrichten?
 *
 * Wird bei jedem Seitenaufruf ausgewertet. Die Abfrage ist bewusst schlank:
 * Erst wenn die Rolle überhaupt betroffen ist, wird nach vorhandenen
 * Passkeys gesehen.
 */
export async function brauchtPasskey(benutzer: {
  id: string
  role: Role
  authProvider: 'LOCAL' | 'OIDC'
}): Promise<boolean> {
  const einstellungen = await holeSicherheitsEinstellungen()
  if (einstellungen.passkeyPflichtRollen.length === 0) return false
  if (!einstellungen.passkeyPflichtRollen.includes(benutzer.role)) return false

  const lage: Lage = {
    rolle: benutzer.role,
    hatPasskey: false,
    technischMoeglich: istPasskeyTauglich(appUrl()),
    ueberSso: benutzer.authProvider === 'OIDC',
  }

  // Erst hier die zusätzliche Abfrage – bei den Ausnahmen erübrigt sie sich.
  if (lage.technischMoeglich && !lage.ueberSso) {
    lage.hatPasskey =
      (await prisma.passkey.count({ where: { userId: benutzer.id } })) > 0
  }

  return mussEinrichten({ rollen: einstellungen.passkeyPflichtRollen }, lage)
}

/** Wie viele Personen je Rolle haben noch keinen Passkey? */
export async function ohnePasskeyJeRolle(): Promise<Record<string, number>> {
  const benutzer = await prisma.user.findMany({
    where: { active: true, authProvider: 'LOCAL' },
    select: { role: true, _count: { select: { passkeys: true } } },
  })

  const zaehler: Record<string, number> = {}
  for (const person of benutzer) {
    if (person._count.passkeys > 0) continue
    zaehler[person.role] = (zaehler[person.role] ?? 0) + 1
  }
  return zaehler
}
