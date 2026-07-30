/**
 * Revisionssicheres Protokoll.
 *
 * Jede schreibende Aktion der Anwendung erzeugt genau einen Eintrag.
 * Einträge werden ausschließlich eingefügt – Änderungen und Löschungen sind
 * zusätzlich per Datenbank-Trigger unterbunden
 * (Migration `audit_log_append_only`).
 */
import type { Prisma, PrismaClient } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/** Alle protokollierten Aktionen an einer Stelle – auch für Filter im Admin. */
export const AUDIT_AKTIONEN = {
  LOGIN_SUCCESS: 'Anmeldung erfolgreich',
  LOGIN_FAILED: 'Anmeldung fehlgeschlagen',
  LOGIN_BLOCKED: 'Anmeldung gesperrt (zu viele Fehlversuche)',
  LOGOUT: 'Abmeldung',
  PASSWORD_CHANGED: 'Passwort geändert',
  USER_CREATED: 'Benutzer angelegt',
  USER_UPDATED: 'Benutzer geändert',
  USER_DEACTIVATED: 'Benutzer deaktiviert',
  USER_ACTIVATED: 'Benutzer aktiviert',
  USER_PASSWORD_RESET: 'Passwort zurückgesetzt',
  USER_PROVISIONED_VIA_OIDC: 'Benutzer über SSO angelegt',
  USER_LINKED_VIA_OIDC: 'Konto mit SSO verknüpft',
  CATEGORY_CREATED: 'Kategorie angelegt',
  CATEGORY_UPDATED: 'Kategorie geändert',
  CATEGORY_DELETED: 'Kategorie gelöscht',
  TASK_CREATED: 'Aufgabe angelegt',
  TASK_UPDATED: 'Aufgabe geändert',
  TASK_ACTIVATED: 'Aufgabe aktiviert',
  TASK_DEACTIVATED: 'Aufgabe deaktiviert',
  OCCURRENCE_CREATED: 'Fälligkeit erzeugt',
  OCCURRENCE_OVERDUE: 'Fälligkeit als überfällig markiert',
  OCCURRENCE_SUSPENDED: 'Fälligkeit ausgesetzt',
  OCCURRENCE_RESUMED: 'Aussetzung aufgehoben',
  EXECUTION_CREATED: 'Durchführung protokolliert',
  ATTACHMENT_UPLOADED: 'Nachweis hochgeladen',
  ATTACHMENT_DOWNLOADED: 'Nachweis heruntergeladen',
  FINDING_CREATED: 'Abweichung angelegt',
  FINDING_UPDATED: 'Abweichung geändert',
  FINDING_CLOSED: 'Abweichung geschlossen',
  REPORT_GENERATED: 'Report erzeugt',
  CRON_RUN: 'Täglicher Job ausgeführt',
  BRANDING_UPDATED: 'Erscheinungsbild geändert',
  BRANDING_RESET: 'Erscheinungsbild zurückgesetzt',
  NOTIFICATION_SETTINGS_UPDATED: 'Benachrichtigungen konfiguriert',
  NOTIFICATION_SENT: 'Benachrichtigung versendet',
  NOTIFICATION_TEST_SENT: 'Testnachricht versendet',
  NOTIFICATION_RUN: 'Benachrichtigungslauf ausgeführt',
  PASSKEY_REGISTRIERT: 'Passkey hinterlegt',
  PASSKEY_ENTFERNT: 'Passkey entfernt',
  PASSKEY_UMBENANNT: 'Passkey umbenannt',
  PRUEFBOGEN_ANGELEGT: 'Prüfbogen angelegt',
  PRUEFBOGEN_GEAENDERT: 'Prüfbogen geändert',
  PRUEFBOGEN_GELOESCHT: 'Prüfbogen gelöscht',
  NACHWEIS_BEGONNEN: 'Prüfnachweis begonnen',
  NACHWEIS_VORGELEGT: 'Prüfnachweis zur Gegenzeichnung vorgelegt',
  NACHWEIS_GEGENGEZEICHNET: 'Prüfnachweis gegengezeichnet',
  NACHWEIS_ZURUECKGEWIESEN: 'Prüfnachweis zurückgewiesen',
  NACHWEIS_ABGESCHLOSSEN: 'Prüfnachweis abgeschlossen',
  NACHWEIS_BELEG_HINZUGEFUEGT: 'Beleg zum Prüfnachweis hinzugefügt',
  NACHWEIS_BELEG_ENTFERNT: 'Beleg vom Prüfnachweis entfernt',
  REPORT_VORLAGE_ANGELEGT: 'Report-Vorlage angelegt',
  REPORT_VORLAGE_GEAENDERT: 'Report-Vorlage geändert',
  REPORT_VORLAGE_GELOESCHT: 'Report-Vorlage gelöscht',
  IMPORT_AUSGEFUEHRT: 'Import ausgeführt',
  EXPORT_ERZEUGT: 'Export erzeugt',
} as const

export type AuditAktion = keyof typeof AUDIT_AKTIONEN

/** Liefert den deutschen Klartext zu einer Aktion (Fallback: Schlüssel). */
export function auditAktionLabel(action: string): string {
  return (AUDIT_AKTIONEN as Record<string, string>)[action] ?? action
}

type AuditClient = PrismaClient | Prisma.TransactionClient

export type AuditEintrag = {
  /** Auslösende Person; `null` z. B. bei fehlgeschlagener Anmeldung oder Cron. */
  userId?: string | null
  action: AuditAktion
  entityType: string
  entityId?: string | null
  /** Zusätzliche Angaben zum Vorgang (keine Passwörter, keine Dateiinhalte). */
  payload?: Prisma.InputJsonValue | null
}

/**
 * Schreibt einen Audit-Eintrag. Wird ein Transaktions-Client übergeben, ist der
 * Eintrag Teil derselben Transaktion wie die fachliche Änderung.
 */
export async function schreibeAudit(
  eintrag: AuditEintrag,
  client: AuditClient = prisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: eintrag.userId ?? null,
      action: eintrag.action,
      entityType: eintrag.entityType,
      entityId: eintrag.entityId ?? null,
      payloadJson: eintrag.payload ?? undefined,
    },
  })
}

/**
 * Wie `schreibeAudit`, unterdrückt aber Fehler. Für Protokollierung außerhalb
 * einer Transaktion (z. B. Anmeldevorgänge), damit ein Protokollfehler den
 * eigentlichen Vorgang nicht abbricht.
 */
export async function schreibeAuditLeise(eintrag: AuditEintrag): Promise<void> {
  try {
    await schreibeAudit(eintrag)
  } catch (error) {
    console.error('Audit-Eintrag konnte nicht geschrieben werden:', error)
  }
}
