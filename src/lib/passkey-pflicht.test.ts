import { describe, expect, it } from 'vitest'

import { bewerte, mussEinrichten, pruefeUmstellung, type Lage } from './passkey-pflicht'

const lage = (teil: Partial<Lage> = {}): Lage => ({
  rolle: 'ADMIN',
  hatPasskey: false,
  technischMoeglich: true,
  ueberSso: false,
  ...teil,
})

describe('bewerte', () => {
  it('verlangt nichts, wenn die Rolle nicht gewählt ist', () => {
    const ergebnis = bewerte({ rollen: ['ADMIN'] }, lage({ rolle: 'EDITOR' }))
    expect(ergebnis).toEqual({ pflicht: false, grund: 'nicht-verlangt' })
  })

  it('verlangt nichts bei Anmeldung über SSO', () => {
    // Dort gibt es bereits ein Verfahren; ein zweiter Faktor gehört in den
    // Identity Provider, nicht in diese Anwendung.
    const ergebnis = bewerte({ rollen: ['ADMIN'] }, lage({ ueberSso: true }))
    expect(ergebnis).toEqual({ pflicht: false, grund: 'sso' })
  })

  it('verlangt nichts, wenn Passkeys technisch unmöglich sind', () => {
    // Ohne HTTPS bietet kein Browser die Registrierung an – die Pflicht
    // durchzusetzen hieße, jede Anmeldung in eine Sackgasse zu führen.
    const ergebnis = bewerte({ rollen: ['ADMIN'] }, lage({ technischMoeglich: false }))
    expect(ergebnis).toEqual({ pflicht: false, grund: 'nicht-moeglich' })
  })

  it('gilt als unerfüllt ohne hinterlegten Passkey', () => {
    expect(bewerte({ rollen: ['ADMIN'] }, lage())).toEqual({
      pflicht: true,
      erfuellt: false,
    })
  })

  it('gilt als erfüllt mit Passkey', () => {
    expect(bewerte({ rollen: ['ADMIN'] }, lage({ hatPasskey: true }))).toEqual({
      pflicht: true,
      erfuellt: true,
    })
  })

  it('betrachtet SSO auch dann, wenn ein Passkey fehlt', () => {
    expect(
      bewerte({ rollen: ['ADMIN'] }, lage({ ueberSso: true, hatPasskey: false })),
    ).toEqual({ pflicht: false, grund: 'sso' })
  })
})

describe('mussEinrichten', () => {
  it('führt nur bei bestehender, unerfüllter Pflicht zur Einrichtung', () => {
    expect(mussEinrichten({ rollen: ['ADMIN'] }, lage())).toBe(true)
    expect(mussEinrichten({ rollen: ['ADMIN'] }, lage({ hatPasskey: true }))).toBe(
      false,
    )
    expect(mussEinrichten({ rollen: [] }, lage())).toBe(false)
  })

  it('sperrt niemanden aus, wo Passkeys unmöglich sind', () => {
    expect(
      mussEinrichten({ rollen: ['ADMIN'] }, lage({ technischMoeglich: false })),
    ).toBe(false)
  })
})

describe('pruefeUmstellung', () => {
  it('lehnt die Umstellung ohne HTTPS ab', () => {
    const ergebnis = pruefeUmstellung(['ADMIN'], 'ADMIN', {}, false)
    expect(ergebnis.moeglich).toBe(false)
    expect(ergebnis.hinweis).toContain('HTTPS')
  })

  it('lässt sie zu, warnt aber vor der eigenen Betroffenheit', () => {
    const ergebnis = pruefeUmstellung(['ADMIN'], 'ADMIN', { ADMIN: 1 }, true)
    expect(ergebnis.moeglich).toBe(true)
    expect(ergebnis.hinweis).toContain('Sie selbst')
  })

  it('nennt die Anzahl betroffener Personen', () => {
    const ergebnis = pruefeUmstellung(['EDITOR'], 'ADMIN', { EDITOR: 3 }, true)
    expect(ergebnis.moeglich).toBe(true)
    expect(ergebnis.hinweis).toContain('3')
  })

  it('setzt den Singular richtig', () => {
    const ergebnis = pruefeUmstellung(['EDITOR'], 'ADMIN', { EDITOR: 1 }, true)
    expect(ergebnis.hinweis).toContain('1 Person hat')
  })

  it('meldet nichts, wenn alle Betroffenen bereits einen Passkey haben', () => {
    const ergebnis = pruefeUmstellung(['ADMIN'], 'ADMIN', { ADMIN: 0 }, true)
    expect(ergebnis).toEqual({ moeglich: true, hinweis: null })
  })
})
