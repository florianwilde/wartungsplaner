import { describe, expect, it } from 'vitest'

import {
  SPALTEN_KATALOG,
  alleSpalten,
  eingebauteVorlage,
  normalisiereSpalten,
  pflichtSpalten,
  pruefeVorlagenName,
  saeubereText,
  seitenMasse,
  spaltenAusSchluesseln,
  standardSpalten,
} from './report-vorlagen'
import { REPORT_TYPEN } from '@/server/reports/typen'

describe('SPALTEN_KATALOG', () => {
  it('kennt jede Reportart', () => {
    for (const typ of REPORT_TYPEN) {
      expect(SPALTEN_KATALOG[typ].length).toBeGreaterThan(2)
    }
  })

  it('vergibt eindeutige Schlüssel je Reportart', () => {
    for (const typ of REPORT_TYPEN) {
      const schluessel = alleSpalten(typ)
      expect(new Set(schluessel).size, typ).toBe(schluessel.length)
    }
  })

  it('hat je Reportart mindestens eine Pflichtspalte', () => {
    for (const typ of REPORT_TYPEN) {
      expect(pflichtSpalten(typ).length, typ).toBeGreaterThan(0)
    }
  })

  it('vergibt jeder Spalte eine Überschrift und einen Anteil', () => {
    for (const typ of REPORT_TYPEN) {
      for (const spalte of SPALTEN_KATALOG[typ]) {
        expect(spalte.kopf.length, `${typ}.${spalte.key}`).toBeGreaterThan(1)
        expect(spalte.anteil, `${typ}.${spalte.key}`).toBeGreaterThan(0)
      }
    }
  })
})

describe('standardSpalten', () => {
  it('enthält alle Pflichtspalten', () => {
    for (const typ of REPORT_TYPEN) {
      const standard = new Set(standardSpalten(typ))
      for (const pflicht of pflichtSpalten(typ)) {
        expect(standard.has(pflicht), `${typ}.${pflicht}`).toBe(true)
      }
    }
  })

  it('lässt ausführliche Spalten weg', () => {
    expect(standardSpalten('historie')).not.toContain('kommentar')
  })
})

describe('normalisiereSpalten', () => {
  it('behält die gewählte Reihenfolge bei', () => {
    expect(normalisiereSpalten('vorschau', ['aufgabe', 'termin', 'kategorie'])).toEqual(
      ['aufgabe', 'termin', 'kategorie'],
    )
  })

  it('entfernt unbekannte Schlüssel', () => {
    expect(
      normalisiereSpalten('vorschau', ['termin', 'gibtsnicht', 'aufgabe']),
    ).toEqual(['termin', 'aufgabe'])
  })

  it('entfernt Doppelungen', () => {
    expect(normalisiereSpalten('vorschau', ['termin', 'termin', 'aufgabe'])).toEqual([
      'termin',
      'aufgabe',
    ])
  })

  it('ergänzt fehlende Pflichtspalten', () => {
    // "termin" und "aufgabe" sind Pflicht und werden hinten angefügt.
    const ergebnis = normalisiereSpalten('vorschau', ['kategorie'])
    expect(ergebnis[0]).toBe('kategorie')
    expect(ergebnis).toContain('termin')
    expect(ergebnis).toContain('aufgabe')
  })

  it('fällt bei leerer Auswahl auf die Vorbelegung zurück', () => {
    expect(normalisiereSpalten('compliance', [])).toEqual(standardSpalten('compliance'))
  })

  it('liefert für jede Reportart eine brauchbare Auswahl', () => {
    for (const typ of REPORT_TYPEN) {
      const ergebnis = normalisiereSpalten(typ, ['unfug'])
      expect(ergebnis.length, typ).toBeGreaterThan(0)
      for (const pflicht of pflichtSpalten(typ)) {
        expect(ergebnis, `${typ}.${pflicht}`).toContain(pflicht)
      }
    }
  })
})

describe('spaltenAusSchluesseln', () => {
  it('löst Schlüssel in Definitionen auf', () => {
    const spalten = spaltenAusSchluesseln('vorschau', ['aufgabe', 'termin'])
    expect(spalten.map((s) => s.kopf)).toEqual(['Aufgabe', 'Termin'])
  })

  it('übergeht unbekannte Schlüssel', () => {
    expect(spaltenAusSchluesseln('vorschau', ['unfug'])).toEqual([])
  })
})

describe('eingebauteVorlage', () => {
  it('ist für jede Reportart brauchbar', () => {
    for (const typ of REPORT_TYPEN) {
      const vorlage = eingebauteVorlage(typ)
      expect(vorlage.typ).toBe(typ)
      expect(vorlage.spalten.length).toBeGreaterThan(0)
      expect(vorlage.istStandard).toBe(true)
      expect(vorlage.id).toBeNull()
    }
  })
})

describe('seitenMasse', () => {
  it('dreht die Seite im Querformat', () => {
    const hoch = seitenMasse('hoch')
    const quer = seitenMasse('quer')
    expect(hoch.breite).toBeLessThan(hoch.hoehe)
    expect(quer.breite).toBeGreaterThan(quer.hoehe)
    expect(quer.breite).toBeCloseTo(hoch.hoehe, 2)
    expect(quer.hoehe).toBeCloseTo(hoch.breite, 2)
  })
})

describe('saeubereText', () => {
  it('entfernt Ränder und vereinheitlicht Zeilenenden', () => {
    expect(saeubereText('  Zeile 1\r\nZeile 2  ')).toBe('Zeile 1\nZeile 2')
  })

  it('liefert null bei leerem Inhalt', () => {
    expect(saeubereText('')).toBeNull()
    expect(saeubereText('   ')).toBeNull()
    expect(saeubereText(null)).toBeNull()
    expect(saeubereText(undefined)).toBeNull()
  })

  it('begrenzt die Länge', () => {
    expect(saeubereText('x'.repeat(5000))).toHaveLength(2000)
  })
})

describe('pruefeVorlagenName', () => {
  it('übernimmt brauchbare Namen', () => {
    expect(pruefeVorlagenName('  Jahresaudit  ')).toBe('Jahresaudit')
    expect(pruefeVorlagenName('Kurzfassung   GF')).toBe('Kurzfassung GF')
  })

  it('weist zu kurze Namen ab', () => {
    expect(pruefeVorlagenName('AB')).toBeNull()
    expect(pruefeVorlagenName('')).toBeNull()
  })

  it('begrenzt die Länge', () => {
    expect(pruefeVorlagenName('x'.repeat(200))).toHaveLength(60)
  })
})
