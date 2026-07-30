/**
 * Datei-Nachweise.
 *
 * Dateien werden in ein Docker-Volume (Standard `/app/uploads`) geschrieben.
 * In der Datenbank stehen ausschließlich Metadaten inklusive SHA-256-Prüfsumme,
 * damit die Unverändertheit eines Nachweises jederzeit belegbar ist.
 */

/** Maximale Größe je Datei: 25 MB. */
export const MAX_DATEIGROESSE_BYTES = 25 * 1024 * 1024

/** Erlaubte Dateiendungen (Whitelist) mit zugehörigem Standard-MIME-Typ. */
export const ERLAUBTE_ENDUNGEN: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  log: 'text/plain',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}

/** Für das `accept`-Attribut des Datei-Auswahlfelds. */
export const ACCEPT_ATTRIBUT = '.pdf,.png,.jpg,.jpeg,.txt,.log,.csv,.xlsx,.docx'

export const ERLAUBTE_ENDUNGEN_TEXT = 'pdf, png, jpg, txt, log, csv, xlsx, docx'

/** Liefert die kleingeschriebene Endung ohne Punkt (leer, wenn keine). */
export function dateiendung(dateiname: string): string {
  const index = dateiname.lastIndexOf('.')
  if (index < 1 || index === dateiname.length - 1) return ''
  return dateiname.slice(index + 1).toLowerCase()
}

/**
 * Entfernt Pfadanteile und problematische Zeichen aus einem Dateinamen.
 * Der bereinigte Name wird nur zur Anzeige und beim Download verwendet –
 * auf der Platte liegt die Datei unter einem generierten Namen.
 */
export function bereinigeDateinamen(dateiname: string): string {
  const ohnePfad = dateiname.split(/[\\/]/).pop() ?? 'datei'
  const bereinigt = ohnePfad
    // Steuerzeichen entfernen
    .replace(new RegExp('[\\u0000-\\u001f\\u007f]', 'g'), '')
    // Im Dateisystem problematische Zeichen ersetzen
    .replace(/["*:<>?|]/g, '_')
    // Führende Punkte verhindern versteckte Dateien und ".."
    .replace(/^\.+/, '')
    .trim()
  return bereinigt.slice(0, 200) || 'datei'
}

export type DateiPruefung =
  | { ok: true; endung: string; mimeType: string }
  | { ok: false; fehler: string }

/**
 * Prüft eine hochgeladene Datei gegen Whitelist und Größenbegrenzung.
 * Maßgeblich ist die Dateiendung, weil Browser für `.log` und `.csv`
 * uneinheitliche MIME-Typen melden.
 */
export function pruefeDatei(
  dateiname: string,
  groesseBytes: number,
  gemeldeterMimeType?: string,
): DateiPruefung {
  const name = bereinigeDateinamen(dateiname)
  const endung = dateiendung(name)

  if (!endung) {
    return { ok: false, fehler: `„${name}“ hat keine Dateiendung.` }
  }
  if (!(endung in ERLAUBTE_ENDUNGEN)) {
    return {
      ok: false,
      fehler: `Der Dateityp „.${endung}“ ist nicht zugelassen. Erlaubt sind: ${ERLAUBTE_ENDUNGEN_TEXT}.`,
    }
  }
  if (groesseBytes <= 0) {
    return { ok: false, fehler: `„${name}“ ist leer.` }
  }
  if (groesseBytes > MAX_DATEIGROESSE_BYTES) {
    return {
      ok: false,
      fehler: `„${name}“ ist größer als 25 MB und wurde nicht übernommen.`,
    }
  }

  return {
    ok: true,
    endung,
    mimeType: gemeldeterMimeType?.trim() || ERLAUBTE_ENDUNGEN[endung],
  }
}

/**
 * Endung zu einem MIME-Typ – nur für Inhalte aus der Zwischenablage.
 *
 * Beim Einfügen gibt es keinen Dateinamen, an dem sich die Art ablesen ließe;
 * der Browser meldet nur den Typ. Die Zuordnung bleibt bewusst knapp: Was
 * hier nicht steht, wird nicht angenommen.
 */
export const ENDUNG_JE_MIMETYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
}

/**
 * Dateiname für einen eingefügten Beleg.
 *
 * Die Zwischenablage liefert je nach Browser „image.png“ oder gar nichts –
 * in einer Nachweisablage wäre das nach dem dritten Screenshot unbrauchbar.
 * Deshalb ein sprechender Name mit Zeitpunkt. Ist der Typ nicht zugelassen,
 * kommt `null` zurück; der Aufrufer meldet das der Person.
 */
export function nameFuerEinfuegung(
  mimeType: string,
  zeitpunkt: Date,
  /** Vom Browser gemeldeter Name, falls brauchbar. */
  vorschlag?: string,
): string | null {
  const endung = ENDUNG_JE_MIMETYPE[mimeType.split(';')[0].trim().toLowerCase()]
  if (!endung) return null

  // Einen echten Namen behalten – „image.png“ ist keiner.
  if (vorschlag) {
    const bereinigt = bereinigeDateinamen(vorschlag)
    const vorhandene = dateiendung(bereinigt)
    if (vorhandene in ERLAUBTE_ENDUNGEN && !/^(image|grafik|bild)\./i.test(bereinigt)) {
      return bereinigt
    }
  }

  const zwei = (wert: number) => String(wert).padStart(2, '0')
  const stempel =
    `${zeitpunkt.getFullYear()}-${zwei(zeitpunkt.getMonth() + 1)}-${zwei(zeitpunkt.getDate())}` +
    `-${zwei(zeitpunkt.getHours())}${zwei(zeitpunkt.getMinutes())}${zwei(zeitpunkt.getSeconds())}`

  const art = endung === 'png' || endung === 'jpg' ? 'bildschirmfoto' : 'einfuegung'
  return `${art}-${stempel}.${endung}`
}

/**
 * Relativer Speicherpfad innerhalb des Upload-Verzeichnisses:
 * `JJJJ/MM/<id>.<endung>`. Die Aufteilung nach Monaten hält die Verzeichnisse
 * klein und erleichtert die Sicherung.
 */
export function baueSpeicherpfad(
  id: string,
  endung: string,
  zeitpunkt: Date,
): string {
  const jahr = zeitpunkt.getUTCFullYear()
  const monat = String(zeitpunkt.getUTCMonth() + 1).padStart(2, '0')
  return `${jahr}/${monat}/${id}.${endung}`
}
