import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  MAX_DATEIGROESSE_BYTES,
  baueSpeicherpfad,
  bereinigeDateinamen,
  dateiendung,
  pruefeDatei,
} from './uploads'

describe('dateiendung', () => {
  it('liefert die kleingeschriebene Endung', () => {
    expect(dateiendung('Protokoll.PDF')).toBe('pdf')
    expect(dateiendung('bericht.tar.gz')).toBe('gz')
  })

  it('liefert leer ohne Endung', () => {
    expect(dateiendung('README')).toBe('')
    expect(dateiendung('.gitignore')).toBe('')
    expect(dateiendung('datei.')).toBe('')
  })
})

describe('bereinigeDateinamen', () => {
  it('entfernt Pfadanteile', () => {
    expect(bereinigeDateinamen('C:\\Temp\\restore.pdf')).toBe('restore.pdf')
    expect(bereinigeDateinamen('/etc/passwd')).toBe('passwd')
    expect(bereinigeDateinamen('../../geheim.txt')).toBe('geheim.txt')
  })

  it('ersetzt problematische Zeichen', () => {
    expect(bereinigeDateinamen('be:richt?.pdf')).toBe('be_richt_.pdf')
  })

  it('behält Umlaute und Leerzeichen', () => {
    expect(bereinigeDateinamen('Prüfprotokoll Mai 2026.pdf')).toBe(
      'Prüfprotokoll Mai 2026.pdf',
    )
  })

  it('liefert einen Ersatznamen bei leerer Eingabe', () => {
    expect(bereinigeDateinamen('')).toBe('datei')
    expect(bereinigeDateinamen('...')).toBe('datei')
  })
})

describe('pruefeDatei', () => {
  it('lässt erlaubte Dateitypen zu', () => {
    for (const name of [
      'a.pdf',
      'b.png',
      'c.jpg',
      'd.txt',
      'e.log',
      'f.csv',
      'g.xlsx',
      'h.docx',
    ]) {
      expect(pruefeDatei(name, 1024).ok, name).toBe(true)
    }
  })

  it('lehnt nicht zugelassene Dateitypen ab', () => {
    const ergebnis = pruefeDatei('schadcode.exe', 1024)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('.exe')
  })

  it('lehnt Dateien ohne Endung ab', () => {
    expect(pruefeDatei('protokoll', 512).ok).toBe(false)
  })

  it('lehnt leere Dateien ab', () => {
    expect(pruefeDatei('leer.pdf', 0).ok).toBe(false)
  })

  it('lehnt Dateien über 25 MB ab', () => {
    expect(pruefeDatei('gross.pdf', MAX_DATEIGROESSE_BYTES).ok).toBe(true)
    expect(pruefeDatei('gross.pdf', MAX_DATEIGROESSE_BYTES + 1).ok).toBe(false)
  })

  it('ergänzt einen Standard-MIME-Typ, wenn der Browser keinen meldet', () => {
    const ergebnis = pruefeDatei('backup.log', 200, '')
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.mimeType).toBe('text/plain')
  })

  it('übernimmt einen gemeldeten MIME-Typ', () => {
    const ergebnis = pruefeDatei('bericht.pdf', 200, 'application/pdf')
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.mimeType).toBe('application/pdf')
  })

  it('greift auch bei getarntem Pfad im Dateinamen', () => {
    expect(pruefeDatei('../../../etc/passwd', 100).ok).toBe(false)
  })
})

describe('baueSpeicherpfad', () => {
  it('gliedert nach Jahr und Monat', () => {
    expect(baueSpeicherpfad('abc123', 'pdf', dateOnly(2026, 3, 9))).toBe(
      '2026/03/abc123.pdf',
    )
    expect(baueSpeicherpfad('xyz', 'png', dateOnly(2026, 12, 31))).toBe(
      '2026/12/xyz.png',
    )
  })
})
