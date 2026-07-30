/**
 * Aufbewahrung der Nachweisdateien.
 *
 * Reine Funktionen ohne Datenbank. Der Bestand wächst sonst unbegrenzt, und
 * hochgeladene Belege enthalten personenbezogene Daten – ein AD-Export nennt
 * Namen von Beschäftigten.
 *
 * Entfernt wird deshalb nach Ablauf der Frist die **Datei**, nicht der
 * Eintrag: Datum, Person, Ergebnis, Dateiname und Prüfsumme bleiben erhalten
 * und belegen weiterhin, dass geprüft wurde und wie der Nachweis lautete.
 * Gelöscht wird der Inhalt, nicht die Tatsache.
 */
import { addMonths, compareDates, toDateOnly } from './dates'

/** Kürzeste zulässige Frist. */
export const MIN_MONATE = 6

/** Längste zulässige Frist: 30 Jahre. */
export const MAX_MONATE = 360

export type Fristquelle = 'kategorie' | 'standard'

export type Frist = {
  monate: number
  quelle: Fristquelle
}

/**
 * Welche Frist gilt für eine Kategorie?
 *
 * Die Kategorie geht vor: Ein Restore-Test-Protokoll darf früher entfallen
 * als der Nachweis einer Berechtigungsprüfung.
 */
export function geltendeFrist(
  kategorieMonate: number | null | undefined,
  standardMonate: number,
): Frist {
  return kategorieMonate != null && kategorieMonate > 0
    ? { monate: kategorieMonate, quelle: 'kategorie' }
    : { monate: standardMonate, quelle: 'standard' }
}

/**
 * Stichtag: Dateien, die älter sind, dürfen entfernt werden.
 * Maßgeblich ist der Zeitpunkt der Durchführung, nicht der des Hochladens –
 * danach fragt eine Aufbewahrungsvorschrift.
 */
export function stichtagFuer(heute: Date, monate: number): Date {
  return addMonths(toDateOnly(heute), -monate)
}

/** Ist eine Datei nach der geltenden Frist zu entfernen? */
export function istFaellig(
  durchgefuehrtAm: Date,
  heute: Date,
  monate: number,
): boolean {
  return compareDates(toDateOnly(durchgefuehrtAm), stichtagFuer(heute, monate)) < 0
}

/** Begrenzt eine eingegebene Frist auf den zulässigen Bereich. */
export function begrenzeFrist(monate: number): number {
  if (!Number.isFinite(monate)) return MIN_MONATE
  return Math.min(MAX_MONATE, Math.max(MIN_MONATE, Math.trunc(monate)))
}

/** Lesbare Angabe einer Frist, etwa „10 Jahre“ oder „18 Monate“. */
export function fristText(monate: number): string {
  if (monate % 12 === 0) {
    const jahre = monate / 12
    return jahre === 1 ? '1 Jahr' : `${jahre} Jahre`
  }
  return monate === 1 ? '1 Monat' : `${monate} Monate`
}

export type AufbewahrungsErgebnis = {
  /** Geprüfte Dateien insgesamt */
  geprueft: number
  /** Entfernte Dateien */
  entfernt: number
  /** Freigewordener Platz in Bytes */
  freigegebenBytes: number
  /** Dateien, die sich nicht entfernen ließen */
  fehlgeschlagen: number
  dauerMs: number
}

/** Einzeilige Zusammenfassung für Protokoll und Übersicht. */
export function fasseAufbewahrungZusammen(
  ergebnis: AufbewahrungsErgebnis,
  nurVorschau: boolean,
): string {
  if (ergebnis.entfernt === 0) {
    return nurVorschau
      ? `${ergebnis.geprueft} Nachweise geprüft, keiner ist zu entfernen`
      : `${ergebnis.geprueft} Nachweise geprüft, nichts zu entfernen`
  }

  const wort = nurVorschau ? 'wären zu entfernen' : 'entfernt'
  const teile = [
    `${ergebnis.geprueft} Nachweise geprüft`,
    `${ergebnis.entfernt} ${wort}`,
    `${lesbareGroesse(ergebnis.freigegebenBytes)}`,
  ]
  if (ergebnis.fehlgeschlagen > 0) {
    teile.push(`${ergebnis.fehlgeschlagen} fehlgeschlagen`)
  }
  return `${teile.join(', ')} (${ergebnis.dauerMs} ms)`
}

/** Dateigröße in lesbarer Form. */
export function lesbareGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
