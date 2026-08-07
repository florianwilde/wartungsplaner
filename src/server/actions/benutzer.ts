'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { pruefePasswortStaerke } from '@/lib/passwort'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { fehlerbehandlung } from '@/lib/fehler'
import { benutzerFuerAktion } from '@/lib/session'

const fehlertext = fehlerbehandlung('Unerwarteter Fehler in einer Benutzer-Aktion')

export type BenutzerStatus = { fehler?: string; erfolg?: string }

const anlegenSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(120),
  email: z.string().trim().toLowerCase().email('Bitte eine gültige E-Mail-Adresse angeben.'),
  role: z.enum(['ADMIN', 'EDITOR', 'AUDITOR']),
  authProvider: z.enum(['LOCAL', 'OIDC']),
  password: z.string().optional().or(z.literal('')),
})

/**
 * Legt einen Benutzer an.
 *
 * Bei `LOCAL` wird ein Startpasswort gesetzt, das beim ersten Login geändert
 * werden muss. Bei `OIDC` bleibt das Konto ohne Passwort – die Anmeldung
 * erfolgt ausschließlich über den Identity Provider.
 */
export async function benutzerAnlegen(
  _status: BenutzerStatus,
  formData: FormData,
): Promise<BenutzerStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const eingabe = anlegenSchema.safeParse({
      name: String(formData.get('name') ?? ''),
      email: String(formData.get('email') ?? ''),
      role: String(formData.get('role') ?? 'AUDITOR'),
      authProvider: String(formData.get('authProvider') ?? 'LOCAL'),
      password: String(formData.get('password') ?? ''),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    const vorhanden = await prisma.user.findUnique({
      where: { email: daten.email },
      select: { id: true },
    })
    if (vorhanden) {
      return { fehler: 'Zu dieser E-Mail-Adresse existiert bereits ein Konto.' }
    }

    let passwordHash: string | null = null
    if (daten.authProvider === 'LOCAL') {
      if (!daten.password) {
        return { fehler: 'Bitte ein Startpasswort vergeben.' }
      }
      const schwaeche = pruefePasswortStaerke(daten.password)
      if (schwaeche) return { fehler: schwaeche }
      passwordHash = await bcrypt.hash(daten.password, 12)
    }

    await prisma.$transaction(async (tx) => {
      const neu = await tx.user.create({
        data: {
          name: daten.name,
          email: daten.email,
          passwordHash,
          authProvider: daten.authProvider,
          role: daten.role,
          active: true,
          mustChangePassword: daten.authProvider === 'LOCAL',
        },
      })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'USER_CREATED',
          entityType: 'User',
          entityId: neu.id,
          payload: {
            name: neu.name,
            email: neu.email,
            rolle: neu.role,
            anmeldeverfahren: neu.authProvider,
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benutzer')
  return { erfolg: 'Der Benutzer wurde angelegt.' }
}

const aendernSchema = z.object({
  userId: z.string().trim().min(1),
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(120),
  role: z.enum(['ADMIN', 'EDITOR', 'AUDITOR']),
})

/** Ändert Name und Rolle eines Benutzers. */
export async function benutzerAendern(
  _status: BenutzerStatus,
  formData: FormData,
): Promise<BenutzerStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const eingabe = aendernSchema.safeParse({
      userId: String(formData.get('userId') ?? ''),
      name: String(formData.get('name') ?? ''),
      role: String(formData.get('role') ?? 'AUDITOR'),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }
    const daten = eingabe.data

    const vorher = await prisma.user.findUnique({ where: { id: daten.userId } })
    if (!vorher) return { fehler: 'Der Benutzer wurde nicht gefunden.' }

    // Der letzte aktive Administrator darf sich nicht selbst herabstufen.
    if (vorher.role === 'ADMIN' && daten.role !== 'ADMIN') {
      const weitereAdmins = await prisma.user.count({
        where: { role: 'ADMIN', active: true, id: { not: daten.userId } },
      })
      if (weitereAdmins === 0) {
        return {
          fehler:
            'Es muss mindestens ein aktiver Administrator verbleiben. Legen Sie zuerst einen weiteren Administrator an.',
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: daten.userId },
        data: { name: daten.name, role: daten.role },
      })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'USER_UPDATED',
          entityType: 'User',
          entityId: daten.userId,
          payload: {
            email: vorher.email,
            nameVorher: vorher.name,
            nameNachher: daten.name,
            rolleVorher: vorher.role,
            rolleNachher: daten.role,
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benutzer')
  return { erfolg: 'Der Benutzer wurde gespeichert.' }
}

/**
 * Aktiviert bzw. deaktiviert ein Konto.
 * Benutzer werden nie gelöscht, damit das Protokoll vollständig bleibt.
 */
export async function benutzerAktivierungUmschalten(
  userId: string,
  aktiv: boolean,
): Promise<BenutzerStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const benutzer = await prisma.user.findUnique({ where: { id: userId } })
    if (!benutzer) return { fehler: 'Der Benutzer wurde nicht gefunden.' }

    if (!aktiv) {
      if (benutzer.id === admin.id) {
        return { fehler: 'Sie können Ihr eigenes Konto nicht deaktivieren.' }
      }
      if (benutzer.role === 'ADMIN') {
        const weitereAdmins = await prisma.user.count({
          where: { role: 'ADMIN', active: true, id: { not: userId } },
        })
        if (weitereAdmins === 0) {
          return { fehler: 'Es muss mindestens ein aktiver Administrator verbleiben.' }
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { active: aktiv } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: aktiv ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
          entityType: 'User',
          entityId: userId,
          payload: { name: benutzer.name, email: benutzer.email },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benutzer')
  return {
    erfolg: aktiv ? 'Das Konto ist wieder aktiv.' : 'Das Konto wurde deaktiviert.',
  }
}

const passwortSchema = z.object({
  userId: z.string().trim().min(1),
  password: z.string().min(1, 'Bitte ein neues Startpasswort vergeben.'),
})

/** Setzt ein neues Startpasswort und erzwingt den Wechsel beim nächsten Login. */
export async function passwortZuruecksetzen(
  _status: BenutzerStatus,
  formData: FormData,
): Promise<BenutzerStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const eingabe = passwortSchema.safeParse({
      userId: String(formData.get('userId') ?? ''),
      password: String(formData.get('password') ?? ''),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }

    const schwaeche = pruefePasswortStaerke(eingabe.data.password)
    if (schwaeche) return { fehler: schwaeche }

    const benutzer = await prisma.user.findUnique({
      where: { id: eingabe.data.userId },
    })
    if (!benutzer) return { fehler: 'Der Benutzer wurde nicht gefunden.' }
    if (benutzer.authProvider === 'OIDC') {
      return {
        fehler:
          'Dieses Konto wird über SSO verwaltet. Ein lokales Passwort ist dafür nicht vorgesehen.',
      }
    }

    const hash = await bcrypt.hash(eingabe.data.password, 12)

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: eingabe.data.userId },
        data: { passwordHash: hash, mustChangePassword: true },
      })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'USER_PASSWORD_RESET',
          entityType: 'User',
          entityId: eingabe.data.userId,
          payload: { email: benutzer.email, wechselErzwungen: true },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benutzer')
  return {
    erfolg:
      'Das Startpasswort wurde gesetzt. Der Benutzer muss es beim nächsten Login ändern.',
  }
}
