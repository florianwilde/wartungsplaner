import { describe, expect, it } from 'vitest'

import {
  baueStrom,
  beschreibe,
  darfAngenommenWerden,
  werteAntwortAus,
  type Pruefstatus,
} from './virenpruefung'

describe('werteAntwortAus', () => {
  it('erkennt eine saubere Datei', () => {
    expect(werteAntwortAus('stream: OK\0')).toEqual({
      art: 'geprueft',
      befund: { sauber: true },
    })
  })

  it('erkennt einen Fund samt Namen', () => {
    expect(werteAntwortAus('stream: Eicar-Test-Signature FOUND\0')).toEqual({
      art: 'geprueft',
      befund: { sauber: false, schadprogramm: 'Eicar-Test-Signature' },
    })
  })

  it('kommt mit Namen zurecht, die Leerzeichen enthalten', () => {
    const ergebnis = werteAntwortAus('stream: Win.Test.EICAR HDB-1 FOUND')
    expect(ergebnis).toEqual({
      art: 'geprueft',
      befund: { sauber: false, schadprogramm: 'Win.Test.EICAR HDB-1' },
    })
  })

  it('behandelt eine Fehlermeldung als „nicht erreichbar“', () => {
    const ergebnis = werteAntwortAus('INSTREAM size limit exceeded. ERROR')
    expect(ergebnis.art).toBe('nicht-erreichbar')
  })

  it('behandelt eine leere Antwort als „nicht erreichbar“', () => {
    expect(werteAntwortAus('   ').art).toBe('nicht-erreichbar')
    expect(werteAntwortAus('\0').art).toBe('nicht-erreichbar')
  })

  it('meldet Unerwartetes, statt es für sauber zu halten', () => {
    // Im Zweifel nicht „OK“ annehmen – das wäre die gefährliche Richtung.
    const ergebnis = werteAntwortAus('irgendwas anderes')
    expect(ergebnis.art).toBe('nicht-erreichbar')
  })
})

describe('darfAngenommenWerden', () => {
  const geprueftSauber: Pruefstatus = {
    art: 'geprueft',
    befund: { sauber: true },
  }
  const gefunden: Pruefstatus = {
    art: 'geprueft',
    befund: { sauber: false, schadprogramm: 'Eicar-Test-Signature' },
  }
  const nichtErreichbar: Pruefstatus = {
    art: 'nicht-erreichbar',
    grund: 'Zeitüberschreitung',
  }
  const nichtEingerichtet: Pruefstatus = { art: 'nicht-eingerichtet' }

  it('lässt eine geprüfte, saubere Datei durch', () => {
    expect(darfAngenommenWerden(geprueftSauber, false).erlaubt).toBe(true)
    expect(darfAngenommenWerden(geprueftSauber, true).erlaubt).toBe(true)
  })

  it('weist einen Fund immer ab – auch ohne Pflicht', () => {
    for (const pflicht of [false, true]) {
      const ergebnis = darfAngenommenWerden(gefunden, pflicht)
      expect(ergebnis.erlaubt).toBe(false)
      expect(ergebnis.grund).toContain('Eicar-Test-Signature')
    }
  })

  it('nimmt ohne Prüfdienst an, solange keine Pflicht gilt', () => {
    expect(darfAngenommenWerden(nichtEingerichtet, false).erlaubt).toBe(true)
    expect(darfAngenommenWerden(nichtErreichbar, false).erlaubt).toBe(true)
  })

  it('weist bei Pflicht ab, wenn nicht geprüft werden konnte', () => {
    const ohneDienst = darfAngenommenWerden(nichtEingerichtet, true)
    expect(ohneDienst.erlaubt).toBe(false)
    expect(ohneDienst.grund).toContain('CLAMAV_HOST')

    const ausgefallen = darfAngenommenWerden(nichtErreichbar, true)
    expect(ausgefallen.erlaubt).toBe(false)
    expect(ausgefallen.grund).toContain('Zeitüberschreitung')
  })
})

describe('beschreibe', () => {
  it('fasst jeden Zustand knapp zusammen', () => {
    expect(beschreibe({ art: 'nicht-eingerichtet' })).toBe('nicht eingerichtet')
    expect(
      beschreibe({ art: 'geprueft', befund: { sauber: true } }),
    ).toContain('ohne Befund')
    expect(
      beschreibe({
        art: 'geprueft',
        befund: { sauber: false, schadprogramm: 'X' },
      }),
    ).toContain('Fund: X')
    expect(
      beschreibe({ art: 'nicht-erreichbar', grund: 'weg' }),
    ).toContain('weg')
  })
})

describe('baueStrom', () => {
  it('setzt vor jeden Abschnitt seine Länge und schließt mit null ab', () => {
    const teile = baueStrom(Buffer.from('abc'), 64 * 1024)

    expect(teile).toHaveLength(3)
    expect(teile[0].readUInt32BE(0)).toBe(3)
    expect(teile[1].toString()).toBe('abc')
    expect(teile[2].readUInt32BE(0)).toBe(0)
  })

  it('teilt größere Inhalte auf', () => {
    const teile = baueStrom(Buffer.alloc(10), 4)

    // 3 Abschnitte (4 + 4 + 2) zu je zwei Teilen, plus Abschluss.
    expect(teile).toHaveLength(7)
    expect(teile[0].readUInt32BE(0)).toBe(4)
    expect(teile[4].readUInt32BE(0)).toBe(2)
    expect(teile.at(-1)?.readUInt32BE(0)).toBe(0)
  })

  it('kommt mit einer leeren Datei zurecht', () => {
    const teile = baueStrom(Buffer.alloc(0))
    expect(teile).toHaveLength(1)
    expect(teile[0].readUInt32BE(0)).toBe(0)
  })
})
