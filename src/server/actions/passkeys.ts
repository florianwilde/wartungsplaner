'use server'

import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import {
  ZugriffVerweigertError,
  benutzerFuerAktion,
  holeBenutzer,
} from '@/lib/session'
import { pruefePasskeyName } from '@/lib/webauthn'

export type PasskeyStatus = { fehler?: string; erfolg?: string }

/** Entfernt einen eigenen Passkey. */
export async function passkeyEntfernen(
  passkeyId: string,
): Promise<PasskeyStatus> {
  try {
    const benutzer = await holeBenutzer()
    if (!benutzer) return { fehler: 'Bitte melden Sie sich an.' }

    const passkey = await prisma.passkey.findUnique({
      where: { id: passkeyId },
      select: { id: true, name: true, userId: true },
    })
    if (!passkey || passkey.userId !== benutzer.id) {
      return { fehler: 'Der Passkey wurde nicht gefunden.' }
    }

    // Wer kein Passwort hat, würde sich ohne Passkey aussperren.
    const konto = await prisma.user.findUniqueOrThrow({
      where: { id: benutzer.id },
      select: { passwordHash: true, _count: { select: { passkeys: true } } },
    })
    if (!konto.passwordHash && konto._count.passkeys <= 1) {
      return {
        fehler:
          'Das ist Ihr letzter Passkey und für dieses Konto ist kein Passwort hinterlegt. Bitte legen Sie zuerst einen weiteren Passkey an oder lassen Sie ein Passwort setzen.',
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.passkey.delete({ where: { id: passkeyId } })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'PASSKEY_ENTFERNT',
          entityType: 'Passkey',
          entityId: passkeyId,
          payload: { name: passkey.name, durch: 'Benutzer selbst' },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/konto')
  return { erfolg: 'Der Passkey wurde entfernt.' }
}

/** Benennt einen eigenen Passkey um. */
export async function passkeyUmbenennen(
  passkeyId: string,
  neuerName: string,
): Promise<PasskeyStatus> {
  try {
    const benutzer = await holeBenutzer()
    if (!benutzer) return { fehler: 'Bitte melden Sie sich an.' }

    const name = pruefePasskeyName(neuerName)
    if (!name) {
      return { fehler: 'Bitte einen Namen mit mindestens 2 Zeichen vergeben.' }
    }

    const passkey = await prisma.passkey.findUnique({
      where: { id: passkeyId },
      select: { id: true, name: true, userId: true },
    })
    if (!passkey || passkey.userId !== benutzer.id) {
      return { fehler: 'Der Passkey wurde nicht gefunden.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.passkey.update({ where: { id: passkeyId }, data: { name } })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'PASSKEY_UMBENANNT',
          entityType: 'Passkey',
          entityId: passkeyId,
          payload: { vorher: passkey.name, nachher: name },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/konto')
  return { erfolg: 'Der Passkey wurde umbenannt.' }
}

/**
 * Entfernt alle Passkeys eines Benutzers – für den Fall eines Geräteverlusts.
 * Nur für Administratoren.
 */
export async function passkeysZuruecksetzen(
  userId: string,
): Promise<PasskeyStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const benutzer = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        passwordHash: true,
        _count: { select: { passkeys: true } },
      },
    })
    if (!benutzer) return { fehler: 'Der Benutzer wurde nicht gefunden.' }
    if (benutzer._count.passkeys === 0) {
      return { fehler: 'Für dieses Konto sind keine Passkeys hinterlegt.' }
    }
    if (!benutzer.passwordHash) {
      return {
        fehler:
          'Für dieses Konto ist kein Passwort hinterlegt. Setzen Sie zuerst ein Startpasswort, sonst bleibt der Zugang verschlossen.',
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.passkey.deleteMany({ where: { userId } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'PASSKEY_ENTFERNT',
          entityType: 'User',
          entityId: userId,
          payload: {
            email: benutzer.email,
            anzahl: benutzer._count.passkeys,
            durch: 'Administration',
            anlass: 'Zurücksetzen',
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/benutzer')
  return { erfolg: 'Alle Passkeys des Kontos wurden entfernt.' }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler bei den Passkeys:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
