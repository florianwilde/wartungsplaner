import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  MAX_MONATE,
  MIN_MONATE,
  begrenzeFrist,
  fasseAufbewahrungZusammen,
  fristText,
  geltendeFrist,
  istFaellig,
  stichtagFuer,
  type AufbewahrungsErgebnis,
} from './aufbewahrung'

const HEUTE = dateOnly(2026, 7, 30)

describe('geltendeFrist', () => {
  it('nimmt die Frist der Kategorie, wenn eine gesetzt ist', () => {
    expect(geltendeFrist(36, 120)).toEqual({ monate: 36, quelle: 'kategorie' })
  })

  it('fällt auf die globale Vorgabe zurück', () => {
    expect(geltendeFrist(null, 120)).toEqual({ monate: 120, quelle: 'standard' })
    expect(geltendeFrist(undefined, 120)).toEqual({
      monate: 120,
      quelle: 'standard',
    })
  })

  it('behandelt 0 wie „nicht gesetzt“', () => {
    // Sonst würde eine versehentliche 0 alles sofort löschen.
    expect(geltendeFrist(0, 120)).toEqual({ monate: 120, quelle: 'standard' })
  })
})

describe('stichtagFuer', () => {
  it('rechnet die Frist zurück', () => {
    expect(stichtagFuer(HEUTE, 12)).toEqual(dateOnly(2025, 7, 30))
    expect(stichtagFuer(HEUTE, 120)).toEqual(dateOnly(2016, 7, 30))
  })

  it('schneidet die Uhrzeit ab', () => {
    const mitUhrzeit = new Date(Date.UTC(2026, 6, 30, 15, 45))
    expect(stichtagFuer(mitUhrzeit, 12)).toEqual(dateOnly(2025, 7, 30))
  })
})

describe('istFaellig', () => {
  it('ist fällig, wenn die Durchführung vor dem Stichtag liegt', () => {
    expect(istFaellig(dateOnly(2016, 7, 29), HEUTE, 120)).toBe(true)
  })

  it('ist am Stichtag selbst noch nicht fällig', () => {
    // Im Zweifel für den Bestand: Eine Datei einen Tag zu lang zu behalten
    // ist harmlos, sie einen Tag zu früh zu löschen nicht.
    expect(istFaellig(dateOnly(2016, 7, 30), HEUTE, 120)).toBe(false)
  })

  it('ist bei jüngeren Durchführungen nicht fällig', () => {
    expect(istFaellig(dateOnly(2026, 1, 1), HEUTE, 120)).toBe(false)
  })

  it('achtet auf die Frist, nicht auf ein festes Alter', () => {
    const durchgefuehrt = dateOnly(2024, 1, 1)
    expect(istFaellig(durchgefuehrt, HEUTE, 12)).toBe(true)
    expect(istFaellig(durchgefuehrt, HEUTE, 120)).toBe(false)
  })
})

describe('begrenzeFrist', () => {
  it('lässt zulässige Werte durch', () => {
    expect(begrenzeFrist(36)).toBe(36)
  })

  it('begrenzt nach unten und oben', () => {
    expect(begrenzeFrist(1)).toBe(MIN_MONATE)
    expect(begrenzeFrist(-5)).toBe(MIN_MONATE)
    expect(begrenzeFrist(9999)).toBe(MAX_MONATE)
  })

  it('fängt unbrauchbare Eingaben ab', () => {
    expect(begrenzeFrist(Number.NaN)).toBe(MIN_MONATE)
    expect(begrenzeFrist(Number.POSITIVE_INFINITY)).toBe(MIN_MONATE)
  })

  it('schneidet Nachkommastellen ab', () => {
    expect(begrenzeFrist(36.9)).toBe(36)
  })
})

describe('fristText', () => {
  it('rechnet volle Jahre um', () => {
    expect(fristText(12)).toBe('1 Jahr')
    expect(fristText(120)).toBe('10 Jahre')
  })

  it('bleibt sonst bei Monaten', () => {
    expect(fristText(18)).toBe('18 Monate')
    expect(fristText(1)).toBe('1 Monat')
  })
})

describe('fasseAufbewahrungZusammen', () => {
  const lauf = (teil: Partial<AufbewahrungsErgebnis> = {}): AufbewahrungsErgebnis => ({
    geprueft: 100,
    entfernt: 0,
    freigegebenBytes: 0,
    fehlgeschlagen: 0,
    dauerMs: 45,
    ...teil,
  })

  it('meldet einen Lauf ohne Fälligkeiten', () => {
    expect(fasseAufbewahrungZusammen(lauf(), false)).toContain('nichts zu entfernen')
  })

  it('unterscheidet Vorschau und tatsächlichen Lauf', () => {
    const daten = lauf({ entfernt: 3, freigegebenBytes: 2048 })

    expect(fasseAufbewahrungZusammen(daten, true)).toContain('wären zu entfernen')
    expect(fasseAufbewahrungZusammen(daten, false)).toContain('3 entfernt')
  })

  it('nennt den freigewordenen Platz', () => {
    const text = fasseAufbewahrungZusammen(
      lauf({ entfernt: 1, freigegebenBytes: 5 * 1024 * 1024 }),
      false,
    )
    expect(text).toContain('5.0 MB')
  })

  it('weist Fehlschläge aus', () => {
    const text = fasseAufbewahrungZusammen(
      lauf({ entfernt: 2, fehlgeschlagen: 1 }),
      false,
    )
    expect(text).toContain('1 fehlgeschlagen')
  })
})
