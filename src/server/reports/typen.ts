/**
 * Gemeinsame Typen der Reports.
 *
 * Bewusst in einer eigenen, abhängigkeitsfreien Datei: So können sowohl die
 * reine Vorlagenlogik (`@/lib/report-vorlagen`) als auch die datenbanknahen
 * Module darauf zugreifen, ohne dass ein Kreis entsteht.
 */

export type ReportTyp = 'compliance' | 'historie' | 'abweichungen' | 'vorschau'

export const REPORT_TYPEN: ReportTyp[] = [
  'compliance',
  'historie',
  'abweichungen',
  'vorschau',
]

export const REPORT_TITEL: Record<ReportTyp, string> = {
  compliance: 'Compliance-Übersicht',
  historie: 'Aufgabenhistorie',
  abweichungen: 'Abweichungsbericht',
  vorschau: 'Fälligkeitsvorschau',
}

export const REPORT_BESCHREIBUNG: Record<ReportTyp, string> = {
  compliance:
    'Erfüllungsgrad gesamt und je Kategorie: pünktlich, verspätet, offen, überfällig.',
  historie:
    'Je Aufgabe alle Durchführungen mit Datum, Person, Ergebnis und Nachweisen inklusive SHA-256.',
  abweichungen:
    'Alle Abweichungen des Zeitraums mit Schweregrad, Verantwortlichkeit, Frist und Maßnahme.',
  vorschau:
    'Vorschau der kommenden Prüfungen inklusive planerisch fortgeschriebener Termine.',
}
