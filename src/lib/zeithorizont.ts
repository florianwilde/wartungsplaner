/**
 * Zeithorizont der Liste „Nächste Fälligkeiten“ auf dem Dashboard.
 *
 * Reine Funktionen ohne Systemzeit: Der Stichtag wird stets übergeben, damit
 * die Auswahl vollständig testbar bleibt.
 */
import { addDays, compareDates, endOfWeek } from '@/lib/dates'

export type Zeithorizont = 'woche' | 'monat' | 'quartal' | 'alle'

export const ZEITHORIZONT_COOKIE = 'zeithorizont'
export const ZEITHORIZONT_STANDARD: Zeithorizont = 'monat'
export const ZEITHORIZONT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const ZEITHORIZONT_BEZEICHNUNG: Record<Zeithorizont, string> = {
  woche: 'Diese Woche',
  monat: 'Nächste 30 Tage',
  quartal: 'Nächste 90 Tage',
  alle: 'Alle offenen',
}

export const ZEITHORIZONT_ERKLAERUNG: Record<Zeithorizont, string> = {
  woche: 'Bis einschließlich Sonntag dieser Woche.',
  monat: 'Alles, was in den kommenden 30 Tagen fällig wird.',
  quartal: 'Alles, was in den kommenden 90 Tagen fällig wird.',
  alle: 'Ohne zeitliche Begrenzung.',
}

export const ZEITHORIZONT_AUSWAHL: Zeithorizont[] = [
  'woche',
  'monat',
  'quartal',
  'alle',
]

/** Prüft und normalisiert einen Cookie-Wert. */
export function leseZeithorizont(wert: string | undefined | null): Zeithorizont {
  return ZEITHORIZONT_AUSWAHL.includes(wert as Zeithorizont)
    ? (wert as Zeithorizont)
    : ZEITHORIZONT_STANDARD
}

/**
 * Letzter Tag, der noch zum Horizont gehört.
 * @returns `null` bei „Alle offenen“ – dann gibt es keine Obergrenze.
 */
export function horizontEnde(horizont: Zeithorizont, stichtag: Date): Date | null {
  switch (horizont) {
    case 'woche':
      return endOfWeek(stichtag)
    case 'monat':
      return addDays(stichtag, 30)
    case 'quartal':
      return addDays(stichtag, 90)
    case 'alle':
      return null
  }
}

/**
 * Gehört eine Fälligkeit in den gewählten Horizont?
 *
 * Überfällige Termine erscheinen immer – sie liegen in der Vergangenheit und
 * würden sonst gerade dann verschwinden, wenn sie am dringendsten sind.
 */
export function imHorizont(
  faelligAm: Date,
  horizont: Zeithorizont,
  stichtag: Date,
  ueberfaellig: boolean,
): boolean {
  if (ueberfaellig) return true

  const ende = horizontEnde(horizont, stichtag)
  if (!ende) return true

  return compareDates(faelligAm, ende) <= 0
}

/** Baut die Cookie-Zeichenkette für den Browser. */
export function baueZeithorizontCookie(horizont: Zeithorizont): string {
  return [
    `${ZEITHORIZONT_COOKIE}=${horizont}`,
    'path=/',
    `max-age=${ZEITHORIZONT_COOKIE_MAX_AGE}`,
    'samesite=lax',
  ].join('; ')
}
