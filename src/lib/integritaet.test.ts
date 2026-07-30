import { describe, expect, it } from 'vitest'

import {
  MAX_BEFUNDE,
  fasseLaufZusammen,
  istUnversehrt,
  kappeBefunde,
  schwerwiegendeBefunde,
  type Befund,
  type LaufErgebnis,
} from './integritaet'

function befund(art: Befund['art'], nummer: number): Befund {
  return {
    art,
    pfad: `2026/07/datei-${nummer}.pdf`,
    dateiname: `Nachweis ${nummer}.pdf`,
    erwartet: 'a'.repeat(64),
    gefunden: art === 'ABWEICHEND' ? 'b'.repeat(64) : null,
  }
}

function lauf(teil: Partial<LaufErgebnis> = {}): LaufErgebnis {
  return {
    geprueft: 10,
    fehlend: 0,
    abweichend: 0,
    verwaist: 0,
    unlesbar: 0,
    befunde: [],
    dauerMs: 120,
    ...teil,
  }
}

describe('istUnversehrt', () => {
  it('gilt ohne Beanstandung', () => {
    expect(istUnversehrt(lauf())).toBe(true)
  })

  it('gilt nicht bei fehlender, veränderter oder unlesbarer Datei', () => {
    expect(istUnversehrt(lauf({ fehlend: 1 }))).toBe(false)
    expect(istUnversehrt(lauf({ abweichend: 1 }))).toBe(false)
    expect(istUnversehrt(lauf({ unlesbar: 1 }))).toBe(false)
  })

  it('bleibt bei einer verwaisten Datei erhalten', () => {
    // Eine Datei ohne Eintrag ist unordentlich, aber kein Beleg fehlt und
    // keiner wurde verändert.
    expect(istUnversehrt(lauf({ verwaist: 5 }))).toBe(true)
  })
})

describe('schwerwiegendeBefunde', () => {
  it('zählt nur, was die Beweiskraft betrifft', () => {
    expect(
      schwerwiegendeBefunde({ fehlend: 2, abweichend: 3, unlesbar: 1 }),
    ).toBe(6)
  })
})

describe('fasseLaufZusammen', () => {
  it('meldet einen sauberen Lauf', () => {
    const text = fasseLaufZusammen(lauf({ geprueft: 42 }))
    expect(text).toContain('42 Nachweise geprüft')
    expect(text).toContain('alle unverändert')
    expect(text).toContain('120 ms')
  })

  it('setzt den Singular richtig', () => {
    expect(fasseLaufZusammen(lauf({ geprueft: 1 }))).toContain('1 Nachweis geprüft')
  })

  it('nennt jede Art von Beanstandung', () => {
    const text = fasseLaufZusammen(
      lauf({ fehlend: 2, abweichend: 1, unlesbar: 3 }),
    )
    expect(text).toContain('2 fehlend')
    expect(text).toContain('1 verändert')
    expect(text).toContain('3 nicht lesbar')
    expect(text).not.toContain('alle unverändert')
  })

  it('führt verwaiste Dateien getrennt auf', () => {
    const eine = fasseLaufZusammen(lauf({ verwaist: 1 }))
    expect(eine).toContain('1 verwaiste Datei')
    expect(eine).toContain('alle unverändert')

    const mehrere = fasseLaufZusammen(lauf({ verwaist: 4 }))
    expect(mehrere).toContain('4 verwaiste Dateien')
  })
})

describe('kappeBefunde', () => {
  it('lässt kurze Listen unverändert', () => {
    const befunde = [befund('FEHLEND', 1), befund('VERWAIST', 2)]
    const ergebnis = kappeBefunde(befunde)

    expect(ergebnis.gespeichert).toHaveLength(2)
    expect(ergebnis.gekappt).toBe(0)
  })

  it('kappt lange Listen und meldet die Anzahl', () => {
    const befunde = Array.from({ length: MAX_BEFUNDE + 25 }, (_, i) =>
      befund('VERWAIST', i),
    )
    const ergebnis = kappeBefunde(befunde)

    expect(ergebnis.gespeichert).toHaveLength(MAX_BEFUNDE)
    expect(ergebnis.gekappt).toBe(25)
  })

  it('behält die schwerwiegenden Befunde, wenn gekappt wird', () => {
    // Verwaiste zuerst, die wichtigen ganz hinten – sie müssen dennoch
    // erhalten bleiben.
    const befunde = [
      ...Array.from({ length: MAX_BEFUNDE }, (_, i) => befund('VERWAIST', i)),
      befund('ABWEICHEND', 9001),
      befund('FEHLEND', 9002),
    ]
    const ergebnis = kappeBefunde(befunde)

    expect(ergebnis.gespeichert.some((b) => b.art === 'ABWEICHEND')).toBe(true)
    expect(ergebnis.gespeichert.some((b) => b.art === 'FEHLEND')).toBe(true)
    expect(ergebnis.gekappt).toBe(2)
  })

  it('verändert die übergebene Liste nicht', () => {
    const befunde = [
      ...Array.from({ length: MAX_BEFUNDE }, (_, i) => befund('VERWAIST', i)),
      befund('ABWEICHEND', 9001),
    ]
    kappeBefunde(befunde)
    expect(befunde[0].art).toBe('VERWAIST')
    expect(befunde.at(-1)?.art).toBe('ABWEICHEND')
  })
})
