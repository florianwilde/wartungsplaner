'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'

export type KategorieStatus = { fehler?: string; erfolg?: string }

const kategorieSchema = z.object({
  name: z.string().trim().min(2, 'Bitte einen Namen angeben.').max(80),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Bitte eine Farbe im Format #rrggbb angeben.'),
  sortOrder: z.number().int().min(0).max(9999),
})

function leseFormular(formData: FormData) {
  const sortOrder = Number(String(formData.get('sortOrder') ?? '0'))
  return {
    name: String(formData.get('name') ?? ''),
    color: String(formData.get('color') ?? '#64748b'),
    sortOrder: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : 0,
  }
}

export async function kategorieAnlegen(
  _status: KategorieStatus,
  formData: FormData,
): Promise<KategorieStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const eingabe = kategorieSchema.safeParse(leseFormular(formData))
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }

    const vorhanden = await prisma.category.findUnique({
      where: { name: eingabe.data.name },
      select: { id: true },
    })
    if (vorhanden) return { fehler: 'Diese Kategorie existiert bereits.' }

    await prisma.$transaction(async (tx) => {
      const neu = await tx.category.create({ data: eingabe.data })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'CATEGORY_CREATED',
          entityType: 'Category',
          entityId: neu.id,
          payload: { name: neu.name, farbe: neu.color, reihenfolge: neu.sortOrder },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/kategorien')
  revalidatePath('/tasks')
  return { erfolg: 'Die Kategorie wurde angelegt.' }
}

export async function kategorieAendern(
  kategorieId: string,
  _status: KategorieStatus,
  formData: FormData,
): Promise<KategorieStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const eingabe = kategorieSchema.safeParse(leseFormular(formData))
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }

    const vorher = await prisma.category.findUnique({ where: { id: kategorieId } })
    if (!vorher) return { fehler: 'Die Kategorie wurde nicht gefunden.' }

    const namensKonflikt = await prisma.category.findFirst({
      where: { name: eingabe.data.name, id: { not: kategorieId } },
      select: { id: true },
    })
    if (namensKonflikt) {
      return { fehler: 'Eine andere Kategorie trägt diesen Namen bereits.' }
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.update({ where: { id: kategorieId }, data: eingabe.data })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'CATEGORY_UPDATED',
          entityType: 'Category',
          entityId: kategorieId,
          payload: {
            nameVorher: vorher.name,
            nameNachher: eingabe.data.name,
            farbe: eingabe.data.color,
            reihenfolge: eingabe.data.sortOrder,
          },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/kategorien')
  revalidatePath('/tasks')
  return { erfolg: 'Die Kategorie wurde gespeichert.' }
}

/** Löscht eine Kategorie – nur zulässig, solange ihr keine Aufgabe zugeordnet ist. */
export async function kategorieLoeschen(
  kategorieId: string,
): Promise<KategorieStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const kategorie = await prisma.category.findUnique({
      where: { id: kategorieId },
      include: { _count: { select: { tasks: true } } },
    })
    if (!kategorie) return { fehler: 'Die Kategorie wurde nicht gefunden.' }
    if (kategorie._count.tasks > 0) {
      return {
        fehler: `Der Kategorie sind noch ${kategorie._count.tasks} Aufgaben zugeordnet. Ordnen Sie diese zuerst um.`,
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id: kategorieId } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'CATEGORY_DELETED',
          entityType: 'Category',
          entityId: kategorieId,
          payload: { name: kategorie.name },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/kategorien')
  revalidatePath('/tasks')
  return { erfolg: 'Die Kategorie wurde gelöscht.' }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler in einer Kategorie-Aktion:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
