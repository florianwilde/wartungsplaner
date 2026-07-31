import { describe, expect, it } from 'vitest'

import {
  KONTRAST_AA,
  abdunkeln,
  aufhellen,
  besterKontrast,
  erreichtKontrastAA,
  hexZuRgb,
  istHexFarbe,
  kontrastVerhaeltnis,
  leiteFarbschemaAb,
  lesbareVordergrundfarbe,
  mische,
  normalisiereHex,
  relativeLeuchtdichte,
  rgbZuHex,
} from './farben'

describe('istHexFarbe', () => {
  it('erkennt gültige Farben', () => {
    expect(istHexFarbe('#2563eb')).toBe(true)
    expect(istHexFarbe('#FFFFFF')).toBe(true)
  })

  it('weist ungültige Eingaben ab', () => {
    expect(istHexFarbe('2563eb')).toBe(false)
    expect(istHexFarbe('#abc')).toBe(false)
    expect(istHexFarbe('rot')).toBe(false)
    expect(istHexFarbe('#12345g')).toBe(false)
  })
})

describe('normalisiereHex', () => {
  it('ergänzt die Raute und schreibt klein', () => {
    expect(normalisiereHex('2563EB')).toBe('#2563eb')
    expect(normalisiereHex('  #0EA5E9  ')).toBe('#0ea5e9')
  })

  it('erweitert die Kurzform', () => {
    expect(normalisiereHex('#abc')).toBe('#aabbcc')
    expect(normalisiereHex('f00')).toBe('#ff0000')
  })

  it('liefert null bei ungültiger Eingabe', () => {
    expect(normalisiereHex('blau')).toBeNull()
    expect(normalisiereHex('#12345')).toBeNull()
    expect(normalisiereHex('')).toBeNull()
  })
})

describe('hexZuRgb und rgbZuHex', () => {
  it('rechnet in beide Richtungen', () => {
    expect(hexZuRgb('#2563eb')).toEqual({ r: 37, g: 99, b: 235 })
    expect(rgbZuHex({ r: 37, g: 99, b: 235 })).toBe('#2563eb')
  })

  it('begrenzt Werte außerhalb des gültigen Bereichs', () => {
    expect(rgbZuHex({ r: -20, g: 300, b: 128 })).toBe('#00ff80')
  })

  it('wirft bei ungültiger Farbe', () => {
    expect(() => hexZuRgb('kein-hex')).toThrow(/Ungültige Farbe/)
  })
})

describe('relativeLeuchtdichte', () => {
  it('liefert die Randwerte für Schwarz und Weiß', () => {
    expect(relativeLeuchtdichte('#000000')).toBeCloseTo(0, 5)
    expect(relativeLeuchtdichte('#ffffff')).toBeCloseTo(1, 5)
  })
})

describe('kontrastVerhaeltnis', () => {
  it('liefert 21 für Schwarz auf Weiß', () => {
    expect(kontrastVerhaeltnis('#000000', '#ffffff')).toBeCloseTo(21, 2)
  })

  it('liefert 1 für identische Farben', () => {
    expect(kontrastVerhaeltnis('#2563eb', '#2563eb')).toBeCloseTo(1, 5)
  })

  it('ist symmetrisch', () => {
    expect(kontrastVerhaeltnis('#2563eb', '#ffffff')).toBeCloseTo(
      kontrastVerhaeltnis('#ffffff', '#2563eb'),
      5,
    )
  })
})

describe('lesbareVordergrundfarbe', () => {
  it('wählt Weiß auf dunklem Grund', () => {
    expect(lesbareVordergrundfarbe('#2563eb')).toBe('#ffffff')
    expect(lesbareVordergrundfarbe('#000000')).toBe('#ffffff')
  })

  it('wählt Anthrazit auf hellem Grund', () => {
    expect(lesbareVordergrundfarbe('#ffffff')).toBe('#1c1c1c')
    expect(lesbareVordergrundfarbe('#ffe066')).toBe('#1c1c1c')
  })

  it('wählt immer die kontraststärkere der beiden Möglichkeiten', () => {
    for (const farbe of ['#2563eb', '#0ea5e9', '#ffe066', '#7f7f7f', '#111111']) {
      const gewaehlt = lesbareVordergrundfarbe(farbe)
      const andere = gewaehlt === '#ffffff' ? '#1c1c1c' : '#ffffff'
      expect(
        kontrastVerhaeltnis(farbe, gewaehlt),
        `Farbe ${farbe}`,
      ).toBeGreaterThanOrEqual(kontrastVerhaeltnis(farbe, andere))
    }
  })
})

describe('erreichtKontrastAA', () => {
  it('bestätigt AA für ausreichend kontrastreiche Marken­farben', () => {
    expect(erreichtKontrastAA('#2563eb')).toBe(true)
    expect(erreichtKontrastAA('#175a8c')).toBe(true)
    expect(erreichtKontrastAA('#ffe066')).toBe(true)
  })

  it('meldet mittlere Helligkeiten als nicht AA-tauglich', () => {
    // Bei Mittelgrau ist AA mit keiner Vordergrundfarbe erreichbar –
    // das ist eine Eigenschaft der WCAG-Formel, kein Rechenfehler.
    expect(erreichtKontrastAA('#7f7f7f')).toBe(false)
    expect(besterKontrast('#7f7f7f')).toBeLessThan(KONTRAST_AA)
  })
})

describe('mische, aufhellen, abdunkeln', () => {
  it('liefert an den Rändern die Ausgangsfarben', () => {
    expect(mische('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mische('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('mischt zur Hälfte', () => {
    expect(mische('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('begrenzt Anteile außerhalb von 0 bis 1', () => {
    expect(mische('#000000', '#ffffff', -1)).toBe('#000000')
    expect(mische('#000000', '#ffffff', 5)).toBe('#ffffff')
  })

  it('hellt auf und dunkelt ab', () => {
    expect(relativeLeuchtdichte(aufhellen('#2563eb', 0.5))).toBeGreaterThan(
      relativeLeuchtdichte('#2563eb'),
    )
    expect(relativeLeuchtdichte(abdunkeln('#2563eb', 0.5))).toBeLessThan(
      relativeLeuchtdichte('#2563eb'),
    )
  })
})

describe('leiteFarbschemaAb', () => {
  it('liefert für beide Schemata lesbare Vordergrundfarben', () => {
    const schema = leiteFarbschemaAb('#2563eb', '#0ea5e9')

    expect(
      kontrastVerhaeltnis(schema.hell.primary, schema.hell.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      kontrastVerhaeltnis(schema.dunkel.primary, schema.dunkel.primaryForeground),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('hellt die Primärfarbe für das dunkle Schema auf', () => {
    const schema = leiteFarbschemaAb('#175a8c', '#0ea5e9')
    expect(relativeLeuchtdichte(schema.dunkel.primary)).toBeGreaterThan(
      relativeLeuchtdichte(schema.hell.primary),
    )
  })
})
