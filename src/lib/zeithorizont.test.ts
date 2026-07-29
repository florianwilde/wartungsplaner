import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  ZEITHORIZONT_AUSWAHL,
  ZEITHORIZONT_BEZEICHNUNG,
  ZEITHORIZONT_COOKIE,
  ZEITHORIZONT_STANDARD,
  baueZeithorizontCookie,
  horizontEnde,
  imHorizont,
  leseZeithorizont,
} from './zeithorizont'

// 29.07.2026 ist ein Mittwoch
const STICHTAG = dateOnly(2026, 7, 29)

describe('leseZeithorizont', () => {
  it('übernimmt gültige Werte', () => {
    for (const wert of ZEITHORIZONT_AUSWAHL) {
      expect(leseZeithorizont(wert)).toBe(wert)
    }
  })

  it('fällt bei unbekannten Werten auf den Standard zurück', () => {
    expect(leseZeithorizont(undefined)).toBe(ZEITHORIZONT_STANDARD)
    expect(leseZeithorizont('jahrzehnt')).toBe(ZEITHORIZONT_STANDARD)
    expect(leseZeithorizont('')).toBe(ZEITHORIZONT_STANDARD)
  })
})

describe('horizontEnde', () => {
  it('endet bei "Diese Woche" am Sonntag', () => {
    expect(horizontEnde('woche', STICHTAG)?.toISOString().slice(0, 10)).toBe(
      '2026-08-02',
    )
  })

  it('rechnet 30 bzw. 90 Tage', () => {
    expect(horizontEnde('monat', STICHTAG)?.toISOString().slice(0, 10)).toBe(
      '2026-08-28',
    )
    expect(horizontEnde('quartal', STICHTAG)?.toISOString().slice(0, 10)).toBe(
      '2026-10-27',
    )
  })

  it('kennt bei "Alle offenen" keine Grenze', () => {
    expect(horizontEnde('alle', STICHTAG)).toBeNull()
  })
})

describe('imHorizont', () => {
  it('schließt Termine bis zum Ende ein', () => {
    expect(imHorizont(dateOnly(2026, 8, 2), 'woche', STICHTAG, false)).toBe(true)
    expect(imHorizont(dateOnly(2026, 8, 3), 'woche', STICHTAG, false)).toBe(false)
  })

  it('schließt den Stichtag selbst ein', () => {
    expect(imHorizont(STICHTAG, 'woche', STICHTAG, false)).toBe(true)
  })

  it('zeigt überfällige Termine unabhängig vom Horizont', () => {
    // Sonst würden sie gerade dann verschwinden, wenn sie am dringendsten sind.
    const langeVorbei = dateOnly(2026, 1, 1)
    for (const horizont of ZEITHORIZONT_AUSWAHL) {
      expect(imHorizont(langeVorbei, horizont, STICHTAG, true), horizont).toBe(true)
    }
  })

  it('blendet weit entfernte Termine je nach Horizont aus', () => {
    const inZweiMonaten = dateOnly(2026, 9, 29)
    expect(imHorizont(inZweiMonaten, 'woche', STICHTAG, false)).toBe(false)
    expect(imHorizont(inZweiMonaten, 'monat', STICHTAG, false)).toBe(false)
    expect(imHorizont(inZweiMonaten, 'quartal', STICHTAG, false)).toBe(true)
    expect(imHorizont(inZweiMonaten, 'alle', STICHTAG, false)).toBe(true)
  })

  it('zeigt bei "Alle offenen" auch sehr ferne Termine', () => {
    expect(imHorizont(dateOnly(2030, 1, 1), 'alle', STICHTAG, false)).toBe(true)
  })
})

describe('baueZeithorizontCookie', () => {
  it('enthält Pfad, Laufzeit und SameSite', () => {
    const cookie = baueZeithorizontCookie('quartal')
    expect(cookie).toContain(`${ZEITHORIZONT_COOKIE}=quartal`)
    expect(cookie).toContain('path=/')
    expect(cookie).toContain('samesite=lax')
  })
})

describe('Beschriftungen', () => {
  it('sind für jede Auswahl vorhanden', () => {
    for (const horizont of ZEITHORIZONT_AUSWAHL) {
      expect(ZEITHORIZONT_BEZEICHNUNG[horizont].length).toBeGreaterThan(3)
    }
  })
})
