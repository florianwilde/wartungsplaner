'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { schreibeAudit } from '@/lib/audit'
import { saeubereFrage, type PruefpunktErgebnis } from '@/lib/nachweise'
import { prisma } from '@/lib/prisma'
import { parseISODate } from '@/lib/dates'
import { canAdminister, canExecute, canManageFindings } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import {
  NachweisFehler,
  entferneBeleg,
  erzeugeAbweichungAusFeststellung,
  fuegeBelegeHinzu,
  fuehreUebergangAus,
  ladeNachweis,
  leereZeilen,
  speichereZeilen,
  uebernehmeZeilen,
  speichereAntworten,
  starteNachweis,
  uebernimmNachweis,
  verwirfNachweis,
  type AntwortEingabe,
} from '@/server/nachweise'

export type NachweisStatusRueckmeldung = {
  fehler?: string
  erfolg?: string
  /** Kennung eines neu angelegten Nachweises */
  nachweisId?: string
}

const feststellungSchema = z.object({
  punktId: z.string().trim().min(1),
  title: z.string().trim().min(3, 'Der Titel muss mindestens 3 Zeichen haben.').max(200),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  responsibleId: z.string().trim().min(1, 'Bitte eine verantwortliche Person wählen.'),
  dueDate: z.string().trim().min(1, 'Bitte eine Frist angeben.'),
})

const ARTEN = ['BEWERTUNG', 'TEXT', 'ZAHL', 'DATUM', 'ENTSCHEIDUNG', 'LISTE'] as const
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

/** Übernimmt einen fremden Entwurf, um ihn weiterzuführen. */
export async function nachweisUebernehmen(
  nachweisId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)
    await uebernimmNachweis(nachweisId, benutzer.id)
    revalidatePath(`/nachweise/${nachweisId}`)
    revalidatePath('/nachweise')
    return { erfolg: 'Der Entwurf gehört jetzt Ihnen und lässt sich ausfüllen.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Verwirft einen Entwurf, damit ein neuer Bogen angelegt werden kann. */
export async function nachweisVerwerfen(
  nachweisId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)
    // Die Administration darf auch fremde Entwürfe verwerfen – sonst bliebe
    // der Bogen einer ausgeschiedenen Person für immer liegen.
    await verwirfNachweis(nachweisId, benutzer.id, canAdminister(benutzer.role))
    revalidatePath('/nachweise')
    return { erfolg: 'Der Entwurf wurde verworfen.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Übernimmt Zeilen aus einer CSV-Datei in einen Listen-Prüfpunkt. */
export async function nachweisZeilenUebernehmen(
  nachweisId: string,
  _status: NachweisStatusRueckmeldung,
  formData: FormData,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    const punktId = String(formData.get('punktId') ?? '').trim()
    if (!punktId) return { fehler: 'Kein Prüfpunkt angegeben.' }

    const datei = formData.get('datei')
    if (!(datei instanceof File) || datei.size === 0) {
      return { fehler: 'Bitte eine CSV-Datei auswählen.' }
    }
    if (datei.size > 5 * 1024 * 1024) {
      return { fehler: 'Die Datei ist größer als 5 MB.' }
    }

    const inhalt = await datei.text()
    const ergebnis = await uebernehmeZeilen(
      nachweisId,
      punktId,
      inhalt,
      benutzer.id,
      formData.get('ersetzen') === 'on',
    )

    const hinweis =
      ergebnis.uebersprungen.length > 0
        ? ` ${ergebnis.uebersprungen.length} übersprungen (${zusammenfassung(ergebnis.uebersprungen)}).`
        : ''

    revalidatePath(`/nachweise/${nachweisId}`)
    return {
      erfolg: `${ergebnis.uebernommen} ${
        ergebnis.uebernommen === 1 ? 'Zeile' : 'Zeilen'
      } übernommen.${hinweis}`,
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Fasst die Gründe übersprungener Zeilen zusammen, ohne sie einzeln zu nennen. */
function zusammenfassung(eintraege: { grund: string }[]): string {
  const nachGrund = new Map<string, number>()
  for (const eintrag of eintraege) {
    nachGrund.set(eintrag.grund, (nachGrund.get(eintrag.grund) ?? 0) + 1)
  }
  return [...nachGrund.entries()].map(([grund, anzahl]) => `${anzahl}× ${grund}`).join(', ')
}

/** Speichert die Entscheidungen zu den Zeilen einer Liste. */
export async function nachweisZeilenSpeichern(
  nachweisId: string,
  eingaben: { id: string; ergebnis: string | null; bemerkung: string | null }[],
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)

    await speichereZeilen(
      nachweisId,
      benutzer.id,
      eingaben.map((eintrag) => ({
        id: String(eintrag.id),
        ergebnis: ERGEBNISSE.includes(eintrag.ergebnis as PruefpunktErgebnis)
          ? (eintrag.ergebnis as PruefpunktErgebnis)
          : null,
        bemerkung: eintrag.bemerkung ? String(eintrag.bemerkung).slice(0, 2000) : null,
      })),
    )

    revalidatePath(`/nachweise/${nachweisId}`)
    return { erfolg: 'Die Zeilen wurden gespeichert.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/** Entfernt alle Zeilen eines Prüfpunkts. */
export async function nachweisZeilenLeeren(
  nachweisId: string,
  punktId: string,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canExecute)
    const anzahl = await leereZeilen(nachweisId, punktId, benutzer.id)
    revalidatePath(`/nachweise/${nachweisId}`)
    return {
      erfolg:
        anzahl === 0
          ? 'Es waren keine Zeilen vorhanden.'
          : `${anzahl} ${anzahl === 1 ? 'Zeile' : 'Zeilen'} entfernt.`,
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/**
 * Legt aus einer Feststellung eine Abweichung an.
 *
 * Die Angaben aus dem Prüfpunkt sind bereits vorbelegt; hier kommen nur noch
 * Schwere, verantwortliche Person und Frist hinzu.
 */
export async function abweichungAusFeststellung(
  nachweisId: string,
  _status: NachweisStatusRueckmeldung,
  formData: FormData,
): Promise<NachweisStatusRueckmeldung> {
  try {
    const benutzer = await benutzerFuerAktion(canManageFindings)

    const eingabe = feststellungSchema.safeParse({
      punktId: String(formData.get('punktId') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      severity: String(formData.get('severity') ?? 'MEDIUM'),
      responsibleId: String(formData.get('responsibleId') ?? ''),
      dueDate: String(formData.get('dueDate') ?? ''),
    })
    if (!eingabe.success) {
      return { fehler: eingabe.error.issues[0]?.message ?? 'Ungültige Eingabe.' }
    }

    let frist: Date
    try {
      frist = parseISODate(eingabe.data.dueDate)
    } catch {
      return { fehler: 'Die Frist ist ungültig.' }
    }

    await erzeugeAbweichungAusFeststellung(
      nachweisId,
      {
        punktId: eingabe.data.punktId,
        title: eingabe.data.title,
        description: eingabe.data.description?.trim() || null,
        severity: eingabe.data.severity,
        responsibleId: eingabe.data.responsibleId,
        dueDate: frist,
      },
      benutzer.id,
    )

    revalidatePath(`/nachweise/${nachweisId}`)
    revalidatePath('/findings')
    return { erfolg: 'Die Abweichung wurde angelegt.' }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
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
