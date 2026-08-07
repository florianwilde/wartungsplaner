/**
 * Virenprüfung hochgeladener Dateien.
 *
 * Reine Funktionen ohne Netzzugriff: das Auswerten der Antwort von `clamd`
 * und die Frage, wie mit einem nicht erreichbaren Prüfdienst umzugehen ist.
 *
 * Warum überhaupt: Belege werden von anderen Personen wieder heruntergeladen.
 * Ohne Prüfung wäre die Nachweisablage ein bequemer Verteilweg – und zwar
 * einer, dem man vertraut, weil er aus der eigenen Anwendung stammt.
 */

export type Befund = { sauber: true } | { sauber: false; schadprogramm: string }

export type Pruefstatus =
  /** Kein Prüfdienst hinterlegt – es wird nicht geprüft. */
  | { art: 'nicht-eingerichtet' }
  /** Geprüft, Ergebnis liegt vor. */
  | { art: 'geprueft'; befund: Befund }
  /** Dienst hinterlegt, aber nicht erreichbar oder fehlerhaft. */
  | { art: 'nicht-erreichbar'; grund: string }

/**
 * Wertet die Antwort von `clamd` aus.
 *
 * Das Protokoll antwortet auf einen Datenstrom mit einer einzelnen Zeile:
 *
 *   stream: OK
 *   stream: Eicar-Test-Signature FOUND
 *   INSTREAM size limit exceeded. ERROR
 */
export function werteAntwortAus(antwort: string): Pruefstatus {
  const zeile = antwort.replace(/\0/g, '').trim()

  if (zeile === '') {
    return { art: 'nicht-erreichbar', grund: 'Leere Antwort des Prüfdienstes.' }
  }

  if (/\bOK$/.test(zeile)) {
    return { art: 'geprueft', befund: { sauber: true } }
  }

  const fund = zeile.match(/:\s*(.+?)\s+FOUND$/)
  if (fund) {
    return {
      art: 'geprueft',
      befund: { sauber: false, schadprogramm: fund[1] },
    }
  }

  if (/ERROR$/.test(zeile)) {
    return { art: 'nicht-erreichbar', grund: zeile }
  }

  return {
    art: 'nicht-erreichbar',
    grund: `Unerwartete Antwort: ${zeile.slice(0, 200)}`,
  }
}

/**
 * Darf die Datei angenommen werden?
 *
 * Die schwierige Entscheidung ist nicht der Fund, sondern der Ausfall des
 * Prüfdienstes. Zwei Wege sind vertretbar, und die Wahl gehört begründet:
 *
 * Wir **nehmen die Datei an** und protokollieren, dass nicht geprüft werden
 * konnte. Der Grund: Die Anwendung dient der Nachweisführung. Eine Prüfung,
 * die sich nicht dokumentieren lässt, weil der Upload scheiterte, ist ein
 * größerer Schaden als eine ungeprüfte Datei aus dem eigenen Netz – zumal nur
 * angemeldete Beschäftigte hochladen können und die Dateitypen ohnehin auf
 * eine Whitelist begrenzt sind.
 *
 * Wer das anders gewichtet, stellt `VIRENPRUEFUNG_PFLICHT=true`: Dann wird
 * ohne erreichbaren Prüfdienst nichts mehr angenommen.
 */
export function darfAngenommenWerden(
  status: Pruefstatus,
  pflicht: boolean,
): { erlaubt: boolean; grund: string | null } {
  switch (status.art) {
    case 'geprueft':
      return status.befund.sauber
        ? { erlaubt: true, grund: null }
        : {
            erlaubt: false,
            grund: `Die Datei wurde als Schadprogramm erkannt (${status.befund.schadprogramm}) und nicht übernommen.`,
          }

    case 'nicht-eingerichtet':
      return pflicht
        ? {
            erlaubt: false,
            grund:
              'Die Virenprüfung ist als verpflichtend eingestellt, aber kein Prüfdienst hinterlegt (CLAMAV_HOST).',
          }
        : { erlaubt: true, grund: null }

    case 'nicht-erreichbar':
      return pflicht
        ? {
            erlaubt: false,
            grund: `Die Datei konnte nicht geprüft werden: ${status.grund}`,
          }
        : { erlaubt: true, grund: null }
  }
}

/** Kurzfassung für Protokoll und Anzeige. */
export function beschreibe(status: Pruefstatus): string {
  switch (status.art) {
    case 'nicht-eingerichtet':
      return 'nicht eingerichtet'
    case 'nicht-erreichbar':
      return `nicht erreichbar (${status.grund})`
    case 'geprueft':
      return status.befund.sauber
        ? 'geprüft, ohne Befund'
        : `Fund: ${status.befund.schadprogramm}`
  }
}

/**
 * Rahmen für den INSTREAM-Datenstrom von clamd.
 *
 * Aufbau: je Abschnitt vier Byte Länge (Big Endian), dann die Daten;
 * abgeschlossen durch eine Länge von null.
 */
export function baueStrom(inhalt: Buffer, abschnittsgroesse = 64 * 1024): Buffer[] {
  const teile: Buffer[] = []

  for (let versatz = 0; versatz < inhalt.length; versatz += abschnittsgroesse) {
    const abschnitt = inhalt.subarray(versatz, versatz + abschnittsgroesse)
    const laenge = Buffer.alloc(4)
    laenge.writeUInt32BE(abschnitt.length, 0)
    teile.push(laenge, abschnitt)
  }

  // Abschluss: vier Nullbytes.
  teile.push(Buffer.alloc(4))
  return teile
}
