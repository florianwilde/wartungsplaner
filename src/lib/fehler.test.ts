import { afterEach, describe, expect, it, vi } from 'vitest'

import { fehlerbehandlung } from './fehler'

const fehlertext = fehlerbehandlung('Prüfung')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fehlerbehandlung', () => {
  it('reicht die Meldung eigener Fehler durch', () => {
    expect(fehlertext(new Error('Die Kategorie existiert nicht.'))).toBe(
      'Die Kategorie existiert nicht.',
    )
  })

  it('reicht auch abgeleitete Fehlerklassen durch', () => {
    class NachweisFehler extends Error {}
    expect(fehlertext(new NachweisFehler('Der Nachweis ist bereits vorgelegt.'))).toBe(
      'Der Nachweis ist bereits vorgelegt.',
    )
  })

  it('verschweigt Meldungen aus dem Datenbankzugriff', () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fehler = new Error(
      'Unique constraint failed on the fields: (`email`)',
    )
    fehler.name = 'PrismaClientKnownRequestError'

    expect(fehlertext(fehler)).toBe('Die Aktion konnte nicht ausgeführt werden.')
    expect(protokoll).toHaveBeenCalled()
  })

  it('protokolliert alles, was kein Fehlerobjekt ist', () => {
    const protokoll = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(fehlertext('kaputt')).toBe('Die Aktion konnte nicht ausgeführt werden.')
    expect(protokoll).toHaveBeenCalledWith('Prüfung:', 'kaputt')
  })

  it('fällt bei leerer Meldung auf den Ersatztext zurück', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(fehlertext(new Error('   '))).toBe(
      'Die Aktion konnte nicht ausgeführt werden.',
    )
  })

  it('übernimmt einen eigenen Ersatztext', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const eigener = fehlerbehandlung('Import', 'Der Import schlug fehl.')
    expect(eigener(42)).toBe('Der Import schlug fehl.')
  })
})
