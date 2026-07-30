/**
 * Datenbeschaffung für die vier Auswertungen.
 *
 * Die Funktionen liefern reine Datenstrukturen; die Aufbereitung als PDF oder
 * Excel erfolgt getrennt davon. So verwenden beide Ausgabeformate garantiert
 * dieselben Zahlen.
 */
import type { Prisma } from '@prisma/client'

import { addMonths, compareDates, formatDate, todayInBerlin } from '@/lib/dates'
import {
  ABWEICHUNG_STATUS_BEZEICHNUNG,
  ERGEBNIS_BEZEICHNUNG,
  KRITIKALITAET_BEZEICHNUNG,
  SCHWERE_BEZEICHNUNG,
} from '@/lib/labels'
import {
  ERGEBNIS_BEZEICHNUNG as PRUEFERGEBNIS_BEZEICHNUNG,
  auffaelligePunkte,
  auffaelligeZeilen,
  type Pruefpunkt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import { prisma } from '@/lib/prisma'
import { erzeugeVorschau, intervallText, warPuenktlich } from '@/lib/scheduling'
import { holeBranding } from '@/server/branding'
import { absoluterPfad } from '@/server/dateiablage'

import { REPORT_TITEL, type ReportTyp } from './typen'

export {
  REPORT_BESCHREIBUNG,
  REPORT_TITEL,
  REPORT_TYPEN,
  type ReportTyp,
} from './typen'

export type Zeitraum = { von: Date; bis: Date }

export type ReportKopf = {
  titel: string
  zeitraum: Zeitraum
  erstelltAm: Date
  erstelltVon: string
  kategorienText: string
  /** Angaben aus dem konfigurierten Erscheinungsbild. */
  anwendung: string
  organisation: string
  markenfarbe: string
  fussnote: string | null
  /** Absoluter Pfad zu einer Logodatei (nur PNG/JPG sind einbettbar). */
  logoDatei: string | null
}

/** Baut den Filter auf ausgewählte Kategorien (leer = alle). */
function kategorieFilter(kategorieIds: string[]): Prisma.TaskWhereInput {
  return kategorieIds.length > 0 ? { categoryId: { in: kategorieIds } } : {}
}

export async function baueKopf(
  typ: ReportTyp,
  zeitraum: Zeitraum,
  erstelltVon: string,
  kategorieIds: string[],
): Promise<ReportKopf> {
  let kategorienText = 'Alle Kategorien'
  if (kategorieIds.length > 0) {
    const kategorien = await prisma.category.findMany({
      where: { id: { in: kategorieIds } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true },
    })
    kategorienText = kategorien.map((k) => k.name).join(', ') || 'Alle Kategorien'
  }

  const branding = await holeBranding()

  // pdfkit kann ausschließlich PNG und JPEG einbetten. Ein hinterlegtes
  // SVG-Logo bleibt deshalb der Oberfläche vorbehalten; der Report führt in
  // dem Fall nur den Namen der Organisation.
  let logoDatei: string | null = null
  if (branding.logoPath && /\.(png|jpe?g)$/i.test(branding.logoPath)) {
    try {
      logoDatei = absoluterPfad(branding.logoPath)
    } catch {
      logoDatei = null
    }
  }

  return {
    titel: REPORT_TITEL[typ],
    zeitraum,
    erstelltAm: new Date(),
    erstelltVon,
    kategorienText,
    anwendung: branding.appName,
    organisation: branding.organisation,
    markenfarbe: branding.primaryColor,
    fussnote: branding.reportFooter,
    logoDatei,
  }
}

// ---------------------------------------------------------------------------
// 1. Compliance-Übersicht
// ---------------------------------------------------------------------------

export type ComplianceZeile = {
  kategorie: string
  gesamt: number
  puenktlich: number
  verspaetet: number
  offen: number
  ueberfaellig: number
  ausgesetzt: number
  /** Anteil erledigter an den bewertbaren Fälligkeiten (ohne ausgesetzte). */
  erfuellungsgrad: number
  /** Anteil pünktlicher an den erledigten Fälligkeiten. */
  puenktlichkeitsquote: number
}

export type ComplianceReport = {
  zeilen: ComplianceZeile[]
  gesamt: ComplianceZeile
}

function berechneQuoten(zeile: Omit<ComplianceZeile, 'erfuellungsgrad' | 'puenktlichkeitsquote'>): ComplianceZeile {
  const bewertbar = zeile.gesamt - zeile.ausgesetzt
  const erledigt = zeile.puenktlich + zeile.verspaetet
  return {
    ...zeile,
    erfuellungsgrad: bewertbar > 0 ? erledigt / bewertbar : 1,
    puenktlichkeitsquote: erledigt > 0 ? zeile.puenktlich / erledigt : 1,
  }
}

export async function ladeCompliance(
  zeitraum: Zeitraum,
  kategorieIds: string[],
): Promise<ComplianceReport> {
  const faelligkeiten = await prisma.occurrence.findMany({
    where: {
      dueDate: { gte: zeitraum.von, lte: zeitraum.bis },
      task: kategorieFilter(kategorieIds),
    },
    select: {
      dueDate: true,
      status: true,
      execution: { select: { executedAt: true } },
      task: {
        select: { graceDays: true, category: { select: { name: true, sortOrder: true } } },
      },
    },
  })

  type Roh = Omit<ComplianceZeile, 'erfuellungsgrad' | 'puenktlichkeitsquote'> & {
    sortOrder: number
  }
  const proKategorie = new Map<string, Roh>()

  const leer = (kategorie: string, sortOrder: number): Roh => ({
    kategorie,
    sortOrder,
    gesamt: 0,
    puenktlich: 0,
    verspaetet: 0,
    offen: 0,
    ueberfaellig: 0,
    ausgesetzt: 0,
  })

  for (const faelligkeit of faelligkeiten) {
    const name = faelligkeit.task.category.name
    const zeile =
      proKategorie.get(name) ??
      leer(name, faelligkeit.task.category.sortOrder)
    proKategorie.set(name, zeile)

    zeile.gesamt++

    switch (faelligkeit.status) {
      case 'DONE': {
        const puenktlich = faelligkeit.execution
          ? warPuenktlich(
              faelligkeit.dueDate,
              faelligkeit.execution.executedAt,
              faelligkeit.task.graceDays,
            )
          : false
        if (puenktlich) zeile.puenktlich++
        else zeile.verspaetet++
        break
      }
      case 'OPEN':
        zeile.offen++
        break
      case 'OVERDUE':
        zeile.ueberfaellig++
        break
      case 'SUSPENDED':
        zeile.ausgesetzt++
        break
    }
  }

  const zeilen = [...proKategorie.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.kategorie.localeCompare(b.kategorie))
    .map(({ sortOrder: _sortOrder, ...rest }) => berechneQuoten(rest))

  const gesamt = berechneQuoten({
    kategorie: 'Gesamt',
    gesamt: zeilen.reduce((s, z) => s + z.gesamt, 0),
    puenktlich: zeilen.reduce((s, z) => s + z.puenktlich, 0),
    verspaetet: zeilen.reduce((s, z) => s + z.verspaetet, 0),
    offen: zeilen.reduce((s, z) => s + z.offen, 0),
    ueberfaellig: zeilen.reduce((s, z) => s + z.ueberfaellig, 0),
    ausgesetzt: zeilen.reduce((s, z) => s + z.ausgesetzt, 0),
  })

  return { zeilen, gesamt }
}

// ---------------------------------------------------------------------------
// 2. Aufgabenhistorie
// ---------------------------------------------------------------------------

export type HistorieNachweis = {
  dateiname: string
  sha256: string
  groesseBytes: number
}

export type HistorieDurchfuehrung = {
  sollDatum: Date
  istDatum: Date
  person: string
  ergebnis: string
  puenktlich: boolean
  kommentar: string
  nachweise: HistorieNachweis[]
  abweichungen: number
}

export type HistorieAufgabe = {
  titel: string
  kategorie: string
  verantwortlich: string
  intervall: string
  auditReferenz: string
  durchfuehrungen: HistorieDurchfuehrung[]
}

export async function ladeHistorie(
  zeitraum: Zeitraum,
  kategorieIds: string[],
): Promise<HistorieAufgabe[]> {
  const aufgaben = await prisma.task.findMany({
    where: {
      ...kategorieFilter(kategorieIds),
      occurrences: {
        some: {
          execution: { isNot: null },
          dueDate: { gte: zeitraum.von, lte: zeitraum.bis },
        },
      },
    },
    orderBy: [{ category: { sortOrder: 'asc' } }, { title: 'asc' }],
    include: {
      category: { select: { name: true } },
      owner: { select: { name: true } },
      occurrences: {
        where: {
          execution: { isNot: null },
          dueDate: { gte: zeitraum.von, lte: zeitraum.bis },
        },
        orderBy: { dueDate: 'asc' },
        include: {
          execution: {
            include: {
              executedBy: { select: { name: true } },
              attachments: {
                orderBy: { uploadedAt: 'asc' },
                select: { filename: true, sha256: true, sizeBytes: true },
              },
              findings: { select: { id: true } },
            },
          },
        },
      },
    },
  })

  return aufgaben.map((aufgabe) => ({
    titel: aufgabe.title,
    kategorie: aufgabe.category.name,
    verantwortlich: aufgabe.owner.name,
    intervall: intervallText(aufgabe.intervalType, aufgabe.intervalValue),
    auditReferenz: aufgabe.auditReference ?? '–',
    durchfuehrungen: aufgabe.occurrences.map((occurrence) => {
      const execution = occurrence.execution!
      return {
        sollDatum: occurrence.dueDate,
        istDatum: execution.executedAt,
        person: execution.executedBy.name,
        ergebnis: ERGEBNIS_BEZEICHNUNG[execution.result],
        puenktlich: warPuenktlich(
          occurrence.dueDate,
          execution.executedAt,
          aufgabe.graceDays,
        ),
        kommentar: execution.comment ?? '',
        nachweise: execution.attachments.map((anhang) => ({
          dateiname: anhang.filename,
          sha256: anhang.sha256,
          groesseBytes: anhang.sizeBytes,
        })),
        abweichungen: execution.findings.length,
      }
    }),
  }))
}

// ---------------------------------------------------------------------------
// 3. Abweichungsbericht
// ---------------------------------------------------------------------------

export type AbweichungZeile = {
  titel: string
  beschreibung: string
  schwere: string
  status: string
  verantwortlich: string
  frist: Date
  fristUeberschritten: boolean
  festgestelltAm: Date
  aufgabe: string
  kategorie: string
  geschlossenAm: Date | null
  massnahme: string
}

export async function ladeAbweichungen(
  zeitraum: Zeitraum,
  kategorieIds: string[],
): Promise<AbweichungZeile[]> {
  const heute = todayInBerlin()

  const abweichungen = await prisma.finding.findMany({
    where: {
      execution: {
        executedAt: { gte: zeitraum.von, lte: naechsterTagesbeginn(zeitraum.bis) },
        occurrence: { task: kategorieFilter(kategorieIds) },
      },
    },
    orderBy: [{ status: 'asc' }, { severity: 'desc' }, { dueDate: 'asc' }],
    include: {
      responsible: { select: { name: true } },
      execution: {
        select: {
          executedAt: true,
          occurrence: {
            select: {
              task: {
                select: { title: true, category: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  })

  return abweichungen.map((abweichung) => ({
    titel: abweichung.title,
    beschreibung: abweichung.description ?? '',
    schwere: SCHWERE_BEZEICHNUNG[abweichung.severity],
    status: ABWEICHUNG_STATUS_BEZEICHNUNG[abweichung.status],
    verantwortlich: abweichung.responsible.name,
    frist: abweichung.dueDate,
    fristUeberschritten:
      abweichung.status !== 'CLOSED' && compareDates(abweichung.dueDate, heute) < 0,
    festgestelltAm: abweichung.execution.executedAt,
    aufgabe: abweichung.execution.occurrence.task.title,
    kategorie: abweichung.execution.occurrence.task.category.name,
    geschlossenAm: abweichung.closedAt,
    massnahme: abweichung.closingComment ?? '',
  }))
}

/** Ende eines Tages als exklusive Obergrenze für Zeitstempel-Vergleiche. */
function naechsterTagesbeginn(tag: Date): Date {
  return new Date(tag.getTime() + 24 * 60 * 60 * 1000 - 1)
}

// ---------------------------------------------------------------------------
// 4. Fälligkeitsvorschau
// ---------------------------------------------------------------------------

export type VorschauZeile = {
  datum: Date
  aufgabe: string
  kategorie: string
  verantwortlich: string
  intervall: string
  kritikalitaet: string
  /** true = bereits angelegte Fälligkeit, false = rechnerisch fortgeschrieben */
  bestehend: boolean
}

/**
 * Kommende Prüfungen der nächsten `monate` Monate.
 *
 * Bereits angelegte Fälligkeiten werden übernommen; darüber hinaus werden die
 * Folgetermine rechnerisch fortgeschrieben, damit die Vorschau auch über den
 * nächsten Termin hinaus trägt.
 */
export async function ladeVorschau(
  monate: number,
  kategorieIds: string[],
): Promise<{ zeitraum: Zeitraum; zeilen: VorschauZeile[] }> {
  const heute = todayInBerlin()
  const bis = addMonths(heute, monate)

  const aufgaben = await prisma.task.findMany({
    where: { active: true, ...kategorieFilter(kategorieIds) },
    orderBy: [{ category: { sortOrder: 'asc' } }, { title: 'asc' }],
    include: {
      category: { select: { name: true } },
      owner: { select: { name: true } },
      occurrences: {
        where: { status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] } },
        orderBy: { dueDate: 'asc' },
        select: { dueDate: true },
      },
    },
  })

  const zeilen: VorschauZeile[] = []

  for (const aufgabe of aufgaben) {
    const basis = {
      aufgabe: aufgabe.title,
      kategorie: aufgabe.category.name,
      verantwortlich: aufgabe.owner.name,
      intervall: intervallText(aufgabe.intervalType, aufgabe.intervalValue),
      kritikalitaet: KRITIKALITAET_BEZEICHNUNG[aufgabe.criticality],
    }

    const bestehende = aufgabe.occurrences
    for (const occurrence of bestehende) {
      if (compareDates(occurrence.dueDate, bis) <= 0) {
        zeilen.push({ ...basis, datum: occurrence.dueDate, bestehend: true })
      }
    }

    // Ab dem letzten bekannten Termin fortschreiben.
    const letzterBekannter =
      bestehende.length > 0
        ? bestehende[bestehende.length - 1].dueDate
        : aufgabe.startDate

    const fortgeschrieben = erzeugeVorschau({
      ab: letzterBekannter,
      intervalType: aufgabe.intervalType,
      intervalValue: aufgabe.intervalValue,
      von: heute,
      bis,
      maxAnzahl: 400,
    }).filter((termin) => compareDates(termin, letzterBekannter) > 0)

    for (const termin of fortgeschrieben) {
      zeilen.push({ ...basis, datum: termin, bestehend: false })
    }
  }

  zeilen.sort(
    (a, b) => compareDates(a.datum, b.datum) || a.aufgabe.localeCompare(b.aufgabe),
  )

  return { zeitraum: { von: heute, bis }, zeilen }
}

// ---------------------------------------------------------------------------
// 5. Nachweisregister
// ---------------------------------------------------------------------------

export type NachweisRegisterZeile = {
  pruefbogen: string
  aufgabe: string
  kategorie: string
  faelligAm: Date
  erfasstVon: string
  erfasstAm: Date
  geprueftVon: string
  geprueftAm: Date | null
  vierAugen: boolean
  anzahlPunkte: number
  anzahlZeilen: number
  anzahlFeststellungen: number
  anzahlBelege: number
  /** Prüfsumme des erzeugten PDF-Nachweises */
  pruefsumme: string
  /** Feststellungen im Klartext für den Detailteil */
  feststellungen: string[]
}

/**
 * Alle abgeschlossenen Prüfnachweise eines Zeitraums.
 *
 * Bewusst nur gegengezeichnete: Ein Entwurf ist kein Nachweis. Maßgeblich ist
 * der Zeitpunkt der Gegenzeichnung, denn das ist der Moment, in dem der
 * Nachweis gültig wurde.
 */
export async function ladeNachweisregister(
  zeitraum: Zeitraum,
  kategorieIds: string[],
): Promise<NachweisRegisterZeile[]> {
  const nachweise = await prisma.nachweis.findMany({
    where: {
      status: 'GEGENGEZEICHNET',
      geprueftAm: {
        gte: zeitraum.von,
        lte: naechsterTagesbeginn(zeitraum.bis),
      },
      occurrence: { task: kategorieFilter(kategorieIds) },
    },
    orderBy: { geprueftAm: 'desc' },
    include: {
      vorlage: { include: { punkte: { orderBy: { position: 'asc' } } } },
      antworten: true,
      zeilen: { orderBy: [{ punktId: 'asc' }, { position: 'asc' }] },
      erfasstBy: { select: { name: true } },
      geprueftBy: { select: { name: true } },
      attachment: { select: { sha256: true } },
      _count: { select: { belege: true } },
      occurrence: {
        select: {
          dueDate: true,
          task: { select: { title: true, category: { select: { name: true } } } },
        },
      },
    },
  })

  return nachweise.map((nachweis) => {
    const punkte = nachweis.vorlage.punkte.map((p) => ({
      id: p.id,
      position: p.position,
      frage: p.frage,
      art: p.art as Pruefpunkt['art'],
      pflicht: p.pflicht,
    }))
    const antworten = nachweis.antworten.map((a) => ({
      punktId: a.punktId,
      ergebnis: (a.ergebnis as PruefpunktErgebnis | null) ?? null,
      wert: a.wert,
    }))
    const zeilen = nachweis.zeilen.map((z) => ({
      id: z.id,
      punktId: z.punktId,
      position: z.position,
      bezeichnung: z.bezeichnung,
      zusatz: z.zusatz,
      ergebnis: (z.ergebnis as PruefpunktErgebnis | null) ?? null,
      bemerkung: z.bemerkung,
    }))

    // Ein Befund kann an einem Prüfpunkt hängen oder an einer einzelnen Zeile
    // einer Liste – beides zählt gleichermaßen als Feststellung.
    const ausPunkten = auffaelligePunkte(punkte, antworten).map(
      (eintrag) =>
        `${eintrag.punkt.position}. ${eintrag.punkt.frage} – ${
          PRUEFERGEBNIS_BEZEICHNUNG[eintrag.antwort.ergebnis!]
        }`,
    )
    const ausZeilen = auffaelligeZeilen(zeilen).map((zeile) => {
      const bezeichnung = zeile.zusatz
        ? `${zeile.bezeichnung} · ${zeile.zusatz}`
        : zeile.bezeichnung
      return `${bezeichnung} – ${PRUEFERGEBNIS_BEZEICHNUNG[zeile.ergebnis!]}${
        zeile.bemerkung ? ` (${zeile.bemerkung})` : ''
      }`
    })

    return {
      pruefbogen: nachweis.vorlage.name,
      aufgabe: nachweis.occurrence.task.title,
      kategorie: nachweis.occurrence.task.category.name,
      faelligAm: nachweis.occurrence.dueDate,
      erfasstVon: nachweis.erfasstBy.name,
      erfasstAm: nachweis.erfasstAm,
      // Ohne Vier-Augen-Pflicht schließt die erfassende Person selbst ab; das
      // wird ausgewiesen, statt eine Gegenzeichnung vorzutäuschen.
      geprueftVon: nachweis.vorlage.vierAugen
        ? (nachweis.geprueftBy?.name ?? '–')
        : 'ohne Gegenzeichnung',
      geprueftAm: nachweis.geprueftAm,
      vierAugen: nachweis.vorlage.vierAugen,
      anzahlPunkte: punkte.length,
      anzahlZeilen: zeilen.length,
      anzahlFeststellungen: ausPunkten.length + ausZeilen.length,
      anzahlBelege: nachweis._count.belege,
      pruefsumme: nachweis.attachment?.sha256 ?? '',
      feststellungen: [...ausPunkten, ...ausZeilen],
    }
  })
}

/** Prozentwert für die Ausgabe, z. B. "92,3 %". */
export function formatiereProzent(anteil: number): string {
  return `${(anteil * 100).toLocaleString('de-DE', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`
}

/** Dateiname eines Exports, z. B. "wartungsplaner-compliance-2026-01-01_2026-12-31.pdf". */
export function baueDateiname(
  typ: ReportTyp,
  zeitraum: Zeitraum,
  endung: 'pdf' | 'xlsx',
): string {
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return `wartungsplaner-${typ}-${iso(zeitraum.von)}_${iso(zeitraum.bis)}.${endung}`
}

export { formatDate }
