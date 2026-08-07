import { describe, expect, it } from 'vitest'

import {
  CHALLENGE_GUELTIGKEIT_MS,
  challengeAblauf,
  geraeteArtText,
  istChallengeGueltig,
  istPasskeyTauglich,
  passkeyHinweis,
  pruefePasskeyName,
  rpIdAus,
  schlageNamenVor,
  ursprungAus,
} from './webauthn'

describe('rpIdAus', () => {
  it('liefert den Hostnamen ohne Port', () => {
    expect(rpIdAus('https://wartungsplaner.firma.de')).toBe('wartungsplaner.firma.de')
    expect(rpIdAus('https://wartungsplaner.firma.de:8443/pfad')).toBe(
      'wartungsplaner.firma.de',
    )
    expect(rpIdAus('http://localhost:3000')).toBe('localhost')
  })

  it('weist unbrauchbare Adressen ab', () => {
    // Lieber ein klarer Fehler als eine stillschweigend falsche Bindung.
    expect(() => rpIdAus('keine-adresse')).toThrow(/gültige Adresse/)
    expect(() => rpIdAus('')).toThrow()
  })
})

describe('ursprungAus', () => {
  it('behält Schema und Port', () => {
    expect(ursprungAus('https://firma.de:8443/pfad')).toBe('https://firma.de:8443')
    expect(ursprungAus('http://localhost:3000/')).toBe('http://localhost:3000')
  })

  it('weist unbrauchbare Adressen ab', () => {
    expect(() => ursprungAus('quatsch')).toThrow()
  })
})

describe('istPasskeyTauglich', () => {
  it('lässt HTTPS zu', () => {
    expect(istPasskeyTauglich('https://firma.de')).toBe(true)
  })

  it('lässt localhost auch ohne HTTPS zu', () => {
    expect(istPasskeyTauglich('http://localhost:3000')).toBe(true)
    expect(istPasskeyTauglich('http://127.0.0.1:3000')).toBe(true)
  })

  it('weist unverschlüsselte Adressen mit echtem Hostnamen ab', () => {
    // Browser erlauben WebAuthn nur in sicheren Kontexten.
    expect(istPasskeyTauglich('http://wartungsplaner.firma.de')).toBe(false)
    expect(istPasskeyTauglich('http://192.168.1.10:3000')).toBe(false)
  })

  it('weist unbrauchbare Adressen ab', () => {
    expect(istPasskeyTauglich('quatsch')).toBe(false)
  })
})

describe('passkeyHinweis', () => {
  it('schweigt bei tauglicher Adresse', () => {
    expect(passkeyHinweis('https://firma.de')).toBeNull()
    expect(passkeyHinweis('http://localhost:3000')).toBeNull()
  })

  it('erklärt das Problem bei untauglicher Adresse', () => {
    const hinweis = passkeyHinweis('http://firma.de')
    expect(hinweis).toContain('HTTPS')
    expect(hinweis).toContain('APP_URL')
  })
})

describe('pruefePasskeyName', () => {
  it('übernimmt brauchbare Namen', () => {
    expect(pruefePasskeyName('  Notebook Windows Hello ')).toBe(
      'Notebook Windows Hello',
    )
  })

  it('entfernt Steuerzeichen', () => {
    expect(pruefePasskeyName('Notebook\r\nBoese')).toBe('NotebookBoese')
  })

  it('begrenzt die Länge', () => {
    expect(pruefePasskeyName('x'.repeat(200))).toHaveLength(60)
  })

  it('weist zu kurze Namen ab', () => {
    expect(pruefePasskeyName('')).toBeNull()
    expect(pruefePasskeyName(' a ')).toBeNull()
  })
})

describe('schlageNamenVor', () => {
  it('erkennt die gängigen Plattformen', () => {
    expect(schlageNamenVor('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Windows Hello',
    )
    expect(schlageNamenVor('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')).toBe('iPhone')
    expect(schlageNamenVor('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)')).toBe('Mac')
    expect(schlageNamenVor('Mozilla/5.0 (Linux; Android 14)')).toBe('Android-Gerät')
    expect(schlageNamenVor('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux-Gerät')
  })

  it('fällt auf einen neutralen Namen zurück', () => {
    expect(schlageNamenVor('irgendein Browser')).toBe('Passkey')
    expect(schlageNamenVor('')).toBe('Passkey')
  })
})

describe('Gültigkeit der Aufgabe', () => {
  const jetzt = new Date('2026-07-29T12:00:00Z')

  it('berechnet den Ablauf', () => {
    const ablauf = challengeAblauf(jetzt)
    expect(ablauf.getTime() - jetzt.getTime()).toBe(CHALLENGE_GUELTIGKEIT_MS)
  })

  it('erkennt abgelaufene Aufgaben', () => {
    const ablauf = challengeAblauf(jetzt)
    expect(istChallengeGueltig(ablauf, jetzt)).toBe(true)
    expect(istChallengeGueltig(ablauf, new Date(ablauf.getTime() - 1))).toBe(true)
    expect(istChallengeGueltig(ablauf, new Date(ablauf.getTime()))).toBe(false)
    expect(istChallengeGueltig(ablauf, new Date(ablauf.getTime() + 1000))).toBe(false)
  })
})

describe('geraeteArtText', () => {
  it('unterscheidet gebundene und synchronisierte Passkeys', () => {
    expect(geraeteArtText('singleDevice', false)).toContain('gebunden')
    expect(geraeteArtText('multiDevice', false)).toContain('Synchronisiert')
    expect(geraeteArtText('multiDevice', true)).toContain('gesichert')
  })
})
