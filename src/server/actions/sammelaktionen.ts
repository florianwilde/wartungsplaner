'use server'

import { revalidatePath } from 'next/cache'

import { anzeigeName } from '@/lib/audit-referenzen'
import { schreibeAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { canAdminister, canManageTasks } from '@/lib/rbac'
import {
  fasseErgebnisZusammen,
  pruefeSammelloeschung,
  type Kandidat,
} from '@/lib/sammelaktion'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'

export type SammelStatus = { fehler?: string; erfolg?: string }

/**
 * Löscht mehrere Audit-Referenzen.
 *
 * Zugeordnete Referenzen bleiben geschützt: Sonst verschwände stillschweigend
 * die Angabe, welche Anforderung eine Prüfung abdeckt. Zum Ausmustern gibt es
 * das Kennzeichen „aktiv".
 */
export async function referenzenSammelLoeschen(
  ids: string[],
): Promise<SammelStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const referenzen = await prisma.auditReferenz.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        kuerzel: true,
        rahmenwerk: true,
        _count: { select: { aufgaben: true } },
      },
    })

    const kandidaten: Kandidat[] = referenzen.map((referenz) => ({
      id: referenz.id,
      bezeichnung: anzeigeName(referenz),
      abhaengige: referenz._count.aufgaben,
      abhaengigeArt: referenz._count.aufgaben === 1 ? 'Aufgabe' : 'Aufgaben',
    }))

    const pruefung = pruefeSammelloeschung(kandidaten)
    if (!pruefung.ok) return { fehler: pruefung.fehler }

    await prisma.$transaction(async (tx) => {
      await tx.auditReferenz.deleteMany({ where: { id: { in: pruefung.ids } } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'AUDIT_REFERENZ_GELOESCHT',
          entityType: 'AuditReferenz',
          entityId: null,
          payload: {
            anzahl: pruefung.ids.length,
            referenzen: kandidaten.map((k) => k.bezeichnung),
          },
        },
        tx,
      )
    })

    revalidatePath('/admin/audit-referenzen')
    revalidatePath('/tasks')

    return {
      erfolg: fasseErgebnisZusammen(
        pruefung.ids.length,
        'Referenz',
        'Referenzen',
        'gelöscht',
      ),
    }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Sammellöschen von Referenzen fehlgeschlagen:', error)
    return { fehler: 'Die Referenzen konnten nicht gelöscht werden.' }
  }
}

/**
 * Löscht mehrere Aufgaben – aber nur solche ohne Historie.
 *
 * **Eine Aufgabe mit auch nur einer Durchführung wird nie gelöscht.** An ihr
 * hängen über die Fremdschlüssel Fälligkeiten, Durchführungen,
 * Nachweisdateien, Abweichungen und Prüfbögen; das Datenmodell räumt sie
 * beim Löschen mit ab. Genau diese Datensätze sind der Zweck der Anwendung.
 *
 * Zum Ausmustern einer benutzten Aufgabe gibt es das Deaktivieren: Die
 * Historie bleibt lesbar, neue Fälligkeiten entstehen nicht mehr.
 */
export async function aufgabenSammelLoeschen(
  ids: string[],
): Promise<SammelStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)

    const aufgaben = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        _count: { select: { occurrences: true } },
        occurrences: {
          where: { execution: { isNot: null } },
          select: { id: true },
        },
      },
    })

    const kandidaten: Kandidat[] = aufgaben.map((aufgabe) => ({
      id: aufgabe.id,
      bezeichnung: aufgabe.title,
      abhaengige: aufgabe.occurrences.length,
      abhaengigeArt:
        aufgabe.occurrences.length === 1 ? 'Durchführung' : 'Durchführungen',
    }))

    const pruefung = pruefeSammelloeschung(kandidaten)
    if (!pruefung.ok) return { fehler: pruefung.fehler }

    await prisma.$transaction(async (tx) => {
      // Der Audit-Eintrag entsteht vor dem Löschen: Danach gibt es die
      // Aufgaben nicht mehr, und ihre Titel wären nicht mehr zu ermitteln.
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: 'TASK_GELOESCHT',
          entityType: 'Task',
          entityId: null,
          payload: {
            anzahl: pruefung.ids.length,
            aufgaben: kandidaten.map((k) => k.bezeichnung),
          },
        },
        tx,
      )
      await tx.task.deleteMany({ where: { id: { in: pruefung.ids } } })
    })

    revalidatePath('/tasks')
    revalidatePath('/')

    return {
      erfolg: fasseErgebnisZusammen(
        pruefung.ids.length,
        'Aufgabe',
        'Aufgaben',
        'gelöscht',
      ),
    }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Sammellöschen von Aufgaben fehlgeschlagen:', error)
    return { fehler: 'Die Aufgaben konnten nicht gelöscht werden.' }
  }
}

/**
 * Setzt mehrere Aufgaben auf aktiv oder inaktiv.
 *
 * Der übliche Weg, eine Prüfung auszumustern: Die Historie bleibt vollständig,
 * neue Fälligkeiten entstehen nicht mehr.
 */
export async function aufgabenSammelAktivierung(
  ids: string[],
  aktiv: boolean,
): Promise<SammelStatus> {
  try {
    const benutzer = await benutzerFuerAktion(canManageTasks)
    if (ids.length === 0) return { fehler: 'Es ist nichts markiert.' }

    const aufgaben = await prisma.task.findMany({
      where: { id: { in: ids }, active: !aktiv },
      select: { id: true, title: true },
    })

    if (aufgaben.length === 0) {
      return {
        erfolg: `Alle markierten Aufgaben sind bereits ${aktiv ? 'aktiv' : 'deaktiviert'}.`,
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { id: { in: aufgaben.map((a) => a.id) } },
        data: { active: aktiv },
      })
      await schreibeAudit(
        {
          userId: benutzer.id,
          action: aktiv ? 'TASK_ACTIVATED' : 'TASK_DEACTIVATED',
          entityType: 'Task',
          entityId: null,
          payload: {
            anzahl: aufgaben.length,
            aufgaben: aufgaben.map((a) => a.title),
          },
        },
        tx,
      )
    })

    revalidatePath('/tasks')
    revalidatePath('/')

    return {
      erfolg: fasseErgebnisZusammen(
        aufgaben.length,
        'Aufgabe',
        'Aufgaben',
        aktiv ? 'aktiviert' : 'deaktiviert',
      ),
    }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Sammelaktivierung fehlgeschlagen:', error)
    return { fehler: 'Die Aufgaben konnten nicht geändert werden.' }
  }
}
