'use server'

import { signOut } from '@/auth'

/** Meldet den aktuellen Benutzer ab und leitet zur Anmeldeseite. */
export async function abmelden(): Promise<void> {
  await signOut({ redirectTo: '/login' })
}
