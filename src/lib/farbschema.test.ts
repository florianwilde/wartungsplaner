import { describe, expect, it } from 'vitest'

import {
  FARBSCHEMA_AUSWAHL,
  FARBSCHEMA_BEZEICHNUNG,
  FARBSCHEMA_COOKIE,
  FARBSCHEMA_SKRIPT,
  FARBSCHEMA_STANDARD,
  baueFarbschemaCookie,
  colorSchemeWert,
  istDunkelServerseitig,
  leseFarbschema,
  toasterSchema,
  type Farbschema,
} from './farbschema'

describe('leseFarbschema', () => {
  it('übernimmt gültige Werte', () => {
    expect(leseFarbschema('hell')).toBe('hell')
    expect(leseFarbschema('dunkel')).toBe('dunkel')
    expect(leseFarbschema('system')).toBe('system')
  })

  it('fällt bei unbekannten oder fehlenden Werten auf den Standard zurück', () => {
    expect(leseFarbschema(undefined)).toBe(FARBSCHEMA_STANDARD)
    expect(leseFarbschema(null)).toBe(FARBSCHEMA_STANDARD)
    expect(leseFarbschema('')).toBe(FARBSCHEMA_STANDARD)
    expect(leseFarbschema('DUNKEL')).toBe(FARBSCHEMA_STANDARD)
    expect(leseFarbschema('<script>')).toBe(FARBSCHEMA_STANDARD)
  })
})

describe('istDunkelServerseitig', () => {
  it('setzt die Klasse nur bei ausdrücklich dunklem Schema', () => {
    expect(istDunkelServerseitig('dunkel')).toBe(true)
    expect(istDunkelServerseitig('hell')).toBe(false)
    // Bei Systemvorgabe entscheidet erst das Skript im Browser.
    expect(istDunkelServerseitig('system')).toBe(false)
  })
})

describe('colorSchemeWert', () => {
  it('gibt beide Möglichkeiten bei Systemvorgabe an', () => {
    expect(colorSchemeWert('hell')).toBe('light')
    expect(colorSchemeWert('dunkel')).toBe('dark')
    expect(colorSchemeWert('system')).toBe('light dark')
  })
})

describe('toasterSchema', () => {
  it('bildet auf die Werte der Hinweisfenster ab', () => {
    expect(toasterSchema('hell')).toBe('light')
    expect(toasterSchema('dunkel')).toBe('dark')
    expect(toasterSchema('system')).toBe('system')
  })
})

describe('baueFarbschemaCookie', () => {
  it('enthält Pfad, Laufzeit und SameSite', () => {
    const cookie = baueFarbschemaCookie('dunkel')
    expect(cookie).toContain(`${FARBSCHEMA_COOKIE}=dunkel`)
    expect(cookie).toContain('path=/')
    expect(cookie).toContain('max-age=')
    expect(cookie).toContain('samesite=lax')
  })

  it('setzt für jede Auswahl einen gültigen Wert', () => {
    for (const schema of FARBSCHEMA_AUSWAHL) {
      expect(baueFarbschemaCookie(schema)).toContain(`=${schema}`)
    }
  })
})

describe('FARBSCHEMA_SKRIPT', () => {
  it('liest den richtigen Cookie-Namen', () => {
    expect(FARBSCHEMA_SKRIPT).toContain(FARBSCHEMA_COOKIE)
  })

  it('berücksichtigt die Geräteeinstellung', () => {
    expect(FARBSCHEMA_SKRIPT).toContain('prefers-color-scheme: dark')
  })

  it('fängt Fehler ab, damit die Seite nie blockiert', () => {
    expect(FARBSCHEMA_SKRIPT).toContain('try')
    expect(FARBSCHEMA_SKRIPT).toContain('catch')
  })

  it('enthält keine Zeichen, die das script-Element vorzeitig beenden', () => {
    // Ein </script> im Inhalt würde die Seite zerlegen.
    expect(FARBSCHEMA_SKRIPT.toLowerCase()).not.toContain('</script')
  })

  it('lässt sich ausführen und setzt die Klasse anhand des Cookies', () => {
    // Minimale Nachbildung von document und window
    const macheUmgebung = (cookie: string, systemDunkel: boolean) => {
      const klassen = new Set<string>()
      const element = {
        classList: {
          toggle: (name: string, an: boolean) => {
            if (an) klassen.add(name)
            else klassen.delete(name)
          },
        },
        style: { colorScheme: '' },
      }
      const umgebung = {
        document: { cookie, documentElement: element },
        window: { matchMedia: () => ({ matches: systemDunkel }) },
      }
      // eslint-disable-next-line no-new-func
      new Function('document', 'window', FARBSCHEMA_SKRIPT)(
        umgebung.document,
        umgebung.window,
      )
      return { klassen, element }
    }

    expect(macheUmgebung('farbschema=dunkel', false).klassen.has('dark')).toBe(true)
    expect(macheUmgebung('farbschema=hell', true).klassen.has('dark')).toBe(false)
    // Systemvorgabe folgt dem Gerät
    expect(macheUmgebung('farbschema=system', true).klassen.has('dark')).toBe(true)
    expect(macheUmgebung('farbschema=system', false).klassen.has('dark')).toBe(false)
    // Ohne Cookie gilt der Standard (Systemvorgabe)
    expect(macheUmgebung('', true).klassen.has('dark')).toBe(true)
  })

  it('setzt color-scheme passend zur Klasse', () => {
    const klassen = new Set<string>()
    const element = {
      classList: {
        toggle: (name: string, an: boolean) => {
          if (an) klassen.add(name)
          else klassen.delete(name)
        },
      },
      style: { colorScheme: '' },
    }
    // eslint-disable-next-line no-new-func
    new Function('document', 'window', FARBSCHEMA_SKRIPT)(
      { cookie: 'farbschema=dunkel', documentElement: element },
      { matchMedia: () => ({ matches: false }) },
    )
    expect(element.style.colorScheme).toBe('dark')
  })
})

describe('FARBSCHEMA_BEZEICHNUNG', () => {
  it('beschriftet jede Auswahl auf Deutsch', () => {
    for (const schema of FARBSCHEMA_AUSWAHL) {
      expect(FARBSCHEMA_BEZEICHNUNG[schema as Farbschema].length).toBeGreaterThan(3)
    }
  })
})
