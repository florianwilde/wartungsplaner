/**
 * Aufgaben duplizieren und in einem Zug ausrollen.
 *
 * Zehn Restore-Tests für zehn Systeme unterscheiden sich oft nur im Titel.
 * Der Import kann das seit 1.3.0, ist für drei Aufgaben aber zu umständlich.
 * Hier steht, wie aus einer Aufgabe mehrere werden – ohne Datenbank, damit
 * die Regeln prüfbar bleiben.
 */

/** Mehr als das ist kein Ausrollen mehr, sondern ein Import. */
export const MAX_KOPIEN = 25

const MIN_TITEL = 3
const MAX_TITEL = 200

export type TitelListe = { ok: true; titel: string[] } | { ok: false; fehler: string }

/**
 * Liest die eingegebenen Titel – einer je Zeile.
 *
 * Leere Zeilen fallen weg, Doppelte werden zusammengefasst: Wer eine Liste
 * aus einer Tabelle einfügt, hat schnell eine Leerzeile oder einen Eintrag
 * doppelt drin, und daran soll der Vorgang nicht scheitern.
 */
export function leseTitel(text: string): TitelListe {
  const zeilen = text
    .split(/\r?\n/)
    .map((zeile) => zeile.trim())
    .filter((zeile) => zeile.length > 0)

  if (zeilen.length === 0) {
    return { ok: false, fehler: 'Bitte mindestens einen Titel angeben.' }
  }

  const gesehen = new Set<string>()
  const titel: string[] = []

  for (const zeile of zeilen) {
    if (zeile.length < MIN_TITEL) {
      return {
        ok: false,
        fehler: `„${zeile}“ ist zu kurz – ein Titel braucht mindestens ${MIN_TITEL} Zeichen.`,
      }
    }
    if (zeile.length > MAX_TITEL) {
      return {
        ok: false,
        fehler: `„${zeile.slice(0, 40)}…“ ist länger als ${MAX_TITEL} Zeichen.`,
      }
    }

    const schluessel = zeile.toLocaleLowerCase('de-DE')
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    titel.push(zeile)
  }

  if (titel.length > MAX_KOPIEN) {
    return {
      ok: false,
      fehler: `Höchstens ${MAX_KOPIEN} Aufgaben auf einmal. Für mehr eignet sich der Import.`,
    }
  }

  return { ok: true, titel }
}

/**
 * Vorschlag für die Kopie einer Aufgabe.
 *
 * Wer zweimal dupliziert, soll nicht „X (Kopie) (Kopie)“ bekommen; ab der
 * zweiten wird durchgezählt.
 */
export function vorschlagFuerKopie(titel: string): string {
  const treffer = /^(.*) \(Kopie(?: (\d+))?\)$/.exec(titel.trim())
  if (!treffer) return `${titel.trim()} (Kopie)`

  const naechste = treffer[2] ? Number(treffer[2]) + 1 : 2
  return `${treffer[1]} (Kopie ${naechste})`
}

/**
 * Macht einen Namen eindeutig, indem eine Nummer angehängt wird.
 *
 * Prüfbogen-Vorlagen tragen einen eindeutigen Namen; beim Ausrollen auf zehn
 * Systeme muss also jede Kopie ihren eigenen bekommen.
 */
export function eindeutigerName(
  basis: string,
  vergeben: Set<string>,
  maxLaenge = 200,
): string {
  // Erst kürzen, dann vergleichen: Sonst gilt ein Name als frei, der nach dem
  // Kürzen doch mit einem vorhandenen zusammenfällt.
  const gekuerzt = basis.slice(0, maxLaenge)
  if (!vergeben.has(gekuerzt)) return gekuerzt

  for (let nummer = 2; nummer < 1000; nummer++) {
    const zusatz = ` (${nummer})`
    const kandidat = `${basis.slice(0, maxLaenge - zusatz.length)}${zusatz}`
    if (!vergeben.has(kandidat)) return kandidat
  }

  // Praktisch unerreichbar; lieber ein sperriger Name als eine Ausnahme.
  return `${basis} ${Date.now()}`.slice(0, maxLaenge)
}

/**
 * Name der Prüfbogen-Kopie: Der Titel der neuen Aufgabe gehört hinein,
 * sonst stehen in der Verwaltung zehn gleich benannte Bögen nebeneinander.
 */
export function nameFuerBogenKopie(bogenName: string, aufgabenTitel: string): string {
  return `${bogenName} – ${aufgabenTitel}`
}
