import { describe, expect, it } from 'vitest'

import {
  MAX_SAMMELAKTION,
  fasseErgebnisZusammen,
  pruefeSammelloeschung,
  type Kandidat,
} from './sammelaktion'

const frei = (id: string, bezeichnung = id): Kandidat => ({
  id,
  bezeichnung,
  abhaengige: 0,
  abhaengigeArt: 'Durchführungen',
})

const belegt = (id: string, anzahl: number, bezeichnung = id): Kandidat => ({
  id,
  bezeichnung,
  abhaengige: anzahl,
  abhaengigeArt: 'Durchführungen',
})

describe('pruefeSammelloeschung', () => {
  it('lässt Einträge ohne Abhängigkeiten zu', () => {
    const ergebnis = pruefeSammelloeschung([frei('a'), frei('b')])
    expect(ergebnis).toEqual({ ok: true, ids: ['a', 'b'] })
  })

  it('lehnt eine leere Markierung ab', () => {
    const ergebnis = pruefeSammelloeschung([])
    expect(ergebnis.ok).toBe(false)
  })

  it('lehnt den gesamten Vorgang ab, sobald ein Eintrag hängt', () => {
    // Alles oder nichts: Ein teilweise ausgeführtes Löschen hinterließe die
    // Frage, was nun gilt.
    const ergebnis = pruefeSammelloeschung([frei('a'), belegt('b', 3), frei('c')])
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.blockiert).toHaveLength(1)
      expect(ergebnis.blockiert[0].id).toBe('b')
    }
  })

  it('benennt die blockierenden Einträge samt Anzahl', () => {
    const ergebnis = pruefeSammelloeschung([
      belegt('a', 3, 'Restore-Test ERP'),
    ])
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.fehler).toContain('Restore-Test ERP')
      expect(ergebnis.fehler).toContain('3 Durchführungen')
    }
  })

  it('nennt höchstens drei und zählt den Rest', () => {
    // Bei zwanzig blockierten Einträgen ist eine vollständige Liste in einer
    // Meldung unlesbar.
    const viele = Array.from({ length: 7 }, (_, i) => belegt(`id-${i}`, 1))
    const ergebnis = pruefeSammelloeschung(viele)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) {
      expect(ergebnis.fehler).toContain('und 4 weitere')
    }
  })

  it('begrenzt die Anzahl je Vorgang', () => {
    const zuViele = Array.from({ length: MAX_SAMMELAKTION + 1 }, (_, i) =>
      frei(`id-${i}`),
    )
    const ergebnis = pruefeSammelloeschung(zuViele)
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain(String(MAX_SAMMELAKTION))
  })

  it('lässt genau die Höchstzahl zu', () => {
    const genau = Array.from({ length: MAX_SAMMELAKTION }, (_, i) => frei(`id-${i}`))
    expect(pruefeSammelloeschung(genau).ok).toBe(true)
  })
})

describe('fasseErgebnisZusammen', () => {
  it('beugt die Mehrzahl richtig', () => {
    expect(fasseErgebnisZusammen(1, 'Aufgabe', 'Aufgaben', 'gelöscht')).toBe(
      '1 Aufgabe gelöscht.',
    )
    expect(fasseErgebnisZusammen(3, 'Aufgabe', 'Aufgaben', 'gelöscht')).toBe(
      '3 Aufgaben gelöscht.',
    )
    expect(fasseErgebnisZusammen(0, 'Aufgabe', 'Aufgaben', 'gelöscht')).toBe(
      '0 Aufgaben gelöscht.',
    )
  })
})
