/**
 * Passkey-Pflicht je Rolle.
 *
 * Reine Funktionen ohne Datenbank. Ein Passwort lässt sich abphishen und
 * wiederverwenden – bei einem Konto mit Administrationsrechten wiegt das
 * schwer. Deshalb kann die Anwendung für einzelne Rollen verlangen, dass ein
 * Passkey hinterlegt ist.
 *
 * Die entscheidende Frage ist dabei nicht „wie erzwinge ich das?“, sondern
 * „wie sperre ich dabei niemanden aus?“. Eine Sicherheitsmaßnahme, die die
 * Administration selbst aus der eigenen Anwendung aussperrt, richtet mehr
 * Schaden an als sie verhindert. Deshalb die Regeln unten.
 */
import type { Role } from '@prisma/client'

export type PflichtEinstellung = {
  /** Rollen, für die ein Passkey verlangt wird */
  rollen: Role[]
}

export type Lage = {
  rolle: Role
  /** Hat die Person mindestens einen Passkey hinterlegt? */
  hatPasskey: boolean
  /**
   * Sind Passkeys technisch überhaupt möglich? Ohne HTTPS bietet der Browser
   * die Registrierung nicht an.
   */
  technischMoeglich: boolean
  /** Meldet sich die Person über das Unternehmens-SSO an? */
  ueberSso: boolean
}

export type Bewertung =
  | { pflicht: false; grund: 'nicht-verlangt' | 'sso' | 'nicht-moeglich' }
  | { pflicht: true; erfuellt: boolean }

/**
 * Gilt die Pflicht für diese Person – und ist sie erfüllt?
 *
 * Drei Ausnahmen, jede mit einem Grund:
 *
 *  - **Nicht verlangt**: Die Rolle steht nicht in der Auswahl.
 *  - **SSO**: Wer sich über den Identity Provider anmeldet, hat dort bereits
 *    ein Verfahren. Ein zweiter Faktor gehört dann in den Provider, nicht in
 *    diese Anwendung.
 *  - **Technisch nicht möglich**: Ohne HTTPS bietet kein Browser die
 *    Registrierung an. Die Pflicht durchzusetzen hieße, jede Anmeldung in
 *    eine Sackgasse zu führen.
 */
export function bewerte(
  einstellung: PflichtEinstellung,
  lage: Lage,
): Bewertung {
  if (!einstellung.rollen.includes(lage.rolle)) {
    return { pflicht: false, grund: 'nicht-verlangt' }
  }
  if (lage.ueberSso) {
    return { pflicht: false, grund: 'sso' }
  }
  if (!lage.technischMoeglich) {
    return { pflicht: false, grund: 'nicht-moeglich' }
  }
  return { pflicht: true, erfuellt: lage.hatPasskey }
}

/** Muss die Person vor allem anderen einen Passkey einrichten? */
export function mussEinrichten(
  einstellung: PflichtEinstellung,
  lage: Lage,
): boolean {
  const bewertung = bewerte(einstellung, lage)
  return bewertung.pflicht && !bewertung.erfuellt
}

/**
 * Prüft eine geplante Einstellung, bevor sie gespeichert wird.
 *
 * Es soll nicht möglich sein, sich selbst und alle anderen Administratoren
 * gleichzeitig auszusperren. Verlangt jemand die Pflicht für eine Rolle, in
 * der noch niemand einen Passkey hat, ist das fast sicher ein Versehen –
 * jedenfalls dann, wenn es die eigene Rolle ist.
 */
export type Einspruch = { moeglich: boolean; hinweis: string | null }

export function pruefeUmstellung(
  neueRollen: Role[],
  eigeneRolle: Role,
  ohnePasskeyJeRolle: Record<string, number>,
  technischMoeglich: boolean,
): Einspruch {
  if (!technischMoeglich) {
    return {
      moeglich: false,
      hinweis:
        'Passkeys sind erst möglich, wenn die Anwendung über HTTPS erreichbar ist. Solange bliebe die Pflicht wirkungslos.',
    }
  }

  if (neueRollen.includes(eigeneRolle) && (ohnePasskeyJeRolle[eigeneRolle] ?? 0) > 0) {
    return {
      moeglich: true,
      hinweis:
        'Sie selbst haben noch keinen Passkey hinterlegt. Nach dem Speichern werden Sie zuerst zur Einrichtung geführt.',
    }
  }

  const betroffen = neueRollen
    .map((rolle) => ohnePasskeyJeRolle[rolle] ?? 0)
    .reduce((summe, anzahl) => summe + anzahl, 0)

  if (betroffen > 0) {
    return {
      moeglich: true,
      hinweis: `${betroffen} ${
        betroffen === 1 ? 'Person hat' : 'Personen haben'
      } noch keinen Passkey. Sie werden bei der nächsten Anmeldung zur Einrichtung geführt.`,
    }
  }

  return { moeglich: true, hinweis: null }
}

export const ROLLEN_BEZEICHNUNG: Record<Role, string> = {
  ADMIN: 'Administratoren',
  EDITOR: 'Bearbeiter',
  AUDITOR: 'Prüfer',
}
