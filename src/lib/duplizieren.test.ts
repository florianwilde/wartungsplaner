import { describe, expect, it } from 'vitest'

import {
  MAX_KOPIEN,
  eindeutigerName,
  leseTitel,
  nameFuerBogenKopie,
  vorschlagFuerKopie,
} from './duplizieren'

describe('leseTitel', () => {
  it('nimmt einen Titel je Zeile', () => {
    const ergebnis = leseTitel('Restore-Test DC01\nRestore-Test DC02')
    expect(ergebnis).toEqual({
      ok: true,
      titel: ['Restore-Test DC01', 'Restore-Test DC02'],
    })
  })

  it('übergeht Leerzeilen und Leerraum', () => {
    // Aus einer Tabelle eingefügt sieht das regelmäßig so aus.
    const ergebnis = leseTitel('  Erste \n\n\r\n\tZweite\n   \n')
    expect(ergebnis).toEqual({ ok: true, titel: ['Erste', 'Zweite'] })
  })

  it('fasst Doppelte zusammen, statt daran zu scheitern', () => {
    const ergebnis = leseTitel('Firewall\nfirewall\nFirewall ')
    expect(ergebnis).toEqual({ ok: true, titel: ['Firewall'] })
  })

  it('verlangt mindestens einen Titel', () => {
    expect(leseTitel('   \n  ').ok).toBe(false)
  })

  it('weist zu kurze Titel ab', () => {
    const ergebnis = leseTitel('Gut genug\nab')
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('zu kurz')
  })

  it('weist zu lange Titel ab', () => {
    const ergebnis = leseTitel('x'.repeat(201))
    expect(ergebnis.ok).toBe(false)
  })

  it('begrenzt die Anzahl', () => {
    const viele = Array.from({ length: MAX_KOPIEN + 1 }, (_, i) => `Aufgabe ${i}`)
    const ergebnis = leseTitel(viele.join('\n'))
    expect(ergebnis.ok).toBe(false)
    if (!ergebnis.ok) expect(ergebnis.fehler).toContain('Import')
  })

  it('lässt genau die Höchstzahl zu', () => {
    const viele = Array.from({ length: MAX_KOPIEN }, (_, i) => `Aufgabe ${i}`)
    expect(leseTitel(viele.join('\n')).ok).toBe(true)
  })
})

describe('vorschlagFuerKopie', () => {
  it('hängt beim ersten Mal „(Kopie)“ an', () => {
    expect(vorschlagFuerKopie('Restore-Test')).toBe('Restore-Test (Kopie)')
  })

  it('zählt weiter, statt zu stapeln', () => {
    expect(vorschlagFuerKopie('Restore-Test (Kopie)')).toBe(
      'Restore-Test (Kopie 2)',
    )
    expect(vorschlagFuerKopie('Restore-Test (Kopie 2)')).toBe(
      'Restore-Test (Kopie 3)',
    )
  })

  it('lässt eine Klammer im Titel unangetastet', () => {
    expect(vorschlagFuerKopie('Prüfung (jährlich)')).toBe(
      'Prüfung (jährlich) (Kopie)',
    )
  })
})

describe('eindeutigerName', () => {
  it('lässt einen freien Namen unverändert', () => {
    expect(eindeutigerName('Bogen', new Set())).toBe('Bogen')
  })

  it('zählt bei Kollision hoch', () => {
    expect(eindeutigerName('Bogen', new Set(['Bogen']))).toBe('Bogen (2)')
    expect(eindeutigerName('Bogen', new Set(['Bogen', 'Bogen (2)']))).toBe(
      'Bogen (3)',
    )
  })

  it('hält die Höchstlänge ein', () => {
    const lang = 'x'.repeat(30)
    expect(eindeutigerName(lang, new Set(), 10)).toHaveLength(10)
    const kollision = eindeutigerName(lang, new Set([lang.slice(0, 10)]), 10)
    expect(kollision.length).toBeLessThanOrEqual(10)
    expect(kollision.endsWith(' (2)')).toBe(true)
  })
})

describe('nameFuerBogenKopie', () => {
  it('nennt die Aufgabe im Namen', () => {
    // Sonst stehen in der Verwaltung zehn gleich benannte Bögen.
    expect(nameFuerBogenKopie('Rezertifizierung', 'AD Standort Nord')).toBe(
      'Rezertifizierung – AD Standort Nord',
    )
  })
})
