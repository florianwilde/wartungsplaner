import { describe, expect, it } from 'vitest'

import { dateOnly } from './dates'
import {
  baueGegenzeichnungsMail,
  baueZurueckweisungsMail,
  type GegenzeichnungsEintrag,
  type MailRahmen,
} from './mail-vorlagen'

const RAHMEN: MailRahmen = {
  anwendung: 'Wartungsplaner',
  organisation: 'Beispiel GmbH',
  markenfarbe: '#1b7cb5',
  appUrl: 'https://wartungsplaner.example.de',
  stichtag: dateOnly(2026, 7, 30),
}

const VORGELEGT: GegenzeichnungsEintrag = {
  pruefbogen: 'Rezertifizierung Berechtigungen',
  aufgabe: 'Berechtigungsprüfung Fachanwendung',
  erfasstVon: 'Anna Beispiel',
  vorgelegtAm: dateOnly(2026, 7, 29),
  feststellungen: 2,
  url: 'https://wartungsplaner.example.de/nachweise/abc',
  ueberfaellig: false,
}

const WARTEND: GegenzeichnungsEintrag = {
  ...VORGELEGT,
  pruefbogen: 'Restore-Test Dateiserver',
  vorgelegtAm: dateOnly(2026, 7, 20),
  feststellungen: 0,
  ueberfaellig: true,
}

describe('baueGegenzeichnungsMail', () => {
  it('nennt Prüfbogen, Aufgabe und erfassende Person', () => {
    const mail = baueGegenzeichnungsMail(RAHMEN, 'Björn Prüfer', [VORGELEGT])

    expect(mail.text).toContain('Rezertifizierung Berechtigungen')
    expect(mail.text).toContain('Berechtigungsprüfung Fachanwendung')
    expect(mail.text).toContain('Anna Beispiel')
    expect(mail.text).toContain('Björn Prüfer')
    expect(mail.html).toContain('Rezertifizierung Berechtigungen')
  })

  it('weist die Anzahl der Feststellungen aus', () => {
    const mit = baueGegenzeichnungsMail(RAHMEN, 'Björn', [VORGELEGT])
    expect(mit.text).toContain('2 Feststellungen')

    const ohne = baueGegenzeichnungsMail(RAHMEN, 'Björn', [WARTEND])
    expect(ohne.text).toContain('ohne Feststellung')
  })

  it('hebt wartende Vorgänge im Betreff hervor', () => {
    const wartend = baueGegenzeichnungsMail(RAHMEN, 'Björn', [WARTEND])
    expect(wartend.betreff).toContain('wartet')

    const frisch = baueGegenzeichnungsMail(RAHMEN, 'Björn', [VORGELEGT])
    expect(frisch.betreff).not.toContain('wartet')
  })

  it('fasst mehrere Nachweise in einer Nachricht zusammen', () => {
    const mail = baueGegenzeichnungsMail(RAHMEN, 'Björn', [VORGELEGT, WARTEND])

    expect(mail.text).toContain('Rezertifizierung Berechtigungen')
    expect(mail.text).toContain('Restore-Test Dateiserver')
    expect(mail.betreff).toContain('1 Prüfnachweis wartet')
  })

  it('weist auf das Vier-Augen-Prinzip hin', () => {
    const mail = baueGegenzeichnungsMail(RAHMEN, 'Björn', [VORGELEGT])
    // Im Textteil sind die Zeilen bewusst hart umbrochen.
    expect(mail.text).toContain('Gegenzeichnen kann nur')
    expect(mail.html).toContain('nicht selbst erfasst hat')
  })

  it('hält den Betreff einzeilig', () => {
    const mail = baueGegenzeichnungsMail(RAHMEN, 'Björn', [
      { ...VORGELEGT, pruefbogen: 'Mit\nUmbruch' },
    ])
    expect(mail.betreff).not.toContain('\n')
  })
})

describe('baueZurueckweisungsMail', () => {
  const EINTRAG = {
    pruefbogen: 'Rezertifizierung Berechtigungen',
    aufgabe: 'Berechtigungsprüfung Fachanwendung',
    geprueftVon: 'Björn Prüfer',
    begruendung: 'Bitte die Stichprobe auf zwanzig Konten erweitern.',
    url: 'https://wartungsplaner.example.de/nachweise/abc',
  }

  it('nennt Begründung und prüfende Person', () => {
    const mail = baueZurueckweisungsMail(RAHMEN, 'Anna Beispiel', EINTRAG)

    expect(mail.text).toContain('Björn Prüfer')
    expect(mail.text).toContain('Bitte die Stichprobe auf zwanzig Konten erweitern.')
    expect(mail.html).toContain('Bitte die Stichprobe auf zwanzig Konten erweitern.')
    expect(mail.betreff).toContain('zurückgewiesen')
  })

  it('maskiert HTML in der Begründung', () => {
    const mail = baueZurueckweisungsMail(RAHMEN, 'Anna', {
      ...EINTRAG,
      begruendung: '<script>alert(1)</script>',
    })

    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
  })

  it('verweist auf den Nachweis', () => {
    const mail = baueZurueckweisungsMail(RAHMEN, 'Anna', EINTRAG)
    expect(mail.text).toContain('/nachweise/abc')
    expect(mail.html).toContain('/nachweise/abc')
  })
})
