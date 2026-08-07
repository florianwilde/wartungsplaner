import { describe, expect, it } from 'vitest'

import {
  BESTAETIGUNGSWORT,
  MAX_SAMMELAKTION,
  beschreibeVerlust,
  fasseErgebnisZusammen,
  pruefeErzwingen,
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
    const ergebnis = pruefeSammelloeschung([belegt('a', 3, 'Restore-Test ERP')])
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

describe('pruefeErzwingen', () => {
  const eingabe = (teil: Partial<Parameters<typeof pruefeErzwingen>[0]> = {}) => ({
    ids: ['a'],
    begruendung: 'Testdaten aus der Einführungsphase, mit der IT-Leitung abgestimmt.',
    bestaetigung: BESTAETIGUNGSWORT,
    ...teil,
  })

  it('lässt eine vollständige Eingabe zu', () => {
    expect(pruefeErzwingen(eingabe())).toEqual({ ok: true })
  })

  it('verlangt eine Markierung', () => {
    expect(pruefeErzwingen(eingabe({ ids: [] })).ok).toBe(false)
  })

  it('verlangt eine tragfähige Begründung', () => {
    // „test" hilft in zwei Jahren niemandem, der wissen will, warum ein
    // Nachweis fehlt.
    const ergebnis = pruefeErzwingen(eingabe({ begruendung: 'test' }))
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('Audit-Log')
  })

  it('zählt Leerraum nicht als Begründung', () => {
    expect(pruefeErzwingen(eingabe({ begruendung: '   ' + ' '.repeat(30) })).ok).toBe(
      false,
    )
  })

  it('begrenzt die Länge der Begründung', () => {
    expect(pruefeErzwingen(eingabe({ begruendung: 'x'.repeat(1001) })).ok).toBe(false)
  })

  it('verlangt das abgetippte Bestätigungswort', () => {
    // Ein Klick auf „OK" passiert versehentlich, das Abtippen eines Wortes
    // nicht.
    const ergebnis = pruefeErzwingen(eingabe({ bestaetigung: 'ja' }))
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain(BESTAETIGUNGSWORT)
  })

  it('nimmt die Bestätigung auch in Kleinschreibung an', () => {
    expect(pruefeErzwingen(eingabe({ bestaetigung: ' loeschen ' })).ok).toBe(true)
  })

  it('begrenzt die Anzahl je Vorgang', () => {
    const viele = Array.from({ length: MAX_SAMMELAKTION + 1 }, (_, i) => `id-${i}`)
    expect(pruefeErzwingen(eingabe({ ids: viele })).ok).toBe(false)
  })
})

describe('beschreibeVerlust', () => {
  const leer = {
    aufgaben: 0,
    faelligkeiten: 0,
    durchfuehrungen: 0,
    nachweisdateien: 0,
    abweichungen: 0,
    pruefnachweise: 0,
    pruefboegen: 0,
  }

  it('nennt nur, was tatsächlich betroffen ist', () => {
    // Eine Aufzählung mit fünf Nullen darin liest niemand zu Ende.
    const text = beschreibeVerlust({
      ...leer,
      aufgaben: 2,
      durchfuehrungen: 7,
      nachweisdateien: 3,
    })
    expect(text).toBe('2 Aufgaben, 7 Durchführungen, 3 Nachweisdateien')
    expect(text).not.toContain('0')
  })

  it('beugt die Einzahl richtig', () => {
    expect(beschreibeVerlust({ ...leer, aufgaben: 1, durchfuehrungen: 1 })).toBe(
      '1 Aufgabe, 1 Durchführung',
    )
  })

  it('liefert bei nichts Betroffenem eine leere Zeichenkette', () => {
    expect(beschreibeVerlust(leer)).toBe('')
  })
})
