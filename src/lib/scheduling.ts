/**
 * Fälligkeitslogik – Kernstück der Anwendung.
 *
 * Alle Funktionen dieser Datei sind rein: gleiche Eingabe, gleiche Ausgabe,
 * keine Datenbank, keine Systemzeit. Der aktuelle Tag wird stets als Parameter
 * übergeben. Dadurch ist das Verhalten vollständig durch Unit-Tests
 * abgesichert (siehe `scheduling.test.ts`).
 *
 * Fachliche Regeln:
 *  - Beim Anlegen einer aktiven Aufgabe entsteht die erste Fälligkeit zum
 *    Startdatum.
 *  - Nach einer Erledigung ergibt sich die nächste Fälligkeit
 *      • bei FIXED            aus der letzten Soll-Fälligkeit + Intervall,
 *      • bei AFTER_COMPLETION aus dem Erledigungsdatum + Intervall.
 *  - Eine Fälligkeit gilt als überfällig, sobald
 *    `dueDate + graceDays < heute`.
 *  - Eine Fälligkeit erscheint ab `dueDate - leadTimeDays` als „bald fällig“.
 */
import { addDays, addMonths, compareDates, differenceInDays, toDateOnly } from '@/lib/dates'

export type IntervallTyp =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL'
  | 'EVERY_N_DAYS'

export type PlanungsModus = 'FIXED' | 'AFTER_COMPLETION'

export type FaelligkeitsStatus = 'OPEN' | 'DONE' | 'OVERDUE' | 'SUSPENDED'

/** Ampelbewertung einer offenen Fälligkeit. */
export type Ampel = 'ok' | 'bald' | 'ueberfaellig'

export const INTERVALL_BEZEICHNUNG: Record<IntervallTyp, string> = {
  DAILY: 'Täglich',
  WEEKLY: 'Wöchentlich',
  MONTHLY: 'Monatlich',
  QUARTERLY: 'Vierteljährlich',
  SEMIANNUAL: 'Halbjährlich',
  ANNUAL: 'Jährlich',
  EVERY_N_DAYS: 'Alle N Tage',
}

export const PLANUNGSMODUS_BEZEICHNUNG: Record<PlanungsModus, string> = {
  FIXED: 'Fester Rhythmus (ab Soll-Fälligkeit)',
  AFTER_COMPLETION: 'Ab Erledigungsdatum',
}

/** Menschenlesbare Beschreibung des Intervalls, z. B. „Alle 45 Tage“. */
export function intervallText(
  typ: IntervallTyp,
  wert?: number | null,
): string {
  if (typ === 'EVERY_N_DAYS') {
    if (!wert || wert < 1) return 'Alle N Tage (nicht konfiguriert)'
    return wert === 1 ? 'Täglich' : `Alle ${wert} Tage`
  }
  return INTERVALL_BEZEICHNUNG[typ]
}

/**
 * Addiert genau ein Intervall auf einen Kalendertag.
 *
 * Bei monatsbasierten Intervallen wird auf den letzten Tag des Zielmonats
 * begrenzt (31.01. + 1 Monat ergibt den 28./29.02.).
 *
 * @throws wenn `EVERY_N_DAYS` ohne gültigen Tageswert verwendet wird.
 */
export function addiereIntervall(
  datum: Date,
  typ: IntervallTyp,
  wert?: number | null,
): Date {
  const basis = toDateOnly(datum)

  switch (typ) {
    case 'DAILY':
      return addDays(basis, 1)
    case 'WEEKLY':
      return addDays(basis, 7)
    case 'MONTHLY':
      return addMonths(basis, 1)
    case 'QUARTERLY':
      return addMonths(basis, 3)
    case 'SEMIANNUAL':
      return addMonths(basis, 6)
    case 'ANNUAL':
      return addMonths(basis, 12)
    case 'EVERY_N_DAYS': {
      if (!Number.isInteger(wert) || (wert as number) < 1) {
        throw new Error(
          'Für das Intervall „Alle N Tage“ muss ein ganzzahliger Wert von mindestens 1 angegeben werden.',
        )
      }
      return addDays(basis, wert as number)
    }
    default: {
      const unbekannt: never = typ
      throw new Error(`Unbekannter Intervalltyp: ${String(unbekannt)}`)
    }
  }
}

export type NaechsteFaelligkeitEingabe = {
  intervalType: IntervallTyp
  intervalValue?: number | null
  scheduleMode: PlanungsModus
  /** Soll-Fälligkeit der soeben erledigten Durchführung. */
  letzteSollFaelligkeit: Date
  /** Tatsächliches Erledigungsdatum (Kalendertag). */
  erledigtAm: Date
}

/**
 * Ermittelt die nächste Soll-Fälligkeit nach einer Erledigung.
 *
 * FIXED behält den ursprünglichen Rhythmus bei – eine verspätete Erledigung
 * verschiebt den Takt also nicht. AFTER_COMPLETION rechnet dagegen ab dem
 * Erledigungsdatum, weil dort der Abstand zur letzten Durchführung zählt.
 */
export function naechsteFaelligkeit(eingabe: NaechsteFaelligkeitEingabe): Date {
  const basis =
    eingabe.scheduleMode === 'AFTER_COMPLETION'
      ? eingabe.erledigtAm
      : eingabe.letzteSollFaelligkeit

  return addiereIntervall(basis, eingabe.intervalType, eingabe.intervalValue)
}

/**
 * Nächste Fälligkeit für eine Aufgabe, die noch nie erledigt wurde bzw. für
 * die der tägliche Job eine fehlende offene Fälligkeit nachzieht.
 *
 * Ausgehend von `letzteFaelligkeit` wird so lange ein Intervall addiert, bis
 * das Ergebnis nach `letzteFaelligkeit` liegt – mindestens also ein Schritt.
 * Optional kann bis mindestens `nichtVor` vorgerollt werden, damit für
 * langlaufende Rückstände nicht dutzende Termine in der Vergangenheit
 * entstehen.
 */
export function faelligkeitNachrollen(
  letzteFaelligkeit: Date,
  typ: IntervallTyp,
  wert: number | null | undefined,
  nichtVor?: Date,
): Date {
  let termin = addiereIntervall(letzteFaelligkeit, typ, wert)
  if (!nichtVor) return termin

  // Obergrenze als Schutz gegen Endlosschleifen bei fehlerhaften Daten.
  let schritte = 0
  const MAX_SCHRITTE = 1000
  while (compareDates(termin, nichtVor) < 0 && schritte < MAX_SCHRITTE) {
    termin = addiereIntervall(termin, typ, wert)
    schritte++
  }
  return termin
}

/** Erste Fälligkeit einer neu angelegten Aufgabe: das Startdatum selbst. */
export function ersteFaelligkeit(startDatum: Date): Date {
  return toDateOnly(startDatum)
}

/**
 * Überfällig, sobald der letzte Karenztag verstrichen ist:
 * `dueDate + graceDays < heute`.
 */
export function istUeberfaellig(
  faelligAm: Date,
  karenztage: number,
  heute: Date,
): boolean {
  const letzterTagOhneMahnung = addDays(faelligAm, Math.max(0, karenztage))
  return compareDates(letzterTagOhneMahnung, heute) < 0
}

/**
 * „Bald fällig“ ab `dueDate - leadTimeDays` bis einschließlich des letzten
 * Karenztages. Überfällige Termine zählen nicht mehr als „bald fällig“.
 */
export function istBaldFaellig(
  faelligAm: Date,
  vorlaufTage: number,
  karenztage: number,
  heute: Date,
): boolean {
  if (istUeberfaellig(faelligAm, karenztage, heute)) return false
  const sichtbarAb = addDays(faelligAm, -Math.max(0, vorlaufTage))
  return compareDates(heute, sichtbarAb) >= 0
}

/** Ampelbewertung einer unerledigten Fälligkeit. */
export function bewerteAmpel(
  faelligAm: Date,
  vorlaufTage: number,
  karenztage: number,
  heute: Date,
): Ampel {
  if (istUeberfaellig(faelligAm, karenztage, heute)) return 'ueberfaellig'
  if (istBaldFaellig(faelligAm, vorlaufTage, karenztage, heute)) return 'bald'
  return 'ok'
}

/**
 * Status, den der tägliche Job für eine Fälligkeit setzen soll.
 * Erledigte und ausgesetzte Fälligkeiten bleiben unverändert.
 */
export function statusNachTagesabgleich(
  aktuellerStatus: FaelligkeitsStatus,
  faelligAm: Date,
  karenztage: number,
  heute: Date,
): FaelligkeitsStatus {
  if (aktuellerStatus === 'DONE' || aktuellerStatus === 'SUSPENDED') {
    return aktuellerStatus
  }
  return istUeberfaellig(faelligAm, karenztage, heute) ? 'OVERDUE' : 'OPEN'
}

/**
 * Verzug in Tagen (bezogen auf die Soll-Fälligkeit, ohne Karenz).
 * Negative Werte bedeuten „vor dem Termin erledigt“.
 */
export function verzugInTagen(faelligAm: Date, erledigtAm: Date): number {
  return differenceInDays(faelligAm, erledigtAm)
}

/**
 * War eine Durchführung pünktlich? Karenztage gelten als pünktlich, weil sie
 * die vereinbarte Toleranz abbilden.
 */
export function warPuenktlich(
  faelligAm: Date,
  erledigtAm: Date,
  karenztage: number,
): boolean {
  return compareDates(erledigtAm, addDays(faelligAm, Math.max(0, karenztage))) <= 0
}

export type VorschauEingabe = {
  /** Erste bekannte offene Fälligkeit bzw. Startdatum der Aufgabe. */
  ab: Date
  intervalType: IntervallTyp
  intervalValue?: number | null
  /** Zeitfenster der Vorschau (einschließlich). */
  von: Date
  bis: Date
  /** Schutzgrenze gegen sehr kurze Intervalle über lange Zeiträume. */
  maxAnzahl?: number
}

/**
 * Erzeugt die voraussichtlichen Termine einer Aufgabe innerhalb eines
 * Zeitfensters. Grundlage der Fälligkeitsvorschau im Report.
 */
export function erzeugeVorschau(eingabe: VorschauEingabe): Date[] {
  const max = eingabe.maxAnzahl ?? 500
  const termine: Date[] = []

  let termin = toDateOnly(eingabe.ab)
  let schritte = 0

  // Bis zum Beginn des Fensters vorrollen.
  while (compareDates(termin, eingabe.von) < 0 && schritte < max * 4) {
    termin = addiereIntervall(
      termin,
      eingabe.intervalType,
      eingabe.intervalValue,
    )
    schritte++
  }

  while (compareDates(termin, eingabe.bis) <= 0 && termine.length < max) {
    termine.push(termin)
    termin = addiereIntervall(
      termin,
      eingabe.intervalType,
      eingabe.intervalValue,
    )
  }

  return termine
}
