'use server'

import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { begrenzeFrist, fasseAufbewahrungZusammen } from '@/lib/aufbewahrung'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { benutzerFuerAktion } from '@/lib/session'
import { fehlerbehandlung } from '@/lib/fehler'
import {
  EINSTELLUNGEN_ID,
  STANDARD_AUFBEWAHRUNG,
  fuehreAufbewahrungAus,
} from '@/server/aufbewahrung'

const fehlertext = fehlerbehandlung('Unerwarteter Fehler bei der Aufbewahrung')

export type AufbewahrungsStatus = { fehler?: string; erfolg?: string }

/** Speichert die globale Vorgabe und die Fristen je Kategorie. */
export async function aufbewahrungSpeichern(
  _status: AufbewahrungsStatus,
  formData: FormData,
): Promise<AufbewahrungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const aktiv = formData.get('aktiv') === 'on'
    const standardMonate = begrenzeFrist(
      Number(formData.get('standardMonate') ?? '120'),
    )

    // Je Kategorie: leeres Feld heißt „globale Vorgabe".
    const kategorien = await prisma.category.findMany({ select: { id: true } })
    const fristen = new Map<string, number | null>()
    for (const kategorie of kategorien) {
      const roh = String(formData.get(`frist-${kategorie.id}`) ?? '').trim()
      fristen.set(kategorie.id, roh === '' ? null : begrenzeFrist(Number(roh)))
    }

    await prisma.$transaction(async (tx) => {
      await tx.aufbewahrungsEinstellung.upsert({
        where: { id: EINSTELLUNGEN_ID },
        update: { aktiv, standardMonate, updatedById: admin.id },
        create: {
          id: EINSTELLUNGEN_ID,
          ...STANDARD_AUFBEWAHRUNG,
          aktiv,
          standardMonate,
          updatedById: admin.id,
        },
      })

      for (const [kategorieId, monate] of fristen) {
        await tx.category.update({
          where: { id: kategorieId },
          data: { aufbewahrungMonate: monate },
        })
      }

      await schreibeAudit(
        {
          userId: admin.id,
          action: 'AUFBEWAHRUNG_KONFIGURIERT',
          entityType: 'System',
          entityId: null,
          payload: {
            aktiv,
            standardMonate,
            eigeneFristen: [...fristen.values()].filter((m) => m !== null).length,
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/aufbewahrung')
  return { erfolg: 'Die Aufbewahrung wurde gespeichert.' }
}

/**
 * Führt die Aufbewahrung von Hand aus.
 *
 * `nurVorschau` ermittelt dasselbe, entfernt aber nichts – dieselbe
 * Auswertung, damit Vorschau und Wirklichkeit nicht auseinanderlaufen.
 */
export async function aufbewahrungAusfuehren(
  nurVorschau: boolean,
): Promise<AufbewahrungsStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)
    const ergebnis = await fuehreAufbewahrungAus(admin.id, nurVorschau)

    if (!nurVorschau) revalidatePath('/admin/aufbewahrung')
    return { erfolg: fasseAufbewahrungZusammen(ergebnis, nurVorschau) }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}
