/**
 * Bewertung eines Integritätslaufs über die abgelegten Nachweise.
 *
 * Reine Funktionen ohne Datenbank und Dateisystem. Die Anwendung verspricht
 * Revisionssicherheit über Prüfsummen – hier steht, wann dieses Versprechen
 * als eingehalten gilt und wie ein Befund einzuordnen ist.
 */

export type BefundArt =
  /** Eintrag in der Datenbank, Datei fehlt im Ablageverzeichnis */
  | 'FEHLEND'
  /** Datei vorhanden, aber der Inhalt stimmt nicht mehr mit der Prüfsumme */
  | 'ABWEICHEND'
  /** Datei im Ablageverzeichnis ohne Eintrag in der Datenbank */
  | 'VERWAIST'
  /** Datei vorhanden, aber nicht lesbar (Rechte, Datenträgerfehler) */
  | 'UNLESBAR'

export const BEFUND_BEZEICHNUNG: Record<BefundArt, string> = {
  FEHLEND: 'Datei fehlt',
  ABWEICHEND: 'Prüfsumme weicht ab',
  VERWAIST: 'Datei ohne Eintrag',
  UNLESBAR: 'Datei nicht lesbar',
}

export type Befund = {
  art: BefundArt
  /** Pfad im Ablageverzeichnis */
  pfad: string
  /** Anzeigename, soweit bekannt */
  dateiname: string | null
  /** Erwartete Prüfsumme laut Datenbank */
  erwartet: string | null
  /** Tatsächlich errechnete Prüfsumme */
  gefunden: string | null
}

export type LaufErgebnis = {
  geprueft: number
  fehlend: number
  abweichend: number
  verwaist: number
  unlesbar: number
  befunde: Befund[]
  dauerMs: number
}

/**
 * Ist die Nachweiskette unversehrt?
 *
 * Eine verwaiste Datei zählt bewusst nicht dagegen: Sie ist unordentlich,
 * aber kein Beleg fehlt und keiner wurde verändert. Fehlende, veränderte und
 * unlesbare Nachweise sind dagegen ein Schaden an der Beweiskraft.
 */
export function istUnversehrt(ergebnis: {
  fehlend: number
  abweichend: number
  unlesbar: number
}): boolean {
  return (
    ergebnis.fehlend === 0 && ergebnis.abweichend === 0 && ergebnis.unlesbar === 0
  )
}

/** Anzahl der Befunde, die die Beweiskraft betreffen. */
export function schwerwiegendeBefunde(ergebnis: {
  fehlend: number
  abweichend: number
  unlesbar: number
}): number {
  return ergebnis.fehlend + ergebnis.abweichend + ergebnis.unlesbar
}

/** Einzeilige Zusammenfassung für Protokoll und Übersicht. */
export function fasseLaufZusammen(ergebnis: LaufErgebnis): string {
  const teile = [
    `${ergebnis.geprueft} ${ergebnis.geprueft === 1 ? 'Nachweis' : 'Nachweise'} geprüft`,
  ]

  if (istUnversehrt(ergebnis)) {
    teile.push('alle unverändert')
  } else {
    if (ergebnis.fehlend > 0) teile.push(`${ergebnis.fehlend} fehlend`)
    if (ergebnis.abweichend > 0) teile.push(`${ergebnis.abweichend} verändert`)
    if (ergebnis.unlesbar > 0) teile.push(`${ergebnis.unlesbar} nicht lesbar`)
  }

  if (ergebnis.verwaist > 0) {
    teile.push(
      `${ergebnis.verwaist} ${ergebnis.verwaist === 1 ? 'verwaiste Datei' : 'verwaiste Dateien'}`,
    )
  }

  return `${teile.join(', ')} (${ergebnis.dauerMs} ms)`
}

/**
 * Höchstzahl gespeicherter Befunde je Lauf.
 *
 * Geht ein ganzes Ablageverzeichnis verloren, entstünden sonst zehntausende
 * Einträge in einem Datensatz. Die Zahlen bleiben vollständig; nur die
 * Einzelaufstellung wird gekappt.
 */
export const MAX_BEFUNDE = 200

export function kappeBefunde(befunde: Befund[]): {
  gespeichert: Befund[]
  gekappt: number
} {
  if (befunde.length <= MAX_BEFUNDE) {
    return { gespeichert: befunde, gekappt: 0 }
  }
  // Zuerst die schwerwiegenden: Sie sollen erhalten bleiben, wenn gekappt wird.
  const sortiert = [...befunde].sort(
    (a, b) => gewicht(a.art) - gewicht(b.art),
  )
  return {
    gespeichert: sortiert.slice(0, MAX_BEFUNDE),
    gekappt: befunde.length - MAX_BEFUNDE,
  }
}

function gewicht(art: BefundArt): number {
  switch (art) {
    case 'ABWEICHEND':
      return 0
    case 'FEHLEND':
      return 1
    case 'UNLESBAR':
      return 2
    case 'VERWAIST':
      return 3
  }
}
