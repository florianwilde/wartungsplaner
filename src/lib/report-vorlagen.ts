/**
 * Anpassbare Report-Vorlagen.
 *
 * Beschreibt, welche Spalten es je Reportart gibt, welche Angaben eine
 * Vorlage machen kann und wie eine Auswahl geprüft wird. Reine Funktionen –
 * die Erzeugung des PDF greift darauf zurück.
 */
import type { ReportTyp } from '@/server/reports/typen'

export type Ausrichtung = 'hoch' | 'quer'

export type SpaltenDefinition = {
  /** Technischer Schlüssel, wird in der Vorlage gespeichert */
  key: string
  /** Überschrift im Report */
  kopf: string
  /** Anteil an der Breite */
  anteil: number
  ausrichtung?: 'left' | 'right' | 'center'
  /** Spalten, ohne die der Report unbrauchbar wäre */
  pflicht?: boolean
}

/**
 * Verfügbare Spalten je Reportart, in der vorgeschlagenen Reihenfolge.
 * Die Pflichtspalten lassen sich nicht abwählen – ohne sie wäre der Bericht
 * nicht mehr aussagekräftig.
 */
export const SPALTEN_KATALOG: Record<ReportTyp, SpaltenDefinition[]> = {
  compliance: [
    { key: 'kategorie', kopf: 'Kategorie', anteil: 22, pflicht: true },
    { key: 'gesamt', kopf: 'Gesamt', anteil: 9, ausrichtung: 'right', pflicht: true },
    { key: 'puenktlich', kopf: 'Pünktlich', anteil: 10, ausrichtung: 'right' },
    { key: 'verspaetet', kopf: 'Verspätet', anteil: 10, ausrichtung: 'right' },
    { key: 'offen', kopf: 'Offen', anteil: 9, ausrichtung: 'right' },
    { key: 'ueberfaellig', kopf: 'Überfällig', anteil: 11, ausrichtung: 'right' },
    { key: 'ausgesetzt', kopf: 'Ausgesetzt', anteil: 11, ausrichtung: 'right' },
    {
      key: 'erfuellung',
      kopf: 'Erfüllung',
      anteil: 9,
      ausrichtung: 'right',
      pflicht: true,
    },
    { key: 'puenktlichkeit', kopf: 'Pünktl.', anteil: 9, ausrichtung: 'right' },
  ],
  historie: [
    { key: 'soll', kopf: 'Soll', anteil: 10, pflicht: true },
    { key: 'ist', kopf: 'Durchgeführt', anteil: 12, pflicht: true },
    { key: 'person', kopf: 'Person', anteil: 16, pflicht: true },
    { key: 'ergebnis', kopf: 'Ergebnis', anteil: 18, pflicht: true },
    { key: 'termintreue', kopf: 'Termintreue', anteil: 11 },
    { key: 'nachweise', kopf: 'Nachweise', anteil: 10, ausrichtung: 'right' },
    { key: 'abweichungen', kopf: 'Abw.', anteil: 7, ausrichtung: 'right' },
    { key: 'kommentar', kopf: 'Kommentar', anteil: 20 },
    { key: 'referenzen', kopf: 'Audit-Referenzen', anteil: 16 },
  ],
  abweichungen: [
    { key: 'titel', kopf: 'Abweichung', anteil: 26, pflicht: true },
    { key: 'aufgabe', kopf: 'Aufgabe', anteil: 20, pflicht: true },
    { key: 'kategorie', kopf: 'Kategorie', anteil: 14 },
    { key: 'schwere', kopf: 'Schwere', anteil: 9 },
    { key: 'status', kopf: 'Status', anteil: 12, pflicht: true },
    { key: 'verantwortlich', kopf: 'Verantwortlich', anteil: 15 },
    { key: 'frist', kopf: 'Frist', anteil: 9 },
    { key: 'festgestellt', kopf: 'Festgestellt', anteil: 9 },
    { key: 'geschlossen', kopf: 'Geschlossen', anteil: 9 },
    { key: 'referenzen', kopf: 'Audit-Referenzen', anteil: 14 },
  ],
  vorschau: [
    { key: 'termin', kopf: 'Termin', anteil: 10, pflicht: true },
    { key: 'aufgabe', kopf: 'Aufgabe', anteil: 30, pflicht: true },
    { key: 'kategorie', kopf: 'Kategorie', anteil: 15 },
    { key: 'verantwortlich', kopf: 'Verantwortlich', anteil: 16 },
    { key: 'intervall', kopf: 'Intervall', anteil: 14 },
    { key: 'kritikalitaet', kopf: 'Kritikalität', anteil: 9 },
    { key: 'art', kopf: 'Art', anteil: 8 },
    { key: 'referenzen', kopf: 'Audit-Referenzen', anteil: 14 },
  ],
  nachweise: [
    { key: 'pruefbogen', kopf: 'Prüfbogen', anteil: 19, pflicht: true },
    { key: 'aufgabe', kopf: 'Aufgabe', anteil: 17, pflicht: true },
    { key: 'kategorie', kopf: 'Kategorie', anteil: 12 },
    { key: 'faellig', kopf: 'Soll', anteil: 8 },
    { key: 'erfasstVon', kopf: 'Erfasst von', anteil: 14, pflicht: true },
    { key: 'geprueftVon', kopf: 'Gegengezeichnet', anteil: 14, pflicht: true },
    { key: 'geprueftAm', kopf: 'Am', anteil: 8 },
    { key: 'vierAugen', kopf: '4-Augen', anteil: 7 },
    { key: 'punkte', kopf: 'Punkte', anteil: 6, ausrichtung: 'right' },
    { key: 'feststellungen', kopf: 'Fest.', anteil: 6, ausrichtung: 'right' },
    { key: 'belege', kopf: 'Belege', anteil: 6, ausrichtung: 'right' },
    { key: 'referenzen', kopf: 'Audit-Referenzen', anteil: 14 },
    { key: 'pruefsumme', kopf: 'SHA-256', anteil: 20 },
  ],
}

/** Alle Spaltenschlüssel einer Reportart. */
export function alleSpalten(typ: ReportTyp): string[] {
  return SPALTEN_KATALOG[typ].map((s) => s.key)
}

/** Die nicht abwählbaren Spalten einer Reportart. */
export function pflichtSpalten(typ: ReportTyp): string[] {
  return SPALTEN_KATALOG[typ].filter((s) => s.pflicht).map((s) => s.key)
}

/** Vorbelegung: alle Spalten außer den ausdrücklich zusätzlichen. */
export function standardSpalten(typ: ReportTyp): string[] {
  // "kommentar" und "geschlossen" sind ausführlich und daher nicht vorbelegt.
  const zusatz = new Set(['kommentar', 'pruefsumme', 'referenzen'])
  return SPALTEN_KATALOG[typ].filter((s) => !zusatz.has(s.key)).map((s) => s.key)
}

/**
 * Prüft und normalisiert eine Spaltenauswahl.
 *
 * - unbekannte Schlüssel entfallen
 * - Doppelungen entfallen
 * - Pflichtspalten werden ergänzt, falls sie fehlen
 * - die Reihenfolge der Auswahl bleibt erhalten
 * - eine leere Auswahl führt zur Vorbelegung
 */
export function normalisiereSpalten(typ: ReportTyp, auswahl: string[]): string[] {
  const bekannt = new Set(alleSpalten(typ))
  const gesehen = new Set<string>()
  const ergebnis: string[] = []

  for (const schluessel of auswahl) {
    if (!bekannt.has(schluessel) || gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    ergebnis.push(schluessel)
  }

  // Bleibt nach dem Aussortieren nichts übrig, gilt die Vorbelegung. Diese
  // Prüfung muss vor dem Ergänzen der Pflichtspalten stehen – sonst wäre die
  // Liste nie leer und die Vorbelegung käme nie zum Tragen.
  if (ergebnis.length === 0) return standardSpalten(typ)

  // Fehlende Pflichtspalten in der Katalogreihenfolge ergänzen.
  for (const schluessel of pflichtSpalten(typ)) {
    if (!gesehen.has(schluessel)) {
      gesehen.add(schluessel)
      ergebnis.push(schluessel)
    }
  }

  return ergebnis
}

/** Löst die Schlüssel in Spaltendefinitionen auf. */
export function spaltenAusSchluesseln(
  typ: ReportTyp,
  schluessel: string[],
): SpaltenDefinition[] {
  const katalog = new Map(SPALTEN_KATALOG[typ].map((s) => [s.key, s]))
  return schluessel
    .map((k) => katalog.get(k))
    .filter((s): s is SpaltenDefinition => Boolean(s))
}

// ---------------------------------------------------------------------------
// Vorlagen
// ---------------------------------------------------------------------------

export type ReportVorlage = {
  id: string | null
  name: string
  typ: ReportTyp
  istStandard: boolean
  ausrichtung: Ausrichtung
  spalten: string[]
  mitDeckblatt: boolean
  deckblattUntertitel: string | null
  einleitung: string | null
  schluss: string | null
  mitUnterschriften: boolean
  unterschriftLinks: string | null
  unterschriftRechts: string | null
}

/** Eingebaute Vorlage, wenn keine eigene hinterlegt ist. */
export function eingebauteVorlage(typ: ReportTyp): ReportVorlage {
  return {
    id: null,
    name: 'Standard',
    typ,
    istStandard: true,
    // Das Nachweisregister führt zwölf Spalten; im Hochformat bräche die
    // Tabelle mitten im Wort um. Die übrigen Berichte kommen hoch aus.
    ausrichtung: typ === 'nachweise' ? 'quer' : 'hoch',
    spalten: standardSpalten(typ),
    mitDeckblatt: false,
    deckblattUntertitel: null,
    einleitung: null,
    schluss: null,
    mitUnterschriften: false,
    unterschriftLinks: null,
    unterschriftRechts: null,
  }
}

/** Maße einer Seite in Punkten. */
export function seitenMasse(ausrichtung: Ausrichtung): {
  breite: number
  hoehe: number
} {
  // A4: 595,28 × 841,89 pt
  return ausrichtung === 'quer'
    ? { breite: 841.89, hoehe: 595.28 }
    : { breite: 595.28, hoehe: 841.89 }
}

/** Kürzt und säubert einen Freitextblock einer Vorlage. */
export function saeubereText(
  wert: string | null | undefined,
  maxLaenge = 2000,
): string | null {
  if (!wert) return null
  const text = wert.replace(/\r\n/g, '\n').trim().slice(0, maxLaenge)
  return text.length > 0 ? text : null
}

/** Prüft den Namen einer Vorlage. */
export function pruefeVorlagenName(wert: string): string | null {
  const name = wert.replace(/\s+/g, ' ').trim().slice(0, 60)
  return name.length >= 3 ? name : null
}
