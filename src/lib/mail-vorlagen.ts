/**
 * Textbausteine der Benachrichtigungen.
 *
 * Bewusst als reine Funktionen ohne Datenbank, Netzwerk oder Systemzeit: Die
 * Inhalte lassen sich damit vollständig durch Unit-Tests absichern. Jede
 * Nachricht entsteht in zwei Fassungen – als reiner Text und als HTML –,
 * damit sie in jedem Mailprogramm lesbar ankommt.
 */
import { differenceInDays, formatDate } from '@/lib/dates'
import { einzeilig } from '@/lib/sicherheit'

export type MailInhalt = {
  betreff: string
  text: string
  html: string
}

export type AufgabenEintrag = {
  aufgabe: string
  kategorie: string
  faelligAm: Date
  /** true = Karenzfrist überschritten */
  ueberfaellig: boolean
  kritikalitaet: string
  /** Absolute Adresse der Aufgabendetailseite */
  url: string
}

export type AbweichungsEintrag = {
  titel: string
  aufgabe: string
  schwere: string
  frist: Date
  fristUeberschritten: boolean
  url: string
}

export type MailRahmen = {
  /** Anwendungsname aus dem Erscheinungsbild */
  anwendung: string
  organisation: string
  /** Primärfarbe als Hex für die HTML-Fassung */
  markenfarbe: string
  /** Basis-Adresse der Anwendung, ohne abschließenden Schrägstrich */
  appUrl: string
  /** Stichtag der Auswertung */
  stichtag: Date
}

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

/**
 * Maskiert Zeichen mit besonderer Bedeutung in HTML.
 * Wird auf alle Inhalte aus der Datenbank angewandt, damit ein Aufgabentitel
 * die Nachricht nicht verfälschen kann.
 */
export function maskiereHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Formuliert den zeitlichen Abstand, z. B. "seit 3 Tagen" oder "in 5 Tagen". */
export function fristText(stichtag: Date, ziel: Date): string {
  const tage = differenceInDays(stichtag, ziel)
  if (tage === 0) return 'heute'
  if (tage === 1) return 'morgen'
  if (tage === -1) return 'seit gestern'
  if (tage > 1) return `in ${tage} Tagen`
  return `seit ${Math.abs(tage)} Tagen`
}

/** Grammatikalisch korrekte Mengenangabe. */
export function anzahlText(anzahl: number, einzahl: string, mehrzahl: string): string {
  return `${anzahl} ${anzahl === 1 ? einzahl : mehrzahl}`
}

/** Aufzählung in Worten: „A“, „A und B“, „A, B und C“. */
export function aufzaehlung(namen: string[]): string {
  if (namen.length === 0) return ''
  if (namen.length === 1) return namen[0]
  return `${namen.slice(0, -1).join(', ')} und ${namen[namen.length - 1]}`
}

/**
 * Hinweis, wenn eine Nachricht wegen Abwesenheit umgeleitet wurde.
 *
 * Ohne ihn wirkte die Nachricht wie ein Irrläufer: Die genannten Prüfungen
 * gehören jemand anderem, und niemand wüsste, warum sie hier ankommen.
 */
export function vertretungsHinweis(namen: string[]): string | null {
  if (namen.length === 0) return null
  return `Sie erhalten diese Nachricht als Vertretung für ${aufzaehlung(namen)}.`
}

/** Hervorgehobener Hinweis über der Aufstellung. */
function htmlHinweis(text: string): string {
  return [
    '<p style="margin:12px 0 0;padding:10px 12px;background:#f3f4f6;',
    'border-radius:6px;font-size:14px;color:#374151;">',
    maskiereHtml(text),
    '</p>',
  ].join('')
}

function htmlRahmen(rahmen: MailRahmen, inhalt: string): string {
  const farbe = maskiereHtml(rahmen.markenfarbe)
  const fuss = [rahmen.organisation, rahmen.anwendung]
    .filter(Boolean)
    .map(maskiereHtml)
    .join(' · ')

  return [
    '<!doctype html><html lang="de"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1"></head>',
    '<body style="margin:0;padding:24px;background:#f4f5f7;',
    'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1c1c;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
    '<table role="presentation" width="100%" style="max-width:640px;background:#ffffff;',
    'border-radius:10px;overflow:hidden;border:1px solid #e2e5e9;">',
    `<tr><td style="background:${farbe};padding:16px 24px;color:#ffffff;font-size:16px;font-weight:600;">`,
    maskiereHtml(rahmen.anwendung),
    '</td></tr>',
    '<tr><td style="padding:24px;">',
    inhalt,
    '</td></tr>',
    '<tr><td style="padding:16px 24px;background:#f8f9fa;border-top:1px solid #e2e5e9;',
    'font-size:12px;color:#6b7280;">',
    `${fuss}<br>Diese Nachricht wurde automatisch erzeugt. `,
    'Die Benachrichtigungen lassen sich im Benutzerkonto abbestellen.',
    '</td></tr></table></td></tr></table></body></html>',
  ].join('')
}

function htmlSchaltflaeche(url: string, beschriftung: string, farbe: string): string {
  return [
    `<p style="margin:20px 0 0;"><a href="${maskiereHtml(url)}" `,
    `style="display:inline-block;background:${maskiereHtml(farbe)};color:#ffffff;`,
    'text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">',
    maskiereHtml(beschriftung),
    '</a></p>',
  ].join('')
}

// ---------------------------------------------------------------------------
// Aufgabenerinnerung
// ---------------------------------------------------------------------------

/**
 * Sammelnachricht über anstehende und überfällige Prüfungen einer Person.
 * Bewusst eine Nachricht je Person statt einer je Aufgabe.
 */
export function baueAufgabenMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  eintraege: AufgabenEintrag[],
  /** Namen abwesender Personen, deren Prüfungen hier mitkommen. */
  vertreteneNamen: string[] = [],
): MailInhalt {
  const hinweis = vertretungsHinweis(vertreteneNamen)
  const ueberfaellige = eintraege.filter((e) => e.ueberfaellig)
  const anstehende = eintraege.filter((e) => !e.ueberfaellig)

  const betreff =
    ueberfaellige.length > 0
      ? `[${rahmen.anwendung}] ${anzahlText(ueberfaellige.length, 'überfällige Prüfung', 'überfällige Prüfungen')}`
      : `[${rahmen.anwendung}] ${anzahlText(anstehende.length, 'anstehende Prüfung', 'anstehende Prüfungen')}`

  // --- Textfassung ---
  const textZeilen: string[] = [
    `Guten Tag ${empfaengerName},`,
    '',
    `Stand ${formatDate(rahmen.stichtag)} liegen für Sie folgende Prüfungen an.`,
    '',
  ]
  if (hinweis) textZeilen.push(hinweis, '')

  if (ueberfaellige.length > 0) {
    textZeilen.push('ÜBERFÄLLIG', '')
    for (const eintrag of ueberfaellige) {
      textZeilen.push(
        `* ${eintrag.aufgabe} (${eintrag.kategorie}, Kritikalität ${eintrag.kritikalitaet})`,
        `  fällig am ${formatDate(eintrag.faelligAm)} – ${fristText(rahmen.stichtag, eintrag.faelligAm)}`,
        `  ${eintrag.url}`,
        '',
      )
    }
  }

  if (anstehende.length > 0) {
    textZeilen.push('BALD FÄLLIG', '')
    for (const eintrag of anstehende) {
      textZeilen.push(
        `* ${eintrag.aufgabe} (${eintrag.kategorie})`,
        `  fällig am ${formatDate(eintrag.faelligAm)} – ${fristText(rahmen.stichtag, eintrag.faelligAm)}`,
        `  ${eintrag.url}`,
        '',
      )
    }
  }

  textZeilen.push(
    `Übersicht: ${rahmen.appUrl}`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  )

  // --- HTML-Fassung ---
  const abschnitt = (titel: string, liste: AufgabenEintrag[], warnfarbe: string) => {
    if (liste.length === 0) return ''
    return [
      `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:${warnfarbe};margin:24px 0 8px;">`,
      maskiereHtml(titel),
      '</h2>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">',
      liste
        .map((eintrag) =>
          [
            '<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f2;">',
            `<a href="${maskiereHtml(eintrag.url)}" style="color:${maskiereHtml(rahmen.markenfarbe)};`,
            'text-decoration:none;font-weight:600;">',
            maskiereHtml(eintrag.aufgabe),
            '</a><br>',
            '<span style="color:#6b7280;font-size:13px;">',
            maskiereHtml(eintrag.kategorie),
            ' · fällig am ',
            formatDate(eintrag.faelligAm),
            ' (',
            maskiereHtml(fristText(rahmen.stichtag, eintrag.faelligAm)),
            ') · Kritikalität ',
            maskiereHtml(eintrag.kritikalitaet),
            '</span></td></tr>',
          ].join(''),
        )
        .join(''),
      '</table>',
    ].join('')
  }

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 4px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      `<p style="margin:0;color:#6b7280;font-size:14px;">Stand ${formatDate(rahmen.stichtag)}</p>`,
      hinweis ? htmlHinweis(hinweis) : '',
      abschnitt('Überfällig', ueberfaellige, '#b91c1c'),
      abschnitt('Bald fällig', anstehende, '#a16207'),
      htmlSchaltflaeche(rahmen.appUrl, 'Zur Übersicht', rahmen.markenfarbe),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

// ---------------------------------------------------------------------------
// Abweichungen
// ---------------------------------------------------------------------------

export function baueAbweichungsMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  eintraege: AbweichungsEintrag[],
  /** Namen abwesender Personen, deren Abweichungen hier mitkommen. */
  vertreteneNamen: string[] = [],
): MailInhalt {
  const ueberschritten = eintraege.filter((e) => e.fristUeberschritten)
  const hinweis = vertretungsHinweis(vertreteneNamen)

  const betreff =
    ueberschritten.length > 0
      ? `[${rahmen.anwendung}] ${anzahlText(ueberschritten.length, 'Abweichung', 'Abweichungen')} mit überschrittener Frist`
      : `[${rahmen.anwendung}] ${anzahlText(eintraege.length, 'Abweichung', 'Abweichungen')} mit näher rückender Frist`

  const textZeilen: string[] = [
    `Guten Tag ${empfaengerName},`,
    '',
    'für folgende Abweichungen sind Sie verantwortlich:',
    '',
  ]
  if (hinweis) textZeilen.push(hinweis, '')

  for (const eintrag of eintraege) {
    textZeilen.push(
      `* ${eintrag.titel} (${eintrag.schwere})`,
      `  aus der Aufgabe: ${eintrag.aufgabe}`,
      `  Frist ${formatDate(eintrag.frist)} – ${fristText(rahmen.stichtag, eintrag.frist)}${
        eintrag.fristUeberschritten ? ' (überschritten)' : ''
      }`,
      `  ${eintrag.url}`,
      '',
    )
  }

  textZeilen.push(
    `Alle Abweichungen: ${rahmen.appUrl}/findings`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  )

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      '<p style="margin:0 0 8px;font-size:14px;">für folgende Abweichungen sind Sie verantwortlich:</p>',
      hinweis ? htmlHinweis(hinweis) : '',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">',
      eintraege
        .map((eintrag) =>
          [
            '<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f2;">',
            `<a href="${maskiereHtml(eintrag.url)}" style="color:${maskiereHtml(rahmen.markenfarbe)};`,
            'text-decoration:none;font-weight:600;">',
            maskiereHtml(eintrag.titel),
            '</a>',
            eintrag.fristUeberschritten
              ? ' <span style="color:#b91c1c;font-size:12px;font-weight:600;">Frist überschritten</span>'
              : '',
            '<br><span style="color:#6b7280;font-size:13px;">',
            maskiereHtml(eintrag.schwere),
            ' · aus: ',
            maskiereHtml(eintrag.aufgabe),
            ' · Frist ',
            formatDate(eintrag.frist),
            ' (',
            maskiereHtml(fristText(rahmen.stichtag, eintrag.frist)),
            ')</span></td></tr>',
          ].join(''),
        )
        .join(''),
      '</table>',
      htmlSchaltflaeche(
        `${rahmen.appUrl}/findings`,
        'Abweichungen öffnen',
        rahmen.markenfarbe,
      ),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

// ---------------------------------------------------------------------------
// Gegenzeichnung
// ---------------------------------------------------------------------------

export type GegenzeichnungsEintrag = {
  pruefbogen: string
  aufgabe: string
  erfasstVon: string
  vorgelegtAm: Date
  /** Anzahl Prüfpunkte mit Befund */
  feststellungen: number
  url: string
  /** Liegt der Vorgang schon länger als vereinbart? */
  ueberfaellig: boolean
}

/**
 * Bitte um Gegenzeichnung.
 *
 * Ohne diese Nachricht bliebe ein vorgelegter Nachweis liegen, bis jemand
 * zufällig auf die Übersicht schaut – das Vier-Augen-Prinzip verlöre damit
 * seine Wirkung im Alltag.
 */
export function baueGegenzeichnungsMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  eintraege: GegenzeichnungsEintrag[],
): MailInhalt {
  const wartende = eintraege.filter((e) => e.ueberfaellig)

  const betreff =
    wartende.length > 0
      ? `[${rahmen.anwendung}] ${anzahlText(wartende.length, 'Prüfnachweis wartet', 'Prüfnachweise warten')} auf Ihre Gegenzeichnung`
      : `[${rahmen.anwendung}] ${anzahlText(eintraege.length, 'Prüfnachweis', 'Prüfnachweise')} zur Gegenzeichnung`

  const textZeilen: string[] = [
    `Guten Tag ${empfaengerName},`,
    '',
    'folgende Prüfnachweise sind zur Gegenzeichnung vorgelegt:',
    '',
  ]

  for (const eintrag of eintraege) {
    textZeilen.push(
      `* ${eintrag.pruefbogen}`,
      `  zur Aufgabe: ${eintrag.aufgabe}`,
      `  erfasst von ${eintrag.erfasstVon}, vorgelegt am ${formatDate(eintrag.vorgelegtAm)}${
        eintrag.ueberfaellig ? ' (wartet bereits)' : ''
      }`,
      eintrag.feststellungen > 0
        ? `  ${anzahlText(eintrag.feststellungen, 'Feststellung', 'Feststellungen')}`
        : '  ohne Feststellung',
      `  ${eintrag.url}`,
      '',
    )
  }

  textZeilen.push(
    'Bitte prüfen Sie den Bogen und zeichnen Sie gegen oder weisen Sie ihn',
    'mit Begründung zurück. Gegenzeichnen kann nur, wer den Nachweis nicht',
    'selbst erfasst hat.',
    '',
    `Alle Nachweise: ${rahmen.appUrl}/nachweise`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  )

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      '<p style="margin:0 0 8px;font-size:14px;">folgende Prüfnachweise sind zur Gegenzeichnung vorgelegt:</p>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">',
      eintraege
        .map((eintrag) =>
          [
            '<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f2;">',
            `<a href="${maskiereHtml(eintrag.url)}" style="color:${maskiereHtml(rahmen.markenfarbe)};`,
            'text-decoration:none;font-weight:600;">',
            maskiereHtml(eintrag.pruefbogen),
            '</a>',
            eintrag.ueberfaellig
              ? ' <span style="color:#b45309;font-size:12px;font-weight:600;">wartet bereits</span>'
              : '',
            '<br><span style="color:#6b7280;font-size:13px;">',
            maskiereHtml(eintrag.aufgabe),
            ' · erfasst von ',
            maskiereHtml(eintrag.erfasstVon),
            ' · vorgelegt ',
            formatDate(eintrag.vorgelegtAm),
            eintrag.feststellungen > 0
              ? ` · ${maskiereHtml(anzahlText(eintrag.feststellungen, 'Feststellung', 'Feststellungen'))}`
              : ' · ohne Feststellung',
            '</span></td></tr>',
          ].join(''),
        )
        .join(''),
      '</table>',
      '<p style="margin:16px 0 0;font-size:13px;color:#6b7280;">',
      'Gegenzeichnen kann nur, wer den Nachweis nicht selbst erfasst hat.',
      '</p>',
      htmlSchaltflaeche(
        `${rahmen.appUrl}/nachweise`,
        'Nachweise öffnen',
        rahmen.markenfarbe,
      ),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

/** Rückmeldung an die erfassende Person nach einer Zurückweisung. */
export function baueZurueckweisungsMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  eintrag: {
    pruefbogen: string
    aufgabe: string
    geprueftVon: string
    begruendung: string
    url: string
  },
): MailInhalt {
  const betreff = `[${rahmen.anwendung}] Prüfnachweis „${eintrag.pruefbogen}“ zurückgewiesen`

  const text = [
    `Guten Tag ${empfaengerName},`,
    '',
    `Ihr Prüfnachweis „${eintrag.pruefbogen}“ zur Aufgabe „${eintrag.aufgabe}“`,
    `wurde von ${eintrag.geprueftVon} zurückgewiesen.`,
    '',
    'Begründung:',
    eintrag.begruendung,
    '',
    'Der Bogen steht wieder zur Bearbeitung bereit:',
    eintrag.url,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  ].join('\n')

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      '<p style="margin:0 0 12px;font-size:14px;">Ihr Prüfnachweis ',
      `<strong>${maskiereHtml(eintrag.pruefbogen)}</strong> zur Aufgabe `,
      `<strong>${maskiereHtml(eintrag.aufgabe)}</strong> wurde von `,
      `${maskiereHtml(eintrag.geprueftVon)} zurückgewiesen.</p>`,
      '<div style="margin:0 0 16px;padding:12px;border-left:3px solid #b45309;background:#fdf6ec;',
      'font-size:14px;color:#78350f;">',
      maskiereHtml(eintrag.begruendung),
      '</div>',
      '<p style="margin:0;font-size:14px;">Der Bogen steht wieder zur Bearbeitung bereit.</p>',
      htmlSchaltflaeche(eintrag.url, 'Nachweis öffnen', rahmen.markenfarbe),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text, html }
}

// ---------------------------------------------------------------------------
// Integrität der Nachweise
// ---------------------------------------------------------------------------

export type IntegritaetsMeldung = {
  geprueft: number
  fehlend: number
  abweichend: number
  unlesbar: number
  verwaist: number
  befunde: { art: string; dateiname: string }[]
}

/**
 * Meldung über beanstandete Nachweise.
 *
 * Bewusst deutlich formuliert: Ein veränderter oder fehlender Nachweis ist
 * kein Betriebshinweis, sondern ein Schaden an der Beweiskraft der Ablage.
 */
export function baueIntegritaetsMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  meldung: IntegritaetsMeldung,
): MailInhalt {
  const schwer = meldung.fehlend + meldung.abweichend + meldung.unlesbar
  const betreff = `[${rahmen.anwendung}] Prüfung der Nachweise: ${anzahlText(
    schwer,
    'Beanstandung',
    'Beanstandungen',
  )}`

  const zaehlung: string[] = []
  if (meldung.abweichend > 0) {
    zaehlung.push(`${meldung.abweichend} mit abweichender Prüfsumme`)
  }
  if (meldung.fehlend > 0) zaehlung.push(`${meldung.fehlend} fehlend`)
  if (meldung.unlesbar > 0) zaehlung.push(`${meldung.unlesbar} nicht lesbar`)

  const textZeilen = [
    `Guten Tag ${empfaengerName},`,
    '',
    `bei der Prüfung von ${meldung.geprueft} Nachweisen wurden Beanstandungen`,
    'festgestellt:',
    '',
    ...zaehlung.map((z) => `* ${z}`),
    '',
    'Betroffen sind unter anderem:',
    '',
    ...meldung.befunde.map((b) => `* ${b.dateiname} (${b.art})`),
    '',
    'Ein fehlender oder veränderter Nachweis lässt sich nicht nachträglich',
    'wiederherstellen. Bitte prüfen Sie die Sicherung und das Ablageverzeichnis.',
    '',
    `Einzelheiten: ${rahmen.appUrl}/admin/integritaet`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  ]

  if (meldung.verwaist > 0) {
    textZeilen.splice(
      textZeilen.length - 4,
      0,
      `Zusätzlich liegen ${meldung.verwaist} Dateien ohne Eintrag in der`,
      'Datenbank im Ablageverzeichnis. Sie beeinträchtigen die Nachweiskette',
      'nicht, sollten aber geklärt werden.',
      '',
    )
  }

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      `<p style="margin:0 0 12px;font-size:14px;">bei der Prüfung von ${meldung.geprueft} `,
      'Nachweisen wurden Beanstandungen festgestellt:</p>',
      '<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#b91c1c;">',
      zaehlung.map((z) => `<li>${maskiereHtml(z)}</li>`).join(''),
      '</ul>',
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">',
      meldung.befunde
        .map(
          (b) =>
            '<tr><td style="padding:6px 0;border-bottom:1px solid #eef0f2;">' +
            `${maskiereHtml(b.dateiname)}<br>` +
            `<span style="color:#6b7280;font-size:13px;">${maskiereHtml(b.art)}</span>` +
            '</td></tr>',
        )
        .join(''),
      '</table>',
      '<p style="margin:16px 0 0;font-size:14px;">Ein fehlender oder veränderter ',
      'Nachweis lässt sich nicht nachträglich wiederherstellen. Bitte prüfen Sie ',
      'die Sicherung und das Ablageverzeichnis.</p>',
      htmlSchaltflaeche(
        `${rahmen.appUrl}/admin/integritaet`,
        'Einzelheiten ansehen',
        rahmen.markenfarbe,
      ),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

// ---------------------------------------------------------------------------
// Eskalation
// ---------------------------------------------------------------------------

export type EskalationsEintrag = AufgabenEintrag & { verantwortlich: string }

export function baueEskalationsMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  abTagen: number,
  eintraege: EskalationsEintrag[],
): MailInhalt {
  const betreff = `[${rahmen.anwendung}] Eskalation: ${anzahlText(
    eintraege.length,
    'Prüfung',
    'Prüfungen',
  )} seit mehr als ${abTagen} Tagen überfällig`

  const textZeilen: string[] = [
    `Guten Tag ${empfaengerName},`,
    '',
    `folgende Prüfungen sind seit mehr als ${abTagen} Tagen überfällig:`,
    '',
  ]

  for (const eintrag of eintraege) {
    textZeilen.push(
      `* ${eintrag.aufgabe} (${eintrag.kategorie}, Kritikalität ${eintrag.kritikalitaet})`,
      `  verantwortlich: ${eintrag.verantwortlich}`,
      `  fällig am ${formatDate(eintrag.faelligAm)} – ${fristText(rahmen.stichtag, eintrag.faelligAm)}`,
      `  ${eintrag.url}`,
      '',
    )
  }

  textZeilen.push(
    `Übersicht: ${rahmen.appUrl}`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  )

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      `<p style="margin:0 0 8px;font-size:14px;">folgende Prüfungen sind seit mehr als ${abTagen} Tagen überfällig:</p>`,
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">',
      eintraege
        .map((eintrag) =>
          [
            '<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f2;">',
            `<a href="${maskiereHtml(eintrag.url)}" style="color:${maskiereHtml(rahmen.markenfarbe)};`,
            'text-decoration:none;font-weight:600;">',
            maskiereHtml(eintrag.aufgabe),
            '</a><br><span style="color:#6b7280;font-size:13px;">verantwortlich: ',
            maskiereHtml(eintrag.verantwortlich),
            ' · fällig am ',
            formatDate(eintrag.faelligAm),
            ' (',
            maskiereHtml(fristText(rahmen.stichtag, eintrag.faelligAm)),
            ')</span></td></tr>',
          ].join(''),
        )
        .join(''),
      '</table>',
      htmlSchaltflaeche(rahmen.appUrl, 'Zur Übersicht', rahmen.markenfarbe),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

// ---------------------------------------------------------------------------
// Wochenübersicht
// ---------------------------------------------------------------------------

export function baueWochenuebersichtMail(
  rahmen: MailRahmen,
  empfaengerName: string,
  aufgaben: AufgabenEintrag[],
  abweichungen: AbweichungsEintrag[],
  /** Namen abwesender Personen, deren Vorgänge hier mitkommen. */
  vertreteneNamen: string[] = [],
): MailInhalt {
  const betreff = `[${rahmen.anwendung}] Wochenübersicht vom ${formatDate(rahmen.stichtag)}`
  const hinweis = vertretungsHinweis(vertreteneNamen)

  const textZeilen: string[] = [`Guten Tag ${empfaengerName},`, '']
  if (hinweis) textZeilen.push(hinweis, '')

  if (aufgaben.length === 0 && abweichungen.length === 0) {
    textZeilen.push(
      'für Sie steht derzeit nichts an – es gibt weder offene Prüfungen noch offene Abweichungen.',
      '',
    )
  } else {
    textZeilen.push('das ist Ihr aktueller Stand:', '')

    if (aufgaben.length > 0) {
      textZeilen.push(
        `OFFENE PRÜFUNGEN (${aufgaben.length})`,
        '',
        ...aufgaben.flatMap((eintrag) => [
          `* ${eintrag.aufgabe} – fällig am ${formatDate(eintrag.faelligAm)}${
            eintrag.ueberfaellig ? ' (überfällig)' : ''
          }`,
        ]),
        '',
      )
    }

    if (abweichungen.length > 0) {
      textZeilen.push(
        `OFFENE ABWEICHUNGEN (${abweichungen.length})`,
        '',
        ...abweichungen.map(
          (eintrag) =>
            `* ${eintrag.titel} – Frist ${formatDate(eintrag.frist)}${
              eintrag.fristUeberschritten ? ' (überschritten)' : ''
            }`,
        ),
        '',
      )
    }
  }

  textZeilen.push(
    `Übersicht: ${rahmen.appUrl}`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  )

  const liste = (titel: string, zeilen: string[]) =>
    zeilen.length === 0
      ? ''
      : [
          `<h2 style="font-size:14px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin:24px 0 8px;">${maskiereHtml(titel)}</h2>`,
          '<ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.7;">',
          zeilen.map((zeile) => `<li>${zeile}</li>`).join(''),
          '</ul>',
        ].join('')

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 4px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      aufgaben.length === 0 && abweichungen.length === 0
        ? '<p style="margin:0;font-size:14px;">für Sie steht derzeit nichts an – es gibt weder offene Prüfungen noch offene Abweichungen.</p>'
        : '<p style="margin:0;color:#6b7280;font-size:14px;">das ist Ihr aktueller Stand.</p>',
      hinweis ? htmlHinweis(hinweis) : '',
      liste(
        `Offene Prüfungen (${aufgaben.length})`,
        aufgaben.map(
          (eintrag) =>
            `<a href="${maskiereHtml(eintrag.url)}" style="color:${maskiereHtml(rahmen.markenfarbe)};text-decoration:none;">${maskiereHtml(eintrag.aufgabe)}</a>` +
            ` <span style="color:#6b7280;">– fällig am ${formatDate(eintrag.faelligAm)}${
              eintrag.ueberfaellig ? ' (überfällig)' : ''
            }</span>`,
        ),
      ),
      liste(
        `Offene Abweichungen (${abweichungen.length})`,
        abweichungen.map(
          (eintrag) =>
            `${maskiereHtml(eintrag.titel)} <span style="color:#6b7280;">– Frist ${formatDate(eintrag.frist)}${
              eintrag.fristUeberschritten ? ' (überschritten)' : ''
            }</span>`,
        ),
      ),
      htmlSchaltflaeche(rahmen.appUrl, 'Zur Übersicht', rahmen.markenfarbe),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text: textZeilen.join('\n'), html }
}

// ---------------------------------------------------------------------------
// Testnachricht
// ---------------------------------------------------------------------------

export function baueTestMail(rahmen: MailRahmen, empfaengerName: string): MailInhalt {
  const betreff = `[${rahmen.anwendung}] Testnachricht`

  const text = [
    `Guten Tag ${empfaengerName},`,
    '',
    'diese Testnachricht bestätigt, dass der E-Mail-Versand richtig eingerichtet ist.',
    '',
    `Anwendung: ${rahmen.anwendung}`,
    `Adresse:   ${rahmen.appUrl}`,
    `Stichtag:  ${formatDate(rahmen.stichtag)}`,
    '',
    'Diese Nachricht wurde automatisch erzeugt.',
  ].join('\n')

  const html = htmlRahmen(
    rahmen,
    [
      `<p style="margin:0 0 16px;font-size:15px;">Guten Tag ${maskiereHtml(empfaengerName)},</p>`,
      '<p style="margin:0 0 16px;font-size:14px;">diese Testnachricht bestätigt, dass der E-Mail-Versand richtig eingerichtet ist.</p>',
      '<table role="presentation" style="font-size:14px;color:#6b7280;">',
      `<tr><td style="padding:2px 12px 2px 0;">Anwendung</td><td>${maskiereHtml(rahmen.anwendung)}</td></tr>`,
      `<tr><td style="padding:2px 12px 2px 0;">Adresse</td><td>${maskiereHtml(rahmen.appUrl)}</td></tr>`,
      `<tr><td style="padding:2px 12px 2px 0;">Stichtag</td><td>${formatDate(rahmen.stichtag)}</td></tr>`,
      '</table>',
      htmlSchaltflaeche(rahmen.appUrl, 'Anwendung öffnen', rahmen.markenfarbe),
    ].join(''),
  )

  return { betreff: einzeilig(betreff), text, html }
}
