import { describe, expect, it } from 'vitest'

import {
  BOM,
  jaNein,
  leseCsv,
  leseJaNein,
  maskiereCsvFeld,
  schreibeCsv,
} from './csv'

describe('leseCsv', () => {
  it('liest Kopfzeile und Datenzeilen', () => {
    const zeilen = leseCsv('name;farbe\nBackup;#0ea5e9\nZutritt;#f59e0b')
    expect(zeilen).toEqual([
      { name: 'Backup', farbe: '#0ea5e9' },
      { name: 'Zutritt', farbe: '#f59e0b' },
    ])
  })

  it('kommt mit CRLF-Zeilenenden zurecht', () => {
    expect(leseCsv('a;b\r\n1;2\r\n')).toEqual([{ a: '1', b: '2' }])
  })

  it('entfernt ein führendes BOM', () => {
    expect(leseCsv(`${BOM}a;b\n1;2`)).toEqual([{ a: '1', b: '2' }])
  })

  it('beachtet Anführungszeichen mit Trennzeichen und Umbrüchen', () => {
    const zeilen = leseCsv('titel;beschreibung\n"Prüfung; Teil 1";"Zeile 1\nZeile 2"')
    expect(zeilen[0].titel).toBe('Prüfung; Teil 1')
    expect(zeilen[0].beschreibung).toBe('Zeile 1\nZeile 2')
  })

  it('liest verdoppelte Anführungszeichen als eines', () => {
    expect(leseCsv('a\n"Er sagte ""Hallo"""')[0].a).toBe('Er sagte "Hallo"')
  })

  it('schneidet Leerraum an den Rändern ab', () => {
    expect(leseCsv('a ; b\n 1 ; 2 ')).toEqual([{ a: '1', b: '2' }])
  })

  it('überspringt vollständig leere Zeilen', () => {
    expect(leseCsv('a;b\n1;2\n\n;\n3;4')).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ])
  })

  it('füllt fehlende Spalten mit leeren Zeichenketten', () => {
    expect(leseCsv('a;b;c\n1;2')).toEqual([{ a: '1', b: '2', c: '' }])
  })

  it('liefert eine leere Liste bei leerem Text', () => {
    expect(leseCsv('')).toEqual([])
  })

  it('weist doppelte Spaltennamen ab', () => {
    expect(() => leseCsv('a;a\n1;2')).toThrow(/doppelte Spalten/)
  })

  it('weist eine fehlende Kopfzeile ab', () => {
    expect(() => leseCsv(';;\n1;2;3')).toThrow(/Kopfzeile/)
  })
})

describe('maskiereCsvFeld', () => {
  it('lässt harmlose Werte unverändert', () => {
    expect(maskiereCsvFeld('Restore-Test')).toBe('Restore-Test')
  })

  it('setzt Anführungszeichen bei Trennzeichen und Umbrüchen', () => {
    expect(maskiereCsvFeld('a;b')).toBe('"a;b"')
    expect(maskiereCsvFeld('a\nb')).toBe('"a\nb"')
  })

  it('verdoppelt enthaltene Anführungszeichen', () => {
    expect(maskiereCsvFeld('Er sagte "Hallo"')).toBe('"Er sagte ""Hallo"""')
  })

  it('entschärft Werte, die Excel als Formel deuten würde', () => {
    // Schutz vor CSV Injection: =cmd|... würde sonst beim Öffnen ausgeführt
    expect(maskiereCsvFeld('=1+1')).toBe("'=1+1")
    expect(maskiereCsvFeld('+49 170')).toBe("'+49 170")
    expect(maskiereCsvFeld('-5')).toBe("'-5")
    expect(maskiereCsvFeld('@SUM(A1)')).toBe("'@SUM(A1)")
  })

  it('entschärft Formeln auch dann, wenn zusätzlich maskiert wird', () => {
    expect(maskiereCsvFeld('=a;b')).toBe('"\'=a;b"')
  })
})

describe('schreibeCsv', () => {
  it('erzeugt Kopfzeile, BOM und CRLF', () => {
    const text = schreibeCsv(['a', 'b'], [{ a: '1', b: '2' }])
    expect(text.startsWith(BOM)).toBe(true)
    expect(text).toContain('a;b\r\n')
    expect(text).toContain('1;2\r\n')
  })

  it('gibt nur die angeforderten Spalten aus', () => {
    const text = schreibeCsv(['a'], [{ a: '1', b: 'ignoriert' }])
    expect(text).not.toContain('ignoriert')
  })

  it('ergänzt fehlende Werte als leere Felder', () => {
    expect(schreibeCsv(['a', 'b'], [{ a: '1' }])).toContain('1;\r\n')
  })

  it('ist mit leseCsv verlustfrei kombinierbar', () => {
    const original = [
      { titel: 'Prüfung; mit Semikolon', text: 'Zeile 1\nZeile 2' },
      { titel: 'Anführung "innen"', text: 'schlicht' },
    ]
    const zurueck = leseCsv(schreibeCsv(['titel', 'text'], original))
    expect(zurueck).toEqual(original)
  })
})

describe('jaNein und leseJaNein', () => {
  it('schreibt Wahrheitswerte deutsch', () => {
    expect(jaNein(true)).toBe('ja')
    expect(jaNein(false)).toBe('nein')
  })

  it('liest die gängigen Schreibweisen', () => {
    for (const wert of ['ja', 'JA', 'j', 'wahr', 'true', '1', 'x', 'yes']) {
      expect(leseJaNein(wert, false), wert).toBe(true)
    }
    for (const wert of ['nein', 'N', 'falsch', 'false', '0', 'no']) {
      expect(leseJaNein(wert, true), wert).toBe(false)
    }
  })

  it('verwendet bei leerer Eingabe den Standard', () => {
    expect(leseJaNein('', true)).toBe(true)
    expect(leseJaNein('   ', false)).toBe(false)
  })

  it('verwendet bei unverständlicher Eingabe den Standard', () => {
    expect(leseJaNein('vielleicht', true)).toBe(true)
    expect(leseJaNein('vielleicht', false)).toBe(false)
  })

  it('ist mit jaNein verlustfrei kombinierbar', () => {
    expect(leseJaNein(jaNein(true), false)).toBe(true)
    expect(leseJaNein(jaNein(false), true)).toBe(false)
  })
})
