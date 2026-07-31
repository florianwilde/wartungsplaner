/**
 * Regeln für Sammelaktionen auf mehreren markierten Einträgen.
 *
 * Löschen ist der einzige Vorgang dieser Anwendung, der Nachweise vernichten
 * kann – und über die Fremdschlüssel des Datenmodells geschieht das leise:
 * An einer Aufgabe hängen Fälligkeiten, an diesen Durchführungen, daran
 * Nachweisdateien, Abweichungen und Prüfbögen. Ein Sammellöschen ohne Regel
 * wäre der schnellste Weg, ein Audit zu verlieren.
 *
 * Deshalb hier, als reine Funktionen ohne Datenbank: Wer darf gelöscht
 * werden, wer nicht, und mit welcher Begründung.
 */

/** Ein markierter Eintrag mit dem, was an ihm hängt. */
export type Kandidat = {
  id: string
  bezeichnung: string
  /**
   * Zahl der Datensätze, die ein Löschen mitnehmen würde und die nicht
   * wiederherstellbar sind. Null bedeutet: gefahrlos.
   */
  abhaengige: number
  /** Wofür die Zahl steht – erscheint in der Meldung. */
  abhaengigeArt: string
}

export type SammelPruefung =
  | { ok: true; ids: string[] }
  | { ok: false; fehler: string; blockiert: Kandidat[] }

/** Höchstzahl je Sammelaktion – schützt vor einem verrutschten „alles". */
export const MAX_SAMMELAKTION = 200

/**
 * Prüft, ob alle markierten Einträge gelöscht werden dürfen.
 *
 * **Bewusst alles oder nichts:** Hängt an einem einzigen Eintrag etwas, wird
 * der ganze Vorgang abgelehnt und die betroffenen Einträge werden benannt.
 * Ein teilweise ausgeführtes Löschen hinterließe die Frage, was nun gilt –
 * und die Antwort wäre nicht mehr rekonstruierbar.
 */
export function pruefeSammelloeschung(
  kandidaten: Kandidat[],
): SammelPruefung {
  if (kandidaten.length === 0) {
    return { ok: false, fehler: 'Es ist nichts markiert.', blockiert: [] }
  }
  if (kandidaten.length > MAX_SAMMELAKTION) {
    return {
      ok: false,
      fehler: `Höchstens ${MAX_SAMMELAKTION} Einträge auf einmal.`,
      blockiert: [],
    }
  }

  const blockiert = kandidaten.filter((k) => k.abhaengige > 0)
  if (blockiert.length === 0) {
    return { ok: true, ids: kandidaten.map((k) => k.id) }
  }

  return { ok: false, fehler: begruendung(blockiert), blockiert }
}

/**
 * Meldung, die genau sagt, woran es liegt.
 *
 * „Löschen nicht möglich" allein hilft niemandem: Bei zwanzig markierten
 * Einträgen bleibt sonst nur Ausprobieren.
 */
function begruendung(blockiert: Kandidat[]): string {
  const namen = blockiert
    .slice(0, 3)
    .map((k) => `„${k.bezeichnung}" (${k.abhaengige} ${k.abhaengigeArt})`)
    .join(', ')

  const rest =
    blockiert.length > 3 ? ` und ${blockiert.length - 3} weitere` : ''

  return (
    `${blockiert.length === 1 ? 'Ein Eintrag lässt' : `${blockiert.length} Einträge lassen`}` +
    ` sich nicht löschen: ${namen}${rest}. ` +
    'Nehmen Sie die Markierung dort zurück, oder deaktivieren Sie die Einträge, ' +
    'statt sie zu löschen.'
  )
}

/**
 * Kurzfassung für die Rückmeldung nach einer Sammelaktion.
 *
 * Die Zahl allein liest sich in der Oberfläche schlecht, und die Mehrzahl
 * ist im Deutschen nicht durch ein angehängtes „s" erledigt.
 */
export function fasseErgebnisZusammen(
  anzahl: number,
  einzahl: string,
  mehrzahl: string,
  vorgang: string,
): string {
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl} ${vorgang}.`
}

// ---------------------------------------------------------------------------
// Erzwungenes Löschen
// ---------------------------------------------------------------------------

/**
 * Was ein erzwungenes Löschen vernichten würde.
 *
 * Die Zahlen stehen vor der Bestätigung auf dem Bildschirm und danach im
 * Audit-Log. Der Grundsatz dahinter: Wenn ein Nachweis schon verschwinden
 * muss, darf wenigstens die Tatsache nicht verschwinden, dass es ihn gab.
 */
export type Verlust = {
  aufgaben: number
  faelligkeiten: number
  durchfuehrungen: number
  nachweisdateien: number
  abweichungen: number
  pruefnachweise: number
  pruefboegen: number
}

/** Mindestlänge der Begründung – „test" hilft in zwei Jahren niemandem. */
export const MIN_BEGRUENDUNG = 15

export type ErzwingenPruefung =
  | { ok: true }
  | { ok: false; fehler: string }

/**
 * Prüft die Angaben vor einem erzwungenen Löschen.
 *
 * Verlangt eine Begründung und die wörtliche Bestätigung. Beides ist Absicht:
 * Ein Klick auf „OK" passiert versehentlich, das Abtippen eines Wortes nicht.
 */
export function pruefeErzwingen(eingabe: {
  ids: string[]
  begruendung: string
  bestaetigung: string
}): ErzwingenPruefung {
  if (eingabe.ids.length === 0) {
    return { ok: false, fehler: 'Es ist nichts markiert.' }
  }
  if (eingabe.ids.length > MAX_SAMMELAKTION) {
    return {
      ok: false,
      fehler: `Höchstens ${MAX_SAMMELAKTION} Einträge auf einmal.`,
    }
  }

  const begruendung = eingabe.begruendung.trim()
  if (begruendung.length < MIN_BEGRUENDUNG) {
    return {
      ok: false,
      fehler:
        `Bitte begründen Sie die Löschung mit mindestens ${MIN_BEGRUENDUNG} Zeichen. ` +
        'Die Begründung steht später im Audit-Log und ist das Einzige, was von ' +
        'den Nachweisen übrig bleibt.',
    }
  }
  if (begruendung.length > 1000) {
    return { ok: false, fehler: 'Die Begründung darf höchstens 1000 Zeichen haben.' }
  }

  if (eingabe.bestaetigung.trim().toUpperCase() !== BESTAETIGUNGSWORT) {
    return {
      ok: false,
      fehler: `Bitte „${BESTAETIGUNGSWORT}" zur Bestätigung eingeben.`,
    }
  }

  return { ok: true }
}

/** Wort, das zur Bestätigung abgetippt werden muss. */
export const BESTAETIGUNGSWORT = 'LOESCHEN'

/**
 * Der Verlust in Worten – für Bestätigungsdialog und Audit-Eintrag.
 *
 * Nur was tatsächlich betroffen ist, wird genannt: Eine Aufzählung mit fünf
 * Nullen darin liest niemand zu Ende.
 */
export function beschreibeVerlust(verlust: Verlust): string {
  const teile: string[] = []
  const nenne = (anzahl: number, einzahl: string, mehrzahl: string) => {
    if (anzahl > 0) teile.push(`${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`)
  }

  nenne(verlust.aufgaben, 'Aufgabe', 'Aufgaben')
  nenne(verlust.faelligkeiten, 'Fälligkeit', 'Fälligkeiten')
  nenne(verlust.durchfuehrungen, 'Durchführung', 'Durchführungen')
  nenne(verlust.pruefnachweise, 'Prüfnachweis', 'Prüfnachweise')
  nenne(verlust.nachweisdateien, 'Nachweisdatei', 'Nachweisdateien')
  nenne(verlust.abweichungen, 'Abweichung', 'Abweichungen')
  nenne(verlust.pruefboegen, 'Prüfbogen', 'Prüfbögen')

  return teile.join(', ')
}
