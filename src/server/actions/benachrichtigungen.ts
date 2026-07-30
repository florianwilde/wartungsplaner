'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit, schreibeAuditLeise } from '@/lib/audit'
import { todayInBerlin } from '@/lib/dates'
import { baueTestMail, type MailRahmen } from '@/lib/mail-vorlagen'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { holeBranding } from '@/server/branding'
import { appBasisUrl } from '@/server/benachrichtigungen'
import { speichereBenachrichtigungsEinstellungen } from '@/server/benachrichtigungs-einstellungen'
import { starteBenachrichtigungen } from '@/server/cron'
import {
  istMailVersandKonfiguriert,
  pruefeMailVerbindung,
  versendeMail,
} from '@/server/mailer'

export type BenachrichtigungsStatus = { fehler?: string; erfolg?: string }

const einstellungenSchema = z.object({
  enabled: z.boolean(),
  aufgabenAktiv: z.boolean(),
  abweichungenAktiv: z.boolean(),
  abweichungVorlaufTage: z.number().int().min(0).max(90),
  eskalationAktiv: z.boolean(),
  eskalationAbTagen: z.number().int().min(1).max(365),
  eskalationUserId: z.string().trim().nullable(),
  gegenzeichnungAktiv: z.boolean(),
  gegenzeichnungAbTagen: z.number().int().min(0).max(90),
  wochenuebersichtAktiv: z.boolean(),
  wochenuebersichtTag: z.number().int().min(1).max(7),
})

function zahl(formData: FormData, feld: string, standard: number): number {
  const wert = Number(String(formData.get(feld) ?? ''))
  return Number.isFinite(wert) ? Math.trunc(wert) : standard
}

/** Speichert die Einstellungen zum E-Mail-Versand. */
export async function benachrichtigungenSpeichern(
  _status: BenachrichtigungsStatus,
  formData: FormData,
): Promise<BenachrichtigungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const rohEskalationUser = String(formData.get('eskalationUserId') ?? '').trim()

    const eingabe = einstellungenSchema.safeParse({
      enabled: formData.get('enabled') === 'on',
      aufgabenAktiv: formData.get('aufgabenAktiv') === 'on',
      abweichungenAktiv: formData.get('abweichungenAktiv') === 'on',
      abweichungVorlaufTage: zahl(formData, 'abweichungVorlaufTage', 7),
      eskalationAktiv: formData.get('eskalationAktiv') === 'on',
      eskalationAbTagen: zahl(formData, 'eskalationAbTagen', 7),
      eskalationUserId: rohEskalationUser === '' ? null : rohEskalationUser,
      gegenzeichnungAktiv: formData.get('gegenzeichnungAktiv') === 'on',
      gegenzeichnungAbTagen: zahl(formData, 'gegenzeichnungAbTagen', 2),
      wochenuebersichtAktiv: formData.get('wochenuebersichtAktiv') === 'on',
      wochenuebersichtTag: zahl(formData, 'wochenuebersichtTag', 1),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    if (daten.enabled && !istMailVersandKonfiguriert()) {
      return {
        fehler:
          'Der Versand lässt sich nicht einschalten, solange kein Mailserver konfiguriert ist. Bitte SMTP_HOST in der .env setzen und den Stack neu starten.',
      }
    }

    if (daten.eskalationAktiv && !daten.eskalationUserId) {
      return { fehler: 'Bitte einen Empfänger für die Eskalation auswählen.' }
    }

    if (daten.eskalationUserId) {
      const empfaenger = await prisma.user.findFirst({
        where: { id: daten.eskalationUserId, active: true },
        select: { id: true },
      })
      if (!empfaenger) {
        return {
          fehler: 'Der gewählte Eskalationsempfänger ist unbekannt oder deaktiviert.',
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await speichereBenachrichtigungsEinstellungen(daten, admin.id, tx)
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'NOTIFICATION_SETTINGS_UPDATED',
          entityType: 'NotificationSetting',
          entityId: 'singleton',
          payload: { ...daten },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benachrichtigungen')
  return { erfolg: 'Die Einstellungen wurden gespeichert.' }
}

/** Sendet eine Testnachricht an die eigene Adresse. */
export async function testnachrichtSenden(): Promise<BenachrichtigungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    if (!istMailVersandKonfiguriert()) {
      return {
        fehler:
          'Es ist kein Mailserver konfiguriert. Bitte SMTP_HOST in der .env setzen und den Stack neu starten.',
      }
    }
    if (!admin.email) {
      return { fehler: 'Für Ihr Konto ist keine E-Mail-Adresse hinterlegt.' }
    }

    const verbindung = await pruefeMailVerbindung()
    if (!verbindung.erfolg) {
      return { fehler: `Der Mailserver ist nicht erreichbar: ${verbindung.fehler}` }
    }

    const branding = await holeBranding()
    const rahmen: MailRahmen = {
      anwendung: branding.appName,
      organisation: branding.organisation,
      markenfarbe: branding.primaryColor,
      appUrl: appBasisUrl(),
      stichtag: todayInBerlin(),
    }

    const ergebnis = await versendeMail(admin.email, baueTestMail(rahmen, admin.name))
    if (!ergebnis.erfolg) {
      return { fehler: `Versand fehlgeschlagen: ${ergebnis.fehler}` }
    }

    await schreibeAuditLeise({
      userId: admin.id,
      action: 'NOTIFICATION_TEST_SENT',
      entityType: 'Notification',
      entityId: 'TEST',
      payload: { empfaenger: admin.email },
    })

    return { erfolg: `Testnachricht an ${admin.email} versendet.` }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Löst den Benachrichtigungslauf sofort aus (statt zur geplanten Zeit). */
export async function benachrichtigungslaufStarten(): Promise<BenachrichtigungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)
    const ergebnis = await starteBenachrichtigungen(admin.id)

    if (!ergebnis) {
      return { fehler: 'Ein Lauf ist bereits aktiv. Bitte kurz warten.' }
    }
    if (ergebnis.uebersprungen) {
      return { fehler: ergebnis.uebersprungen }
    }

    revalidatePath('/admin/benachrichtigungen')
    return {
      erfolg:
        ergebnis.versendet === 0
          ? 'Der Lauf ist durchgeführt – es gab nichts zu melden.'
          : `${ergebnis.versendet} Nachrichten an ${ergebnis.empfaenger} Empfänger versendet.`,
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Schaltet den E-Mail-Empfang für einen Benutzer ein oder aus. */
export async function benutzerMailEmpfangUmschalten(
  userId: string,
  empfangen: boolean,
): Promise<BenachrichtigungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const benutzer = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    if (!benutzer) return { fehler: 'Der Benutzer wurde nicht gefunden.' }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { notifyByEmail: empfangen },
      })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: userId,
          payload: {
            email: benutzer.email,
            benachrichtigungen: empfangen ? 'eingeschaltet' : 'ausgeschaltet',
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benachrichtigungen')
  revalidatePath('/admin/benutzer')
  return {
    erfolg: empfangen
      ? 'Der Benutzer erhält wieder Benachrichtigungen.'
      : 'Der Benutzer erhält keine Benachrichtigungen mehr.',
  }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler bei den Benachrichtigungen:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
