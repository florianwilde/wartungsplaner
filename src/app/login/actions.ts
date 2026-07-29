'use server'

import { AuthError } from 'next-auth'

import { signIn, OIDC_PROVIDER_ID } from '@/auth'

export type AnmeldeStatus = { fehler?: string }

/** Anmeldung mit E-Mail und Passwort (interne Benutzerverwaltung). */
export async function anmeldenMitPasswort(
  _status: AnmeldeStatus,
  formData: FormData,
): Promise<AnmeldeStatus> {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  const weiter = String(formData.get('weiter') ?? '') || '/'

  if (!email || !password) {
    return { fehler: 'Bitte E-Mail-Adresse und Passwort eingeben.' }
  }

  try {
    await signIn('credentials', {
      email,
      password,
      redirectTo: sichereZielUrl(weiter),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      // Bewusst unspezifisch, um keine Rückschlüsse auf vorhandene Konten
      // zuzulassen.
      return {
        fehler:
          'Anmeldung fehlgeschlagen. Bitte prüfen Sie E-Mail-Adresse und Passwort.',
      }
    }
    // Weiterleitungen (NEXT_REDIRECT) müssen durchgereicht werden.
    throw error
  }

  return {}
}

/** Anmeldung über den konfigurierten OIDC-Provider. */
export async function anmeldenMitSso(formData: FormData): Promise<void> {
  const weiter = String(formData.get('weiter') ?? '') || '/'
  await signIn(OIDC_PROVIDER_ID, { redirectTo: sichereZielUrl(weiter) })
}

/**
 * Lässt ausschließlich anwendungsinterne Ziele zu, damit die Weiterleitung
 * nach der Anmeldung nicht für Umleitungen auf fremde Seiten missbraucht
 * werden kann.
 */
function sichereZielUrl(ziel: string): string {
  if (!ziel.startsWith('/') || ziel.startsWith('//')) return '/'
  return ziel
}
