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

/** Ist eine einzelne Antwort ausgefüllt? */
export function istBeantwortet(punkt: Pruefpunkt, antwort: Antwort | undefined): boolean {
  if (!antwort) return false

  if (punkt.art === 'BEWERTUNG' || punkt.art === 'ENTSCHEIDUNG') {
    return antwort.ergebnis !== null
  }
  return Boolean(antwort.wert && antwort.wert.trim().length > 0)
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
): Vollstaendigkeit {
  const nachPunkt = new Map(antworten.map((a) => [a.punktId, a]))
  const offene: number[] = []
  let beantwortet = 0

  for (const punkt of punkte) {
    const gefuellt = istBeantwortet(punkt, nachPunkt.get(punkt.id))
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

/** Kurzfassung des Ergebnisses für Übersichten. */
export function fasseErgebnisZusammen(
  punkte: Pruefpunkt[],
  antworten: Antwort[],
): string {
  const stand = pruefeVollstaendigkeit(punkte, antworten)
  const auffaellig = auffaelligePunkte(punkte, antworten).length

  if (auffaellig > 0) {
    return `${stand.beantwortet} von ${stand.gesamt} beantwortet, ${auffaellig} ${
      auffaellig === 1 ? 'Feststellung' : 'Feststellungen'
    }`
  }
  return `${stand.beantwortet} von ${stand.gesamt} beantwortet, ohne Feststellung`
}

/** Bereinigt den Titel bzw. Namen einer Vorlage oder eines Prüfpunkts. */
export function saeubereFrage(wert: string, maxLaenge = 300): string | null {
  const text = wert.replace(/\s+/g, ' ').trim().slice(0, maxLaenge)
  return text.length >= 3 ? text : null
}
