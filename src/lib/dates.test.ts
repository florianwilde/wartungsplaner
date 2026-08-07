import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  compareDates,
  dateOnly,
  differenceInDays,
  endOfMonth,
  endOfWeek,
  formatDate,
  formatDateTime,
  isSameDay,
  parseISODate,
  startOfMonth,
  startOfWeek,
  toBerlinDateOnly,
  toDateOnly,
  toISODate,
} from './dates'

describe('dateOnly / toDateOnly', () => {
  it('erzeugt UTC-Mitternacht', () => {
    const d = dateOnly(2026, 3, 15)
    expect(d.toISOString()).toBe('2026-03-15T00:00:00.000Z')
  })

  it('schneidet die Uhrzeit ab', () => {
    const mitZeit = new Date('2026-03-15T22:45:12.345Z')
    expect(toDateOnly(mitZeit).toISOString()).toBe('2026-03-15T00:00:00.000Z')
  })
})

describe('toBerlinDateOnly', () => {
  it('ordnet einen Zeitpunkt dem Berliner Kalendertag zu (Winterzeit)', () => {
    // 31.01.2026 23:30 UTC = 01.02.2026 00:30 in Berlin (UTC+1)
    const instant = new Date('2026-01-31T23:30:00.000Z')
    expect(toBerlinDateOnly(instant).toISOString()).toBe('2026-02-01T00:00:00.000Z')
  })

  it('ordnet einen Zeitpunkt dem Berliner Kalendertag zu (Sommerzeit)', () => {
    // 30.06.2026 22:30 UTC = 01.07.2026 00:30 in Berlin (UTC+2)
    const instant = new Date('2026-06-30T22:30:00.000Z')
    expect(toBerlinDateOnly(instant).toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('bleibt am selben Tag, wenn Berlin noch nicht gewechselt hat', () => {
    // 01.07.2026 21:30 UTC = 01.07.2026 23:30 in Berlin
    const instant = new Date('2026-07-01T21:30:00.000Z')
    expect(toBerlinDateOnly(instant).toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  it('funktioniert am Tag der Zeitumstellung', () => {
    // Umstellung auf Sommerzeit: 29.03.2026, 02:00 -> 03:00 MEZ/MESZ
    const instant = new Date('2026-03-29T01:30:00.000Z')
    expect(toBerlinDateOnly(instant).toISOString()).toBe('2026-03-29T00:00:00.000Z')
  })
})

describe('addDays', () => {
  it('addiert und subtrahiert Tage', () => {
    expect(addDays(dateOnly(2026, 1, 30), 5).toISOString()).toBe(
      '2026-02-04T00:00:00.000Z',
    )
    expect(addDays(dateOnly(2026, 1, 3), -5).toISOString()).toBe(
      '2025-12-29T00:00:00.000Z',
    )
  })

  it('überschreitet Sommer-/Winterzeitgrenzen ohne Tagesverlust', () => {
    // Über die Umstellung hinweg müssen es exakt 7 Tage bleiben.
    const vorher = dateOnly(2026, 3, 26)
    expect(addDays(vorher, 7).toISOString()).toBe('2026-04-02T00:00:00.000Z')
  })

  it('verändert das Ausgangsdatum nicht', () => {
    const basis = dateOnly(2026, 5, 10)
    addDays(basis, 30)
    expect(basis.toISOString()).toBe('2026-05-10T00:00:00.000Z')
  })
})

describe('addMonths', () => {
  it('addiert volle Monate', () => {
    expect(addMonths(dateOnly(2026, 1, 15), 3).toISOString()).toBe(
      '2026-04-15T00:00:00.000Z',
    )
  })

  it('begrenzt auf den letzten Tag des Zielmonats', () => {
    expect(addMonths(dateOnly(2026, 1, 31), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(addMonths(dateOnly(2026, 3, 31), 1).toISOString()).toBe(
      '2026-04-30T00:00:00.000Z',
    )
  })

  it('berücksichtigt Schaltjahre', () => {
    expect(addMonths(dateOnly(2028, 1, 31), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    )
    expect(addMonths(dateOnly(2028, 2, 29), 12).toISOString()).toBe(
      '2029-02-28T00:00:00.000Z',
    )
  })

  it('rechnet über Jahresgrenzen', () => {
    expect(addMonths(dateOnly(2026, 11, 15), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    )
  })
})

describe('differenceInDays / compareDates / isSameDay', () => {
  it('zählt ganze Tage', () => {
    expect(differenceInDays(dateOnly(2026, 3, 1), dateOnly(2026, 3, 11))).toBe(11 - 1)
    expect(differenceInDays(dateOnly(2026, 3, 11), dateOnly(2026, 3, 1))).toBe(-10)
  })

  it('zählt über die Zeitumstellung korrekt', () => {
    expect(differenceInDays(dateOnly(2026, 3, 28), dateOnly(2026, 3, 30))).toBe(2)
    expect(differenceInDays(dateOnly(2026, 10, 24), dateOnly(2026, 10, 26))).toBe(2)
  })

  it('vergleicht Kalendertage', () => {
    expect(compareDates(dateOnly(2026, 1, 1), dateOnly(2026, 1, 2))).toBeLessThan(0)
    expect(compareDates(dateOnly(2026, 1, 2), dateOnly(2026, 1, 1))).toBeGreaterThan(0)
    expect(compareDates(dateOnly(2026, 1, 1), dateOnly(2026, 1, 1))).toBe(0)
    expect(isSameDay(dateOnly(2026, 1, 1), new Date('2026-01-01T18:00:00Z'))).toBe(true)
  })
})

describe('Wochen- und Monatsgrenzen', () => {
  it('startOfWeek liefert den Montag', () => {
    // 15.07.2026 ist ein Mittwoch
    expect(startOfWeek(dateOnly(2026, 7, 15)).toISOString()).toBe(
      '2026-07-13T00:00:00.000Z',
    )
    // Sonntag gehört noch zur laufenden Woche
    expect(startOfWeek(dateOnly(2026, 7, 19)).toISOString()).toBe(
      '2026-07-13T00:00:00.000Z',
    )
    // Montag bleibt unverändert
    expect(startOfWeek(dateOnly(2026, 7, 13)).toISOString()).toBe(
      '2026-07-13T00:00:00.000Z',
    )
  })

  it('endOfWeek liefert den Sonntag', () => {
    expect(endOfWeek(dateOnly(2026, 7, 15)).toISOString()).toBe(
      '2026-07-19T00:00:00.000Z',
    )
  })

  it('Monatsgrenzen', () => {
    expect(startOfMonth(dateOnly(2026, 2, 17)).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z',
    )
    expect(endOfMonth(dateOnly(2026, 2, 17)).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    )
    expect(endOfMonth(dateOnly(2028, 2, 1)).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    )
  })
})

describe('Formatierung', () => {
  it('formatDate liefert das deutsche Format', () => {
    expect(formatDate(dateOnly(2026, 7, 5))).toBe('05.07.2026')
    expect(formatDate(null)).toBe('–')
  })

  it('formatDateTime rechnet nach Europe/Berlin um', () => {
    // 01.07.2026 22:30 UTC = 02.07.2026 00:30 in Berlin
    expect(formatDateTime(new Date('2026-07-01T22:30:00.000Z'))).toBe(
      '02.07.2026, 00:30',
    )
  })

  it('toISODate und parseISODate sind zueinander invers', () => {
    const d = dateOnly(2026, 12, 24)
    expect(toISODate(d)).toBe('2026-12-24')
    expect(parseISODate('2026-12-24').toISOString()).toBe(d.toISOString())
  })

  it('parseISODate weist ungültige Eingaben ab', () => {
    expect(() => parseISODate('24.12.2026')).toThrow()
    expect(() => parseISODate('2026-02-30')).toThrow()
    expect(() => parseISODate('')).toThrow()
  })
})
