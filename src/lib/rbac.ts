/**
 * Rollen und Berechtigungen.
 *
 * ADMIN   – darf alles (inkl. Stammdaten, Benutzerverwaltung, Audit-Log)
 * EDITOR  – darf Aufgaben erledigen, Nachweise hochladen, Abweichungen bearbeiten
 * AUDITOR – ausschließlich lesend, inklusive Reports
 */
import type { Role } from '@prisma/client'

export const ROLLEN_BEZEICHNUNG: Record<Role, string> = {
  ADMIN: 'Administrator',
  EDITOR: 'Bearbeiter',
  AUDITOR: 'Auditor (nur lesen)',
}

export const ROLLEN_BESCHREIBUNG: Record<Role, string> = {
  ADMIN:
    'Vollzugriff: Aufgaben und Kategorien pflegen, Benutzer verwalten, Audit-Log einsehen.',
  EDITOR: 'Darf Aufgaben erledigen, Nachweise hochladen und Abweichungen bearbeiten.',
  AUDITOR: 'Strikt lesender Zugriff auf alle Daten und Reports.',
}

/** Darf Aufgaben und Kategorien anlegen, ändern oder deaktivieren. */
export function canManageTasks(role: Role | undefined): boolean {
  return role === 'ADMIN'
}

/** Darf Fälligkeiten erledigen und Nachweise hochladen. */
export function canExecute(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'EDITOR'
}

/** Darf Abweichungen anlegen, bearbeiten und schließen. */
export function canManageFindings(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'EDITOR'
}

/** Darf den Administrationsbereich benutzen. */
export function canAdminister(role: Role | undefined): boolean {
  return role === 'ADMIN'
}

/** Alle angemeldeten Rollen dürfen Reports erzeugen und herunterladen. */
export function canViewReports(role: Role | undefined): boolean {
  return role === 'ADMIN' || role === 'EDITOR' || role === 'AUDITOR'
}

/** Schreibende Aktionen jeglicher Art – für AUDITOR immer false. */
export function isReadOnly(role: Role | undefined): boolean {
  return role === 'AUDITOR' || role === undefined
}
