import { describe, expect, it } from 'vitest'

import {
  archivPfad,
  bauePruefsummenListe,
  baueLiesmich,
  inhaltZeile,
  macheEindeutig,
  sichererName,
  type ArchivEintrag,
} from './archiv'

function eintrag(teil: Partial<ArchivEintrag> = {}): ArchivEintrag {
  return {
    quelle: '2026/07/abc.pdf',
    ziel: 'Backup/Restore-Test/2026-07-30_bericht.pdf',
    sha256: 'a'.repeat(64),
    dateiname: 'bericht.pdf',
    kategorie: 'Backup',
    aufgabe: 'Restore-Test',
    faelligAm: '2026-07-30',
    durchgefuehrtAm: '2026-07-30',
    hochgeladenVon: 'Anna Beispiel',
    groesseBytes: 4711,
    ...teil,
  }
}

describe('sichererName', () => {
  it('ersetzt Pfadtrenner und heikle Zeichen', () => {
    expect(sichererName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j')
  })

  it('entfernt führende Punkte', () => {
    // Sonst entstünden versteckte Dateien oder Pfade mit "..".
    expect(sichererName('../../etc/passwd')).toBe('-..-etc-passwd')
    expect(sichererName('.versteckt')).toBe('versteckt')
  })

  it('fasst Leerraum zusammen und schneidet Ränder', () => {
    expect(sichererName('  viel   Luft  ')).toBe('viel Luft')
  })

  it('kürzt auf die Höchstlänge', () => {
    expect(sichererName('x'.repeat(200), 20)).toHaveLength(20)
  })

  it('liefert einen Ersatz, wenn nichts übrig bleibt', () => {
    expect(sichererName('...')).toBe('ohne-namen')
    expect(sichererName('   ')).toBe('ohne-namen')
  })

  it('behält Umlaute', () => {
    expect(sichererName('Prüfbericht Größe.pdf')).toBe('Prüfbericht Größe.pdf')
  })
})

describe('archivPfad', () => {
  it('gliedert nach Kategorie und Aufgabe und stellt das Datum voran', () => {
    expect(
      archivPfad({
        kategorie: 'Backup & Restore',
        aufgabe: 'Restore-Test ERP',
        faelligAm: '2026-07-30',
        dateiname: 'protokoll.pdf',
      }),
    ).toBe('Backup & Restore/Restore-Test ERP/2026-07-30_protokoll.pdf')
  })

  it('entschärft Pfadtrenner in Kategorie und Aufgabe', () => {
    const pfad = archivPfad({
      kategorie: 'A/B',
      aufgabe: 'C/D',
      faelligAm: '2026-01-01',
      dateiname: 'e/f.pdf',
    })
    // Genau drei Ebenen – kein Ausbruch aus der Gliederung.
    expect(pfad.split('/')).toHaveLength(3)
    expect(pfad).toBe('A-B/C-D/2026-01-01_e-f.pdf')
  })
})

describe('macheEindeutig', () => {
  it('lässt verschiedene Pfade unverändert', () => {
    const pfade = ['a/b.pdf', 'a/c.pdf']
    expect(macheEindeutig(pfade)).toEqual(pfade)
  })

  it('nummeriert Wiederholungen vor der Endung', () => {
    expect(
      macheEindeutig(['a/screenshot.png', 'a/screenshot.png', 'a/screenshot.png']),
    ).toEqual(['a/screenshot.png', 'a/screenshot (2).png', 'a/screenshot (3).png'])
  })

  it('hängt an, wenn es keine Endung gibt', () => {
    expect(macheEindeutig(['a/liste', 'a/liste'])).toEqual([
      'a/liste',
      'a/liste (2)',
    ])
  })

  it('verwechselt einen Punkt im Ordnernamen nicht mit einer Endung', () => {
    expect(macheEindeutig(['a.b/datei', 'a.b/datei'])).toEqual([
      'a.b/datei',
      'a.b/datei (2)',
    ])
  })
})

describe('bauePruefsummenListe', () => {
  it('schreibt das Format von sha256sum', () => {
    const liste = bauePruefsummenListe([
      eintrag({ sha256: 'b'.repeat(64), ziel: 'x/y.pdf' }),
    ])
    // Zwei Leerzeichen zwischen Summe und Pfad – so erwartet es das Werkzeug.
    expect(liste).toBe(`${'b'.repeat(64)}  x/y.pdf\n`)
  })

  it('endet mit einem Zeilenumbruch', () => {
    expect(bauePruefsummenListe([eintrag(), eintrag()]).endsWith('\n')).toBe(true)
  })
})

describe('inhaltZeile', () => {
  it('liefert so viele Felder wie Spalten', () => {
    expect(inhaltZeile(eintrag())).toHaveLength(9)
  })

  it('führt Prüfsumme und Herkunft mit', () => {
    const zeile = inhaltZeile(eintrag())
    expect(zeile).toContain('a'.repeat(64))
    expect(zeile).toContain('Anna Beispiel')
    expect(zeile).toContain('Restore-Test')
  })
})

describe('baueLiesmich', () => {
  const angaben = {
    anwendung: 'Wartungsplaner',
    organisation: 'Beispiel GmbH',
    von: '01.01.2026',
    bis: '31.12.2026',
    anzahl: 42,
    erstelltAm: '30.07.2026, 11:00',
    erstelltVon: 'Anna Beispiel',
    kategorien: 'Alle Kategorien',
  }

  it('nennt Zeitraum, Anzahl und Herkunft', () => {
    const text = baueLiesmich(angaben)
    expect(text).toContain('01.01.2026')
    expect(text).toContain('42')
    expect(text).toContain('Anna Beispiel')
    expect(text).toContain('Beispiel GmbH')
  })

  it('erklärt die Prüfung ohne diese Anwendung', () => {
    const text = baueLiesmich(angaben)
    expect(text).toContain('sha256sum -c PRUEFSUMMEN.sha256')
    expect(text).toContain('Get-FileHash')
  })
})
