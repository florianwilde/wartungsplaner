import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  alsTag,
  alsZeitpunkt,
  baueKalender,
  falteZeile,
  maskiereText,
  type Kalendereintrag,
} from './ical'

const JETZT = new Date(Date.UTC(2026, 6, 30, 15, 4, 5))

const eintrag = (teil: Partial<Kalendereintrag> = {}): Kalendereintrag => ({
  uid: 'occ-1',
  tag: dateOnly(2026, 8, 12),
  titel: 'Restore-Test',
  ...teil,
})

const kalender = (eintraege: Kalendereintrag[]) =>
  baueKalender({
    name: 'Meine Prüfungen',
    beschreibung: 'Offene Fälligkeiten',
    eintraege,
    jetzt: JETZT,
    domain: 'wartungsplaner',
  })

describe('maskiereText', () => {
  it('maskiert Semikolon, Komma und Zeilenumbruch', () => {
    expect(maskiereText('a;b,c\nd')).toBe('a\\;b\\,c\\nd')
  })

  it('maskiert den Rückstrich zuerst', () => {
    // Andernfalls würde die eigene Maskierung nochmals maskiert.
    expect(maskiereText('C:\\temp;x')).toBe('C:\\\\temp\\;x')
  })

  it('behandelt CRLF als einen Umbruch', () => {
    expect(maskiereText('a\r\nb')).toBe('a\\nb')
  })
})

describe('falteZeile', () => {
  it('lässt kurze Zeilen unverändert', () => {
    expect(falteZeile('SUMMARY:kurz')).toBe('SUMMARY:kurz')
  })

  it('faltet lange Zeilen mit führendem Leerzeichen', () => {
    const gefaltet = falteZeile(`SUMMARY:${'x'.repeat(200)}`)
    const teile = gefaltet.split('\r\n')
    expect(teile.length).toBeGreaterThan(1)
    expect(teile.slice(1).every((teil) => teil.startsWith(' '))).toBe(true)
    // Jede Zeile bleibt unter der Grenze von 75 Oktetten.
    expect(teile.every((teil) => Buffer.from(teil, 'utf8').length <= 75)).toBe(true)
  })

  it('schneidet nicht mitten in einen Umlaut', () => {
    // Gezählt werden Oktette; ein zerteiltes Zeichen ergäbe Buchstabensalat.
    const gefaltet = falteZeile(`SUMMARY:${'ä'.repeat(100)}`)
    const zusammen = gefaltet.split('\r\n ').join('')
    expect(zusammen).toBe(`SUMMARY:${'ä'.repeat(100)}`)
    expect(gefaltet).not.toContain('\ufffd')
  })
})

describe('alsTag und alsZeitpunkt', () => {
  it('schreibt Kalendertage ohne Zeitanteil', () => {
    expect(alsTag(dateOnly(2026, 8, 3))).toBe('20260803')
  })

  it('schreibt Zeitpunkte in UTC', () => {
    expect(alsZeitpunkt(JETZT)).toBe('20260730T150405Z')
  })
})

describe('baueKalender', () => {
  it('erzeugt einen vollständigen Rahmen', () => {
    const text = kalender([])
    expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text).toContain('VERSION:2.0')
    expect(text).toContain('X-WR-CALNAME:Meine Prüfungen')
  })

  it('verwendet durchgehend CRLF', () => {
    // Ein bloßes \n lehnen manche Kalenderprogramme ab.
    const text = kalender([eintrag()])
    expect(
      text.split('\n').every((zeile) => zeile === '' || zeile.endsWith('\r')),
    ).toBe(true)
  })

  it('legt ganztägige Termine mit ausschließendem Ende an', () => {
    // DTEND ist der Folgetag – sonst fehlt der Termin oder dauert zwei Tage.
    const text = kalender([eintrag()])
    expect(text).toContain('DTSTART;VALUE=DATE:20260812')
    expect(text).toContain('DTEND;VALUE=DATE:20260813')
  })

  it('blockiert den Tag im Kalender nicht', () => {
    expect(kalender([eintrag()])).toContain('TRANSP:TRANSPARENT')
  })

  it('hängt die Anwendung an die UID', () => {
    expect(kalender([eintrag()])).toContain('UID:occ-1@wartungsplaner')
  })

  it('nimmt Beschreibung, Verweis und Kategorie mit auf', () => {
    const text = kalender([
      eintrag({
        beschreibung: 'Kategorie: Datensicherung',
        url: 'https://beispiel.local/tasks/abc',
        kategorie: 'Datensicherung',
      }),
    ])
    expect(text).toContain('DESCRIPTION:Kategorie: Datensicherung')
    expect(text).toContain('URL:https://beispiel.local/tasks/abc')
    expect(text).toContain('CATEGORIES:Datensicherung')
  })

  it('lässt Felder weg, die nicht gefüllt sind', () => {
    const text = kalender([eintrag()])
    expect(text).not.toContain('DESCRIPTION:')
    expect(text).not.toContain('URL:')
  })

  it('legt eine Erinnerung nur an, wenn ein Vorlauf gewünscht ist', () => {
    expect(kalender([eintrag({ erinnerungTage: 7 })])).toContain('TRIGGER:-P7D')
    expect(kalender([eintrag({ erinnerungTage: 0 })])).not.toContain('VALARM')
    expect(kalender([eintrag()])).not.toContain('VALARM')
  })

  it('maskiert Titel mit Sonderzeichen', () => {
    const text = kalender([eintrag({ titel: 'Firewall; Regeln, Teil 2' })])
    expect(text).toContain('SUMMARY:Firewall\\; Regeln\\, Teil 2')
  })

  it('schreibt je Eintrag einen Termin', () => {
    const text = kalender([
      eintrag({ uid: 'a' }),
      eintrag({ uid: 'b' }),
      eintrag({ uid: 'c' }),
    ])
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(text.match(/END:VEVENT/g)).toHaveLength(3)
  })
})
