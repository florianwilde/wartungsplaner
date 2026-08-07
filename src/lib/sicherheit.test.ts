import { describe, expect, it } from 'vitest'

import {
  baueContentSecurityPolicy,
  baueSicherheitsHeader,
  einzeilig,
  erzeugeNonce,
} from './sicherheit'

describe('erzeugeNonce', () => {
  it('liefert bei jedem Aufruf einen anderen Wert', () => {
    const werte = new Set(Array.from({ length: 50 }, () => erzeugeNonce()))
    expect(werte.size).toBe(50)
  })

  it('liefert ausreichend Entropie', () => {
    // 16 Byte als Base64 ergeben 24 Zeichen
    expect(erzeugeNonce()).toHaveLength(24)
  })
})

describe('baueContentSecurityPolicy', () => {
  const nonce = 'abc123'

  it('bindet den Nonce in die Skriptquellen ein', () => {
    const csp = baueContentSecurityPolicy({ nonce })
    expect(csp).toContain(`'nonce-${nonce}'`)
    expect(csp).toContain("'strict-dynamic'")
  })

  it('unterbindet Einbettung, Objekte und fremde Formularziele', () => {
    const csp = baueContentSecurityPolicy({ nonce })
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("base-uri 'self'")
  })

  it('erlaubt unsafe-eval nur in der Entwicklung', () => {
    expect(baueContentSecurityPolicy({ nonce })).not.toContain("'unsafe-eval'")
    expect(baueContentSecurityPolicy({ nonce, entwicklung: true })).toContain(
      "'unsafe-eval'",
    )
  })

  it('erlaubt niemals unsafe-inline für Skripte', () => {
    for (const optionen of [
      { nonce },
      { nonce, entwicklung: true },
      { nonce, https: true },
    ]) {
      const skriptTeil = baueContentSecurityPolicy(optionen)
        .split('; ')
        .find((teil) => teil.startsWith('script-src'))
      expect(skriptTeil).not.toContain("'unsafe-inline'")
    }
  })

  it('stellt bei HTTPS auf sichere Verbindungen um', () => {
    expect(baueContentSecurityPolicy({ nonce, https: true })).toContain(
      'upgrade-insecure-requests',
    )
    expect(baueContentSecurityPolicy({ nonce })).not.toContain(
      'upgrade-insecure-requests',
    )
  })
})

describe('baueSicherheitsHeader', () => {
  it('setzt die Grundschutz-Header immer', () => {
    const header = baueSicherheitsHeader(false)
    expect(header['X-Content-Type-Options']).toBe('nosniff')
    expect(header['X-Frame-Options']).toBe('DENY')
    expect(header['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
    expect(header['Permissions-Policy']).toContain('camera=()')
  })

  it('setzt HSTS ausschließlich bei HTTPS', () => {
    expect(baueSicherheitsHeader(false)['Strict-Transport-Security']).toBeUndefined()
    expect(baueSicherheitsHeader(true)['Strict-Transport-Security']).toContain(
      'max-age=31536000',
    )
  })
})

describe('einzeilig', () => {
  it('entfernt Zeilenumbrüche und Steuerzeichen', () => {
    expect(einzeilig('Betreff\r\nBcc: fremd@example.com')).toBe(
      'Betreff Bcc: fremd@example.com',
    )
    expect(einzeilig('a\tb\nc')).toBe('a b c')
  })

  it('fasst Leerraum zusammen und schneidet Ränder ab', () => {
    expect(einzeilig('  viel    Leerraum  ')).toBe('viel Leerraum')
  })

  it('begrenzt die Länge', () => {
    expect(einzeilig('x'.repeat(500), 100)).toHaveLength(100)
  })

  it('lässt Umlaute unverändert', () => {
    expect(einzeilig('Prüfplaner für Änderungen')).toBe('Prüfplaner für Änderungen')
  })
})
