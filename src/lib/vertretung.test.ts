import { describe, expect, it } from 'vitest'

import { parseISODate } from './dates'
import {
  beschreibeZeitraum,
  istVertretungAbgelaufen,
  istVertretungAktiv,
  istVertretungGeplant,
  loeseVertretung,
  pruefeVertretung,
  type Vertretung,
} from './vertretung'

const tag = (iso: string) => parseISODate(iso)
const HEUTE = tag('2026-08-10')

const vertretung = (teil: Partial<Vertretung> = {}): Vertretung => ({
  vertretungId: 'b',
  von: null,
  bis: null,
  ...teil,
})

describe('istVertretungAktiv', () => {
  it('gilt ohne Zeitraum ab sofort und bis auf Weiteres', () => {
    expect(istVertretungAktiv(vertretung(), HEUTE)).toBe(true)
  })

  it('gilt nicht ohne vertretende Person', () => {
    expect(istVertretungAktiv(vertretung({ vertretungId: null }), HEUTE)).toBe(
      false,
    )
  })

  it('greift erst ab dem ersten Tag der Abwesenheit', () => {
    const kuenftig = vertretung({ von: tag('2026-08-11') })
    expect(istVertretungAktiv(kuenftig, HEUTE)).toBe(false)
    expect(istVertretungAktiv(kuenftig, tag('2026-08-11'))).toBe(true)
  })

  it('zählt beide Grenzen mit', () => {
    // Wer „bis 12.08.“ abwesend ist, wird am 12.08. noch vertreten – alles
    // andere überrascht bei der Urlaubsplanung.
    const zeitraum = vertretung({ von: tag('2026-08-03'), bis: tag('2026-08-12') })
    expect(istVertretungAktiv(zeitraum, tag('2026-08-03'))).toBe(true)
    expect(istVertretungAktiv(zeitraum, tag('2026-08-12'))).toBe(true)
    expect(istVertretungAktiv(zeitraum, tag('2026-08-13'))).toBe(false)
  })
})

describe('Zustand einer hinterlegten Vertretung', () => {
  it('unterscheidet geplant, laufend und abgelaufen', () => {
    const geplant = vertretung({ von: tag('2026-09-01') })
    const abgelaufen = vertretung({ bis: tag('2026-08-01') })

    expect(istVertretungGeplant(geplant, HEUTE)).toBe(true)
    expect(istVertretungAktiv(geplant, HEUTE)).toBe(false)

    expect(istVertretungAbgelaufen(abgelaufen, HEUTE)).toBe(true)
    expect(istVertretungAktiv(abgelaufen, HEUTE)).toBe(false)

    expect(istVertretungGeplant(vertretung(), HEUTE)).toBe(false)
    expect(istVertretungAbgelaufen(vertretung(), HEUTE)).toBe(false)
  })
})

describe('pruefeVertretung', () => {
  const eingabe = (teil: Partial<Parameters<typeof pruefeVertretung>[0]> = {}) => ({
    personId: 'a',
    vertretungId: 'b',
    von: null,
    bis: null,
    vertretungAktiv: true,
    vertretungDarfDurchfuehren: true,
    ...teil,
  })

  it('lässt das Aufheben immer zu', () => {
    const ergebnis = pruefeVertretung(
      eingabe({ vertretungId: null, vertretungAktiv: false }),
    )
    expect(ergebnis).toEqual({ ok: true })
  })

  it('weist Selbstvertretung ab', () => {
    const ergebnis = pruefeVertretung(eingabe({ vertretungId: 'a' }))
    expect(ergebnis).toEqual({
      ok: false,
      fehler: 'Niemand kann sich selbst vertreten.',
    })
  })

  it('verlangt ein aktives Konto', () => {
    // Ein gesperrtes Konto liest keine Post – die Meldung ginge ins Leere.
    const ergebnis = pruefeVertretung(eingabe({ vertretungAktiv: false }))
    expect(ergebnis.ok).toBe(false)
  })

  it('verlangt das Recht, Prüfungen durchzuführen', () => {
    const ergebnis = pruefeVertretung(
      eingabe({ vertretungDarfDurchfuehren: false }),
    )
    expect(ergebnis.ok).toBe(false)
  })

  it('weist ein Ende vor dem Beginn ab', () => {
    const ergebnis = pruefeVertretung(
      eingabe({ von: tag('2026-08-10'), bis: tag('2026-08-01') }),
    )
    expect(ergebnis).toEqual({
      ok: false,
      fehler: 'Das Ende darf nicht vor dem Beginn liegen.',
    })
  })

  it('lässt einen eintägigen Zeitraum zu', () => {
    const ergebnis = pruefeVertretung(
      eingabe({ von: tag('2026-08-10'), bis: tag('2026-08-10') }),
    )
    expect(ergebnis).toEqual({ ok: true })
  })
})

describe('loeseVertretung', () => {
  it('bleibt bei der Person, wenn niemand vertritt', () => {
    const ergebnis = loeseVertretung('a', new Map(), HEUTE)
    expect(ergebnis).toEqual({ empfaengerId: 'a', kette: [], abgebrochen: false })
  })

  it('leitet an die vertretende Person weiter', () => {
    const karte = new Map([['a', vertretung({ vertretungId: 'b' })]])
    expect(loeseVertretung('a', karte, HEUTE)).toEqual({
      empfaengerId: 'b',
      kette: ['b'],
      abgebrochen: false,
    })
  })

  it('folgt einer Kette, wenn auch die Vertretung abwesend ist', () => {
    const karte = new Map([
      ['a', vertretung({ vertretungId: 'b' })],
      ['b', vertretung({ vertretungId: 'c' })],
    ])
    expect(loeseVertretung('a', karte, HEUTE)).toEqual({
      empfaengerId: 'c',
      kette: ['b', 'c'],
      abgebrochen: false,
    })
  })

  it('ignoriert Vertretungen außerhalb ihres Zeitraums', () => {
    const karte = new Map([
      ['a', vertretung({ vertretungId: 'b' })],
      ['b', vertretung({ vertretungId: 'c', von: tag('2026-09-01') })],
    ])
    expect(loeseVertretung('a', karte, HEUTE).empfaengerId).toBe('b')
  })

  it('bricht einen Ring ab, statt endlos zu laufen', () => {
    const karte = new Map([
      ['a', vertretung({ vertretungId: 'b' })],
      ['b', vertretung({ vertretungId: 'a' })],
    ])
    const ergebnis = loeseVertretung('a', karte, HEUTE)
    expect(ergebnis.empfaengerId).toBe('b')
    expect(ergebnis.abgebrochen).toBe(true)
  })

  it('bricht auch eine zu lange Kette ab', () => {
    const karte = new Map(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((id, index) => [
        id,
        vertretung({ vertretungId: ['b', 'c', 'd', 'e', 'f', 'g'][index] }),
      ]),
    )
    const ergebnis = loeseVertretung('a', karte, HEUTE)
    expect(ergebnis.abgebrochen).toBe(true)
    expect(ergebnis.kette).toHaveLength(5)
  })
})

describe('beschreibeZeitraum', () => {
  it('nennt beide Grenzen, sonst die offene Seite', () => {
    expect(beschreibeZeitraum(tag('2026-08-03'), tag('2026-08-12'))).toBe(
      '03.08.2026 bis 12.08.2026',
    )
    expect(beschreibeZeitraum(tag('2026-08-03'), null)).toBe('ab 03.08.2026')
    expect(beschreibeZeitraum(null, tag('2026-08-12'))).toBe('bis 12.08.2026')
    expect(beschreibeZeitraum(null, null)).toBe('bis auf Weiteres')
  })
})
