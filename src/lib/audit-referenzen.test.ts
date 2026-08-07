import { describe, expect, it } from 'vitest'

import {
  anzeigeName,
  langName,
  nachRahmenwerk,
  pruefeReferenz,
  saeubere,
  vergleicheKuerzel,
} from './audit-referenzen'

const eingabe = (teil: Partial<Record<string, string>> = {}) => ({
  kuerzel: 'A.8.13',
  bezeichnung: 'Informationssicherung',
  rahmenwerk: 'ISO 27001',
  beschreibung: '',
  ...teil,
})

describe('saeubere', () => {
  it('fasst Leerraum zusammen und schneidet Ränder', () => {
    expect(saeubere('  viel   Luft  ', 100)).toBe('viel Luft')
  })

  it('liefert null für leere Angaben', () => {
    expect(saeubere('', 100)).toBeNull()
    expect(saeubere('   ', 100)).toBeNull()
    expect(saeubere(null, 100)).toBeNull()
    expect(saeubere(undefined, 100)).toBeNull()
  })

  it('kürzt auf die Höchstlänge', () => {
    expect(saeubere('x'.repeat(200), 20)).toHaveLength(20)
  })
})

describe('pruefeReferenz', () => {
  it('nimmt vollständige Angaben an', () => {
    const ergebnis = pruefeReferenz(eingabe())
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) {
      expect(ergebnis.wert.kuerzel).toBe('A.8.13')
      expect(ergebnis.wert.rahmenwerk).toBe('ISO 27001')
      expect(ergebnis.wert.beschreibung).toBeNull()
    }
  })

  it('verlangt ein Kurzzeichen', () => {
    const ergebnis = pruefeReferenz(eingabe({ kuerzel: '   ' }))
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('Kurzzeichen')
  })

  it('setzt das Kurzzeichen als Bezeichnung, wenn keine angegeben ist', () => {
    // Bei aus Freitexten übernommenen Referenzen ist das der Normalfall.
    const ergebnis = pruefeReferenz(eingabe({ bezeichnung: '' }))
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.wert.bezeichnung).toBe('A.8.13')
  })

  it('lässt das Rahmenwerk weg, wenn es fehlt', () => {
    const ergebnis = pruefeReferenz(eingabe({ rahmenwerk: '' }))
    expect(ergebnis.ok).toBe(true)
    if (ergebnis.ok) expect(ergebnis.wert.rahmenwerk).toBeNull()
  })
})

describe('anzeigeName und langName', () => {
  it('stellt das Rahmenwerk voran', () => {
    expect(anzeigeName({ kuerzel: 'A.8.13', rahmenwerk: 'ISO 27001' })).toBe(
      'ISO 27001 A.8.13',
    )
  })

  it('kommt ohne Rahmenwerk aus', () => {
    expect(anzeigeName({ kuerzel: 'A.8.13', rahmenwerk: null })).toBe('A.8.13')
  })

  it('hängt die Bezeichnung an, wenn sie etwas hinzufügt', () => {
    expect(
      langName({
        kuerzel: 'A.8.13',
        bezeichnung: 'Informationssicherung',
        rahmenwerk: 'ISO 27001',
      }),
    ).toBe('ISO 27001 A.8.13 – Informationssicherung')
  })

  it('wiederholt das Kurzzeichen nicht', () => {
    expect(
      langName({ kuerzel: 'A.8.13', bezeichnung: 'A.8.13', rahmenwerk: null }),
    ).toBe('A.8.13')
  })
})

describe('nachRahmenwerk', () => {
  it('gruppiert und sortiert die Rahmenwerke', () => {
    const gruppen = nachRahmenwerk([
      { rahmenwerk: 'TISAX' },
      { rahmenwerk: 'ISO 27001' },
      { rahmenwerk: 'ISO 27001' },
    ])

    expect(gruppen.map((g) => g.rahmenwerk)).toEqual(['ISO 27001', 'TISAX'])
    expect(gruppen[0].eintraege).toHaveLength(2)
  })

  it('stellt Referenzen ohne Rahmenwerk ans Ende', () => {
    // Sie sollen sichtbar bleiben und zum Nachpflegen einladen.
    const gruppen = nachRahmenwerk([{ rahmenwerk: null }, { rahmenwerk: 'ISO 27001' }])

    expect(gruppen.at(-1)?.rahmenwerk).toBeNull()
  })
})

describe('vergleicheKuerzel', () => {
  it('sortiert nach Zahlen statt alphabetisch', () => {
    // Alphabetisch stünde A.8.13 vor A.8.8 – das ist nicht gemeint.
    expect(vergleicheKuerzel('A.8.8', 'A.8.13')).toBeLessThan(0)
  })

  it('ordnet Buchstabenteile alphabetisch', () => {
    expect(vergleicheKuerzel('A.5.1', 'B.1.1')).toBeLessThan(0)
  })

  it('stellt kürzere Kurzzeichen voran', () => {
    expect(vergleicheKuerzel('A.8', 'A.8.1')).toBeLessThan(0)
  })

  it('erkennt Gleichheit', () => {
    expect(vergleicheKuerzel('A.8.13', 'A.8.13')).toBe(0)
  })

  it('kommt mit Bindestrichen und Leerzeichen zurecht', () => {
    expect(vergleicheKuerzel('1-2', '1-10')).toBeLessThan(0)
    expect(vergleicheKuerzel('Kap 2', 'Kap 10')).toBeLessThan(0)
  })

  it('ergibt eine brauchbare Gesamtsortierung', () => {
    const kuerzel = ['A.8.13', 'A.5.1', 'A.8.8', 'A.10.1', 'A.8']
    expect([...kuerzel].sort(vergleicheKuerzel)).toEqual([
      'A.5.1',
      'A.8',
      'A.8.8',
      'A.8.13',
      'A.10.1',
    ])
  })
})
