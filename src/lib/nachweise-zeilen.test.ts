import { describe, expect, it } from 'vitest'

import {
  MAX_ZEILEN,
  auffaelligeZeilen,
  fasseErgebnisZusammen,
  istBeantwortet,
  pruefeVollstaendigkeit,
  uebernehmeZeilenAusCsv,
  wendeSammelentscheidungAn,
  zaehleZeilen,
  zeilenVon,
  type Pruefpunkt,
  type Zeile,
} from './nachweise'

const LISTE: Pruefpunkt = {
  id: 'p1',
  position: 1,
  frage: 'Sind die Berechtigungen weiterhin erforderlich?',
  art: 'LISTE',
  pflicht: true,
}

function zeile(
  id: string,
  position: number,
  ergebnis: Zeile['ergebnis'] = null,
  punktId = 'p1',
): Zeile {
  return {
    id,
    punktId,
    position,
    bezeichnung: `konto${position}`,
    zusatz: 'Fachanwendung-Admins',
    ergebnis,
    bemerkung: null,
  }
}

describe('istBeantwortet bei Zeilenlisten', () => {
  it('gilt als offen, solange eine Zeile ohne Entscheidung ist', () => {
    const zeilen = [zeile('a', 1, 'BELASSEN'), zeile('b', 2)]
    expect(istBeantwortet(LISTE, undefined, zeilen)).toBe(false)
  })

  it('gilt als beantwortet, wenn jede Zeile entschieden ist', () => {
    const zeilen = [zeile('a', 1, 'BELASSEN'), zeile('b', 2, 'ENTZIEHEN')]
    expect(istBeantwortet(LISTE, undefined, zeilen)).toBe(true)
  })

  it('gilt als offen, wenn die Liste leer ist – sie belegt dann nichts', () => {
    expect(istBeantwortet(LISTE, undefined, [])).toBe(false)
  })

  it('betrachtet nur die Zeilen des eigenen Prüfpunkts', () => {
    const zeilen = [zeile('a', 1, 'BELASSEN'), zeile('b', 1, null, 'p2')]
    expect(istBeantwortet(LISTE, undefined, zeilen)).toBe(true)
  })
})

describe('pruefeVollstaendigkeit mit Zeilen', () => {
  it('meldet den Prüfpunkt als offen, solange Zeilen fehlen', () => {
    const stand = pruefeVollstaendigkeit([LISTE], [], [zeile('a', 1)])
    expect(stand.vollstaendig).toBe(false)
    expect(stand.offenePflichtpunkte).toEqual([1])
  })

  it('ist vollständig, sobald alle Zeilen entschieden sind', () => {
    const stand = pruefeVollstaendigkeit([LISTE], [], [zeile('a', 1, 'BELASSEN')])
    expect(stand.vollstaendig).toBe(true)
    expect(stand.beantwortet).toBe(1)
  })
})

describe('zaehleZeilen', () => {
  it('zählt entschieden, offen und auffällig getrennt', () => {
    const stand = zaehleZeilen([
      zeile('a', 1, 'BELASSEN'),
      zeile('b', 2, 'ENTZIEHEN'),
      zeile('c', 3, 'AENDERN'),
      zeile('d', 4),
    ])

    expect(stand.gesamt).toBe(4)
    expect(stand.entschieden).toBe(3)
    expect(stand.offen).toBe(1)
    // Belassen ist kein Befund.
    expect(stand.auffaellig).toBe(2)
  })
})

describe('wendeSammelentscheidungAn', () => {
  it('füllt nur die offenen Zeilen', () => {
    const zeilen = [zeile('a', 1, 'ENTZIEHEN'), zeile('b', 2), zeile('c', 3)]
    const danach = wendeSammelentscheidungAn(zeilen, 'BELASSEN')

    expect(danach[0].ergebnis).toBe('ENTZIEHEN')
    expect(danach[1].ergebnis).toBe('BELASSEN')
    expect(danach[2].ergebnis).toBe('BELASSEN')
  })

  it('lässt die Ausgangsliste unverändert', () => {
    const zeilen = [zeile('a', 1)]
    wendeSammelentscheidungAn(zeilen, 'BELASSEN')
    expect(zeilen[0].ergebnis).toBeNull()
  })
})

describe('zeilenVon und auffaelligeZeilen', () => {
  it('sortiert nach Position', () => {
    const zeilen = [zeile('b', 2), zeile('a', 1)]
    expect(zeilenVon(zeilen, 'p1').map((z) => z.id)).toEqual(['a', 'b'])
  })

  it('liefert nur Zeilen mit Befund', () => {
    const zeilen = [
      zeile('a', 1, 'BELASSEN'),
      zeile('b', 2, 'ENTZIEHEN'),
      zeile('c', 3, 'AENDERN'),
    ]
    expect(auffaelligeZeilen(zeilen).map((z) => z.id)).toEqual(['b', 'c'])
  })
})

describe('fasseErgebnisZusammen mit Zeilen', () => {
  it('zählt auffällige Zeilen als Feststellungen', () => {
    const text = fasseErgebnisZusammen(
      [LISTE],
      [],
      [zeile('a', 1, 'BELASSEN'), zeile('b', 2, 'ENTZIEHEN')],
    )
    expect(text).toContain('1 Feststellung')
  })

  it('meldet einen Bogen ohne Befund als unauffällig', () => {
    const text = fasseErgebnisZusammen([LISTE], [], [zeile('a', 1, 'BELASSEN')])
    expect(text).toContain('ohne Feststellung')
  })
})

describe('uebernehmeZeilenAusCsv', () => {
  it('liest Semikolon-Dateien mit Kopfzeile', () => {
    const ergebnis = uebernehmeZeilenAusCsv(
      'sAMAccountName;Gruppe\r\nmmueller;Fachanwendung-Admins\r\nsschmidt;Buchhaltung\r\n',
    )

    expect(ergebnis.kopfzeileErkannt).toBe(true)
    expect(ergebnis.zeilen).toHaveLength(2)
    expect(ergebnis.zeilen[0]).toEqual({
      bezeichnung: 'mmueller',
      zusatz: 'Fachanwendung-Admins',
    })
  })

  it('verschluckt keine Datenzeile, nur weil hinten „Gruppe“ steht', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Gruppe\nsschmidt;Gruppe')

    expect(ergebnis.kopfzeileErkannt).toBe(false)
    expect(ergebnis.zeilen).toHaveLength(2)
  })

  it('kommt auch ohne Kopfzeile zurecht', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Admins\nsschmidt;Buchhaltung')

    expect(ergebnis.kopfzeileErkannt).toBe(false)
    expect(ergebnis.zeilen).toHaveLength(2)
  })

  it('erkennt Komma und Tabulator als Trennzeichen', () => {
    const komma = uebernehmeZeilenAusCsv('mmueller,Admins')
    expect(komma.zeilen[0].zusatz).toBe('Admins')

    const tab = uebernehmeZeilenAusCsv('mmueller\tAdmins')
    expect(tab.zeilen[0].zusatz).toBe('Admins')
  })

  it('beachtet Anführungszeichen samt enthaltenem Trennzeichen', () => {
    const ergebnis = uebernehmeZeilenAusCsv('"Müller, Maria";"Gruppe ""A"""')

    expect(ergebnis.zeilen[0].bezeichnung).toBe('Müller, Maria')
    expect(ergebnis.zeilen[0].zusatz).toBe('Gruppe "A"')
  })

  it('fügt weitere Spalten zum Zusatz zusammen', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Admins;Vertrieb')
    expect(ergebnis.zeilen[0].zusatz).toBe('Admins · Vertrieb')
  })

  it('entfernt eine leere Bombezeichnung und meldet sie', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Admins\n;Buchhaltung')

    expect(ergebnis.zeilen).toHaveLength(1)
    expect(ergebnis.uebersprungen).toEqual([{ zeile: 2, grund: 'ohne Bezeichnung' }])
  })

  it('überspringt doppelte Einträge', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Admins\nmmueller;Admins')

    expect(ergebnis.zeilen).toHaveLength(1)
    expect(ergebnis.uebersprungen[0].grund).toBe('doppelter Eintrag')
  })

  it('übergeht leere Zeilen stillschweigend', () => {
    const ergebnis = uebernehmeZeilenAusCsv('mmueller;Admins\n\n\nsschmidt;Buchhaltung\n')

    expect(ergebnis.zeilen).toHaveLength(2)
    expect(ergebnis.uebersprungen).toHaveLength(0)
  })

  it('entfernt eine führende Byte-Order-Mark', () => {
    const ergebnis = uebernehmeZeilenAusCsv('﻿mmueller;Admins')
    expect(ergebnis.zeilen[0].bezeichnung).toBe('mmueller')
  })

  it('begrenzt die Anzahl und meldet den Rest', () => {
    const viele = Array.from({ length: MAX_ZEILEN + 3 }, (_, i) => `konto${i};Gruppe`).join('\n')
    const ergebnis = uebernehmeZeilenAusCsv(viele)

    expect(ergebnis.zeilen).toHaveLength(MAX_ZEILEN)
    expect(ergebnis.uebersprungen).toHaveLength(3)
    expect(ergebnis.uebersprungen[0].grund).toContain('Höchstzahl')
  })

  it('berücksichtigt bereits vorhandene Zeilen bei der Höchstzahl', () => {
    const ergebnis = uebernehmeZeilenAusCsv('a;1\nb;2\nc;3', MAX_ZEILEN - 1)

    expect(ergebnis.zeilen).toHaveLength(1)
    expect(ergebnis.uebersprungen).toHaveLength(2)
  })
})
