/**
 * Grundlagen für die Anmeldung mit Passkeys (WebAuthn / FIDO2).
 *
 * Reine Funktionen ohne Datenbank und ohne Bibliothek – damit die Ableitung
 * der Kennungen aus der konfigurierten Adresse vollständig testbar bleibt.
 * Ein Fehler an dieser Stelle würde entweder alle Anmeldungen verhindern oder,
 * schlimmer, Passkeys für eine fremde Domäne gültig machen.
 */
import { ohneSteuerzeichen } from './sicherheit'

/** Gültigkeitsdauer einer Aufgabe (Challenge) in Millisekunden. */
export const CHALLENGE_GUELTIGKEIT_MS = 5 * 60 * 1000

/** Name des Cookies, das auf die serverseitige Aufgabe verweist. */
export const CHALLENGE_COOKIE = 'webauthn-vorgang'

/** Höchstzahl Passkeys je Benutzer. */
export const MAX_PASSKEYS_JE_BENUTZER = 10

/**
 * Ermittelt die Relying-Party-ID: der Hostname ohne Port.
 *
 * Passkeys sind an diesen Wert gebunden. Ändert sich die Adresse der
 * Anwendung, sind bestehende Passkeys nicht mehr verwendbar.
 *
 * @throws bei einer unbrauchbaren Adresse – lieber ein klarer Fehler als eine
 *         stillschweigend falsche Bindung.
 */
export function rpIdAus(appUrl: string): string {
  let url: URL
  try {
    url = new URL(appUrl)
  } catch {
    throw new Error(
      `APP_URL ist keine gültige Adresse: "${appUrl}". Passkeys benötigen eine gültige Adresse.`,
    )
  }

  if (!url.hostname) {
    throw new Error(`APP_URL enthält keinen Hostnamen: "${appUrl}"`)
  }

  return url.hostname
}

/** Erwarteter Ursprung der Anfragen: Schema, Host und Port. */
export function ursprungAus(appUrl: string): string {
  try {
    return new URL(appUrl).origin
  } catch {
    throw new Error(`APP_URL ist keine gültige Adresse: "${appUrl}"`)
  }
}

/**
 * Sind Passkeys unter dieser Adresse überhaupt nutzbar?
 *
 * Browser erlauben WebAuthn nur in sicheren Kontexten: HTTPS oder localhost.
 * Bei einer HTTP-Adresse mit echtem Hostnamen bleibt die Funktion aus, statt
 * mit einer unverständlichen Browsermeldung zu scheitern.
 */
export function istPasskeyTauglich(appUrl: string): boolean {
  let url: URL
  try {
    url = new URL(appUrl)
  } catch {
    return false
  }

  if (url.protocol === 'https:') return true
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1'
}

/** Erklärt, warum Passkeys nicht zur Verfügung stehen. */
export function passkeyHinweis(appUrl: string): string | null {
  if (istPasskeyTauglich(appUrl)) return null
  return (
    'Passkeys benötigen eine verschlüsselte Verbindung. ' +
    'Bitte betreiben Sie die Anwendung über HTTPS und tragen Sie die Adresse in APP_URL ein.'
  )
}

/**
 * Bereinigt und prüft den Namen eines Passkeys.
 * @returns den bereinigten Namen oder `null`, wenn er unbrauchbar ist.
 */
export function pruefePasskeyName(wert: string): string | null {
  const name = ohneSteuerzeichen(wert).trim()
    .slice(0, 60)

  return name.length >= 2 ? name : null
}

/** Schlägt anhand der Browserkennung einen Namen vor. */
export function schlageNamenVor(userAgent: string): string {
  const kennung = userAgent.toLowerCase()

  if (kennung.includes('windows')) return 'Windows Hello'
  if (kennung.includes('iphone')) return 'iPhone'
  if (kennung.includes('ipad')) return 'iPad'
  if (kennung.includes('android')) return 'Android-Gerät'
  if (kennung.includes('mac os') || kennung.includes('macintosh')) return 'Mac'
  if (kennung.includes('linux')) return 'Linux-Gerät'

  return 'Passkey'
}

/** Ist eine Aufgabe (Challenge) noch gültig? */
export function istChallengeGueltig(ablauf: Date, jetzt: Date): boolean {
  return ablauf.getTime() > jetzt.getTime()
}

/** Ablaufzeitpunkt für eine neue Aufgabe. */
export function challengeAblauf(jetzt: Date): Date {
  return new Date(jetzt.getTime() + CHALLENGE_GUELTIGKEIT_MS)
}

/** Beschreibt die Art eines Passkeys für die Oberfläche. */
export function geraeteArtText(deviceType: string, gesichert: boolean): string {
  if (deviceType === 'multiDevice') {
    return gesichert
      ? 'Synchronisiert (in einem Konto gesichert)'
      : 'Synchronisiert'
  }
  return 'An dieses Gerät gebunden'
}
