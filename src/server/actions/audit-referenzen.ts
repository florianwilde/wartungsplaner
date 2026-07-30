'use server'

import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { anzeigeName, pruefeReferenz } from '@/lib/audit-referenzen'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'

export type ReferenzStatus = { fehler?: string; erfolg?: string }

/** Legt eine Audit-Referenz an oder ändert sie. */
export async function referenzSpeichern(
  referenzId: string | null,
  _status: ReferenzStatus,
  formData: FormData,
): Promise<ReferenzStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const geprueft = pruefeReferenz({
      kuerzel: String(formData.get('kuerzel') ?? ''),
      bezeichnung: String(formData.get('bezeichnung') ?? ''),
      rahmenwerk: String(formData.get('rahmenwerk') ?? ''),
      beschreibung: String(formData.get('beschreibung') ?? ''),
    })
    if (!geprueft.ok) return { fehler: geprueft.fehler }
    const daten = geprueft.wert

    const konflikt = await prisma.auditReferenz.findFirst({
      where: {
        kuerzel: daten.kuerzel,
        rahmenwerk: daten.rahmenwerk,
        ...(referenzId ? { id: { not: referenzId } } : {}),
      },
      select: { id: true },
    })
    if (konflikt) {
      return {
        fehler: `„${anzeigeName(daten)}“ ist bereits erfasst.`,
      }
    }

    const stammdaten = {
      ...daten,
      aktiv: formData.get('aktiv') !== 'off',
      sortOrder: Number(formData.get('sortOrder') ?? '0') || 0,
    }

    await prisma.$transaction(async (tx) => {
      if (referenzId) {
        await tx.auditReferenz.update({
          where: { id: referenzId },
          data: stammdaten,
        })
        await schreibeAudit(
          {
            userId: admin.id,
            action: 'AUDIT_REFERENZ_GEAENDERT',
            entityType: 'AuditReferenz',
            entityId: referenzId,
            payload: { referenz: anzeigeName(daten) },
          },
          tx,
        )
      } else {
        const erstellt = await tx.auditReferenz.create({
          data: stammdaten,
          select: { id: true },
        })
        await schreibeAudit(
          {
            userId: admin.id,
            action: 'AUDIT_REFERENZ_ANGELEGT',
            entityType: 'AuditReferenz',
            entityId: erstellt.id,
            payload: { referenz: anzeigeName(daten) },
          },
          tx,
        )
      }
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/audit-referenzen')
  revalidatePath('/tasks')
  return { erfolg: 'Die Audit-Referenz wurde gespeichert.' }
}

/**
 * Löscht eine Referenz.
 *
 * Zugeordnete Aufgaben verhindern das Löschen: Sonst verschwände stillschweigend
 * die Angabe, welche Anforderung eine Prüfung abdeckt. Zum Ausmustern gibt es
 * das Kennzeichen „aktiv“.
 */
export async function referenzLoeschen(
  referenzId: string,
): Promise<ReferenzStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const referenz = await prisma.auditReferenz.findUnique({
      where: { id: referenzId },
      select: {
        kuerzel: true,
        rahmenwerk: true,
        _count: { select: { aufgaben: true } },
      },
    })
    if (!referenz) return { fehler: 'Die Referenz wurde nicht gefunden.' }

    if (referenz._count.aufgaben > 0) {
      return {
        fehler: `Dieser Referenz sind ${referenz._count.aufgaben} Aufgaben zugeordnet. Deaktivieren Sie sie stattdessen.`,
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.auditReferenz.delete({ where: { id: referenzId } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'AUDIT_REFERENZ_GELOESCHT',
          entityType: 'AuditReferenz',
          entityId: referenzId,
          payload: { referenz: anzeigeName(referenz) },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/audit-referenzen')
  return { erfolg: 'Die Audit-Referenz wurde gelöscht.' }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler bei den Audit-Referenzen:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
