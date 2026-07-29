import 'server-only'

import { redirect } from 'next/navigation'
import type { Role } from '@prisma/client'

import { auth } from '@/auth'

export type AngemeldeterBenutzer = {
  id: string
  name: string
  email: string
  role: Role
  mustChangePassword: boolean
  authProvider: 'LOCAL' | 'OIDC'
}

/** Liefert den angemeldeten Benutzer oder `null`. */
export async function holeBenutzer(): Promise<AngemeldeterBenutzer | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: session.user.role,
    mustChangePassword: session.user.mustChangePassword,
    authProvider: session.user.authProvider,
  }
}

/**
 * Für Seiten: erzwingt eine Anmeldung und leitet sonst zur Anmeldeseite.
 * Ein erzwungener Passwortwechsel wird ebenfalls hier durchgesetzt.
 */
export async function erforderlicherBenutzer(): Promise<AngemeldeterBenutzer> {
  const benutzer = await holeBenutzer()
  if (!benutzer) redirect('/login')
  if (benutzer.mustChangePassword) redirect('/passwort-aendern')
  return benutzer
}

/** Für Seiten: erzwingt eine der angegebenen Rollen. */
export async function erforderlicheRolle(
  ...rollen: Role[]
): Promise<AngemeldeterBenutzer> {
  const benutzer = await erforderlicherBenutzer()
  if (!rollen.includes(benutzer.role)) redirect('/kein-zugriff')
  return benutzer
}

/**
 * Fehler für schreibende Server Actions. Wird in der Oberfläche als
 * Fehlermeldung angezeigt, statt zu einer Weiterleitung zu führen.
 */
export class ZugriffVerweigertError extends Error {
  constructor(nachricht = 'Für diese Aktion fehlt Ihnen die Berechtigung.') {
    super(nachricht)
    this.name = 'ZugriffVerweigertError'
  }
}

/**
 * Für Server Actions: liefert den angemeldeten Benutzer und prüft die Rolle.
 * Wirft `ZugriffVerweigertError`, wenn die Berechtigung fehlt.
 */
export async function benutzerFuerAktion(
  pruefung: (rolle: Role) => boolean,
): Promise<AngemeldeterBenutzer> {
  const benutzer = await holeBenutzer()
  if (!benutzer) throw new ZugriffVerweigertError('Bitte melden Sie sich an.')
  if (!pruefung(benutzer.role)) throw new ZugriffVerweigertError()
  return benutzer
}
