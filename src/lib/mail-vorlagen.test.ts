import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  anzahlText,
  baueAbweichungsMail,
  baueAufgabenMail,
  baueEskalationsMail,
  baueTestMail,
  baueWochenuebersichtMail,
  fristText,
  maskiereHtml,
  type AbweichungsEintrag,
  type AufgabenEintrag,
  type MailRahmen,
} from './mail-vorlagen'

const RAHMEN: MailRahmen = {
  anwendung: 'Wartungsplaner',
  organisation: 'Beispiel GmbH',
  markenfarbe: '#1b7cb5',
  appUrl: 'https://wartungsplaner.example.de',
  stichtag: dateOnly(2026, 7, 29),
}

const AUFGABE_UEBERFAELLIG: AufgabenEintrag = {
  aufgabe: 'Restore-Test ERP-System',
  kategorie: 'Backup & Restore',
  faelligAm: dateOnly(2026, 7, 17),
  ueberfaellig: true,
  kritikalitaet: 'Hoch',
  url: 'https://wartungsplaner.example.de/tasks/abc',
}

const AUFGABE_BALD: AufgabenEintrag = {
  aufgabe: 'Zertifikats-Check',
  kategorie: 'Sicherheit',
  faelligAm: dateOnly(2026, 8, 2),
  ueberfaellig: false,
  kritikalitaet: 'Mittel',
  url: 'https://wartungsplaner.example.de/tasks/def',
}

const ABWEICHUNG: AbweichungsEintrag = {
  titel: 'Patchstand SRV-07 veraltet',
  aufgabe: 'Patch-Status-Review',
  schwere: 'Hoch',
  frist: dateOnly(2026, 7, 25),
  fristUeberschritten: true,
  url: 'https://wartungsplaner.example.de/findings',
}

describe('maskiereHtml', () => {
  it('maskiert alle Sonderzeichen', () => {
    expect(maskiereHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    )
    expect(maskiereHtml("Müller & Söhne's")).toBe('Müller &amp; Söhne&#39;s')
  })

  it('lässt harmlosen Text unverändert', () => {
    expect(maskiereHtml('Restore-Test ERP')).toBe('Restore-Test ERP')
  })
})

describe('fristText', () => {
  const heute = dateOnly(2026, 7, 29)

  it('beschreibt Vergangenheit und Zukunft', () => {
    expect(fristText(heute, dateOnly(2026, 7, 29))).toBe('heute')
    expect(fristText(heute, dateOnly(2026, 7, 30))).toBe('morgen')
    expect(fristText(heute, dateOnly(2026, 7, 28))).toBe('seit gestern')
    expect(fristText(heute, dateOnly(2026, 8, 3))).toBe('in 5 Tagen')
    expect(fristText(heute, dateOnly(2026, 7, 22))).toBe('seit 7 Tagen')
  })
})

describe('anzahlText', () => {
  it('unterscheidet Einzahl und Mehrzahl', () => {
    expect(anzahlText(1, 'Prüfung', 'Prüfungen')).toBe('1 Prüfung')
    expect(anzahlText(3, 'Prüfung', 'Prüfungen')).toBe('3 Prüfungen')
    expect(anzahlText(0, 'Prüfung', 'Prüfungen')).toBe('0 Prüfungen')
  })
})

describe('baueAufgabenMail', () => {
  it('nennt überfällige Prüfungen im Betreff, wenn es welche gibt', () => {
    const mail = baueAufgabenMail(RAHMEN, 'Frau Meier', [
      AUFGABE_UEBERFAELLIG,
      AUFGABE_BALD,
    ])
    expect(mail.betreff).toBe('[Wartungsplaner] 1 überfällige Prüfung')
  })

  it('nennt anstehende Prüfungen, wenn nichts überfällig ist', () => {
    const mail = baueAufgabenMail(RAHMEN, 'Frau Meier', [AUFGABE_BALD])
    expect(mail.betreff).toBe('[Wartungsplaner] 1 anstehende Prüfung')
  })

  it('führt beide Abschnitte in der Textfassung', () => {
    const mail = baueAufgabenMail(RAHMEN, 'Frau Meier', [
      AUFGABE_UEBERFAELLIG,
      AUFGABE_BALD,
    ])
    expect(mail.text).toContain('ÜBERFÄLLIG')
    expect(mail.text).toContain('BALD FÄLLIG')
    expect(mail.text).toContain('Restore-Test ERP-System')
    expect(mail.text).toContain('17.07.2026')
    expect(mail.text).toContain('seit 12 Tagen')
    expect(mail.text).toContain('Guten Tag Frau Meier,')
  })

  it('lässt einen leeren Abschnitt weg', () => {
    const mail = baueAufgabenMail(RAHMEN, 'Frau Meier', [AUFGABE_BALD])
    expect(mail.text).not.toContain('ÜBERFÄLLIG')
    expect(mail.text).toContain('BALD FÄLLIG')
  })

  it('liefert wohlgeformtes HTML mit Verweisen', () => {
    const mail = baueAufgabenMail(RAHMEN, 'Frau Meier', [AUFGABE_UEBERFAELLIG])
    expect(mail.html).toContain('<!doctype html>')
    expect(mail.html).toContain('</html>')
    expect(mail.html).toContain('https://wartungsplaner.example.de/tasks/abc')
    expect(mail.html).toContain('#1b7cb5')
    expect(mail.html).toContain('Beispiel GmbH')
  })

  it('maskiert Inhalte aus der Datenbank im HTML', () => {
    const boesartig: AufgabenEintrag = {
      ...AUFGABE_BALD,
      aufgabe: '<img src=x onerror="alert(1)">',
      kategorie: 'A & B',
    }
    const mail = baueAufgabenMail(RAHMEN, '<b>Chef</b>', [boesartig])
    expect(mail.html).not.toContain('<img src=x')
    expect(mail.html).toContain('&lt;img src=x')
    expect(mail.html).toContain('A &amp; B')
    expect(mail.html).not.toContain('<b>Chef</b>')
  })
})

describe('baueAbweichungsMail', () => {
  it('hebt überschrittene Fristen im Betreff hervor', () => {
    const mail = baueAbweichungsMail(RAHMEN, 'Herr Schulz', [ABWEICHUNG])
    expect(mail.betreff).toContain('überschrittener Frist')
  })

  it('meldet näher rückende Fristen ohne Überschreitung anders', () => {
    const mail = baueAbweichungsMail(RAHMEN, 'Herr Schulz', [
      { ...ABWEICHUNG, fristUeberschritten: false, frist: dateOnly(2026, 8, 3) },
    ])
    expect(mail.betreff).toContain('näher rückender Frist')
  })

  it('nennt Titel, Aufgabe und Frist', () => {
    const mail = baueAbweichungsMail(RAHMEN, 'Herr Schulz', [ABWEICHUNG])
    expect(mail.text).toContain('Patchstand SRV-07 veraltet')
    expect(mail.text).toContain('Patch-Status-Review')
    expect(mail.text).toContain('25.07.2026')
    expect(mail.text).toContain('(überschritten)')
    expect(mail.html).toContain('Frist überschritten')
  })
})

describe('baueEskalationsMail', () => {
  it('nennt Schwelle und Verantwortliche', () => {
    const mail = baueEskalationsMail(RAHMEN, 'Herr Hofmann', 7, [
      { ...AUFGABE_UEBERFAELLIG, verantwortlich: 'Frau Meier' },
    ])
    expect(mail.betreff).toContain('seit mehr als 7 Tagen überfällig')
    expect(mail.text).toContain('verantwortlich: Frau Meier')
    expect(mail.html).toContain('Frau Meier')
  })
})

describe('baueWochenuebersichtMail', () => {
  it('nennt den Stichtag im Betreff', () => {
    const mail = baueWochenuebersichtMail(RAHMEN, 'Frau Meier', [], [])
    expect(mail.betreff).toBe('[Wartungsplaner] Wochenübersicht vom 29.07.2026')
  })

  it('meldet ausdrücklich, wenn nichts ansteht', () => {
    const mail = baueWochenuebersichtMail(RAHMEN, 'Frau Meier', [], [])
    expect(mail.text).toContain('nichts an')
    expect(mail.html).toContain('nichts an')
  })

  it('listet Prüfungen und Abweichungen mit Anzahl', () => {
    const mail = baueWochenuebersichtMail(
      RAHMEN,
      'Frau Meier',
      [AUFGABE_UEBERFAELLIG, AUFGABE_BALD],
      [ABWEICHUNG],
    )
    expect(mail.text).toContain('OFFENE PRÜFUNGEN (2)')
    expect(mail.text).toContain('OFFENE ABWEICHUNGEN (1)')
    expect(mail.text).toContain('(überfällig)')
    expect(mail.html).toContain('Offene Prüfungen (2)')
    expect(mail.html).toContain('Offene Abweichungen (1)')
  })
})

describe('baueTestMail', () => {
  it('enthält die Eckdaten der Installation', () => {
    const mail = baueTestMail(RAHMEN, 'Administrator')
    expect(mail.betreff).toBe('[Wartungsplaner] Testnachricht')
    expect(mail.text).toContain('https://wartungsplaner.example.de')
    expect(mail.text).toContain('29.07.2026')
    expect(mail.html).toContain('<!doctype html>')
  })
})

describe('Alle Vorlagen', () => {
  const alle = [
    baueAufgabenMail(RAHMEN, 'Test', [AUFGABE_UEBERFAELLIG, AUFGABE_BALD]),
    baueAbweichungsMail(RAHMEN, 'Test', [ABWEICHUNG]),
    baueEskalationsMail(RAHMEN, 'Test', 7, [
      { ...AUFGABE_UEBERFAELLIG, verantwortlich: 'Frau Meier' },
    ]),
    baueWochenuebersichtMail(RAHMEN, 'Test', [AUFGABE_BALD], [ABWEICHUNG]),
    baueTestMail(RAHMEN, 'Test'),
  ]

  it('liefern immer Betreff, Text und HTML', () => {
    for (const mail of alle) {
      expect(mail.betreff.length).toBeGreaterThan(5)
      expect(mail.text.length).toBeGreaterThan(20)
      expect(mail.html).toContain('<!doctype html>')
      expect(mail.html).toContain('</html>')
    }
  })

  it('weisen im Betreff die Anwendung aus', () => {
    for (const mail of alle) {
      expect(mail.betreff.startsWith('[Wartungsplaner]')).toBe(true)
    }
  })

  it('enthalten den Hinweis auf den automatischen Versand', () => {
    for (const mail of alle) {
      expect(mail.text).toContain('automatisch erzeugt')
      expect(mail.html).toContain('automatisch erzeugt')
    }
  })
})

describe('Schutz vor Header-Injection im Betreff', () => {
  it('entfernt Zeilenumbrüche aus dem Anwendungsnamen', () => {
    // Der Anwendungsname ist im Admin-Bereich frei setzbar. Ein Umbruch darf
    // nicht in die Betreffzeile gelangen, sonst ließen sich weitere
    // Mail-Kopfzeilen einschleusen.
    const boesartig: MailRahmen = {
      ...RAHMEN,
      anwendung: 'Planer\r\nBcc: fremd@example.com',
    }

    const alle = [
      baueAufgabenMail(boesartig, 'Test', [AUFGABE_BALD]),
      baueAbweichungsMail(boesartig, 'Test', [ABWEICHUNG]),
      baueEskalationsMail(boesartig, 'Test', 7, [
        { ...AUFGABE_UEBERFAELLIG, verantwortlich: 'X' },
      ]),
      baueWochenuebersichtMail(boesartig, 'Test', [AUFGABE_BALD], []),
      baueTestMail(boesartig, 'Test'),
    ]

    for (const mail of alle) {
      expect(mail.betreff).not.toContain('\r')
      expect(mail.betreff).not.toContain('\n')
    }
  })

  it('begrenzt die Länge der Betreffzeile', () => {
    const langerName: MailRahmen = { ...RAHMEN, anwendung: 'A'.repeat(500) }
    const mail = baueTestMail(langerName, 'Test')
    expect(mail.betreff.length).toBeLessThanOrEqual(200)
  })
})
