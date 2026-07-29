/**
 * Datums-Hilfsfunktionen.
 *
 * Grundsatz: Fälligkeiten sind reine Kalendertage (Prisma-Typ `@db.Date`).
 * Sie werden intern immer als `Date` mit UTC-Mitternacht dargestellt, damit
 * keine Zeitzonenverschiebung den Tag verändert. Die Umrechnung "was ist
 * heute?" erfolgt bewusst in der Zeitzone Europe/Berlin.
 *
 * Alle Funktionen sind rein (keine Seiteneffekte) und damit direkt testbar.
 */

export const APP_TIME_ZONE = 'Europe/Berlin'

/** Erzeugt einen reinen Kalendertag (UTC-Mitternacht). Monat ist 1-basiert. */
export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

/** Schneidet die Uhrzeit ab und liefert den Kalendertag als UTC-Mitternacht. */
export function toDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  )
}

/**
 * Ermittelt den Kalendertag, der zu einem Zeitpunkt in Europe/Berlin gehört,
 * und liefert ihn als UTC-Mitternacht zurück.
 */
export function toBerlinDateOnly(instant: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)!.value)

  return dateOnly(get('year'), get('month'), get('day'))
}

/** Heutiger Kalendertag in Europe/Berlin (als UTC-Mitternacht). */
export function todayInBerlin(now: Date = new Date()): Date {
  return toBerlinDateOnly(now)
}

/** Addiert Tage zu einem Kalendertag. Negative Werte subtrahieren. */
export function addDays(date: Date, days: number): Date {
  const result = toDateOnly(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/**
 * Addiert Monate zu einem Kalendertag. Existiert der Zieltag im Zielmonat
 * nicht (31.01. + 1 Monat), wird auf den letzten Tag des Monats begrenzt.
 */
export function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate()
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1),
  )
  const lastDayOfTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate()
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth))
  return target
}

/** Differenz in ganzen Tagen (b - a). */
export function differenceInDays(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / MS_PER_DAY)
}

/** Vergleich zweier Kalendertage: negativ, 0 oder positiv. */
export function compareDates(a: Date, b: Date): number {
  return toDateOnly(a).getTime() - toDateOnly(b).getTime()
}

export function isSameDay(a: Date, b: Date): boolean {
  return compareDates(a, b) === 0
}

/** Montag der Woche, in der `date` liegt (ISO-Woche, Montag = Wochenstart). */
export function startOfWeek(date: Date): Date {
  const d = toDateOnly(date)
  // getUTCDay(): 0 = Sonntag … 6 = Samstag
  const offset = (d.getUTCDay() + 6) % 7
  return addDays(d, -offset)
}

/** Sonntag der Woche, in der `date` liegt. */
export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6)
}

export function startOfMonth(date: Date): Date {
  return dateOnly(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)
}

export function endOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

/** Formatiert einen Kalendertag als "TT.MM.JJJJ". */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return '–'
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`
}

/** Formatiert einen Zeitpunkt als "TT.MM.JJJJ, HH:MM" in Europe/Berlin. */
export function formatDateTime(value: Date | null | undefined): string {
  if (!value) return '–'
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

/**
 * ISO-Wochennummer nach DIN 1355 / ISO 8601.
 * Woche 1 ist die Woche, die den ersten Donnerstag des Jahres enthält.
 */
export function isoKalenderwoche(date: Date): { jahr: number; woche: number } {
  // Auf den Donnerstag derselben Woche schieben – dessen Jahr bestimmt das
  // ISO-Jahr.
  const donnerstag = addDays(startOfWeek(date), 3)
  const jahresbeginn = dateOnly(donnerstag.getUTCFullYear(), 1, 1)
  const ersterDonnerstag = addDays(startOfWeek(jahresbeginn), 3)

  const woche =
    Math.round(differenceInDays(ersterDonnerstag, donnerstag) / 7) + 1

  return { jahr: donnerstag.getUTCFullYear(), woche }
}

/** Kennung einer Kalenderwoche, z. B. "2026-W31". */
export function kalenderwochenSchluessel(date: Date): string {
  const { jahr, woche } = isoKalenderwoche(date)
  return `${jahr}-W${String(woche).padStart(2, '0')}`
}

/**
 * Wochentag als Zahl: 1 = Montag … 7 = Sonntag.
 * Entspricht der Zählung in ISO 8601 und der Auswahl im Admin-Bereich.
 */
export function wochentagIso(date: Date): number {
  return ((toDateOnly(date).getUTCDay() + 6) % 7) + 1
}

/** ISO-Kalendertag "JJJJ-MM-TT" – für <input type="date"> und Dateinamen. */
export function toISODate(date: Date): string {
  const d = new Date(date)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

/** Parst "JJJJ-MM-TT" zu einem Kalendertag. Wirft bei ungültiger Eingabe. */
export function parseISODate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) {
    throw new Error(`Ungültiges Datum: "${value}" (erwartet JJJJ-MM-TT)`)
  }
  const [, y, m, d] = match
  const result = dateOnly(Number(y), Number(m), Number(d))
  if (
    result.getUTCFullYear() !== Number(y) ||
    result.getUTCMonth() + 1 !== Number(m) ||
    result.getUTCDate() !== Number(d)
  ) {
    throw new Error(`Ungültiges Datum: "${value}"`)
  }
  return result
}
