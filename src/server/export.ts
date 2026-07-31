/**
 * Export der Stammdaten.
 *
 * Die Ausgabe ist bewusst so gestaltet, dass sie unverändert wieder
 * eingelesen werden kann: dieselben Spalten, dieselben Schlüssel
 * (Kategoriename, Aufgabentitel, E-Mail-Adresse) und keine technischen IDs.
 */
import { jaNein, schreibeCsv, type CsvZeile } from '@/lib/csv'
import { toISODate } from '@/lib/dates'
import {
  AUFGABE_SPALTEN,
  BENUTZER_SPALTEN,
  KATEGORIE_SPALTEN,
  PRUEFBOGEN_SPALTEN,
  REFERENZ_SPALTEN,
  type ImportArt,
} from '@/lib/import-export'
import { anzeigeName } from '@/lib/audit-referenzen'
import { prisma } from '@/lib/prisma'

export const SPALTEN: Record<ImportArt, readonly string[]> = {
  kategorien: KATEGORIE_SPALTEN,
  aufgaben: AUFGABE_SPALTEN,
  benutzer: BENUTZER_SPALTEN,
  referenzen: REFERENZ_SPALTEN,
  pruefboegen: PRUEFBOGEN_SPALTEN,
}

export async function ladeKategorienZeilen(): Promise<CsvZeile[]> {
  const kategorien = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })

  return kategorien.map((k) => ({
    name: k.name,
    farbe: k.color,
    reihenfolge: String(k.sortOrder),
  }))
}

export async function ladeAufgabenZeilen(): Promise<CsvZeile[]> {
  const aufgaben = await prisma.task.findMany({
    orderBy: [{ category: { sortOrder: 'asc' } }, { title: 'asc' }],
    include: {
      category: { select: { name: true } },
      owner: { select: { email: true } },
      auditReferenzen: {
        select: { referenz: { select: { kuerzel: true, rahmenwerk: true } } },
      },
    },
  })

  return aufgaben.map((a) => ({
    titel: a.title,
    beschreibung: a.description ?? '',
    kategorie: a.category.name,
    verantwortlich: a.owner.email,
    intervall: a.intervalType,
    intervalltage: a.intervalValue === null ? '' : String(a.intervalValue),
    rhythmus: a.scheduleMode,
    startdatum: toISODate(a.startDate),
    vorlauftage: String(a.leadTimeDays),
    karenztage: String(a.graceDays),
    nachweispflicht: jaNein(a.evidenceRequired),
    kritikalitaet: a.criticality,
    auditreferenzen: a.auditReferenzen
      .map((zuordnung) => anzeigeName(zuordnung.referenz))
      .sort((x, y) => x.localeCompare(y, 'de'))
      .join(', '),
    aktiv: jaNein(a.active),
    pruefanleitung: a.instructionsMd ?? '',
  }))
}

export async function ladeBenutzerZeilen(): Promise<CsvZeile[]> {
  const benutzer = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  })

  // Passworthashes werden bewusst nicht exportiert.
  return benutzer.map((b) => ({
    name: b.name,
    email: b.email,
    rolle: b.role,
    anmeldeverfahren: b.authProvider,
    aktiv: jaNein(b.active),
    benachrichtigungen: jaNein(b.notifyByEmail),
  }))
}

export async function ladeReferenzenZeilen(): Promise<CsvZeile[]> {
  const referenzen = await prisma.auditReferenz.findMany({
    orderBy: [{ rahmenwerk: 'asc' }, { sortOrder: 'asc' }, { kuerzel: 'asc' }],
  })

  return referenzen.map((r) => ({
    rahmenwerk: r.rahmenwerk ?? '',
    kuerzel: r.kuerzel,
    bezeichnung: r.bezeichnung,
    beschreibung: r.beschreibung ?? '',
    aktiv: jaNein(r.aktiv),
    reihenfolge: String(r.sortOrder),
  }))
}

/**
 * Prüfbögen: eine Zeile je Prüfpunkt.
 *
 * Die Angaben zum Bogen wiederholen sich dabei in jeder seiner Zeilen. Das
 * ist redundant, aber der einzige Weg, eine geschachtelte Struktur in einer
 * Tabelle abzubilden, die sich in Excel bearbeiten lässt.
 */
export async function ladePruefboegenZeilen(): Promise<CsvZeile[]> {
  const boegen = await prisma.pruefbogenVorlage.findMany({
    orderBy: { name: 'asc' },
    include: {
      punkte: { orderBy: { position: 'asc' } },
      task: { select: { title: true } },
    },
  })

  return boegen.flatMap((bogen) =>
    bogen.punkte.map((punkt) => ({
      pruefbogen: bogen.name,
      beschreibung: bogen.beschreibung ?? '',
      aufgabe: bogen.task?.title ?? '',
      vier_augen: jaNein(bogen.vierAugen),
      aktiv: jaNein(bogen.aktiv),
      position: String(punkt.position),
      frage: punkt.frage,
      hinweis: punkt.hinweis ?? '',
      art: punkt.art,
      pflicht: jaNein(punkt.pflicht),
    })),
  )
}

export async function ladeZeilen(art: ImportArt): Promise<CsvZeile[]> {
  switch (art) {
    case 'kategorien':
      return ladeKategorienZeilen()
    case 'aufgaben':
      return ladeAufgabenZeilen()
    case 'benutzer':
      return ladeBenutzerZeilen()
    case 'referenzen':
      return ladeReferenzenZeilen()
    case 'pruefboegen':
      return ladePruefboegenZeilen()
  }
}

/** Erzeugt den Export als CSV. */
export async function exportiereCsv(art: ImportArt): Promise<string> {
  return schreibeCsv([...SPALTEN[art]], await ladeZeilen(art))
}

/**
 * Erzeugt den Export als JSON.
 * Das Format entspricht den CSV-Spalten, damit beide Wege austauschbar sind.
 */
export async function exportiereJson(art: ImportArt): Promise<string> {
  return JSON.stringify(
    {
      art,
      erzeugtAm: new Date().toISOString(),
      spalten: SPALTEN[art],
      zeilen: await ladeZeilen(art),
    },
    null,
    2,
  )
}

/** Gesamtexport aller Bereiche als JSON. */
export async function exportiereAllesJson(): Promise<string> {
  const [kategorien, aufgaben, benutzer, referenzen, pruefboegen] =
    await Promise.all([
      ladeKategorienZeilen(),
      ladeAufgabenZeilen(),
      ladeBenutzerZeilen(),
      ladeReferenzenZeilen(),
      ladePruefboegenZeilen(),
    ])

  return JSON.stringify(
    {
      erzeugtAm: new Date().toISOString(),
      kategorien: { spalten: SPALTEN.kategorien, zeilen: kategorien },
      aufgaben: { spalten: SPALTEN.aufgaben, zeilen: aufgaben },
      benutzer: { spalten: SPALTEN.benutzer, zeilen: benutzer },
      referenzen: { spalten: SPALTEN.referenzen, zeilen: referenzen },
      pruefboegen: { spalten: SPALTEN.pruefboegen, zeilen: pruefboegen },
    },
    null,
    2,
  )
}

/**
 * Leere Vorlagendatei mit Kopfzeile und einer Beispielzeile.
 *
 * Bei Prüfbögen steht in einer Zeile ein **Prüfpunkt**, nicht ein Bogen:
 * Für einen Bogen mit fünf Punkten wiederholt man den Namen fünfmal.
 */
export function vorlageCsv(art: ImportArt): string {
  const beispiele: Record<ImportArt, CsvZeile> = {
    kategorien: { name: 'Beispielkategorie', farbe: '#2563eb', reihenfolge: '10' },
    aufgaben: {
      titel: 'Beispielprüfung',
      beschreibung: 'Kurzbeschreibung der Prüfung',
      kategorie: 'Beispielkategorie',
      verantwortlich: 'admin@example.com',
      intervall: 'QUARTERLY',
      intervalltage: '',
      rhythmus: 'FIXED',
      startdatum: '2026-01-15',
      vorlauftage: '14',
      karenztage: '7',
      nachweispflicht: 'ja',
      kritikalitaet: 'HIGH',
      auditreferenzen: 'ISO 27001 A.8.13, ISO 27001 A.8.24',
      aktiv: 'ja',
      pruefanleitung: '## Durchführung\n1. Erster Schritt',
    },
    benutzer: {
      name: 'Vorname Nachname',
      email: 'vorname.nachname@firma.de',
      rolle: 'EDITOR',
      anmeldeverfahren: 'LOCAL',
      aktiv: 'ja',
      benachrichtigungen: 'ja',
    },
    referenzen: {
      rahmenwerk: 'ISO 27001',
      kuerzel: 'A.8.13',
      bezeichnung: 'Sicherung von Informationen',
      beschreibung: 'Sicherungskopien werden regelmäßig erstellt und geprüft.',
      aktiv: 'ja',
      reihenfolge: '10',
    },
    pruefboegen: {
      pruefbogen: 'Beispiel-Prüfbogen',
      beschreibung: 'Wofür dieser Bogen gedacht ist',
      aufgabe: '',
      vier_augen: 'ja',
      aktiv: 'ja',
      position: '1',
      frage: 'Erste zu prüfende Frage',
      hinweis: 'Optionaler Hinweis zur Durchführung',
      art: 'BEWERTUNG',
      pflicht: 'ja',
    },
  }

  return schreibeCsv([...SPALTEN[art]], [beispiele[art]])
}
