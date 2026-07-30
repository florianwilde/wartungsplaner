'use server'

import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { saeubereFrage, type PruefpunktErgebnis } from '@/lib/nachweise'
import { prisma } from '@/lib/prisma'
import { canAdminister, canExecute } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import {
  NachweisFehler,
  entferneBeleg,
  fuegeBelegeHinzu,
  fuehreUebergangAus,
  ladeNachweis,
  speichereAntworten,
  starteNachweis,
  type AntwortEingabe,
} from '@/server/nachweise'

export type NachweisStatusRueckmeldung = {
  fehler?: string
  erfolg?: string
  /** Kennung eines neu angelegten Nachweises */
  nachweisId?: string
}

const ARTEN = ['BEWERTUNG', 'TEXT', 'ZAHL', 'DATUM', 'ENTSCHEIDUNG'] as const
const ERGEBNISSE = [
  'ERFUELLT',
  'NICHT_ERFUELLT',
  'ENTFAELLT',
  'BELASSEN',
  'ENTZIEHEN',
  'AENDERN',
] as const

// ---------------------------------------------------------------------------
// Prüfbögen verwalten (nur ADMIN)
// ---------------------------------------------------------------------------

/**
 * Legt einen Prüfbogen an oder speichert ihn.
 *
 * Die Prüfpunkte werden als JSON übergeben, weil ihre Anzahl frei ist. Bei
 * einer Änderung werden sie ersetzt – solange der Bogen noch nicht in einem
 * abgeschlossenen Nachweis verwendet wurde.
 */
export async function pruefbogenSpeichern(
  vorlagenId: string | null,
  _status: NachweisStatusRueckmeldung,
  formData: FormData,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const name = saeubereFrage(String(formData.get('name') ?? ''), 120)
    if (!name) return { fehler: 'Der Name muss mindestens 3 Zeichen haben.' }

    const taskIdRoh = String(formData.get('taskId') ?? '').trim()
    const taskId = taskIdRoh === '' ? null : taskIdRoh
    if (taskId) {
      const aufgabe = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true },
      })
      if (!aufgabe) return { fehler: 'Die gewählte Aufgabe existiert nicht.' }
    }

    let punkteRoh: unknown
    try {
      punkteRoh = JSON.parse(String(formData.get('punkte') ?? '[]'))
    } catch {
      return { fehler: 'Die Prüfpunkte konnten nicht gelesen werden.' }
    }
    if (!Array.isArray(punkteRoh) || punkteRoh.length === 0) {
      return { fehler: 'Bitte mindestens einen Prüfpunkt anlegen.' }
    }
    if (punkteRoh.length > 200) {
      return { fehler: 'Ein Prüfbogen darf höchstens 200 Prüfpunkte enthalten.' }
    }

    const punkte = punkteRoh.map((eintrag, index) => {
      const roh = eintrag as Record<string, unknown>
      const frage = saeubereFrage(String(roh.frage ?? ''))
      if (!frage) {
        throw new NachweisFehler(
          `Prüfpunkt ${index + 1}: Die Frage muss mindestens 3 Zeichen haben.`,
        )
      }
      const art = String(roh.art ?? 'BEWERTUNG')
      if (!ARTEN.includes(art as (typeof ARTEN)[number])) {
        throw new NachweisFehler(`Prüfpunkt ${index + 1}: Unbekannte Antwortart.`)
      }
      return {
        position: index + 1,
        frage,
        hinweis: saeubereFrage(String(roh.hinweis ?? ''), 300),
        art: art as (typeof ARTEN)[number],
        pflicht: roh.pflicht !== false,
      }
    })

    const namensKonflikt = await prisma.pruefbogenVorlage.findFirst({
      where: { name, ...(vorlagenId ? { id: { not: vorlagenId } } : {}) },
      select: { id: true },
    })
    if (namensKonflikt) {
      return { fehler: `Es gibt bereits einen Prüfbogen namens „${name}“.` }
    }

    const stammdaten = {
      name,
      beschreibung: saeubereFrage(String(formData.get('beschreibung') ?? ''), 1000),
      taskId,
      vierAugen: formData.get('vierAugen') === 'on',
      aktiv: formData.get('aktiv') !== 'off',
      updatedById: admin.id,
    }

    await prisma.$transaction(async (tx) => {
      if (vorlagenId) {
        // Prüfpunkte werden ersetzt. Bereits abgeschlossene Nachweise behalten
        // ihre Antworten; deren Prüfpunkte dürfen daher nicht entfernt werden.
        const verwendet = await tx.nachweis.count({
          where: { vorlageId: vorlagenId, status: 'GEGENGEZEICHNET' },
        })
        if (verwendet > 0) {
          throw new NachweisFehler(
            `Dieser Prüfbogen wurde bereits in ${verwendet} abgeschlossenen Nachweisen verwendet. ` +
              'Die Prüfpunkte lassen sich nicht mehr ändern – legen Sie stattdessen einen neuen Bogen an.',
          )
        }

        await tx.pruefbogenVorlage.update({
          where: { id: vorlagenId },
          data: stammdaten,
        })
        await tx.pruefbogenPunkt.deleteMany({ where: { vorlageId: vorlagenId } })
        await tx.pruefbogenPunkt.createMany({
          data: punkte.map((p) => ({ ...p, vorlageId: vorlagenId })),
        })
        await schreibeAudit(
          {
            userId: admin.id,
            action: 'PRUEFBOGEN_GEAENDERT',
            entityType: 'PruefbogenVorlage',
            entityId: vorlagenId,
            payload: { name, pruefpunkte: punkte.length, vierAugen: stammdaten.vierAugen },
          },
          tx,
        )
      } else {
        const erstellt = await tx.pruefbogenVorlage.create({
          data: { ...stammdaten, punkte: { create: punkte } },
          select: { id: true },
        })
        await schreibeAudit(
          {
            userId: admin.id,
            action: 'PRUEFBOGEN_ANGELEGT',
            entityType: 'PruefbogenVorlage',
            entityId: erstellt.id,
            payload: { name, pruefpunkte: punkte.length, vierAugen: stammdaten.vierAugen },
          },
          tx,
        )
      }
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/pruefboegen')
  return { erfolg: 'Der Prüfbogen wurde gespeichert.' }
}

/** Löscht einen Prüfbogen, solange er nicht verwendet wurde. */
export async function pruefbogenLoeschen(
  vorlagenId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const vorlage = await prisma.pruefbogenVorlage.findUnique({
      where: { id: vorlagenId },
      select: { id: true, name: true, _count: { select: { nachweise: true } } },
    })
    if (!vorlage) return { fehler: 'Der Prüfbogen wurde nicht gefunden.' }
    if (vorlage._count.nachweise > 0) {
      return {
        fehler: `Zu diesem Prüfbogen gibt es ${vorlage._count.nachweise} Nachweise. Deaktivieren Sie ihn stattdessen.`,
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pruefbogenVorlage.delete({ where: { id: vorlagenId } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'PRUEFBOGEN_GELOESCHT',
          entityType: 'PruefbogenVorlage',
          entityId: vorlagenId,
          payload: { name: vorlage.name },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/pruefboegen')
  return { erfolg: 'Der Prüfbogen wurde gelöscht.' }
}

// ---------------------------------------------------------------------------
// Nachweise erfassen
// ---------------------------------------------------------------------------

/** Beginnt einen Nachweis zu einer Fälligkeit. */
export async function nachweisBeginnen(
  occurrenceId: string,
  vorlageId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)
    const nachweisId = await starteNachweis(occurrenceId, vorlageId, benutzer.id)
    revalidatePath('/nachweise')
    return { nachweisId, erfolg: 'Der Prüfbogen wurde angelegt.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Speichert den Zwischenstand eines Prüfbogens. */
export async function nachweisSpeichern(
  nachweisId: string,
  _status: NachweisStatusRueckmeldung,
  formData: FormData,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    let antwortenRoh: unknown
    try {
      antwortenRoh = JSON.parse(String(formData.get('antworten') ?? '[]'))
    } catch {
      return { fehler: 'Die Antworten konnten nicht gelesen werden.' }
    }
    if (!Array.isArray(antwortenRoh)) {
      return { fehler: 'Die Antworten konnten nicht gelesen werden.' }
    }

    const eingaben: AntwortEingabe[] = antwortenRoh.map((eintrag) => {
      const roh = eintrag as Record<string, unknown>
      const ergebnisRoh = roh.ergebnis ? String(roh.ergebnis) : ''
      return {
        punktId: String(roh.punktId ?? ''),
        ergebnis: ERGEBNISSE.includes(ergebnisRoh as PruefpunktErgebnis)
          ? (ergebnisRoh as PruefpunktErgebnis)
          : null,
        wert: roh.wert ? String(roh.wert).slice(0, 2000) : null,
        bemerkung: roh.bemerkung ? String(roh.bemerkung).slice(0, 2000) : null,
      }
    })

    const bemerkung = String(formData.get('bemerkung') ?? '').trim() || null

    await speichereAntworten(nachweisId, benutzer.id, bemerkung, eingaben)
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath(`/nachweise/${nachweisId}`)
  return { erfolg: 'Der Zwischenstand wurde gespeichert.' }
}

/**
 * Nimmt Belege zu einem Prüfbogen entgegen.
 *
 * Gemeint sind die tatsächlichen Nachweise aus den geprüften Systemen:
 * AD-Export, Screenshot, Herstellerprotokoll, Sicherungsbericht.
 */
export async function nachweisBelegeHochladen(
  nachweisId: string,
  _status: NachweisStatusRueckmeldung,
  formData: FormData,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    const dateien = formData
      .getAll('dateien')
      .filter((eintrag): eintrag is File => eintrag instanceof File && eintrag.size > 0)

    if (dateien.length === 0) {
      return { fehler: 'Bitte mindestens eine Datei auswählen.' }
    }

    const punktIdRoh = String(formData.get('punktId') ?? '').trim()
    const anzahl = await fuegeBelegeHinzu(
      nachweisId,
      benutzer.id,
      dateien,
      punktIdRoh === '' ? null : punktIdRoh,
    )

    revalidatePath(`/nachweise/${nachweisId}`)
    return {
      erfolg:
        anzahl === 1
          ? 'Der Beleg wurde hinzugefügt.'
          : `${anzahl} Belege wurden hinzugefügt.`,
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Entfernt einen Beleg, solange der Prüfbogen bearbeitet werden darf. */
export async function nachweisBelegEntfernen(
  nachweisId: string,
  belegId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)
    await entferneBeleg(nachweisId, belegId, benutzer.id)
    revalidatePath(`/nachweise/${nachweisId}`)
    return { erfolg: 'Der Beleg wurde entfernt.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Legt vor, zeichnet gegen, weist zurück oder schließt ab. */
export async function nachweisUebergang(
  nachweisId: string,
  uebergang: 'vorlegen' | 'gegenzeichnen' | 'zurueckweisen' | 'abschliessen',
  begruendung: string | null,
): Promise<NachweisStatusRueckmeldung> {
  let taskId: string | null = null

  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    const vorher = await ladeNachweis(nachweisId)
    taskId = vorher?.occurrence.task.id ?? null

    const ergebnis = await fuehreUebergangAus(
      nachweisId,
      uebergang,
      benutzer.id,
      begruendung,
    )

    const meldungen: Record<typeof uebergang, string> = {
      vorlegen: 'Der Nachweis wurde zur Gegenzeichnung vorgelegt.',
      gegenzeichnen: ergebnis.attachmentId
        ? 'Gegengezeichnet. Der Nachweis ist als Anhang an der Durchführung hinterlegt.'
        : 'Gegengezeichnet.',
      zurueckweisen: 'Der Nachweis wurde zurückgewiesen.',
      abschliessen: ergebnis.attachmentId
        ? 'Abgeschlossen. Der Nachweis ist als Anhang an der Durchführung hinterlegt.'
        : 'Der Nachweis wurde abgeschlossen.',
    }

    const hinweis =
      ergebnis.neuerStatus === 'GEGENGEZEICHNET' && !ergebnis.attachmentId
        ? ' Hinweis: Das PDF konnte nicht hinterlegt werden – bitte den Anhang an der Durchführung prüfen.'
        : ''

    revalidatePath('/nachweise')
    revalidatePath(`/nachweise/${nachweisId}`)
    if (taskId) revalidatePath(`/tasks/${taskId}`)

    return { erfolg: meldungen[uebergang] + hinweis }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof NachweisFehler) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler im Nachweismodul:', error)
  return 'Die Aktion konnte nicht ausgeführt werden.'
}
