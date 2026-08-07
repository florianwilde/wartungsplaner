import { describe, expect, it } from 'vitest'

import { ermittleSvgGroesse, passeEin, siehtNachSvgAus } from './svg'

describe('ermittleSvgGroesse', () => {
  it('liest den viewBox', () => {
    expect(ermittleSvgGroesse('<svg viewBox="0 0 240 60" xmlns="..."></svg>')).toEqual({
      breite: 240,
      hoehe: 60,
    })
  })

  it('kommt mit Kommas im viewBox zurecht', () => {
    expect(ermittleSvgGroesse('<svg viewBox="0,0,120,40"></svg>')).toEqual({
      breite: 120,
      hoehe: 40,
    })
  })

  it('bevorzugt den viewBox vor width und height', () => {
    // Zeichenprogramme schreiben dort oft eine beliebige Anzeigegröße.
    const svg = '<svg width="1000" height="1000" viewBox="0 0 200 50"></svg>'
    expect(ermittleSvgGroesse(svg)).toEqual({ breite: 200, hoehe: 50 })
  })

  it('nimmt width und height, wenn kein viewBox da ist', () => {
    expect(ermittleSvgGroesse('<svg width="300px" height="80px"></svg>')).toEqual({
      breite: 300,
      hoehe: 80,
    })
  })

  it('übergeht Prozentangaben', () => {
    // „100 %“ bezieht sich auf den Elternrahmen und sagt hier nichts aus.
    const groesse = ermittleSvgGroesse('<svg width="100%" height="100%"></svg>')
    expect(groesse.breite / groesse.hoehe).toBe(3)
  })

  it('fällt bei fehlenden Angaben auf ein übliches Verhältnis zurück', () => {
    const groesse = ermittleSvgGroesse('<svg></svg>')
    expect(groesse.breite).toBeGreaterThan(0)
    expect(groesse.hoehe).toBeGreaterThan(0)
  })

  it('lässt sich von unsinnigen Werten nicht aus der Ruhe bringen', () => {
    const groesse = ermittleSvgGroesse('<svg viewBox="0 0 0 0" width="-5"></svg>')
    expect(groesse.breite).toBeGreaterThan(0)
    expect(groesse.hoehe).toBeGreaterThan(0)
  })
})

describe('passeEin', () => {
  it('begrenzt an der Breite', () => {
    expect(passeEin({ breite: 400, hoehe: 100 }, { breite: 200, hoehe: 100 })).toEqual({
      breite: 200,
      hoehe: 50,
    })
  })

  it('begrenzt an der Höhe', () => {
    expect(passeEin({ breite: 100, hoehe: 400 }, { breite: 200, hoehe: 100 })).toEqual({
      breite: 25,
      hoehe: 100,
    })
  })

  it('vergrößert nicht', () => {
    // Ein Logo, das den Kasten nicht füllt, ist besser als ein ausgefranstes.
    expect(passeEin({ breite: 60, hoehe: 20 }, { breite: 200, hoehe: 100 })).toEqual({
      breite: 60,
      hoehe: 20,
    })
  })

  it('behält das Seitenverhältnis', () => {
    const eingepasst = passeEin({ breite: 300, hoehe: 90 }, { breite: 130, hoehe: 26 })
    expect(eingepasst.breite / eingepasst.hoehe).toBeCloseTo(300 / 90, 5)
    expect(eingepasst.hoehe).toBeLessThanOrEqual(26)
    expect(eingepasst.breite).toBeLessThanOrEqual(130)
  })
})

describe('siehtNachSvgAus', () => {
  it('erkennt SVG auch mit vorangehender XML-Zeile', () => {
    expect(
      siehtNachSvgAus('<?xml version="1.0"?>\n<!-- Logo -->\n<svg xmlns="...">'),
    ).toBe(true)
  })

  it('verneint bei anderen Inhalten', () => {
    // Ein umbenanntes PNG würde die Erzeugung sonst mitten im Lauf abbrechen.
    expect(siehtNachSvgAus('\x89PNG\r\n\x1a\n')).toBe(false)
    expect(siehtNachSvgAus('<svgabc>')).toBe(false)
  })
})
