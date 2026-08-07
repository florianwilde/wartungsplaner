import { describe, expect, it } from 'vitest'

import {
  AUFFAELLIGE_ERGEBNISSE,
  ERLAUBTE_ERGEBNISSE,
  auffaelligePunkte,
  ergebnisPasst,
  fasseErgebnisZusammen,
  istAbgeschlossen,
  istAenderbar,
  istBeantwortet,
  pruefeUebergang,
  pruefeVollstaendigkeit,
  saeubereFrage,
  type Antwort,
  type Pruefpunkt,
  type UebergangsEingabe,
} from './nachweise'

const ERFASSER = 'benutzer-a'
const PRUEFER = 'benutzer-b'

const basis: UebergangsEingabe = {
  status: 'ENTWURF',
  vierAugen: true,
  handelnderId: ERFASSER,
  erfasstById: ERFASSER,
  vollstaendig: true,
}

describe('istAenderbar / istAbgeschlossen', () => {
  it('erlaubt Änderungen nur im Entwurf und nach Zurückweisung', () => {
    expect(istAenderbar('ENTWURF')).toBe(true)
    expect(istAenderbar('ZURUECKGEWIESEN')).toBe(true)
    expect(istAenderbar('VORGELEGT')).toBe(false)
    expect(istAenderbar('GEGENGEZEICHNET')).toBe(false)
  })

  it('erkennt den endgültigen Zustand', () => {
    expect(istAbgeschlossen('GEGENGEZEICHNET')).toBe(true)
    expect(istAbgeschlossen('VORGELEGT')).toBe(false)
  })
})

describe('pruefeUebergang – vorlegen', () => {
  it('führt vom Entwurf zur Vorlage', () => {
    const ergebnis = pruefeUebergang('vorlegen', basis)
    expect(ergebnis).toEqual({ erlaubt: true, neuerStatus: 'VORGELEGT' })
  })

  it('funktioniert auch nach einer Zurückweisung', () => {
    const ergebnis = pruefeUebergang('vorlegen', {
      ...basis,
      status: 'ZURUECKGEWIESEN',
    })
    expect(ergebnis.erlaubt).toBe(true)
  })

  it('verlangt vollständige Pflichtangaben', () => {
    const ergebnis = pruefeUebergang('vorlegen', { ...basis, vollstaendig: false })
    expect(ergebnis.erlaubt).toBe(false)
    if (!ergebnis.erlaubt) expect(ergebnis.grund).toContain('Pflichtangaben')
  })

  it('lässt nur die erfassende Person vorlegen', () => {
    const ergebnis = pruefeUebergang('vorlegen', { ...basis, handelnderId: PRUEFER })
    expect(ergebnis.erlaubt).toBe(false)
  })

  it('lehnt ab, wenn keine Gegenzeichnung vorgesehen ist', () => {
    const ergebnis = pruefeUebergang('vorlegen', { ...basis, vierAugen: false })
    expect(ergebnis.erlaubt).toBe(false)
    if (!ergebnis.erlaubt) expect(ergebnis.grund).toContain('direkt abschließen')
  })

  it('lehnt ein erneutes Vorlegen ab', () => {
    const ergebnis = pruefeUebergang('vorlegen', { ...basis, status: 'VORGELEGT' })
    expect(ergebnis.erlaubt).toBe(false)
  })
})

describe('pruefeUebergang – gegenzeichnen', () => {
  const vorgelegt: UebergangsEingabe = {
    ...basis,
    status: 'VORGELEGT',
    handelnderId: PRUEFER,
  }

  it('lässt eine zweite Person gegenzeichnen', () => {
    expect(pruefeUebergang('gegenzeichnen', vorgelegt)).toEqual({
      erlaubt: true,
      neuerStatus: 'GEGENGEZEICHNET',
    })
  })

  it('verhindert das Gegenzeichnen durch die erfassende Person', () => {
    // Das ist der Kern des Vier-Augen-Prinzips.
    const ergebnis = pruefeUebergang('gegenzeichnen', {
      ...vorgelegt,
      handelnderId: ERFASSER,
    })
    expect(ergebnis.erlaubt).toBe(false)
    if (!ergebnis.erlaubt) expect(ergebnis.grund).toContain('zweite Person')
  })

  it('lehnt das Gegenzeichnen eines Entwurfs ab', () => {
    const ergebnis = pruefeUebergang('gegenzeichnen', {
      ...vorgelegt,
      status: 'ENTWURF',
    })
    expect(ergebnis.erlaubt).toBe(false)
  })

  it('lehnt ein erneutes Gegenzeichnen ab', () => {
    const ergebnis = pruefeUebergang('gegenzeichnen', {
      ...vorgelegt,
      status: 'GEGENGEZEICHNET',
    })
    expect(ergebnis.erlaubt).toBe(false)
  })
})

describe('pruefeUebergang – zurueckweisen', () => {
  const vorgelegt: UebergangsEingabe = {
    ...basis,
    status: 'VORGELEGT',
    handelnderId: PRUEFER,
  }

  it('weist einen vorgelegten Nachweis zurück', () => {
    expect(pruefeUebergang('zurueckweisen', vorgelegt)).toEqual({
      erlaubt: true,
      neuerStatus: 'ZURUECKGEWIESEN',
    })
  })

  it('verhindert das Zurückweisen des eigenen Nachweises', () => {
    const ergebnis = pruefeUebergang('zurueckweisen', {
      ...vorgelegt,
      handelnderId: ERFASSER,
    })
    expect(ergebnis.erlaubt).toBe(false)
  })

  it('lehnt das Zurückweisen eines Entwurfs ab', () => {
    const ergebnis = pruefeUebergang('zurueckweisen', {
      ...vorgelegt,
      status: 'ENTWURF',
    })
    expect(ergebnis.erlaubt).toBe(false)
  })
})

describe('pruefeUebergang – abschliessen (ohne Vier-Augen-Pflicht)', () => {
  const ohneVierAugen: UebergangsEingabe = { ...basis, vierAugen: false }

  it('schließt direkt ab', () => {
    expect(pruefeUebergang('abschliessen', ohneVierAugen)).toEqual({
      erlaubt: true,
      neuerStatus: 'GEGENGEZEICHNET',
    })
  })

  it('lehnt ab, wenn eine Gegenzeichnung verlangt ist', () => {
    const ergebnis = pruefeUebergang('abschliessen', basis)
    expect(ergebnis.erlaubt).toBe(false)
    if (!ergebnis.erlaubt) expect(ergebnis.grund).toContain('Gegenzeichnung')
  })

  it('verlangt vollständige Pflichtangaben', () => {
    const ergebnis = pruefeUebergang('abschliessen', {
      ...ohneVierAugen,
      vollstaendig: false,
    })
    expect(ergebnis.erlaubt).toBe(false)
  })
})

describe('Ein abgeschlossener Nachweis ist endgültig', () => {
  it('lässt keinen weiteren Übergang zu', () => {
    const abgeschlossen: UebergangsEingabe = {
      ...basis,
      status: 'GEGENGEZEICHNET',
    }
    for (const uebergang of [
      'vorlegen',
      'gegenzeichnen',
      'zurueckweisen',
      'abschliessen',
    ] as const) {
      expect(
        pruefeUebergang(uebergang, {
          ...abgeschlossen,
          vierAugen: uebergang === 'abschliessen' ? false : true,
          handelnderId: uebergang === 'gegenzeichnen' ? PRUEFER : ERFASSER,
        }).erlaubt,
        uebergang,
      ).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Antworten
// ---------------------------------------------------------------------------

const PUNKTE: Pruefpunkt[] = [
  {
    id: 'p1',
    position: 1,
    frage: 'Sicherung vorhanden?',
    art: 'BEWERTUNG',
    pflicht: true,
  },
  {
    id: 'p2',
    position: 2,
    frage: 'Anzahl geprüfter Systeme',
    art: 'ZAHL',
    pflicht: true,
  },
  { id: 'p3', position: 3, frage: 'Bemerkung', art: 'TEXT', pflicht: false },
]

describe('istBeantwortet', () => {
  it('verlangt bei Bewertungen ein Ergebnis', () => {
    expect(
      istBeantwortet(PUNKTE[0], { punktId: 'p1', ergebnis: 'ERFUELLT', wert: null }),
    ).toBe(true)
    expect(
      istBeantwortet(PUNKTE[0], { punktId: 'p1', ergebnis: null, wert: 'ja' }),
    ).toBe(false)
  })

  it('verlangt bei Freitext und Zahl einen Wert', () => {
    expect(
      istBeantwortet(PUNKTE[1], { punktId: 'p2', ergebnis: null, wert: '3' }),
    ).toBe(true)
    expect(
      istBeantwortet(PUNKTE[1], { punktId: 'p2', ergebnis: null, wert: '  ' }),
    ).toBe(false)
    expect(
      istBeantwortet(PUNKTE[1], { punktId: 'p2', ergebnis: null, wert: null }),
    ).toBe(false)
  })

  it('behandelt eine fehlende Antwort als unbeantwortet', () => {
    expect(istBeantwortet(PUNKTE[0], undefined)).toBe(false)
  })
})

describe('pruefeVollstaendigkeit', () => {
  it('meldet offene Pflichtangaben mit Position', () => {
    const stand = pruefeVollstaendigkeit(PUNKTE, [
      { punktId: 'p1', ergebnis: 'ERFUELLT', wert: null },
    ])
    expect(stand.vollstaendig).toBe(false)
    expect(stand.offenePflichtpunkte).toEqual([2])
    expect(stand.beantwortet).toBe(1)
    expect(stand.gesamt).toBe(3)
  })

  it('ist vollständig, sobald alle Pflichtpunkte gefüllt sind', () => {
    const stand = pruefeVollstaendigkeit(PUNKTE, [
      { punktId: 'p1', ergebnis: 'ENTFAELLT', wert: null },
      { punktId: 'p2', ergebnis: null, wert: '7' },
    ])
    expect(stand.vollstaendig).toBe(true)
    // Der freiwillige Punkt bleibt offen, verhindert aber nichts.
    expect(stand.beantwortet).toBe(2)
  })

  it('sortiert die offenen Positionen', () => {
    const punkte: Pruefpunkt[] = [
      { id: 'a', position: 3, frage: 'C', art: 'TEXT', pflicht: true },
      { id: 'b', position: 1, frage: 'A', art: 'TEXT', pflicht: true },
    ]
    expect(pruefeVollstaendigkeit(punkte, []).offenePflichtpunkte).toEqual([1, 3])
  })
})

describe('ergebnisPasst', () => {
  it('lässt nur passende Ergebnisse zu', () => {
    expect(ergebnisPasst('BEWERTUNG', 'ERFUELLT')).toBe(true)
    expect(ergebnisPasst('BEWERTUNG', 'ENTZIEHEN')).toBe(false)
    expect(ergebnisPasst('ENTSCHEIDUNG', 'BELASSEN')).toBe(true)
    expect(ergebnisPasst('ENTSCHEIDUNG', 'ERFUELLT')).toBe(false)
  })

  it('lässt bei Text, Zahl und Datum kein Ergebnis zu', () => {
    expect(ergebnisPasst('TEXT', 'ERFUELLT')).toBe(false)
    expect(ergebnisPasst('ZAHL', null)).toBe(true)
  })

  it('erlaubt stets ein fehlendes Ergebnis', () => {
    expect(ergebnisPasst('BEWERTUNG', null)).toBe(true)
  })
})

describe('auffaelligePunkte', () => {
  const punkte: Pruefpunkt[] = [
    { id: 'p1', position: 1, frage: 'A', art: 'BEWERTUNG', pflicht: true },
    { id: 'p2', position: 2, frage: 'B', art: 'BEWERTUNG', pflicht: true },
    { id: 'p3', position: 3, frage: 'C', art: 'ENTSCHEIDUNG', pflicht: true },
  ]

  it('findet nicht erfüllte Punkte und Entzüge', () => {
    const antworten: Antwort[] = [
      { punktId: 'p1', ergebnis: 'ERFUELLT', wert: null },
      { punktId: 'p2', ergebnis: 'NICHT_ERFUELLT', wert: null },
      { punktId: 'p3', ergebnis: 'ENTZIEHEN', wert: null },
    ]
    const auffaellig = auffaelligePunkte(punkte, antworten)
    expect(auffaellig.map((a) => a.punkt.id)).toEqual(['p2', 'p3'])
  })

  it('wertet "entfällt" und "belassen" nicht als Feststellung', () => {
    const antworten: Antwort[] = [
      { punktId: 'p1', ergebnis: 'ENTFAELLT', wert: null },
      { punktId: 'p3', ergebnis: 'BELASSEN', wert: null },
    ]
    expect(auffaelligePunkte(punkte, antworten)).toEqual([])
  })

  it('stimmt mit der Liste der auffälligen Ergebnisse überein', () => {
    for (const ergebnis of AUFFAELLIGE_ERGEBNISSE) {
      const treffer = auffaelligePunkte(
        [{ id: 'x', position: 1, frage: 'X', art: 'BEWERTUNG', pflicht: true }],
        [{ punktId: 'x', ergebnis, wert: null }],
      )
      expect(treffer, ergebnis).toHaveLength(1)
    }
  })
})

describe('fasseErgebnisZusammen', () => {
  it('nennt Feststellungen, wenn es welche gibt', () => {
    const text = fasseErgebnisZusammen(PUNKTE, [
      { punktId: 'p1', ergebnis: 'NICHT_ERFUELLT', wert: null },
      { punktId: 'p2', ergebnis: null, wert: '5' },
    ])
    expect(text).toContain('1 Feststellung')
  })

  it('meldet ausdrücklich, wenn nichts auffällig ist', () => {
    const text = fasseErgebnisZusammen(PUNKTE, [
      { punktId: 'p1', ergebnis: 'ERFUELLT', wert: null },
      { punktId: 'p2', ergebnis: null, wert: '5' },
    ])
    expect(text).toContain('ohne Feststellung')
  })
})

describe('ERLAUBTE_ERGEBNISSE', () => {
  it('deckt jede Art ab', () => {
    for (const art of ['BEWERTUNG', 'TEXT', 'ZAHL', 'DATUM', 'ENTSCHEIDUNG'] as const) {
      expect(ERLAUBTE_ERGEBNISSE[art], art).toBeDefined()
    }
  })
})

describe('saeubereFrage', () => {
  it('fasst Leerraum zusammen', () => {
    expect(saeubereFrage('  Ist   die Sicherung  vollständig? ')).toBe(
      'Ist die Sicherung vollständig?',
    )
  })

  it('weist zu kurze Fragen ab', () => {
    expect(saeubereFrage('ab')).toBeNull()
    expect(saeubereFrage('')).toBeNull()
  })

  it('begrenzt die Länge', () => {
    expect(saeubereFrage('x'.repeat(500))).toHaveLength(300)
  })
})
