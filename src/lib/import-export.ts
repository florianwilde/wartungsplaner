/**
 * Prüfung und Abgleich für den Import von Stammdaten.
 *
 * Reine Funktionen ohne Datenbank: Sie erhalten die vorhandenen Datensätze als
 * Parameter und liefern eine Vorschau, was angelegt, geändert oder
 * übersprungen würde. Dadurch lässt sich derselbe Code sowohl für die Anzeige
 * der Vorschau als auch für die abschließende Prüfung vor dem Schreiben
 * verwenden – und vollständig testen.
 *
 * Zuordnung erfolgt über einen fachlichen Schlüssel (Kategoriename,
 * Aufgabentitel, E-Mail-Adresse), nicht über technische IDs. So bleiben
 * Daten zwischen Installationen übertragbar.
 */
import { leseJaNein, type CsvZeile } from '@/lib/csv'
import { parseISODate, toISODate } from '@/lib/dates'
import { normalisiereHex } from '@/lib/farben'

export type ImportArt = 'kategorien' | 'aufgaben' | 'benutzer'

export const IMPORT_BEZEICHNUNG: Record<ImportArt, string> = {
  kategorien: 'Kategorien',
  aufgaben: 'Aufgaben',
  benutzer: 'Benutzer',
}

/** Höchstzahl Zeilen je Import – schützt vor versehentlich riesigen Dateien. */
export const MAX_ZEILEN = 2000

export type Vorgang = 'anlegen' | 'aktualisieren' | 'unveraendert'

export type ImportFehler = {
  /** Zeilennummer in der Datei, Kopfzeile ist Zeile 1 */
  zeile: number
  spalte?: string
  meldung: string
}

export type ImportEintrag<T> = {
  zeile: number
  schluessel: string
  vorgang: Vorgang
  daten: T
  /** Bei "aktualisieren": welche Felder sich ändern */
  aenderungen: string[]
}

export type ImportVorschau<T> = {
  art: ImportArt
  eintraege: ImportEintrag<T>[]
  fehler: ImportFehler[]
  anlegen: number
  aktualisieren: number
  unveraendert: number
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export type KategorieDaten = {
  name: string
  color: string
  sortOrder: number
}

export const KATEGORIE_SPALTEN = ['name', 'farbe', 'reihenfolge'] as const

export function pruefeKategorien(
  zeilen: CsvZeile[],
  vorhandene: KategorieDaten[],
): ImportVorschau<KategorieDaten> {
  const fehler: ImportFehler[] = []
  const eintraege: ImportEintrag<KategorieDaten>[] = []
  const gesehen = new Set<string>()

  const bestand = new Map(vorhandene.map((k) => [k.name.toLowerCase(), k]))

  zeilen.forEach((zeile, index) => {
    const zeilennummer = index + 2 // Kopfzeile ist Zeile 1

    const name = (zeile.name ?? '').trim()
    if (name.length < 2) {
      fehler.push({
        zeile: zeilennummer,
        spalte: 'name',
        meldung: 'Der Name muss mindestens 2 Zeichen haben.',
      })
      return
    }
    if (name.length > 80) {
      fehler.push({
        zeile: zeilennummer,
        spalte: 'name',
        meldung: 'Der Name darf höchstens 80 Zeichen haben.',
      })
      return
    }

    const schluessel = name.toLowerCase()
    if (gesehen.has(schluessel)) {
      fehler.push({
        zeile: zeilennummer,
        spalte: 'name',
        meldung: `„${name}“ kommt in der Datei mehrfach vor.`,
      })
      return
    }
    gesehen.add(schluessel)

    const farbe = normalisiereHex((zeile.farbe ?? '').trim() || '#64748b')
    if (!farbe) {
      fehler.push({
        zeile: zeilennummer,
        spalte: 'farbe',
        meldung: 'Die Farbe muss im Format #rrggbb angegeben werden.',
      })
      return
    }

    const rohReihenfolge = (zeile.reihenfolge ?? '').trim()
    const reihenfolge = rohReihenfolge === '' ? 0 : Number(rohReihenfolge)
    if (!Number.isInteger(reihenfolge) || reihenfolge < 0 || reihenfolge > 9999) {
      fehler.push({
        zeile: zeilennummer,
        spalte: 'reihenfolge',
        meldung: 'Die Reihenfolge muss eine ganze Zahl zwischen 0 und 9999 sein.',
      })
      return
    }

    const daten: KategorieDaten = { name, color: farbe, sortOrder: reihenfolge }
    const alt = bestand.get(schluessel)

    if (!alt) {
      eintraege.push({
        zeile: zeilennummer,
        schluessel: name,
        vorgang: 'anlegen',
        daten,
        aenderungen: [],
      })
      return
    }

    const aenderungen: string[] = []
    if (alt.color !== daten.color) aenderungen.push('Farbe')
    if (alt.sortOrder !== daten.sortOrder) aenderungen.push('Reihenfolge')
    if (alt.name !== daten.name) aenderungen.push('Schreibweise')

    eintraege.push({
      zeile: zeilennummer,
      schluessel: name,
      vorgang: aenderungen.length > 0 ? 'aktualisieren' : 'unveraendert',
      daten,
      aenderungen,
    })
  })

  return fasseZusammen('kategorien', eintraege, fehler)
}

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

export type AufgabeDaten = {
  title: string
  description: string | null
  instructionsMd: string | null
  kategorieName: string
  verantwortlichEmail: string
  intervalType: string
  intervalValue: number | null
  scheduleMode: string
  startDate: string
  leadTimeDays: number
  graceDays: number
  evidenceRequired: boolean
  criticality: string
  /** Anzeigenamen der zugeordneten Referenzen, mit Komma getrennt */
  auditReferenzen: string
  active: boolean
}

export const AUFGABE_SPALTEN = [
  'titel',
  'beschreibung',
  'kategorie',
  'verantwortlich',
  'intervall',
  'intervalltage',
  'rhythmus',
  'startdatum',
  'vorlauftage',
  'karenztage',
  'nachweispflicht',
  'kritikalitaet',
  'auditreferenzen',
  'aktiv',
  'pruefanleitung',
] as const

const INTERVALLE = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'EVERY_N_DAYS',
]
const RHYTHMEN = ['FIXED', 'AFTER_COMPLETION']
const KRITIKALITAETEN = ['LOW', 'MEDIUM', 'HIGH']

export type AufgabenBestand = {
  title: string
  kategorieName: string
  verantwortlichEmail: string
  intervalType: string
  intervalValue: number | null
  scheduleMode: string
  startDate: string
  leadTimeDays: number
  graceDays: number
  evidenceRequired: boolean
  criticality: string
  auditReferenzen: string
  active: boolean
  description: string | null
  instructionsMd: string | null
}

export function pruefeAufgaben(
  zeilen: CsvZeile[],
  vorhandene: AufgabenBestand[],
  kategorienNamen: string[],
  benutzerEmails: string[],
): ImportVorschau<AufgabeDaten> {
  const fehler: ImportFehler[] = []
  const eintraege: ImportEintrag<AufgabeDaten>[] = []
  const gesehen = new Set<string>()

  const bestand = new Map(vorhandene.map((a) => [a.title.toLowerCase(), a]))
  const kategorien = new Set(kategorienNamen.map((n) => n.toLowerCase()))
  const benutzer = new Set(benutzerEmails.map((e) => e.toLowerCase()))

  zeilen.forEach((zeile, index) => {
    const zeilennummer = index + 2
    const melde = (spalte: string, meldung: string) =>
      fehler.push({ zeile: zeilennummer, spalte, meldung })

    const titel = (zeile.titel ?? '').trim()
    if (titel.length < 3) {
      melde('titel', 'Der Titel muss mindestens 3 Zeichen haben.')
      return
    }
    if (titel.length > 200) {
      melde('titel', 'Der Titel darf höchstens 200 Zeichen haben.')
      return
    }

    const schluessel = titel.toLowerCase()
    if (gesehen.has(schluessel)) {
      melde('titel', `„${titel}“ kommt in der Datei mehrfach vor.`)
      return
    }
    gesehen.add(schluessel)

    const kategorie = (zeile.kategorie ?? '').trim()
    if (!kategorien.has(kategorie.toLowerCase())) {
      melde(
        'kategorie',
        `Die Kategorie „${kategorie}“ ist nicht vorhanden. Bitte zuerst die Kategorien importieren.`,
      )
      return
    }

    const verantwortlich = (zeile.verantwortlich ?? '').trim().toLowerCase()
    if (!benutzer.has(verantwortlich)) {
      melde(
        'verantwortlich',
        `Zur E-Mail-Adresse „${verantwortlich}“ gibt es kein aktives Konto.`,
      )
      return
    }

    const intervall = (zeile.intervall ?? '').trim().toUpperCase()
    if (!INTERVALLE.includes(intervall)) {
      melde('intervall', `Unbekanntes Intervall. Erlaubt: ${INTERVALLE.join(', ')}`)
      return
    }

    const rohIntervalltage = (zeile.intervalltage ?? '').trim()
    let intervalltage: number | null = null
    if (intervall === 'EVERY_N_DAYS') {
      intervalltage = Number(rohIntervalltage)
      if (!Number.isInteger(intervalltage) || intervalltage < 1 || intervalltage > 3650) {
        melde(
          'intervalltage',
          'Für EVERY_N_DAYS wird eine ganze Zahl zwischen 1 und 3650 benötigt.',
        )
        return
      }
    }

    const rhythmus = ((zeile.rhythmus ?? '').trim() || 'FIXED').toUpperCase()
    if (!RHYTHMEN.includes(rhythmus)) {
      melde('rhythmus', `Unbekannter Rhythmus. Erlaubt: ${RHYTHMEN.join(', ')}`)
      return
    }

    const rohStart = (zeile.startdatum ?? '').trim()
    let startdatum: string
    try {
      startdatum = toISODate(parseISODate(rohStart))
    } catch {
      melde('startdatum', 'Das Startdatum muss im Format JJJJ-MM-TT angegeben werden.')
      return
    }

    const zahl = (spalte: string, wert: string, standard: number) => {
      const roh = wert.trim()
      if (roh === '') return standard
      const zahlwert = Number(roh)
      if (!Number.isInteger(zahlwert) || zahlwert < 0 || zahlwert > 365) {
        melde(spalte, 'Erwartet wird eine ganze Zahl zwischen 0 und 365.')
        return null
      }
      return zahlwert
    }

    const vorlauf = zahl('vorlauftage', zeile.vorlauftage ?? '', 7)
    const karenz = zahl('karenztage', zeile.karenztage ?? '', 0)
    if (vorlauf === null || karenz === null) return

    const kritikalitaet = ((zeile.kritikalitaet ?? '').trim() || 'MEDIUM').toUpperCase()
    if (!KRITIKALITAETEN.includes(kritikalitaet)) {
      melde(
        'kritikalitaet',
        `Unbekannte Kritikalität. Erlaubt: ${KRITIKALITAETEN.join(', ')}`,
      )
      return
    }

    const daten: AufgabeDaten = {
      title: titel,
      description: (zeile.beschreibung ?? '').trim() || null,
      instructionsMd: (zeile.pruefanleitung ?? '').trim() || null,
      kategorieName: kategorie,
      verantwortlichEmail: verantwortlich,
      intervalType: intervall,
      intervalValue: intervalltage,
      scheduleMode: rhythmus,
      startDate: startdatum,
      leadTimeDays: vorlauf,
      graceDays: karenz,
      evidenceRequired: leseJaNein(zeile.nachweispflicht ?? '', false),
      criticality: kritikalitaet,
      auditReferenzen: normalisiereReferenzliste(
        zeile.auditreferenzen ?? zeile.auditreferenz ?? '',
      ),
      active: leseJaNein(zeile.aktiv ?? '', true),
    }

    const alt = bestand.get(schluessel)
    if (!alt) {
      eintraege.push({
        zeile: zeilennummer,
        schluessel: titel,
        vorgang: 'anlegen',
        daten,
        aenderungen: [],
      })
      return
    }

    const aenderungen = vergleicheAufgabe(alt, daten)
    eintraege.push({
      zeile: zeilennummer,
      schluessel: titel,
      vorgang: aenderungen.length > 0 ? 'aktualisieren' : 'unveraendert',
      daten,
      aenderungen,
    })
  })

  return fasseZusammen('aufgaben', eintraege, fehler)
}

function vergleicheAufgabe(alt: AufgabenBestand, neu: AufgabeDaten): string[] {
  const aenderungen: string[] = []
  const pruefe = (bezeichnung: string, a: unknown, b: unknown) => {
    if (a !== b) aenderungen.push(bezeichnung)
  }

  pruefe('Kategorie', alt.kategorieName.toLowerCase(), neu.kategorieName.toLowerCase())
  pruefe('Verantwortlich', alt.verantwortlichEmail.toLowerCase(), neu.verantwortlichEmail)
  pruefe('Intervall', alt.intervalType, neu.intervalType)
  pruefe('Intervalltage', alt.intervalValue, neu.intervalValue)
  pruefe('Rhythmus', alt.scheduleMode, neu.scheduleMode)
  pruefe('Startdatum', alt.startDate, neu.startDate)
  pruefe('Vorlaufzeit', alt.leadTimeDays, neu.leadTimeDays)
  pruefe('Karenz', alt.graceDays, neu.graceDays)
  pruefe('Nachweispflicht', alt.evidenceRequired, neu.evidenceRequired)
  pruefe('Kritikalität', alt.criticality, neu.criticality)
  pruefe('Audit-Referenzen', alt.auditReferenzen, neu.auditReferenzen)
  pruefe('Aktiv', alt.active, neu.active)
  pruefe('Beschreibung', alt.description, neu.description)
  pruefe('Prüfanleitung', alt.instructionsMd, neu.instructionsMd)

  return aenderungen
}

// ---------------------------------------------------------------------------
// Benutzer
// ---------------------------------------------------------------------------

export type BenutzerDaten = {
  name: string
  email: string
  role: string
  authProvider: string
  active: boolean
  notifyByEmail: boolean
}

export const BENUTZER_SPALTEN = [
  'name',
  'email',
  'rolle',
  'anmeldeverfahren',
  'aktiv',
  'benachrichtigungen',
] as const

const ROLLEN = ['ADMIN', 'EDITOR', 'AUDITOR']
const VERFAHREN = ['LOCAL', 'OIDC']

/** Einfache Prüfung der E-Mail-Form – bewusst großzügig. */
function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert)
}

export function pruefeBenutzer(
  zeilen: CsvZeile[],
  vorhandene: BenutzerDaten[],
): ImportVorschau<BenutzerDaten> {
  const fehler: ImportFehler[] = []
  const eintraege: ImportEintrag<BenutzerDaten>[] = []
  const gesehen = new Set<string>()

  const bestand = new Map(vorhandene.map((b) => [b.email.toLowerCase(), b]))

  zeilen.forEach((zeile, index) => {
    const zeilennummer = index + 2
    const melde = (spalte: string, meldung: string) =>
      fehler.push({ zeile: zeilennummer, spalte, meldung })

    const email = (zeile.email ?? '').trim().toLowerCase()
    if (!istEmail(email)) {
      melde('email', 'Die E-Mail-Adresse ist ungültig.')
      return
    }
    if (gesehen.has(email)) {
      melde('email', `„${email}“ kommt in der Datei mehrfach vor.`)
      return
    }
    gesehen.add(email)

    const name = (zeile.name ?? '').trim()
    if (name.length < 2) {
      melde('name', 'Der Name muss mindestens 2 Zeichen haben.')
      return
    }

    const rolle = ((zeile.rolle ?? '').trim() || 'AUDITOR').toUpperCase()
    if (!ROLLEN.includes(rolle)) {
      melde('rolle', `Unbekannte Rolle. Erlaubt: ${ROLLEN.join(', ')}`)
      return
    }

    const verfahren = ((zeile.anmeldeverfahren ?? '').trim() || 'LOCAL').toUpperCase()
    if (!VERFAHREN.includes(verfahren)) {
      melde('anmeldeverfahren', `Unbekanntes Verfahren. Erlaubt: ${VERFAHREN.join(', ')}`)
      return
    }

    const daten: BenutzerDaten = {
      name,
      email,
      role: rolle,
      authProvider: verfahren,
      active: leseJaNein(zeile.aktiv ?? '', true),
      notifyByEmail: leseJaNein(zeile.benachrichtigungen ?? '', true),
    }

    const alt = bestand.get(email)
    if (!alt) {
      eintraege.push({
        zeile: zeilennummer,
        schluessel: email,
        vorgang: 'anlegen',
        daten,
        aenderungen: [],
      })
      return
    }

    const aenderungen: string[] = []
    if (alt.name !== daten.name) aenderungen.push('Name')
    if (alt.role !== daten.role) aenderungen.push('Rolle')
    if (alt.active !== daten.active) aenderungen.push('Aktiv')
    if (alt.notifyByEmail !== daten.notifyByEmail) aenderungen.push('Benachrichtigungen')
    // Das Anmeldeverfahren wird bewusst nicht geändert: Ein Wechsel würde ein
    // vorhandenes Passwort entwerten oder eine SSO-Verknüpfung zerstören.

    eintraege.push({
      zeile: zeilennummer,
      schluessel: email,
      vorgang: aenderungen.length > 0 ? 'aktualisieren' : 'unveraendert',
      daten,
      aenderungen,
    })
  })

  return fasseZusammen('benutzer', eintraege, fehler)
}

// ---------------------------------------------------------------------------
// Gemeinsames
// ---------------------------------------------------------------------------

function fasseZusammen<T>(
  art: ImportArt,
  eintraege: ImportEintrag<T>[],
  fehler: ImportFehler[],
): ImportVorschau<T> {
  return {
    art,
    eintraege,
    fehler,
    anlegen: eintraege.filter((e) => e.vorgang === 'anlegen').length,
    aktualisieren: eintraege.filter((e) => e.vorgang === 'aktualisieren').length,
    unveraendert: eintraege.filter((e) => e.vorgang === 'unveraendert').length,
  }
}

/**
 * Die Kennzahlen einer Vorschau – unabhängig davon, welche Art von Daten sie
 * enthält. Dadurch lassen sich die folgenden Funktionen auf jede Vorschau
 * anwenden, ohne den Datentyp zu kennen.
 */
export type VorschauKennzahlen = {
  fehler: ImportFehler[]
  anlegen: number
  aktualisieren: number
  unveraendert: number
}

/**
 * Darf der Import geschrieben werden?
 *
 * Bewusst streng: Ein einziger fehlerhafter Datensatz verhindert den gesamten
 * Lauf. Ein halb eingespielter Bestand wäre schlimmer als gar keiner.
 */
export function darfGeschriebenWerden(vorschau: VorschauKennzahlen): boolean {
  return (
    vorschau.fehler.length === 0 &&
    vorschau.anlegen + vorschau.aktualisieren > 0
  )
}

/** Kurzfassung der Vorschau für die Oberfläche. */
export function fasseVorschauZusammen(vorschau: VorschauKennzahlen): string {
  if (vorschau.fehler.length > 0) {
    return `${vorschau.fehler.length} ${
      vorschau.fehler.length === 1 ? 'Fehler' : 'Fehler'
    } – es wird nichts geschrieben.`
  }
  if (vorschau.anlegen + vorschau.aktualisieren === 0) {
    return 'Keine Änderungen: Alle Datensätze sind bereits auf diesem Stand.'
  }
  return (
    `${vorschau.anlegen} anlegen, ${vorschau.aktualisieren} aktualisieren, ` +
    `${vorschau.unveraendert} unverändert.`
  )
}

/**
 * Bringt eine Liste von Audit-Referenzen in eine vergleichbare Form.
 *
 * Reihenfolge und Leerraum sollen keinen Unterschied machen: Sonst meldete
 * der Abgleich eine Änderung, wo inhaltlich keine ist.
 */
export function normalisiereReferenzliste(wert: string): string {
  return [
    ...new Set(
      wert
        .split(',')
        .map((eintrag) => eintrag.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    ),
  ]
    .sort((a, b) => a.localeCompare(b, 'de'))
    .join(', ')
}
