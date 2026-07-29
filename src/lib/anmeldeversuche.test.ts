import { describe, expect, it } from 'vitest'

import {
  MAX_FEHLVERSUCHE,
  SPERRDAUER_MS,
  ZEITFENSTER_MS,
  baueKennung,
  neuerSpeicher,
  pruefeVersuch,
  raeumeAuf,
  setzeZurueck,
  vermerkeFehlversuch,
} from './anmeldeversuche'

const T0 = 1_800_000_000_000

describe('pruefeVersuch', () => {
  it('erlaubt Versuche ohne Vorgeschichte', () => {
    expect(pruefeVersuch(neuerSpeicher(), 'a|1.2.3.4', T0)).toEqual({ erlaubt: true })
  })

  it('erlaubt Versuche unterhalb der Höchstzahl', () => {
    const speicher = neuerSpeicher()
    for (let i = 0; i < MAX_FEHLVERSUCHE - 1; i++) {
      vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)
    }
    expect(pruefeVersuch(speicher, 'a|1.2.3.4', T0 + 10_000).erlaubt).toBe(true)
  })
})

describe('vermerkeFehlversuch', () => {
  it('sperrt nach Erreichen der Höchstzahl', () => {
    const speicher = neuerSpeicher()
    let ausgeloest = false
    for (let i = 0; i < MAX_FEHLVERSUCHE; i++) {
      ausgeloest = vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)
    }
    expect(ausgeloest).toBe(true)

    const ergebnis = pruefeVersuch(speicher, 'a|1.2.3.4', T0 + 10_000)
    expect(ergebnis.erlaubt).toBe(false)
    if (!ergebnis.erlaubt) {
      expect(ergebnis.verbleibendeSekunden).toBeGreaterThan(0)
      expect(ergebnis.verbleibendeSekunden).toBeLessThanOrEqual(SPERRDAUER_MS / 1000)
    }
  })

  it('meldet erst beim letzten Versuch eine Sperre', () => {
    const speicher = neuerSpeicher()
    for (let i = 0; i < MAX_FEHLVERSUCHE - 1; i++) {
      expect(vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)).toBe(false)
    }
    expect(vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + 9000)).toBe(true)
  })

  it('lässt die Sperre nach Ablauf der Sperrdauer wieder frei', () => {
    const speicher = neuerSpeicher()
    let letzterVersuch = T0
    for (let i = 0; i < MAX_FEHLVERSUCHE; i++) {
      letzterVersuch = T0 + i * 1000
      vermerkeFehlversuch(speicher, 'a|1.2.3.4', letzterVersuch)
    }

    // Die Sperrdauer läuft ab dem letzten Fehlversuch, nicht ab dem ersten.
    expect(
      pruefeVersuch(speicher, 'a|1.2.3.4', letzterVersuch + SPERRDAUER_MS - 1)
        .erlaubt,
    ).toBe(false)
    expect(
      pruefeVersuch(speicher, 'a|1.2.3.4', letzterVersuch + SPERRDAUER_MS + 1)
        .erlaubt,
    ).toBe(true)
  })

  it('zählt nur Versuche innerhalb des gleitenden Zeitfensters', () => {
    const speicher = neuerSpeicher()
    // Vier Fehlversuche, danach eine lange Pause
    for (let i = 0; i < MAX_FEHLVERSUCHE - 1; i++) {
      vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)
    }
    // Der nächste Versuch liegt außerhalb des Fensters – keine Sperre
    const spaeter = T0 + ZEITFENSTER_MS + 5000
    expect(vermerkeFehlversuch(speicher, 'a|1.2.3.4', spaeter)).toBe(false)
    expect(pruefeVersuch(speicher, 'a|1.2.3.4', spaeter).erlaubt).toBe(true)
  })

  it('trennt verschiedene Kennungen', () => {
    const speicher = neuerSpeicher()
    for (let i = 0; i < MAX_FEHLVERSUCHE; i++) {
      vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)
    }
    expect(pruefeVersuch(speicher, 'a|1.2.3.4', T0).erlaubt).toBe(false)
    expect(pruefeVersuch(speicher, 'a|5.6.7.8', T0).erlaubt).toBe(true)
    expect(pruefeVersuch(speicher, 'b|1.2.3.4', T0).erlaubt).toBe(true)
  })
})

describe('setzeZurueck', () => {
  it('löscht die Vorgeschichte nach erfolgreicher Anmeldung', () => {
    const speicher = neuerSpeicher()
    for (let i = 0; i < MAX_FEHLVERSUCHE - 1; i++) {
      vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + i * 1000)
    }
    setzeZurueck(speicher, 'a|1.2.3.4')
    // Nach dem Zurücksetzen sind wieder alle Versuche frei
    for (let i = 0; i < MAX_FEHLVERSUCHE - 1; i++) {
      expect(vermerkeFehlversuch(speicher, 'a|1.2.3.4', T0 + 20_000 + i)).toBe(false)
    }
  })
})

describe('raeumeAuf', () => {
  it('entfernt abgelaufene Einträge', () => {
    const speicher = neuerSpeicher()
    vermerkeFehlversuch(speicher, 'alt|1.2.3.4', T0)
    vermerkeFehlversuch(speicher, 'neu|1.2.3.4', T0 + ZEITFENSTER_MS)

    const entfernt = raeumeAuf(speicher, T0 + ZEITFENSTER_MS + 1000)
    expect(entfernt).toBe(1)
    expect(speicher.has('alt|1.2.3.4')).toBe(false)
    expect(speicher.has('neu|1.2.3.4')).toBe(true)
  })

  it('behält gesperrte Einträge', () => {
    const speicher = neuerSpeicher()
    for (let i = 0; i < MAX_FEHLVERSUCHE; i++) {
      vermerkeFehlversuch(speicher, 'gesperrt|1.2.3.4', T0 + i)
    }
    raeumeAuf(speicher, T0 + 1000)
    expect(speicher.has('gesperrt|1.2.3.4')).toBe(true)
  })
})

describe('baueKennung', () => {
  it('verbindet E-Mail und Adresse und schreibt klein', () => {
    expect(baueKennung('  Admin@Example.COM ', '10.0.0.5')).toBe(
      'admin@example.com|10.0.0.5',
    )
  })

  it('trennt Konten und Adressen voneinander', () => {
    expect(baueKennung('a@x.de', '1.1.1.1')).not.toBe(baueKennung('a@x.de', '2.2.2.2'))
    expect(baueKennung('a@x.de', '1.1.1.1')).not.toBe(baueKennung('b@x.de', '1.1.1.1'))
  })
})
