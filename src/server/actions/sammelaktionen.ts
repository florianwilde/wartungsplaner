'use server'

import { revalidatePath } from 'next/cache'

import { anzeigeName } from '@/lib/audit-referenzen'
import { schreibeAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { canAdminister, canManageTasks } from '@/lib/rbac'
import {
  beschreibeVerlust,
  fasseErgebnisZusammen,
  pruefeErzwingen,
  pruefeSammelloeschung,
  type Kandidat,
  type Verlust,
} from '@/lib/sammelaktion'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import { entferneDateien } from '@/server/dateiablage'

export type SammelStatus = { fehler?: string; erfolg?: string }

/**
 * Löscht mehrere Audit-Referenzen.
 *
 * Zugeordnete Referenzen bleiben geschützt: Sonst verschwände stillschweigend
 * die Angabe, welche Anforderung eine Prüfung abdeckt. Zum Ausmustern gibt es
 * das Kennzeichen „aktiv".
 */
export async function referenzenSammelLoeschen(ids: string[]): Promise<SammelStatus> {
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
export async function aufgabenSammelLoeschen(ids: string[]): Promise<SammelStatus> {
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

/** Bestandsaufnahme dessen, was ein erzwungenes Löschen mitnehmen würde. */
export type VerlustBericht = {
  verlust: Verlust
  /** Titel der betroffenen Aufgaben, für Anzeige und Protokoll. */
  aufgaben: string[]
  /** Klartext der Verluste, etwa „2 Aufgaben, 7 Durchführungen". */
  beschreibung: string
}

/**
 * Ermittelt, was beim erzwungenen Löschen verlorenginge.
 *
 * Wird vor der Bestätigung angezeigt: Wer Nachweise vernichtet, soll vorher
 * sehen, wie viele es sind – nicht erst danach im Protokoll.
 */
export async function ermittleVerlust(ids: string[]): Promise<VerlustBericht> {
  const leer: VerlustBericht = {
    verlust: {
      aufgaben: 0,
      faelligkeiten: 0,
      durchfuehrungen: 0,
      nachweisdateien: 0,
      abweichungen: 0,
      pruefnachweise: 0,
      pruefboegen: 0,
    },
    aufgaben: [],
    beschreibung: '',
  }

  try {
    await benutzerFuerAktion(canAdminister)
    if (ids.length === 0) return leer

    const aufgaben = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: {
        title: true,
        _count: { select: { occurrences: true, pruefboegen: true } },
        occurrences: {
          select: {
            _count: { select: { nachweise: true } },
            execution: {
              select: {
                _count: { select: { attachments: true, findings: true } },
              },
            },
          },
        },
      },
    })

    const verlust: Verlust = { ...leer.verlust, aufgaben: aufgaben.length }

    for (const aufgabe of aufgaben) {
      verlust.faelligkeiten += aufgabe._count.occurrences
      verlust.pruefboegen += aufgabe._count.pruefboegen
      for (const faelligkeit of aufgabe.occurrences) {
        verlust.pruefnachweise += faelligkeit._count.nachweise
        if (faelligkeit.execution) {
          verlust.durchfuehrungen++
          verlust.nachweisdateien += faelligkeit.execution._count.attachments
          verlust.abweichungen += faelligkeit.execution._count.findings
        }
      }
    }

    // Belege, die am Prüfbogen hängen und noch keiner Durchführung zugeordnet
    // sind, zählen ebenfalls mit.
    verlust.nachweisdateien += await prisma.attachment.count({
      where: { nachweis: { occurrence: { taskId: { in: ids } } } },
    })

    return {
      verlust,
      aufgaben: aufgaben.map((a) => a.title),
      beschreibung: beschreibeVerlust(verlust),
    }
  } catch (error) {
    console.error('Verlust konnte nicht ermittelt werden:', error)
    return leer
  }
}

/**
 * Löscht Aufgaben **einschließlich** ihrer Nachweise.
 *
 * Der Ausnahmeweg für Testdaten und Fehlimporte. Bewusst kein dauerhafter
 * Modus, sondern eine Einzelhandlung mit Begründung und abgetippter
 * Bestätigung: Ein eingeschalteter Modus wird vergessen, und dann verschwindet
 * nebenbei etwas Echtes.
 *
 * Drei Vorkehrungen:
 *
 *  1. **Der Audit-Eintrag entsteht vor dem Löschen** – mit Titeln, Zahlen,
 *     Begründung und den Prüfsummen der entfernten Dateien. Das Audit-Log ist
 *     durch einen Datenbank-Trigger unveränderlich und übersteht die Löschung.
 *     Wenn ein Nachweis schon verschwinden muss, bleibt wenigstens die
 *     Tatsache, dass es ihn gab.
 *  2. **Die Dateien werden von der Platte entfernt**, nicht nur ihre Einträge.
 *     Sonst meldete der nächste Prüfsummenlauf sie als herrenlos.
 *  3. **Nur Administratoren.** Das Verwalten von Aufgaben genügt nicht.
 */
export async function aufgabenErzwungenLoeschen(
  ids: string[],
  begruendung: string,
  bestaetigung: string,
): Promise<SammelStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const pruefung = pruefeErzwingen({ ids, begruendung, bestaetigung })
    if (!pruefung.ok) return { fehler: pruefung.fehler }

    const bericht = await ermittleVerlust(ids)
    if (bericht.aufgaben.length === 0) {
      return { fehler: 'Die markierten Aufgaben wurden nicht gefunden.' }
    }

    // Pfade und Prüfsummen einsammeln, solange die Einträge noch da sind.
    const dateien = await prisma.attachment.findMany({
      where: {
        OR: [
          { execution: { occurrence: { taskId: { in: ids } } } },
          { nachweis: { occurrence: { taskId: { in: ids } } } },
        ],
      },
      select: { storedPath: true, filename: true, sha256: true },
    })

    await prisma.$transaction(async (tx) => {
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'TASK_ERZWUNGEN_GELOESCHT',
          entityType: 'Task',
          entityId: null,
          payload: {
            begruendung: begruendung.trim(),
            aufgaben: bericht.aufgaben,
            verlust: bericht.verlust,
            beschreibung: bericht.beschreibung,
            // Die Prüfsummen belegen später, welche Datei genau fehlt.
            dateien: dateien.map((datei) => ({
              name: datei.filename,
              sha256: datei.sha256,
            })),
          },
        },
        tx,
      )
      await tx.task.deleteMany({ where: { id: { in: ids } } })
    })

    // Erst nach der Transaktion: Ein fehlgeschlagenes Löschen auf der Platte
    // darf den Datenbankvorgang nicht zurückrollen, der Eintrag ist geschrieben.
    if (dateien.length > 0) {
      await entferneDateien(dateien.map((datei) => datei.storedPath))
    }

    revalidatePath('/tasks')
    revalidatePath('/')
    revalidatePath('/nachweise')
    revalidatePath('/findings')

    return {
      erfolg:
        `Gelöscht: ${bericht.beschreibung}. ` +
        'Der Vorgang steht mit Begründung im Audit-Log.',
    }
  } catch (error) {
    if (error instanceof ZugriffVerweigertError) return { fehler: error.message }
    console.error('Erzwungenes Löschen fehlgeschlagen:', error)
    return { fehler: 'Die Aufgaben konnten nicht gelöscht werden.' }
  }
}
