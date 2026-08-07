import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  addiereIntervall,
  bewerteAmpel,
  ersteFaelligkeit,
  erzeugeVorschau,
  faelligkeitNachrollen,
  intervallText,
  istBaldFaellig,
  istUeberfaellig,
  naechsteFaelligkeit,
  statusNachTagesabgleich,
  verzugInTagen,
  warPuenktlich,
  type IntervallTyp,
} from './scheduling'

const iso = (d: Date) => d.toISOString().slice(0, 10)

describe('addiereIntervall', () => {
  const start = dateOnly(2026, 3, 15)

  it.each<[IntervallTyp, string]>([
    ['DAILY', '2026-03-16'],
    ['WEEKLY', '2026-03-22'],
    ['MONTHLY', '2026-04-15'],
    ['QUARTERLY', '2026-06-15'],
    ['SEMIANNUAL', '2026-09-15'],
    ['ANNUAL', '2027-03-15'],
  ])('%s ergibt %s', (typ, erwartet) => {
    expect(iso(addiereIntervall(start, typ))).toBe(erwartet)
  })

  it('EVERY_N_DAYS addiert den konfigurierten Wert', () => {
    expect(iso(addiereIntervall(start, 'EVERY_N_DAYS', 45))).toBe('2026-04-29')
    expect(iso(addiereIntervall(start, 'EVERY_N_DAYS', 1))).toBe('2026-03-16')
  })

  it('EVERY_N_DAYS ohne gültigen Wert wird abgelehnt', () => {
    expect(() => addiereIntervall(start, 'EVERY_N_DAYS')).toThrow(/Alle N Tage/)
    expect(() => addiereIntervall(start, 'EVERY_N_DAYS', 0)).toThrow()
    expect(() => addiereIntervall(start, 'EVERY_N_DAYS', -5)).toThrow()
    expect(() => addiereIntervall(start, 'EVERY_N_DAYS', 1.5)).toThrow()
  })

  it('begrenzt Monatsenden korrekt', () => {
    expect(iso(addiereIntervall(dateOnly(2026, 1, 31), 'MONTHLY'))).toBe('2026-02-28')
    expect(iso(addiereIntervall(dateOnly(2026, 8, 31), 'QUARTERLY'))).toBe('2026-11-30')
    expect(iso(addiereIntervall(dateOnly(2026, 8, 31), 'SEMIANNUAL'))).toBe(
      '2027-02-28',
    )
    expect(iso(addiereIntervall(dateOnly(2028, 2, 29), 'ANNUAL'))).toBe('2029-02-28')
  })

  it('rechnet über die Sommerzeitumstellung ohne Tagesversatz', () => {
    // Umstellung Ende März und Ende Oktober
    expect(iso(addiereIntervall(dateOnly(2026, 3, 25), 'WEEKLY'))).toBe('2026-04-01')
    expect(iso(addiereIntervall(dateOnly(2026, 10, 22), 'WEEKLY'))).toBe('2026-10-29')
  })

  it('verändert das Eingabedatum nicht', () => {
    const basis = dateOnly(2026, 5, 10)
    addiereIntervall(basis, 'ANNUAL')
    expect(iso(basis)).toBe('2026-05-10')
  })
})

describe('ersteFaelligkeit', () => {
  it('entspricht dem Startdatum', () => {
    expect(iso(ersteFaelligkeit(dateOnly(2026, 9, 1)))).toBe('2026-09-01')
  })

  it('schneidet eine mitgelieferte Uhrzeit ab', () => {
    expect(iso(ersteFaelligkeit(new Date('2026-09-01T15:22:00Z')))).toBe('2026-09-01')
  })
})

describe('naechsteFaelligkeit – Modus FIXED', () => {
  it('rechnet ab der Soll-Fälligkeit, nicht ab der Erledigung', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'QUARTERLY',
      scheduleMode: 'FIXED',
      letzteSollFaelligkeit: dateOnly(2026, 1, 15),
      erledigtAm: dateOnly(2026, 2, 3),
    })
    expect(iso(naechste)).toBe('2026-04-15')
  })

  it('behält den Takt auch bei sehr verspäteter Erledigung bei', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'MONTHLY',
      scheduleMode: 'FIXED',
      letzteSollFaelligkeit: dateOnly(2026, 1, 10),
      erledigtAm: dateOnly(2026, 6, 30),
    })
    // Der Rhythmus wird nicht verschoben – der Termin liegt bewusst in der
    // Vergangenheit und wird vom Tagesjob als überfällig markiert.
    expect(iso(naechste)).toBe('2026-02-10')
  })

  it('behält den Takt bei früher Erledigung bei', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'ANNUAL',
      scheduleMode: 'FIXED',
      letzteSollFaelligkeit: dateOnly(2026, 6, 1),
      erledigtAm: dateOnly(2026, 5, 2),
    })
    expect(iso(naechste)).toBe('2027-06-01')
  })
})

describe('naechsteFaelligkeit – Modus AFTER_COMPLETION', () => {
  it('rechnet ab dem Erledigungsdatum', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'QUARTERLY',
      scheduleMode: 'AFTER_COMPLETION',
      letzteSollFaelligkeit: dateOnly(2026, 1, 15),
      erledigtAm: dateOnly(2026, 2, 3),
    })
    expect(iso(naechste)).toBe('2026-05-03')
  })

  it('verschiebt den Takt bei verspäteter Erledigung', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'ANNUAL',
      scheduleMode: 'AFTER_COMPLETION',
      letzteSollFaelligkeit: dateOnly(2026, 3, 1),
      erledigtAm: dateOnly(2026, 4, 20),
    })
    expect(iso(naechste)).toBe('2027-04-20')
  })

  it('funktioniert mit EVERY_N_DAYS', () => {
    const naechste = naechsteFaelligkeit({
      intervalType: 'EVERY_N_DAYS',
      intervalValue: 90,
      scheduleMode: 'AFTER_COMPLETION',
      letzteSollFaelligkeit: dateOnly(2026, 1, 1),
      erledigtAm: dateOnly(2026, 1, 20),
    })
    expect(iso(naechste)).toBe('2026-04-20')
  })
})

describe('faelligkeitNachrollen', () => {
  it('addiert mindestens ein Intervall', () => {
    expect(iso(faelligkeitNachrollen(dateOnly(2026, 1, 15), 'MONTHLY', null))).toBe(
      '2026-02-15',
    )
  })

  it('rollt bis zur Untergrenze vor', () => {
    expect(
      iso(
        faelligkeitNachrollen(
          dateOnly(2026, 1, 15),
          'MONTHLY',
          null,
          dateOnly(2026, 5, 20),
        ),
      ),
    ).toBe('2026-06-15')
  })

  it('rollt nicht weiter, wenn der erste Termin bereits passt', () => {
    expect(
      iso(
        faelligkeitNachrollen(
          dateOnly(2026, 1, 15),
          'MONTHLY',
          null,
          dateOnly(2026, 1, 20),
        ),
      ),
    ).toBe('2026-02-15')
  })

  it('trifft die Untergrenze exakt', () => {
    expect(
      iso(
        faelligkeitNachrollen(
          dateOnly(2026, 1, 1),
          'WEEKLY',
          null,
          dateOnly(2026, 1, 15),
        ),
      ),
    ).toBe('2026-01-15')
  })
})

describe('istUeberfaellig', () => {
  const faellig = dateOnly(2026, 5, 10)

  it('ist am Fälligkeitstag selbst nicht überfällig', () => {
    expect(istUeberfaellig(faellig, 0, dateOnly(2026, 5, 10))).toBe(false)
  })

  it('ist ohne Karenz am Folgetag überfällig', () => {
    expect(istUeberfaellig(faellig, 0, dateOnly(2026, 5, 11))).toBe(true)
  })

  it('berücksichtigt die Karenztage', () => {
    expect(istUeberfaellig(faellig, 3, dateOnly(2026, 5, 13))).toBe(false)
    expect(istUeberfaellig(faellig, 3, dateOnly(2026, 5, 14))).toBe(true)
  })

  it('behandelt negative Karenzangaben wie null', () => {
    expect(istUeberfaellig(faellig, -5, dateOnly(2026, 5, 10))).toBe(false)
    expect(istUeberfaellig(faellig, -5, dateOnly(2026, 5, 11))).toBe(true)
  })

  it('ist vor dem Termin nie überfällig', () => {
    expect(istUeberfaellig(faellig, 0, dateOnly(2026, 1, 1))).toBe(false)
  })
})

describe('istBaldFaellig', () => {
  const faellig = dateOnly(2026, 5, 10)

  it('erscheint genau ab dueDate - leadTimeDays', () => {
    expect(istBaldFaellig(faellig, 7, 0, dateOnly(2026, 5, 2))).toBe(false)
    expect(istBaldFaellig(faellig, 7, 0, dateOnly(2026, 5, 3))).toBe(true)
    expect(istBaldFaellig(faellig, 7, 0, dateOnly(2026, 5, 10))).toBe(true)
  })

  it('gilt innerhalb der Karenzzeit weiter als bald fällig', () => {
    expect(istBaldFaellig(faellig, 7, 3, dateOnly(2026, 5, 13))).toBe(true)
    expect(istBaldFaellig(faellig, 7, 3, dateOnly(2026, 5, 14))).toBe(false)
  })

  it('gilt nicht mehr, sobald überfällig', () => {
    expect(istBaldFaellig(faellig, 7, 0, dateOnly(2026, 5, 11))).toBe(false)
  })

  it('ohne Vorlaufzeit erst am Fälligkeitstag', () => {
    expect(istBaldFaellig(faellig, 0, 0, dateOnly(2026, 5, 9))).toBe(false)
    expect(istBaldFaellig(faellig, 0, 0, dateOnly(2026, 5, 10))).toBe(true)
  })
})

describe('bewerteAmpel', () => {
  const faellig = dateOnly(2026, 5, 10)

  it('unterscheidet ok, bald und überfällig', () => {
    expect(bewerteAmpel(faellig, 7, 2, dateOnly(2026, 4, 1))).toBe('ok')
    expect(bewerteAmpel(faellig, 7, 2, dateOnly(2026, 5, 5))).toBe('bald')
    expect(bewerteAmpel(faellig, 7, 2, dateOnly(2026, 5, 12))).toBe('bald')
    expect(bewerteAmpel(faellig, 7, 2, dateOnly(2026, 5, 13))).toBe('ueberfaellig')
  })
})

describe('statusNachTagesabgleich', () => {
  const faellig = dateOnly(2026, 5, 10)

  it('setzt offene Fälligkeiten nach Fristablauf auf OVERDUE', () => {
    expect(statusNachTagesabgleich('OPEN', faellig, 0, dateOnly(2026, 5, 11))).toBe(
      'OVERDUE',
    )
  })

  it('lässt offene Fälligkeiten vor Fristablauf unverändert', () => {
    expect(statusNachTagesabgleich('OPEN', faellig, 0, dateOnly(2026, 5, 10))).toBe(
      'OPEN',
    )
  })

  it('setzt OVERDUE zurück, wenn sich der Termin verschoben hat', () => {
    expect(statusNachTagesabgleich('OVERDUE', faellig, 30, dateOnly(2026, 5, 20))).toBe(
      'OPEN',
    )
  })

  it('lässt erledigte und ausgesetzte Fälligkeiten unangetastet', () => {
    expect(statusNachTagesabgleich('DONE', faellig, 0, dateOnly(2027, 1, 1))).toBe(
      'DONE',
    )
    expect(statusNachTagesabgleich('SUSPENDED', faellig, 0, dateOnly(2027, 1, 1))).toBe(
      'SUSPENDED',
    )
  })
})

describe('verzugInTagen und warPuenktlich', () => {
  const faellig = dateOnly(2026, 5, 10)

  it('zählt Verzugstage', () => {
    expect(verzugInTagen(faellig, dateOnly(2026, 5, 14))).toBe(4)
    expect(verzugInTagen(faellig, dateOnly(2026, 5, 10))).toBe(0)
    expect(verzugInTagen(faellig, dateOnly(2026, 5, 7))).toBe(-3)
  })

  it('wertet Karenztage als pünktlich', () => {
    expect(warPuenktlich(faellig, dateOnly(2026, 5, 10), 0)).toBe(true)
    expect(warPuenktlich(faellig, dateOnly(2026, 5, 11), 0)).toBe(false)
    expect(warPuenktlich(faellig, dateOnly(2026, 5, 13), 3)).toBe(true)
    expect(warPuenktlich(faellig, dateOnly(2026, 5, 14), 3)).toBe(false)
  })

  it('wertet frühzeitige Erledigung als pünktlich', () => {
    expect(warPuenktlich(faellig, dateOnly(2026, 4, 20), 0)).toBe(true)
  })
})

describe('erzeugeVorschau', () => {
  it('liefert die Termine innerhalb des Fensters', () => {
    const termine = erzeugeVorschau({
      ab: dateOnly(2026, 1, 15),
      intervalType: 'MONTHLY',
      von: dateOnly(2026, 3, 1),
      bis: dateOnly(2026, 6, 30),
    })
    expect(termine.map(iso)).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
      '2026-06-15',
    ])
  })

  it('schließt Start- und Endtag ein', () => {
    const termine = erzeugeVorschau({
      ab: dateOnly(2026, 3, 1),
      intervalType: 'MONTHLY',
      von: dateOnly(2026, 3, 1),
      bis: dateOnly(2026, 5, 1),
    })
    expect(termine.map(iso)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01'])
  })

  it('liefert nichts, wenn das Fenster vor dem Start liegt', () => {
    const termine = erzeugeVorschau({
      ab: dateOnly(2027, 1, 1),
      intervalType: 'ANNUAL',
      von: dateOnly(2026, 1, 1),
      bis: dateOnly(2026, 12, 31),
    })
    expect(termine).toEqual([])
  })

  it('begrenzt die Anzahl der Termine', () => {
    const termine = erzeugeVorschau({
      ab: dateOnly(2026, 1, 1),
      intervalType: 'DAILY',
      von: dateOnly(2026, 1, 1),
      bis: dateOnly(2030, 1, 1),
      maxAnzahl: 10,
    })
    expect(termine).toHaveLength(10)
  })

  it('behält den Monatsrhythmus bei Monatsenden bei', () => {
    const termine = erzeugeVorschau({
      ab: dateOnly(2026, 1, 31),
      intervalType: 'MONTHLY',
      von: dateOnly(2026, 1, 1),
      bis: dateOnly(2026, 5, 31),
    })
    // Nach der Begrenzung auf den 28.02. läuft der Rhythmus auf dem 28. weiter.
    expect(termine.map(iso)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-28',
      '2026-04-28',
      '2026-05-28',
    ])
  })
})

describe('intervallText', () => {
  it('beschreibt feste Intervalle', () => {
    expect(intervallText('QUARTERLY')).toBe('Vierteljährlich')
    expect(intervallText('SEMIANNUAL')).toBe('Halbjährlich')
  })

  it('beschreibt EVERY_N_DAYS mit Wert', () => {
    expect(intervallText('EVERY_N_DAYS', 45)).toBe('Alle 45 Tage')
    expect(intervallText('EVERY_N_DAYS', 1)).toBe('Täglich')
    expect(intervallText('EVERY_N_DAYS', null)).toContain('nicht konfiguriert')
  })
})
