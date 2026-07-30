'use server'

import type { Role } from '@prisma/client'
import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { pruefeUmstellung } from '@/lib/passkey-pflicht'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { istPasskeyTauglich } from '@/lib/webauthn'
import {
  EINSTELLUNGEN_ID,
  appUrl,
  ohnePasskeyJeRolle,
} from '@/server/sicherheit-einstellungen'

export type SicherheitsStatus = { fehler?: string; erfolg?: string }

const ROLLEN: Role[] = ['ADMIN', 'EDITOR', 'AUDITOR']

/** Speichert, für welche Rollen ein Passkey verlangt wird. */
export async function passkeyPflichtSpeichern(
  _status: SicherheitsStatus,
  formData: FormData,
): Promise<SicherheitsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const rollen = ROLLEN.filter(
      (rolle) => formData.get(`pflicht-${rolle}`) === 'on',
    )

    // Der Einspruch prüft, ob die Umstellung überhaupt Sinn ergibt – ohne
    // HTTPS bliebe sie wirkungslos und würde nur verwirren.
    const einspruch = pruefeUmstellung(
      rollen,
      admin.role,
      await ohnePasskeyJeRolle(),
      istPasskeyTauglich(appUrl()),
    )
    if (!einspruch.moeglich && rollen.length > 0) {
      return { fehler: einspruch.hinweis ?? 'Die Umstellung ist nicht möglich.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.sicherheitsEinstellung.upsert({
        where: { id: EINSTELLUNGEN_ID },
        update: { passkeyPflichtRollen: rollen, updatedById: admin.id },
        create: {
          id: EINSTELLUNGEN_ID,
          passkeyPflichtRollen: rollen,
          updatedById: admin.id,
        },
      })

      await schreibeAudit(
        {
          userId: admin.id,
          action: 'SICHERHEIT_KONFIGURIERT',
          entityType: 'System',
          entityId: null,
          payload: { passkeyPflichtRollen: rollen },
        },
        tx,
      )
    })

    revalidatePath('/admin/system')
    return {
      erfolg: einspruch.hinweis
        ? `Gespeichert. ${einspruch.hinweis}`
        : 'Die Passkey-Pflicht wurde gespeichert.',
    }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Sicherheitseinstellungen nicht speicherbar:', error)
    return { fehler: 'Die Einstellung konnte nicht gespeichert werden.' }
  }
}
