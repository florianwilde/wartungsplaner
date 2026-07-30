'use server'

import { revalidatePath } from 'next/cache'

import { leseCsv, type CsvZeile } from '@/lib/csv'
import { toISODate } from '@/lib/dates'
import {
  IMPORT_BEZEICHNUNG,
  MAX_ZEILEN,
  darfGeschriebenWerden,
  fasseVorschauZusammen,
  normalisiereReferenzliste,
  pruefeAufgaben,
  pruefeBenutzer,
  pruefeKategorien,
  type AufgabeDaten,
  type BenutzerDaten,
  type ImportArt,
  type KategorieDaten,
  type ImportFehler,
  type ImportVorschau,
} from '@/lib/import-export'
import { anzeigeName } from '@/lib/audit-referenzen'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import { ZugriffVerweigertError, benutzerFuerAktion } from '@/lib/session'
import {
  schreibeAufgaben,
  schreibeBenutzer,
  schreibeKategorien,
} from '@/server/import'

/** Für die Anzeige aufbereitete Vorschau (ohne die vollständigen Daten). */
export type VorschauZeile = {
  zeile: number
  schluessel: string
  vorgang: 'anlegen' | 'aktualisieren' | 'unveraendert'
  aenderungen: string[]
}

export type ImportStatus = {
  fehler?: string
  erfolg?: string
  art?: ImportArt
  /** Der geprüfte Dateiinhalt, damit die Bestätigung erneut prüfen kann. */
  inhalt?: string
  zusammenfassung?: string
  zeilen?: VorschauZeile[]
  pruefFehler?: ImportFehler[]
  schreibbar?: boolean
}

const ARTEN: ImportArt[] = ['kategorien', 'aufgaben', 'benutzer']

/** Liest die Datei bzw. den durchgereichten Inhalt aus dem Formular. */
async function leseInhalt(formData: FormData): Promise<string | null> {
  const datei = formData.get('datei')
  if (datei instanceof File && datei.size > 0) {
    if (datei.size > 5 * 1024 * 1024) {
      throw new Error('Die Datei ist größer als 5 MB.')
    }
    return await datei.text()
  }

  const durchgereicht = formData.get('inhalt')
  return typeof durchgereicht === 'string' && durchgereicht.length > 0
    ? durchgereicht
    : null
}

/**
 * Ergebnis der Prüfung. Die Unterscheidung nach `art` hält die Typen der
 * Nutzdaten erhalten, sodass beim Schreiben keine Umwandlung nötig ist.
 */
type GepruefteDaten =
  | { art: 'kategorien'; vorschau: ImportVorschau<KategorieDaten> }
  | { art: 'aufgaben'; vorschau: ImportVorschau<AufgabeDaten> }
  | { art: 'benutzer'; vorschau: ImportVorschau<BenutzerDaten> }

/** Führt die Prüfung gegen den aktuellen Datenbestand aus. */
async function pruefe(
  art: ImportArt,
  zeilen: CsvZeile[],
): Promise<GepruefteDaten> {
  if (art === 'kategorien') {
    const vorhandene = await prisma.category.findMany({
      select: { name: true, color: true, sortOrder: true },
    })
    return { art: 'kategorien', vorschau: pruefeKategorien(zeilen, vorhandene) }
  }

  if (art === 'benutzer') {
    const vorhandene = await prisma.user.findMany({
      select: {
        name: true,
        email: true,
        role: true,
        authProvider: true,
        active: true,
        notifyByEmail: true,
      },
    })
    return { art: 'benutzer', vorschau: pruefeBenutzer(zeilen, vorhandene) }
  }

  const [aufgaben, kategorien, benutzer] = await Promise.all([
    prisma.task.findMany({
      include: {
        category: { select: { name: true } },
        owner: { select: { email: true } },
        auditReferenzen: {
          select: { referenz: { select: { kuerzel: true, rahmenwerk: true } } },
        },
      },
    }),
    prisma.category.findMany({ select: { name: true } }),
    prisma.user.findMany({ where: { active: true }, select: { email: true } }),
  ])

  return {
    art: 'aufgaben',
    vorschau: pruefeAufgaben(
    zeilen,
    aufgaben.map((a) => ({
      title: a.title,
      kategorieName: a.category.name,
      verantwortlichEmail: a.owner.email,
      intervalType: a.intervalType,
      intervalValue: a.intervalValue,
      scheduleMode: a.scheduleMode,
      startDate: toISODate(a.startDate),
      leadTimeDays: a.leadTimeDays,
      graceDays: a.graceDays,
      evidenceRequired: a.evidenceRequired,
      criticality: a.criticality,
      auditReferenzen: normalisiereReferenzliste(
        a.auditReferenzen.map((z) => anzeigeName(z.referenz)).join(','),
      ),
      active: a.active,
      description: a.description,
      instructionsMd: a.instructionsMd,
    })),
      kategorien.map((k) => k.name),
      benutzer.map((b) => b.email),
    ),
  }
}

/**
 * Erster Schritt: Datei einlesen, prüfen und die Vorschau zurückgeben.
 * Es wird noch nichts geschrieben.
 */
export async function importVorschau(
  _status: ImportStatus,
  formData: FormData,
): Promise<ImportStatus> {
  try {
    await benutzerFuerAktion(canAdminister)

    const art = String(formData.get('art') ?? '') as ImportArt
    if (!ARTEN.includes(art)) {
      return { fehler: 'Bitte einen gültigen Bereich wählen.' }
    }

    const inhalt = await leseInhalt(formData)
    if (!inhalt) return { fehler: 'Bitte eine Datei auswählen.', art }

    let zeilen: CsvZeile[]
    try {
      zeilen = leseCsv(inhalt)
    } catch (error) {
      return {
        fehler: `Die Datei konnte nicht gelesen werden: ${
          error instanceof Error ? error.message : 'unbekannter Fehler'
        }`,
        art,
      }
    }

    if (zeilen.length === 0) {
      return { fehler: 'Die Datei enthält keine Datenzeilen.', art }
    }
    if (zeilen.length > MAX_ZEILEN) {
      return {
        fehler: `Die Datei enthält ${zeilen.length} Zeilen. Erlaubt sind höchstens ${MAX_ZEILEN}.`,
        art,
      }
    }

    const geprueft = await pruefe(art, zeilen)
    const vorschau = geprueft.vorschau

    return {
      art,
      inhalt,
      zusammenfassung: fasseVorschauZusammen(vorschau),
      zeilen: vorschau.eintraege.map((e) => ({
        zeile: e.zeile,
        schluessel: e.schluessel,
        vorgang: e.vorgang,
        aenderungen: e.aenderungen,
      })),
      pruefFehler: vorschau.fehler,
      schreibbar: darfGeschriebenWerden(vorschau),
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

/**
 * Zweiter Schritt: Nach Bestätigung schreiben.
 *
 * Die Prüfung läuft hier erneut gegen den aktuellen Datenbestand – der
 * Vorschau aus dem Browser wird bewusst nicht vertraut.
 */
export async function importAusfuehren(
  _status: ImportStatus,
  formData: FormData,
): Promise<ImportStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const art = String(formData.get('art') ?? '') as ImportArt
    if (!ARTEN.includes(art)) {
      return { fehler: 'Bitte einen gültigen Bereich wählen.' }
    }

    const inhalt = await leseInhalt(formData)
    if (!inhalt) {
      return { fehler: 'Der Dateiinhalt ist verloren gegangen. Bitte erneut hochladen.' }
    }

    const zeilen = leseCsv(inhalt)
    const geprueft = await pruefe(art, zeilen)
    const vorschau = geprueft.vorschau

    if (!darfGeschriebenWerden(vorschau)) {
      return {
        fehler:
          vorschau.fehler.length > 0
            ? 'Die Daten enthalten Fehler. Es wurde nichts geschrieben.'
            : 'Es gibt nichts zu schreiben.',
        art,
        inhalt,
        zusammenfassung: fasseVorschauZusammen(vorschau),
        pruefFehler: vorschau.fehler,
        schreibbar: false,
      }
    }

    // Die Unterscheidung nach `geprueft.art` liefert die passenden Typen -
    // eine Umwandlung ist nicht nötig.
    const ergebnis =
      geprueft.art === 'kategorien'
        ? await schreibeKategorien(geprueft.vorschau, admin.id)
        : geprueft.art === 'benutzer'
          ? await schreibeBenutzer(geprueft.vorschau, admin.id)
          : await schreibeAufgaben(geprueft.vorschau, admin.id)

    revalidatePath('/admin/import-export')
    revalidatePath('/tasks')
    revalidatePath('/admin/kategorien')
    revalidatePath('/admin/benutzer')
    revalidatePath('/')

    return {
      art,
      erfolg:
        `${IMPORT_BEZEICHNUNG[art]}: ${ergebnis.angelegt} angelegt, ` +
        `${ergebnis.aktualisiert} aktualisiert, ${ergebnis.uebersprungen} unverändert.`,
    }
  } catch (error) {
    return { fehler: fehlertext(error) }
  }
}

function fehlertext(error: unknown): string {
  if (error instanceof ZugriffVerweigertError) return error.message
  if (error instanceof Error) return error.message
  console.error('Unerwarteter Fehler beim Import:', error)
  return 'Der Import konnte nicht ausgeführt werden.'
}
