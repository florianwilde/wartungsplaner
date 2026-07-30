/**
 * Nachweismodul: Ablauf und Prüfregeln.
 *
 * Reine Funktionen ohne Datenbank. Der Ablauf eines Prüfbogens ist der Kern
 * des Vier-Augen-Prinzips – ein Fehler hier würde die Aussagekraft des
 * Nachweises zerstören. Deshalb ist er vollständig durch Tests abgedeckt.
 *
 * Ablauf:
 *
 *   ENTWURF ──vorlegen──► VORGELEGT ──gegenzeichnen──► GEGENGEZEICHNET
 *      ▲                       │
 *      └───zurückweisen────────┘  (ZURUECKGEWIESEN, danach wieder änderbar)
 *
 * Ohne Vier-Augen-Pflicht führt „abschließen“ direkt von ENTWURF nach
 * GEGENGEZEICHNET; erfassende und prüfende Person sind dann dieselbe.
 */

export type NachweisStatus =
  | 'ENTWURF'
  | 'VORGELEGT'
  | 'GEGENGEZEICHNET'
  | 'ZURUECKGEWIESEN'

export type PruefpunktArt =
  | 'BEWERTUNG'
  | 'TEXT'
  | 'ZAHL'
  | 'DATUM'
  | 'ENTSCHEIDUNG'
  /** Viele gleichartige Zeilen mit derselben Frage – je Zeile eine Entscheidung */
  | 'LISTE'

export type PruefpunktErgebnis =
  | 'ERFUELLT'
  | 'NICHT_ERFUELLT'
  | 'ENTFAELLT'
  | 'BELASSEN'
  | 'ENTZIEHEN'
  | 'AENDERN'

export const STATUS_BEZEICHNUNG: Record<NachweisStatus, string> = {
  ENTWURF: 'Entwurf',
  VORGELEGT: 'Zur Prüfung vorgelegt',
  GEGENGEZEICHNET: 'Gegengezeichnet',
  ZURUECKGEWIESEN: 'Zurückgewiesen',
}

export const ART_BEZEICHNUNG: Record<PruefpunktArt, string> = {
  BEWERTUNG: 'Bewertung (erfüllt / nicht erfüllt / entfällt)',
  TEXT: 'Freitext',
  ZAHL: 'Zahl',
  DATUM: 'Datum',
  ENTSCHEIDUNG: 'Entscheidung (belassen / entziehen / ändern)',
  LISTE: 'Zeilenliste (je Zeile belassen / entziehen / ändern)',
}

export const ERGEBNIS_BEZEICHNUNG: Record<PruefpunktErgebnis, string> = {
  ERFUELLT: 'Erfüllt',
  NICHT_ERFUELLT: 'Nicht erfüllt',
  ENTFAELLT: 'Entfällt',
  BELASSEN: 'Belassen',
  ENTZIEHEN: 'Entziehen',
  AENDERN: 'Ändern',
}

/** Welche Ergebnisse sind bei welcher Art eines Prüfpunkts zulässig? */
export const ERLAUBTE_ERGEBNISSE: Record<PruefpunktArt, PruefpunktErgebnis[]> = {
  BEWERTUNG: ['ERFUELLT', 'NICHT_ERFUELLT', 'ENTFAELLT'],
  ENTSCHEIDUNG: ['BELASSEN', 'ENTZIEHEN', 'AENDERN'],
  LISTE: ['BELASSEN', 'ENTZIEHEN', 'AENDERN'],
  TEXT: [],
  ZAHL: [],
  DATUM: [],
}

/** Ergebnisse, die eine Feststellung bedeuten und eine Maßnahme verlangen. */
export const AUFFAELLIGE_ERGEBNISSE: PruefpunktErgebnis[] = [
  'NICHT_ERFUELLT',
  'ENTZIEHEN',
  'AENDERN',
]

/** Ist ein Nachweis in diesem Zustand noch änderbar? */
export function istAenderbar(status: NachweisStatus): boolean {
  return status === 'ENTWURF' || status === 'ZURUECKGEWIESEN'
}

/** Ist ein Nachweis endgültig und damit unveränderlich? */
export function istAbgeschlossen(status: NachweisStatus): boolean {
  return status === 'GEGENGEZEICHNET'
}

export type Uebergang = 'vorlegen' | 'gegenzeichnen' | 'zurueckweisen' | 'abschliessen'

export type UebergangsPruefung =
  | { erlaubt: true; neuerStatus: NachweisStatus }
  | { erlaubt: false; grund: string }

export type UebergangsEingabe = {
  status: NachweisStatus
  /** Verlangt die Vorlage eine Gegenzeichnung? */
  vierAugen: boolean
  /** Person, die den Übergang auslöst */
  handelnderId: string
  /** Person, die den Bogen ausgefüllt hat */
  erfasstById: string
  /** Sind alle Pflichtangaben ausgefüllt? */
  vollstaendig: boolean
}

/**
 * Prüft einen Zustandswechsel.
 *
 * Die entscheidende Regel: Bei Vier-Augen-Pflicht darf die gegenzeichnende
 * Person nicht die erfassende sein. Ohne diese Prüfung wäre das Verfahren
 * wertlos.
 */
export function pruefeUebergang(
  uebergang: Uebergang,
  eingabe: UebergangsEingabe,
): UebergangsPruefung {
  const { status, vierAugen, handelnderId, erfasstById, vollstaendig } = eingabe

  switch (uebergang) {
    case 'vorlegen': {
      if (!vierAugen) {
        return {
          erlaubt: false,
          grund:
            'Für diesen Prüfbogen ist keine Gegenzeichnung vorgesehen. Er lässt sich direkt abschließen.',
        }
      }
      if (!istAenderbar(status)) {
        return {
          erlaubt: false,
          grund: `Ein Nachweis im Zustand „${STATUS_BEZEICHNUNG[status]}“ kann nicht vorgelegt werden.`,
        }
      }
      if (handelnderId !== erfasstById) {
        return {
          erlaubt: false,
          grund: 'Nur die erfassende Person kann den Nachweis vorlegen.',
        }
      }
      if (!vollstaendig) {
        return {
          erlaubt: false,
          grund: 'Es sind noch nicht alle Pflichtangaben ausgefüllt.',
        }
      }
      return { erlaubt: true, neuerStatus: 'VORGELEGT' }
    }

    case 'gegenzeichnen': {
      if (status !== 'VORGELEGT') {
        return {
          erlaubt: false,
          grund: 'Es kann nur ein vorgelegter Nachweis gegengezeichnet werden.',
        }
      }
      if (handelnderId === erfasstById) {
        return {
          erlaubt: false,
          grund:
            'Das Vier-Augen-Prinzip verlangt, dass eine zweite Person gegenzeichnet.',
        }
      }
      return { erlaubt: true, neuerStatus: 'GEGENGEZEICHNET' }
    }

    case 'zurueckweisen': {
      if (status !== 'VORGELEGT') {
        return {
          erlaubt: false,
          grund: 'Es kann nur ein vorgelegter Nachweis zurückgewiesen werden.',
        }
      }
      if (handelnderId === erfasstById) {
        return {
          erlaubt: false,
          grund: 'Die erfassende Person kann den eigenen Nachweis nicht zurückweisen.',
        }
      }
      return { erlaubt: true, neuerStatus: 'ZURUECKGEWIESEN' }
    }

    case 'abschliessen': {
      if (vierAugen) {
        return {
          erlaubt: false,
          grund:
            'Dieser Prüfbogen verlangt eine Gegenzeichnung. Bitte legen Sie ihn zur Prüfung vor.',
        }
      }
      if (!istAenderbar(status)) {
        return {
          erlaubt: false,
          grund: `Ein Nachweis im Zustand „${STATUS_BEZEICHNUNG[status]}“ kann nicht abgeschlossen werden.`,
        }
      }
      if (handelnderId !== erfasstById) {
        return {
          erlaubt: false,
          grund: 'Nur die erfassende Person kann den Nachweis abschließen.',
        }
      }
      if (!vollstaendig) {
        return {
          erlaubt: false,
          grund: 'Es sind noch nicht alle Pflichtangaben ausgefüllt.',
        }
      }
      return { erlaubt: true, neuerStatus: 'GEGENGEZEICHNET' }
    }
  }
}

// ---------------------------------------------------------------------------
// Antworten
// ---------------------------------------------------------------------------

export type Pruefpunkt = {
  id: string
  position: number
  frage: string
  art: PruefpunktArt
  pflicht: boolean
}

export type Antwort = {
  punktId: string
  ergebnis: PruefpunktErgebnis | null
  wert: string | null
}

/**
 * Eine Zeile einer Zeilenliste – etwa ein Konto aus einem AD-Export.
 *
 * Die Zeilen gehören zum einzelnen Nachweis, nicht zur Vorlage: Welche Konten
 * es gibt, entscheidet sich erst beim Prüfen.
 */
export type Zeile = {
  id: string
  punktId: string
  position: number
  /** Erste Spalte, etwa der Anmeldename */
  bezeichnung: string
  /** Zweite Spalte, etwa Gruppe oder Abteilung */
  zusatz: string | null
  ergebnis: PruefpunktErgebnis | null
  bemerkung: string | null
}

/** Ist eine einzelne Antwort ausgefüllt? */
export function istBeantwortet(
  punkt: Pruefpunkt,
  antwort: Antwort | undefined,
  zeilen: Zeile[] = [],
): boolean {
  if (punkt.art === 'LISTE') {
    // Eine leere Liste gilt als unbeantwortet: Ein Prüfbogen ohne geprüfte
    // Zeilen belegt nichts. Sonst muss jede Zeile entschieden sein.
    const eigene = zeilen.filter((z) => z.punktId === punkt.id)
    return eigene.length > 0 && eigene.every((z) => z.ergebnis !== null)
  }

  if (!antwort) return false

  if (punkt.art === 'BEWERTUNG' || punkt.art === 'ENTSCHEIDUNG') {
    return antwort.ergebnis !== null
  }
  return Boolean(antwort.wert && antwort.wert.trim().length > 0)
}

/** Zeilen eines Prüfpunkts, nach Position sortiert. */
export function zeilenVon(zeilen: Zeile[], punktId: string): Zeile[] {
  return zeilen
    .filter((z) => z.punktId === punktId)
    .sort((a, b) => a.position - b.position)
}

export type ZeilenStand = {
  gesamt: number
  entschieden: number
  offen: number
  /** Zeilen mit Befund – belassen zählt nicht dazu */
  auffaellig: number
}

export function zaehleZeilen(zeilen: Zeile[]): ZeilenStand {
  const entschieden = zeilen.filter((z) => z.ergebnis !== null).length
  return {
    gesamt: zeilen.length,
    entschieden,
    offen: zeilen.length - entschieden,
    auffaellig: zeilen.filter(
      (z) => z.ergebnis && AUFFAELLIGE_ERGEBNISSE.includes(z.ergebnis),
    ).length,
  }
}

/**
 * Wendet eine Sammelentscheidung auf alle noch offenen Zeilen an.
 *
 * Bei einer Rezertifizierung ist die überwiegende Mehrheit der Einträge in
 * Ordnung. Ohne diesen Griff müsste man achtzig Mal dasselbe auswählen, um an
 * die drei Ausnahmen zu kommen – bereits entschiedene Zeilen bleiben deshalb
 * unangetastet.
 */
export function wendeSammelentscheidungAn(
  zeilen: Zeile[],
  ergebnis: PruefpunktErgebnis,
): Zeile[] {
  return zeilen.map((zeile) =>
    zeile.ergebnis === null ? { ...zeile, ergebnis } : zeile,
  )
}

export type Vollstaendigkeit = {
  vollstaendig: boolean
  /** Positionen der offenen Pflichtangaben */
  offenePflichtpunkte: number[]
  beantwortet: number
  gesamt: number
}

/** Prüft, ob alle Pflichtangaben ausgefüllt sind. */
export function pruefeVollstaendigkeit(
  punkte: Pruefpunkt[],
  antworten: Antwort[],
  zeilen: Zeile[] = [],
): Vollstaendigkeit {
  const nachPunkt = new Map(antworten.map((a) => [a.punktId, a]))
  const offene: number[] = []
  let beantwortet = 0

  for (const punkt of punkte) {
    const gefuellt = istBeantwortet(punkt, nachPunkt.get(punkt.id), zeilen)
    if (gefuellt) beantwortet++
    else if (punkt.pflicht) offene.push(punkt.position)
  }

  return {
    vollstaendig: offene.length === 0,
    offenePflichtpunkte: offene.sort((a, b) => a - b),
    beantwortet,
    gesamt: punkte.length,
  }
}

/**
 * Prüft, ob ein Ergebnis zur Art des Prüfpunkts passt.
 * Verhindert etwa „Entziehen“ bei einer einfachen Bewertung.
 */
export function ergebnisPasst(
  art: PruefpunktArt,
  ergebnis: PruefpunktErgebnis | null,
): boolean {
  if (ergebnis === null) return true
  return ERLAUBTE_ERGEBNISSE[art].includes(ergebnis)
}

/** Prüfpunkte mit auffälligem Ergebnis – Grundlage für Abweichungen. */
export function auffaelligePunkte(
  punkte: Pruefpunkt[],
  antworten: Antwort[],
): { punkt: Pruefpunkt; antwort: Antwort }[] {
  const nachPunkt = new Map(antworten.map((a) => [a.punktId, a]))

  return punkte
    .map((punkt) => ({ punkt, antwort: nachPunkt.get(punkt.id) }))
    .filter(
      (eintrag): eintrag is { punkt: Pruefpunkt; antwort: Antwort } =>
        Boolean(
          eintrag.antwort?.ergebnis &&
            AUFFAELLIGE_ERGEBNISSE.includes(eintrag.antwort.ergebnis),
        ),
    )
}

/** Einzelne Zeilen mit Befund – je Zeile eine mögliche Maßnahme. */
export function auffaelligeZeilen(zeilen: Zeile[]): Zeile[] {
  return zeilen
    .filter((z) => z.ergebnis && AUFFAELLIGE_ERGEBNISSE.includes(z.ergebnis))
    .sort((a, b) => a.position - b.position)
}

/** Kurzfassung des Ergebnisses für Übersichten. */
export function fasseErgebnisZusammen(
  punkte: Pruefpunkt[],
  antworten: Antwort[],
  zeilen: Zeile[] = [],
): string {
  const stand = pruefeVollstaendigkeit(punkte, antworten, zeilen)
  const auffaellig =
    auffaelligePunkte(punkte, antworten).length + auffaelligeZeilen(zeilen).length

  if (auffaellig > 0) {
    return `${stand.beantwortet} von ${stand.gesamt} beantwortet, ${auffaellig} ${
      auffaellig === 1 ? 'Feststellung' : 'Feststellungen'
    }`
  }
  return `${stand.beantwortet} von ${stand.gesamt} beantwortet, ohne Feststellung`
}

// ---------------------------------------------------------------------------
// Zeilen aus einer CSV-Datei übernehmen
// ---------------------------------------------------------------------------

/** Höchstzahl an Zeilen je Prüfpunkt. */
export const MAX_ZEILEN = 2000

export type ZeilenEntwurf = {
  bezeichnung: string
  zusatz: string | null
}

export type ZeilenUebernahme = {
  zeilen: ZeilenEntwurf[]
  /** Übersprungene Zeilen mit Grund, damit nichts stillschweigend entfällt */
  uebersprungen: { zeile: number; grund: string }[]
  /** Wurde die erste Zeile als Kopfzeile gewertet? */
  kopfzeileErkannt: boolean
}

/** Erkennt das Trennzeichen anhand der ersten Zeile: Semikolon oder Komma. */
function trennzeichenVon(text: string): string {
  const erste = text.split(/\r?\n/, 1)[0] ?? ''
  const semikolon = (erste.match(/;/g) ?? []).length
  const komma = (erste.match(/,/g) ?? []).length
  const tab = (erste.match(/\t/g) ?? []).length
  if (tab > semikolon && tab > komma) return '\t'
  return komma > semikolon ? ',' : ';'
}

/** Zerlegt eine CSV-Zeile unter Beachtung von Anführungszeichen. */
function zerlegeZeile(zeile: string, trenner: string): string[] {
  const felder: string[] = []
  let aktuell = ''
  let inAnfuehrung = false

  for (let i = 0; i < zeile.length; i++) {
    const zeichen = zeile[i]

    if (inAnfuehrung) {
      if (zeichen === '"') {
        if (zeile[i + 1] === '"') {
          aktuell += '"'
          i++
        } else {
          inAnfuehrung = false
        }
      } else {
        aktuell += zeichen
      }
    } else if (zeichen === '"') {
      inAnfuehrung = true
    } else if (zeichen === trenner) {
      felder.push(aktuell)
      aktuell = ''
    } else {
      aktuell += zeichen
    }
  }

  felder.push(aktuell)
  return felder.map((f) => f.trim())
}

/**
 * Sieht die erste Zeile nach einer Kopfzeile aus?
 *
 * Maßgeblich ist allein die erste Spalte. Zöge man alle Spalten heran, würde
 * eine echte Datenzeile verschluckt, sobald in einer hinteren Spalte zufällig
 * „Gruppe“ steht – ein stillschweigend verlorenes Konto wäre schlimmer als
 * eine überzählige Zeile, die auffällt und sich löschen lässt.
 */
function istKopfzeile(felder: string[]): boolean {
  const bekannt = [
    'name',
    'bezeichnung',
    'konto',
    'benutzer',
    'benutzername',
    'anmeldename',
    'samaccountname',
    'login',
    'person',
    'gruppe',
    'system',
    'regel',
    'transponder',
  ]
  const erste = (felder[0] ?? '').toLowerCase().replace(/\s+/g, '')
  return bekannt.includes(erste)
}

/**
 * Übernimmt Zeilen aus einer CSV-Datei.
 *
 * Erwartet wird die erste Spalte als Bezeichnung und optional eine zweite als
 * Zusatz; weitere Spalten werden angehängt. Semikolon, Komma und Tabulator
 * werden erkannt, eine Kopfzeile ebenfalls – ein AD-Export lässt sich damit
 * unverändert einlesen.
 */
export function uebernehmeZeilenAusCsv(
  inhalt: string,
  bereitsVorhanden = 0,
): ZeilenUebernahme {
  const ohneBom = inhalt.replace(/^﻿/, '')
  const trenner = trennzeichenVon(ohneBom)
  const roheZeilen = ohneBom.split(/\r?\n/)

  const zeilen: ZeilenEntwurf[] = []
  const uebersprungen: { zeile: number; grund: string }[] = []
  const gesehen = new Set<string>()
  let kopfzeileErkannt = false

  for (let index = 0; index < roheZeilen.length; index++) {
    const roh = roheZeilen[index]
    if (roh.trim() === '') continue

    const felder = zerlegeZeile(roh, trenner)

    if (index === 0 && istKopfzeile(felder)) {
      kopfzeileErkannt = true
      continue
    }

    const bezeichnung = felder[0]?.trim() ?? ''
    if (!bezeichnung) {
      uebersprungen.push({ zeile: index + 1, grund: 'ohne Bezeichnung' })
      continue
    }

    const zusatzFelder = felder.slice(1).filter((f) => f !== '')
    const zusatz = zusatzFelder.length > 0 ? zusatzFelder.join(' · ').slice(0, 300) : null

    // Doppelte Einträge würden eine Rezertifizierung aufblähen und die
    // Auswertung verfälschen.
    const schluessel = `${bezeichnung.toLowerCase()}|${(zusatz ?? '').toLowerCase()}`
    if (gesehen.has(schluessel)) {
      uebersprungen.push({ zeile: index + 1, grund: 'doppelter Eintrag' })
      continue
    }
    gesehen.add(schluessel)

    if (bereitsVorhanden + zeilen.length >= MAX_ZEILEN) {
      uebersprungen.push({
        zeile: index + 1,
        grund: `Höchstzahl von ${MAX_ZEILEN} Zeilen erreicht`,
      })
      continue
    }

    zeilen.push({ bezeichnung: bezeichnung.slice(0, 300), zusatz })
  }

  return { zeilen, uebersprungen, kopfzeileErkannt }
}

/** Bereinigt den Titel bzw. Namen einer Vorlage oder eines Prüfpunkts. */
export function saeubereFrage(wert: string, maxLaenge = 300): string | null {
  const text = wert.replace(/\s+/g, ' ').trim().slice(0, maxLaenge)
  return text.length >= 3 ? text : null
}
