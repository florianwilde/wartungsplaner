/**
 * Kalenderdatei im iCalendar-Format (RFC 5545).
 *
 * Wer Prüfungen plant, plant sie im Kalender – nicht in einer zweiten
 * Anwendung, die man dafür öffnen muss. Ein abonnierbarer Feed bringt die
 * Fälligkeiten dorthin, wo ohnehin geschaut wird.
 *
 * Bewusst von Hand erzeugt statt mit einer Bibliothek: Es geht um ein
 * Dutzend Zeilen Text, und die Feinheiten – Faltung, Maskierung, ganztägige
 * Termine – sind hier nachlesbar und geprüft.
 */

/** Zeilenende laut Norm; ein bloßes \n lehnen manche Programme ab. */
const CRLF = '\r\n'

/**
 * Maskiert einen Textwert.
 *
 * Reihenfolge beachten: Der Rückstrich zuerst, sonst würde die eigene
 * Maskierung der übrigen Zeichen nochmals maskiert.
 */
export function maskiereText(wert: string): string {
  return wert
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

/**
 * Faltet eine Zeile auf höchstens 75 Oktette.
 *
 * Gezählt werden Bytes, nicht Zeichen: Ein Umlaut belegt in UTF-8 zwei, und
 * eine mitten im Zeichen getrennte Zeile ergibt Buchstabensalat.
 */
export function falteZeile(zeile: string): string {
  const bytes = Buffer.from(zeile, 'utf8')
  if (bytes.length <= 75) return zeile

  const teile: string[] = []
  let start = 0
  let grenze = 75

  while (start < bytes.length) {
    let ende = Math.min(start + grenze, bytes.length)

    // Nicht mitten in ein Mehrbyte-Zeichen schneiden: Folgebytes beginnen
    // mit den Bits 10.
    while (ende > start && ende < bytes.length && (bytes[ende] & 0xc0) === 0x80) {
      ende--
    }

    teile.push(bytes.subarray(start, ende).toString('utf8'))
    start = ende
    // Fortsetzungszeilen beginnen mit einem Leerzeichen, das mitzählt.
    grenze = 74
  }

  return teile.join(`${CRLF} `)
}

/** Datum als Kalendertag „JJJJMMTT“ – für ganztägige Termine. */
export function alsTag(datum: Date): string {
  const zwei = (wert: number) => String(wert).padStart(2, '0')
  return `${datum.getUTCFullYear()}${zwei(datum.getUTCMonth() + 1)}${zwei(
    datum.getUTCDate(),
  )}`
}

/** Zeitpunkt in UTC – für DTSTAMP. */
export function alsZeitpunkt(zeitpunkt: Date): string {
  const zwei = (wert: number) => String(wert).padStart(2, '0')
  return (
    `${zeitpunkt.getUTCFullYear()}${zwei(zeitpunkt.getUTCMonth() + 1)}` +
    `${zwei(zeitpunkt.getUTCDate())}T${zwei(zeitpunkt.getUTCHours())}` +
    `${zwei(zeitpunkt.getUTCMinutes())}${zwei(zeitpunkt.getUTCSeconds())}Z`
  )
}

/** Nächster Tag – DTEND ist bei ganztägigen Terminen ausschließend. */
function tagDanach(datum: Date): Date {
  const kopie = new Date(datum)
  kopie.setUTCDate(kopie.getUTCDate() + 1)
  return kopie
}

export type Kalendereintrag = {
  /** Dauerhaft gleich, damit ein Termin beim Abgleich nicht doppelt erscheint. */
  uid: string
  tag: Date
  titel: string
  beschreibung?: string
  url?: string
  kategorie?: string
  /** Erinnerung so viele Tage vorher; 0 oder fehlend = keine. */
  erinnerungTage?: number
}

export type Kalenderangaben = {
  name: string
  beschreibung: string
  eintraege: Kalendereintrag[]
  /** Zeitpunkt der Erzeugung – steckt als DTSTAMP in jedem Termin. */
  jetzt: Date
  /** Für die UID: alles nach dem @ soll die Anwendung benennen. */
  domain: string
}

/**
 * Baut die vollständige Kalenderdatei.
 *
 * Die Termine sind **ganztägig und unverbindlich** (`TRANSP:TRANSPARENT`):
 * Eine Fälligkeit ist keine Besprechung – sie darf im Kalender keinen Tag
 * blockieren und niemanden als beschäftigt ausweisen.
 */
export function baueKalender(angaben: Kalenderangaben): string {
  const zeilen: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wartungsplaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${maskiereText(angaben.name)}`,
    `X-WR-CALDESC:${maskiereText(angaben.beschreibung)}`,
    'X-WR-TIMEZONE:Europe/Berlin',
    // Beides sagt dasselbe: Ein halber Tag genügt, die Termine ändern sich
    // selten. Outlook liest das eine, andere Programme das andere.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ]

  for (const eintrag of angaben.eintraege) {
    zeilen.push(
      'BEGIN:VEVENT',
      `UID:${eintrag.uid}@${angaben.domain}`,
      `DTSTAMP:${alsZeitpunkt(angaben.jetzt)}`,
      `DTSTART;VALUE=DATE:${alsTag(eintrag.tag)}`,
      `DTEND;VALUE=DATE:${alsTag(tagDanach(eintrag.tag))}`,
      `SUMMARY:${maskiereText(eintrag.titel)}`,
      'TRANSP:TRANSPARENT',
    )

    if (eintrag.beschreibung) {
      zeilen.push(`DESCRIPTION:${maskiereText(eintrag.beschreibung)}`)
    }
    if (eintrag.url) zeilen.push(`URL:${eintrag.url}`)
    if (eintrag.kategorie) {
      zeilen.push(`CATEGORIES:${maskiereText(eintrag.kategorie)}`)
    }

    if (eintrag.erinnerungTage && eintrag.erinnerungTage > 0) {
      zeilen.push(
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:-P${Math.trunc(eintrag.erinnerungTage)}D`,
        `DESCRIPTION:${maskiereText(eintrag.titel)}`,
        'END:VALARM',
      )
    }

    zeilen.push('END:VEVENT')
  }

  zeilen.push('END:VCALENDAR')

  return zeilen.map(falteZeile).join(CRLF) + CRLF
}
