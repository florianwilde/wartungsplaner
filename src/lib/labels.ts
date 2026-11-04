/**
 * Deutsche Beschriftungen aller Aufzählungen.
 * Zentral gehalten, damit Oberfläche, Reports und Exporte dieselben Begriffe
 * verwenden.
 */
import type {
  Criticality,
  ExecutionResult,
  FindingStatus,
  OccurrenceStatus,
  Severity,
} from '@/generated/prisma/client'

export const STATUS_BEZEICHNUNG: Record<OccurrenceStatus, string> = {
  OPEN: 'Offen',
  DONE: 'Erledigt',
  OVERDUE: 'Überfällig',
  SUSPENDED: 'Ausgesetzt',
}

export const ERGEBNIS_BEZEICHNUNG: Record<ExecutionResult, string> = {
  OK: 'In Ordnung',
  OK_WITH_REMARKS: 'In Ordnung mit Anmerkungen',
  DEVIATION: 'Abweichung',
}

export const ERGEBNIS_BESCHREIBUNG: Record<ExecutionResult, string> = {
  OK: 'Die Prüfung verlief vollständig ohne Beanstandung.',
  OK_WITH_REMARKS:
    'Die Prüfung war erfolgreich, es gibt jedoch Hinweise für die nächste Durchführung.',
  DEVIATION:
    'Es wurde eine Abweichung festgestellt. Es muss mindestens eine Abweichung mit Maßnahme erfasst werden.',
}

export const SCHWERE_BEZEICHNUNG: Record<Severity, string> = {
  LOW: 'Gering',
  MEDIUM: 'Mittel',
  HIGH: 'Hoch',
  CRITICAL: 'Kritisch',
}

export const ABWEICHUNG_STATUS_BEZEICHNUNG: Record<FindingStatus, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  CLOSED: 'Geschlossen',
}

export const KRITIKALITAET_BEZEICHNUNG: Record<Criticality, string> = {
  LOW: 'Niedrig',
  MEDIUM: 'Mittel',
  HIGH: 'Hoch',
}

/** Formatiert eine Dateigröße für die Anzeige. */
export function formatiereDateigroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
