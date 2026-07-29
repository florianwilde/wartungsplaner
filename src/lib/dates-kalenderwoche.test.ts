import { describe, expect, it } from 'vitest'

import {
  dateOnly,
  isoKalenderwoche,
  kalenderwochenSchluessel,
  wochentagIso,
} from './dates'

describe('isoKalenderwoche', () => {
  it('zählt Wochen innerhalb des Jahres', () => {
    expect(isoKalenderwoche(dateOnly(2026, 1, 5))).toEqual({ jahr: 2026, woche: 2 })
    expect(isoKalenderwoche(dateOnly(2026, 7, 29))).toEqual({ jahr: 2026, woche: 31 })
    expect(isoKalenderwoche(dateOnly(2026, 12, 28))).toEqual({ jahr: 2026, woche: 53 })
  })

  it('ordnet den Jahreswechsel nach ISO 8601 zu', () => {
    // Der 01.01.2026 ist ein Donnerstag und gehört damit zur Woche 1 von 2026.
    expect(isoKalenderwoche(dateOnly(2026, 1, 1))).toEqual({ jahr: 2026, woche: 1 })
    // Der 01.01.2027 ist ein Freitag und gehört noch zur Woche 53 von 2026.
    expect(isoKalenderwoche(dateOnly(2027, 1, 1))).toEqual({ jahr: 2026, woche: 53 })
    // Der 31.12.2024 ist ein Dienstag und gehört bereits zur Woche 1 von 2025.
    expect(isoKalenderwoche(dateOnly(2024, 12, 31))).toEqual({ jahr: 2025, woche: 1 })
  })

  it('liefert für alle Tage einer Woche dasselbe Ergebnis', () => {
    const montag = dateOnly(2026, 7, 27)
    const sonntag = dateOnly(2026, 8, 2)
    expect(isoKalenderwoche(montag)).toEqual(isoKalenderwoche(sonntag))
  })
})

describe('kalenderwochenSchluessel', () => {
  it('formatiert mit führender Null', () => {
    expect(kalenderwochenSchluessel(dateOnly(2026, 1, 5))).toBe('2026-W02')
    expect(kalenderwochenSchluessel(dateOnly(2026, 7, 29))).toBe('2026-W31')
  })

  it('ist innerhalb einer Woche stabil', () => {
    expect(kalenderwochenSchluessel(dateOnly(2026, 7, 27))).toBe(
      kalenderwochenSchluessel(dateOnly(2026, 8, 2)),
    )
  })
})

describe('wochentagIso', () => {
  it('zählt Montag als 1 und Sonntag als 7', () => {
    expect(wochentagIso(dateOnly(2026, 7, 27))).toBe(1) // Montag
    expect(wochentagIso(dateOnly(2026, 7, 29))).toBe(3) // Mittwoch
    expect(wochentagIso(dateOnly(2026, 8, 1))).toBe(6) // Samstag
    expect(wochentagIso(dateOnly(2026, 8, 2))).toBe(7) // Sonntag
  })
})
