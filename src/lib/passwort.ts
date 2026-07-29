/** Mindestanforderungen an lokale Passwörter (Credentials-Anmeldung). */
export const PASSWORT_MINDESTLAENGE = 12

/**
 * Prüft die Passwortstärke.
 * @returns Fehlertext oder `null`, wenn das Passwort den Anforderungen genügt.
 */
export function pruefePasswortStaerke(passwort: string): string | null {
  if (passwort.length < PASSWORT_MINDESTLAENGE) {
    return `Das Passwort muss mindestens ${PASSWORT_MINDESTLAENGE} Zeichen lang sein.`
  }

  const kategorien = [
    /[a-zäöüß]/.test(passwort),
    /[A-ZÄÖÜ]/.test(passwort),
    /[0-9]/.test(passwort),
    /[^A-Za-z0-9]/.test(passwort),
  ].filter(Boolean).length

  if (kategorien < 3) {
    return 'Das Passwort muss mindestens drei der vier Kategorien enthalten: Kleinbuchstaben, Großbuchstaben, Ziffern, Sonderzeichen.'
  }

  return null
}
