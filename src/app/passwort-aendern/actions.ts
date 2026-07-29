'use server'

import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'

import { prisma } from '@/lib/prisma'
import { schreibeAudit } from '@/lib/audit'
import { holeBenutzer } from '@/lib/session'
import { pruefePasswortStaerke } from '@/lib/passwort'

export type PasswortStatus = { fehler?: string; erfolg?: string }

export async function passwortAendern(
  _status: PasswortStatus,
  formData: FormData,
): Promise<PasswortStatus> {
  const benutzer = await holeBenutzer()
  if (!benutzer) return { fehler: 'Bitte melden Sie sich erneut an.' }

  if (benutzer.authProvider === 'OIDC') {
    return {
      fehler:
        'Dieses Konto wird über SSO verwaltet. Das Passwort ändern Sie beim Identity Provider.',
    }
  }

  const aktuell = String(formData.get('aktuellesPasswort') ?? '')
  const neu = String(formData.get('neuesPasswort') ?? '')
  const wiederholung = String(formData.get('wiederholung') ?? '')

  if (!aktuell || !neu || !wiederholung) {
    return { fehler: 'Bitte füllen Sie alle Felder aus.' }
  }
  if (neu !== wiederholung) {
    return { fehler: 'Die beiden neuen Passwörter stimmen nicht überein.' }
  }
  if (neu === aktuell) {
    return { fehler: 'Das neue Passwort muss sich vom bisherigen unterscheiden.' }
  }

  const schwaeche = pruefePasswortStaerke(neu)
  if (schwaeche) return { fehler: schwaeche }

  const datensatz = await prisma.user.findUnique({
    where: { id: benutzer.id },
    select: { id: true, passwordHash: true },
  })
  if (!datensatz?.passwordHash) {
    return { fehler: 'Für dieses Konto ist kein Passwort hinterlegt.' }
  }

  const stimmt = await bcrypt.compare(aktuell, datensatz.passwordHash)
  if (!stimmt) {
    return { fehler: 'Das aktuelle Passwort ist nicht korrekt.' }
  }

  const neuerHash = await bcrypt.hash(neu, 12)
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: benutzer.id },
      data: { passwordHash: neuerHash, mustChangePassword: false },
    })
    await schreibeAudit(
      {
        userId: benutzer.id,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: benutzer.id,
        payload: { durch: 'Benutzer selbst' },
      },
      tx,
    )
  })

  redirect('/')
}
