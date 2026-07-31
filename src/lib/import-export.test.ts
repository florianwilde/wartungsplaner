import { describe, expect, it } from 'vitest'

import { leseCsv } from './csv'
import {
  darfGeschriebenWerden,
  fasseVorschauZusammen,
  pruefeAufgaben,
  pruefeAuditReferenzen,
  pruefePruefboegen,
  pruefeBenutzer,
  pruefeKategorien,
  type AufgabenBestand,
  type BenutzerDaten,
  type KategorieDaten,
  type PruefbogenBestand,
  type ReferenzDaten,
} from './import-export'

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

const BESTAND_KATEGORIEN: KategorieDaten[] = [
  { name: 'Backup & Restore', color: '#0ea5e9', sortOrder: 10 },
  { name: 'Sicherheit', color: '#ef4444', sortOrder: 50 },
]

describe('pruefeKategorien', () => {
  it('erkennt neue Kategorien', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nNeu;#123456;70'),
      BESTAND_KATEGORIEN,
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.anlegen).toBe(1)
    expect(vorschau.eintraege[0].vorgang).toBe('anlegen')
  })

  it('erkennt Änderungen und benennt die Felder', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nSicherheit;#000000;99'),
      BESTAND_KATEGORIEN,
    )
    expect(vorschau.aktualisieren).toBe(1)
    expect(vorschau.eintraege[0].aenderungen).toEqual(['Farbe', 'Reihenfolge'])
  })

  it('erkennt unveränderte Datensätze', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nSicherheit;#ef4444;50'),
      BESTAND_KATEGORIEN,
    )
    expect(vorschau.unveraendert).toBe(1)
    expect(vorschau.aktualisieren).toBe(0)
  })

  it('ordnet unabhängig von der Groß- und Kleinschreibung zu', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nSICHERHEIT;#ef4444;50'),
      BESTAND_KATEGORIEN,
    )
    expect(vorschau.anlegen).toBe(0)
    expect(vorschau.eintraege[0].aenderungen).toContain('Schreibweise')
  })

  it('meldet zu kurze Namen mit Zeilennummer', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nA;#123456;1'),
      [],
    )
    expect(vorschau.fehler[0]).toMatchObject({ zeile: 2, spalte: 'name' })
  })

  it('meldet ungültige Farben', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nTest;rot;1'),
      [],
    )
    expect(vorschau.fehler[0].spalte).toBe('farbe')
  })

  it('meldet ungültige Reihenfolgen', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nTest;#123456;abc'),
      [],
    )
    expect(vorschau.fehler[0].spalte).toBe('reihenfolge')
  })

  it('meldet Dubletten innerhalb der Datei', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nTest;#123456;1\nTest;#654321;2'),
      [],
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].meldung).toContain('mehrfach')
  })

  it('verwendet Standardwerte für leere Felder', () => {
    const vorschau = pruefeKategorien(leseCsv('name;farbe;reihenfolge\nTest;;'), [])
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.eintraege[0].daten).toEqual({
      name: 'Test',
      color: '#64748b',
      sortOrder: 0,
    })
  })
})

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

const KOPF_AUFGABEN =
  'titel;beschreibung;kategorie;verantwortlich;intervall;intervalltage;rhythmus;startdatum;vorlauftage;karenztage;nachweispflicht;kritikalitaet;auditreferenz;aktiv;pruefanleitung'

const KATEGORIEN = ['Backup & Restore', 'Sicherheit']
const EMAILS = ['admin@example.com', 'meier@example.com']

const BESTAND_AUFGABEN: AufgabenBestand[] = [
  {
    title: 'Restore-Test ERP',
    kategorieName: 'Backup & Restore',
    verantwortlichEmail: 'admin@example.com',
    intervalType: 'QUARTERLY',
    intervalValue: null,
    scheduleMode: 'FIXED',
    startDate: '2026-01-15',
    leadTimeDays: 14,
    graceDays: 7,
    evidenceRequired: true,
    criticality: 'HIGH',
    auditReferenzen: 'ISO 27001 A.8.13',
    active: true,
    description: null,
    instructionsMd: null,
  },
]

describe('pruefeAufgaben', () => {
  it('erkennt neue Aufgaben', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nNeue Prüfung;;Sicherheit;meier@example.com;MONTHLY;;FIXED;2026-03-01;7;3;ja;HIGH;A.1;ja;`,
      ),
      BESTAND_AUFGABEN,
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.anlegen).toBe(1)
    expect(vorschau.eintraege[0].daten.evidenceRequired).toBe(true)
    expect(vorschau.eintraege[0].daten.leadTimeDays).toBe(7)
  })

  it('erkennt unveränderte Aufgaben', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nRestore-Test ERP;;Backup & Restore;admin@example.com;QUARTERLY;;FIXED;2026-01-15;14;7;ja;HIGH;ISO 27001 A.8.13;ja;`,
      ),
      BESTAND_AUFGABEN,
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.unveraendert).toBe(1)
  })

  it('benennt geänderte Felder', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nRestore-Test ERP;;Sicherheit;meier@example.com;QUARTERLY;;FIXED;2026-01-15;14;7;ja;HIGH;ISO 27001 A.8.13;ja;`,
      ),
      BESTAND_AUFGABEN,
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.eintraege[0].aenderungen).toEqual(['Kategorie', 'Verantwortlich'])
  })

  it('weist unbekannte Kategorien ab', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Gibtsnicht;admin@example.com;MONTHLY;;FIXED;2026-03-01;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.fehler[0].spalte).toBe('kategorie')
    expect(vorschau.fehler[0].meldung).toContain('zuerst die Kategorien')
  })

  it('weist unbekannte Verantwortliche ab', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;fremd@example.com;MONTHLY;;FIXED;2026-03-01;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.fehler[0].spalte).toBe('verantwortlich')
  })

  it('verlangt bei EVERY_N_DAYS eine Tagesangabe', () => {
    const ohne = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;admin@example.com;EVERY_N_DAYS;;FIXED;2026-03-01;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(ohne.fehler[0].spalte).toBe('intervalltage')

    const mit = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;admin@example.com;EVERY_N_DAYS;45;FIXED;2026-03-01;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(mit.fehler).toEqual([])
    expect(mit.eintraege[0].daten.intervalValue).toBe(45)
  })

  it('weist ungültige Startdaten ab', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;admin@example.com;MONTHLY;;FIXED;01.03.2026;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.fehler[0].spalte).toBe('startdatum')
  })

  it('weist unbekannte Intervalle und Kritikalitäten ab', () => {
    const intervall = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;admin@example.com;IRGENDWAS;;FIXED;2026-03-01;7;3;ja;HIGH;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(intervall.fehler[0].spalte).toBe('intervall')

    const kritikalitaet = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;admin@example.com;MONTHLY;;FIXED;2026-03-01;7;3;ja;EXTREM;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(kritikalitaet.fehler[0].spalte).toBe('kritikalitaet')
  })

  it('nimmt Groß- und Kleinschreibung bei Aufzählungen entgegen', () => {
    const vorschau = pruefeAufgaben(
      leseCsv(
        `${KOPF_AUFGABEN}\nTest;;Sicherheit;ADMIN@example.com;monthly;;fixed;2026-03-01;7;3;ja;high;;ja;`,
      ),
      [],
      KATEGORIEN,
      EMAILS,
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.eintraege[0].daten.intervalType).toBe('MONTHLY')
    expect(vorschau.eintraege[0].daten.criticality).toBe('HIGH')
  })
})

// ---------------------------------------------------------------------------
// Benutzer
// ---------------------------------------------------------------------------

const BESTAND_BENUTZER: BenutzerDaten[] = [
  {
    name: 'Administrator',
    email: 'admin@example.com',
    role: 'ADMIN',
    authProvider: 'LOCAL',
    active: true,
    notifyByEmail: true,
  },
]

describe('pruefeBenutzer', () => {
  it('erkennt neue Benutzer', () => {
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nFrau Meier;meier@example.com;EDITOR;LOCAL;ja;ja',
      ),
      BESTAND_BENUTZER,
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.anlegen).toBe(1)
  })

  it('erkennt Rollenwechsel', () => {
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nAdministrator;admin@example.com;EDITOR;LOCAL;ja;ja',
      ),
      BESTAND_BENUTZER,
    )
    expect(vorschau.eintraege[0].aenderungen).toEqual(['Rolle'])
  })

  it('ändert das Anmeldeverfahren bestehender Konten nicht', () => {
    // Ein Wechsel würde ein vorhandenes Passwort entwerten.
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nAdministrator;admin@example.com;ADMIN;OIDC;ja;ja',
      ),
      BESTAND_BENUTZER,
    )
    expect(vorschau.eintraege[0].aenderungen).toEqual([])
    expect(vorschau.unveraendert).toBe(1)
  })

  it('weist ungültige E-Mail-Adressen ab', () => {
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nTest;keine-mail;EDITOR;LOCAL;ja;ja',
      ),
      [],
    )
    expect(vorschau.fehler[0].spalte).toBe('email')
  })

  it('normalisiert E-Mail-Adressen', () => {
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nTest; MEIER@Example.COM ;EDITOR;LOCAL;ja;ja',
      ),
      [],
    )
    expect(vorschau.eintraege[0].daten.email).toBe('meier@example.com')
  })

  it('weist unbekannte Rollen ab', () => {
    const vorschau = pruefeBenutzer(
      leseCsv(
        'name;email;rolle;anmeldeverfahren;aktiv;benachrichtigungen\nTest;a@b.de;CHEF;LOCAL;ja;ja',
      ),
      [],
    )
    expect(vorschau.fehler[0].spalte).toBe('rolle')
  })
})

// ---------------------------------------------------------------------------
// Gemeinsames
// ---------------------------------------------------------------------------

describe('darfGeschriebenWerden', () => {
  it('verweigert den Lauf bei einem einzigen Fehler', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nGut;#123456;1\nA;#123456;2'),
      [],
    )
    // Ein fehlerhafter Datensatz verhindert den gesamten Lauf.
    expect(vorschau.anlegen).toBe(1)
    expect(darfGeschriebenWerden(vorschau)).toBe(false)
  })

  it('verweigert den Lauf, wenn es nichts zu tun gibt', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nSicherheit;#ef4444;50'),
      BESTAND_KATEGORIEN,
    )
    expect(darfGeschriebenWerden(vorschau)).toBe(false)
  })

  it('lässt fehlerfreie Läufe mit Änderungen zu', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nNeu;#123456;1'),
      [],
    )
    expect(darfGeschriebenWerden(vorschau)).toBe(true)
  })
})

describe('fasseVorschauZusammen', () => {
  it('nennt Fehler zuerst', () => {
    const vorschau = pruefeKategorien(leseCsv('name;farbe;reihenfolge\nA;#123456;1'), [])
    expect(fasseVorschauZusammen(vorschau)).toContain('nichts geschrieben')
  })

  it('meldet, wenn nichts zu tun ist', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nSicherheit;#ef4444;50'),
      BESTAND_KATEGORIEN,
    )
    expect(fasseVorschauZusammen(vorschau)).toContain('Keine Änderungen')
  })

  it('zählt die Vorgänge auf', () => {
    const vorschau = pruefeKategorien(
      leseCsv('name;farbe;reihenfolge\nNeu;#123456;1\nSicherheit;#000000;50'),
      BESTAND_KATEGORIEN,
    )
    expect(fasseVorschauZusammen(vorschau)).toBe(
      '1 anlegen, 1 aktualisieren, 0 unverändert.',
    )
  })
})


// ---------------------------------------------------------------------------
// Audit-Referenzen
// ---------------------------------------------------------------------------

const BESTAND_REFERENZEN: ReferenzDaten[] = [
  {
    kuerzel: 'A.8.13',
    bezeichnung: 'Sicherung von Informationen',
    rahmenwerk: 'ISO 27001',
    beschreibung: null,
    aktiv: true,
    sortOrder: 10,
  },
]

const referenzZeilen = (...zeilen: string[]) =>
  leseCsv(
    [
      'rahmenwerk;kuerzel;bezeichnung;beschreibung;aktiv;reihenfolge',
      ...zeilen,
    ].join('\n'),
  )

describe('pruefeAuditReferenzen', () => {
  it('legt eine unbekannte Referenz an', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen('ISO 27001;A.5.18;Zugangsrechte;;ja;20'),
      BESTAND_REFERENZEN,
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.anlegen).toBe(1)
    expect(vorschau.eintraege[0].schluessel).toBe('ISO 27001 A.5.18')
  })

  it('erkennt eine vorhandene Referenz als unverändert', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen('ISO 27001;A.8.13;Sicherung von Informationen;;ja;10'),
      BESTAND_REFERENZEN,
    )
    expect(vorschau.unveraendert).toBe(1)
    expect(vorschau.anlegen).toBe(0)
  })

  it('nennt die geänderten Felder', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen(
        'ISO 27001;A.8.13;Sicherung von Daten;Neue Erläuterung;nein;10',
      ),
      BESTAND_REFERENZEN,
    )
    expect(vorschau.aktualisieren).toBe(1)
    expect(vorschau.eintraege[0].aenderungen).toEqual([
      'Bezeichnung',
      'Beschreibung',
      'Aktiv',
    ])
  })

  it('unterscheidet dasselbe Kurzzeichen in verschiedenen Rahmenwerken', () => {
    // Dieselbe Kennung bedeutet in einem anderen Rahmenwerk etwas anderes –
    // das darf der Abgleich nicht zusammenwerfen.
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen('TISAX;A.8.13;Etwas ganz anderes;;ja;10'),
      BESTAND_REFERENZEN,
    )
    expect(vorschau.anlegen).toBe(1)
  })

  it('weist ein doppeltes Kurzzeichen in derselben Datei ab', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen(
        'ISO 27001;A.5.18;Zugangsrechte;;ja;10',
        'ISO 27001;a.5.18;Nochmal;;ja;20',
      ),
      BESTAND_REFERENZEN,
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].meldung).toContain('mehrfach')
  })

  it('verlangt Kurzzeichen und Bezeichnung', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen(';;;;ja;0', 'ISO 27001;A.1;ab;;ja;0'),
      [],
    )
    expect(vorschau.fehler).toHaveLength(2)
    expect(vorschau.fehler[0].spalte).toBe('kuerzel')
    expect(vorschau.fehler[1].spalte).toBe('bezeichnung')
  })

  it('lehnt einen unverständlichen Ja-Nein-Wert ab, statt zu raten', () => {
    // Aus einer unklaren Angabe klaglos "ja" zu machen wäre eine stille
    // Falschauskunft.
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen('ISO 27001;A.5.18;Zugangsrechte;;vielleicht;10'),
      [],
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].spalte).toBe('aktiv')
  })

  it('kommt ohne Rahmenwerk aus', () => {
    const vorschau = pruefeAuditReferenzen(
      referenzZeilen(';Eigene-1;Interne Vorgabe;;ja;0'),
      [],
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.eintraege[0].schluessel).toBe('Eigene-1')
    expect(vorschau.eintraege[0].daten.rahmenwerk).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Prüfbögen
// ---------------------------------------------------------------------------

const bogenZeilen = (...zeilen: string[]) =>
  leseCsv(
    [
      'pruefbogen;beschreibung;aufgabe;vier_augen;aktiv;position;frage;hinweis;art;pflicht',
      ...zeilen,
    ].join('\n'),
  )

const BESTAND_BOEGEN: PruefbogenBestand[] = [
  {
    name: 'Rezertifizierung',
    beschreibung: 'Halbjährliche Durchsicht',
    aufgabe: null,
    vierAugen: true,
    aktiv: true,
    punkte: [
      {
        position: 1,
        frage: 'Sind alle privilegierten Konten begründet?',
        hinweis: null,
        art: 'BEWERTUNG',
        pflicht: true,
      },
    ],
    hatNachweise: false,
  },
]

describe('pruefePruefboegen', () => {
  it('fasst mehrere Zeilen zu einem Bogen zusammen', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Restore-Test;Ablauf der Rücksicherung;;ja;ja;1;Ist die Sicherung lesbar?;;BEWERTUNG;ja',
        'Restore-Test;Ablauf der Rücksicherung;;ja;ja;2;Dauer der Rücksicherung;in Minuten;ZAHL;nein',
      ),
      [],
      [],
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.anlegen).toBe(1)
    expect(vorschau.eintraege[0].daten.punkte).toHaveLength(2)
    expect(vorschau.eintraege[0].daten.vierAugen).toBe(true)
    expect(vorschau.eintraege[0].daten.punkte[1].art).toBe('ZAHL')
  })

  it('nummeriert ohne Positionsangabe in der Reihenfolge der Datei', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Bogen;;;nein;ja;;Erste Frage;;BEWERTUNG;ja',
        'Bogen;;;nein;ja;;Zweite Frage;;BEWERTUNG;ja',
      ),
      [],
      [],
    )
    expect(vorschau.eintraege[0].daten.punkte.map((p) => p.position)).toEqual([
      1, 2,
    ])
  })

  it('weist eine doppelte Position ab', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Bogen;;;nein;ja;1;Erste Frage;;BEWERTUNG;ja',
        'Bogen;;;nein;ja;1;Zweite Frage;;BEWERTUNG;ja',
      ),
      [],
      [],
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].spalte).toBe('position')
  })

  it('weist einen Bogen ohne Prüfpunkt ab', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen('Leerer Bogen;;;nein;ja;1;;;BEWERTUNG;ja'),
      [],
      [],
    )
    expect(vorschau.fehler.length).toBeGreaterThan(0)
    expect(vorschau.anlegen).toBe(0)
  })

  it('weist eine unbekannte Art ab und nennt die erlaubten', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen('Bogen;;;nein;ja;1;Eine Frage;;MEINUNG;ja'),
      [],
      [],
    )
    expect(vorschau.fehler[0].spalte).toBe('art')
    expect(vorschau.fehler[0].meldung).toContain('BEWERTUNG')
  })

  it('ordnet einer vorhandenen Aufgabe zu', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen('Bogen;;Restore-Test ERP;nein;ja;1;Eine Frage;;BEWERTUNG;ja'),
      [],
      ['Restore-Test ERP'],
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.eintraege[0].daten.aufgabe).toBe('Restore-Test ERP')
  })

  it('weist eine unbekannte Aufgabe ab', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen('Bogen;;Gibt es nicht;nein;ja;1;Eine Frage;;BEWERTUNG;ja'),
      [],
      ['Restore-Test ERP'],
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].spalte).toBe('aufgabe')
  })

  it('erkennt einen unveränderten Bogen', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;1;Sind alle privilegierten Konten begründet?;;BEWERTUNG;ja',
      ),
      BESTAND_BOEGEN,
      [],
    )
    expect(vorschau.unveraendert).toBe(1)
    expect(vorschau.eintraege[0].aenderungen).toEqual([])
  })

  it('meldet geänderte Prüfpunkte als Änderung', () => {
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;1;Sind alle privilegierten Konten begründet?;;BEWERTUNG;ja',
        'Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;2;Neue Frage;;TEXT;nein',
      ),
      BESTAND_BOEGEN,
      [],
    )
    expect(vorschau.aktualisieren).toBe(1)
    expect(vorschau.eintraege[0].aenderungen).toContain('Prüfpunkte')
  })

  it('verweigert das Ändern der Prüfpunkte eines benutzten Bogens', () => {
    // An den Punkten hängen Antworten und Belege geführter Nachweise. Sie zu
    // ersetzen hieße, einen abgeschlossenen Nachweis nachträglich zu ändern.
    const benutzt: PruefbogenBestand[] = [
      { ...BESTAND_BOEGEN[0], hatNachweise: true },
    ]
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;1;Ganz andere Frage;;BEWERTUNG;ja',
      ),
      benutzt,
      [],
    )
    expect(vorschau.fehler).toHaveLength(1)
    expect(vorschau.fehler[0].meldung).toContain('bereits geprüft')
    expect(vorschau.aktualisieren).toBe(0)
  })

  it('lässt Beschreibung und Aktiv-Status eines benutzten Bogens zu', () => {
    // Die Angaben zum Bogen berühren keinen geführten Nachweis.
    const benutzt: PruefbogenBestand[] = [
      { ...BESTAND_BOEGEN[0], hatNachweise: true },
    ]
    const vorschau = pruefePruefboegen(
      bogenZeilen(
        'Rezertifizierung;Neue Beschreibung;;ja;nein;1;Sind alle privilegierten Konten begründet?;;BEWERTUNG;ja',
      ),
      benutzt,
      [],
    )
    expect(vorschau.fehler).toEqual([])
    expect(vorschau.eintraege[0].aenderungen).toEqual(['Beschreibung', 'Aktiv'])
  })
})
