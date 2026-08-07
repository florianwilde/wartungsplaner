/**
 * Aufbau des Nachweisarchivs.
 *
 * Reine Funktionen: Wie heißen die Ordner und Dateien im ZIP, und wie sieht
 * die Prüfsummenliste aus? Die Liste ist bewusst im Format von `sha256sum`
 * gehalten – eine prüfende Person kann damit ohne diese Anwendung und ohne
 * Vertrauen in sie belegen, dass die Dateien unverändert sind.
 */
import { ohneSteuerzeichen } from './sicherheit'

/** Ersetzt alles, was in einem Dateinamen im ZIP Ärger macht. */
export function sichererName(wert: string, maxLaenge = 80): string {
  const bereinigt = ohneSteuerzeichen(wert)
    // Pfadtrenner und im Dateisystem heikle Zeichen
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    // Führende Punkte verhindern versteckte Dateien und ".."
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')

  return bereinigt.slice(0, maxLaenge) || 'ohne-namen'
}

export type ArchivEintrag = {
  /** Pfad im Ablageverzeichnis */
  quelle: string
  /** Pfad innerhalb des Archivs */
  ziel: string
  sha256: string
  dateiname: string
  kategorie: string
  aufgabe: string
  faelligAm: string
  durchgefuehrtAm: string
  hochgeladenVon: string
  groesseBytes: number
}

/**
 * Baut den Pfad einer Datei im Archiv.
 *
 * Gegliedert nach Kategorie und Aufgabe, damit sich ein Archiv auch ohne
 * Inhaltsverzeichnis durchsehen lässt. Das vorangestellte Datum sortiert die
 * Nachweise einer Aufgabe von selbst chronologisch.
 */
export function archivPfad(eintrag: {
  kategorie: string
  aufgabe: string
  faelligAm: string
  dateiname: string
}): string {
  return [
    sichererName(eintrag.kategorie, 60),
    sichererName(eintrag.aufgabe, 60),
    `${eintrag.faelligAm}_${sichererName(eintrag.dateiname, 100)}`,
  ].join('/')
}

/**
 * Sorgt für eindeutige Pfade.
 *
 * Zwei Nachweise derselben Fälligkeit können denselben Anzeigenamen tragen –
 * etwa zweimal „screenshot.png“. Im Archiv würde einer den anderen
 * überschreiben, und im Zweifel wäre es der aussagekräftigere.
 */
export function macheEindeutig(pfade: string[]): string[] {
  const gesehen = new Map<string, number>()
  return pfade.map((pfad) => {
    const anzahl = gesehen.get(pfad) ?? 0
    gesehen.set(pfad, anzahl + 1)
    if (anzahl === 0) return pfad

    const punkt = pfad.lastIndexOf('.')
    const schraeg = pfad.lastIndexOf('/')
    return punkt > schraeg
      ? `${pfad.slice(0, punkt)} (${anzahl + 1})${pfad.slice(punkt)}`
      : `${pfad} (${anzahl + 1})`
  })
}

/**
 * Prüfsummenliste im Format von `sha256sum`.
 *
 * Zwei Leerzeichen zwischen Summe und Pfad, wie es das Werkzeug erwartet;
 * damit lässt sich das entpackte Archiv mit `sha256sum -c PRUEFSUMMEN.sha256`
 * prüfen, ohne dass jemand dieser Anwendung glauben muss.
 */
export function bauePruefsummenListe(eintraege: ArchivEintrag[]): string {
  return eintraege.map((e) => `${e.sha256}  ${e.ziel}`).join('\n') + '\n'
}

/** Kopfzeile und Zeilen des Inhaltsverzeichnisses. */
export const INHALT_SPALTEN = [
  'Datei im Archiv',
  'Ursprünglicher Dateiname',
  'Kategorie',
  'Aufgabe',
  'Soll-Fälligkeit',
  'Durchgeführt am',
  'Hochgeladen von',
  'Größe in Bytes',
  'SHA-256',
] as const

export function inhaltZeile(eintrag: ArchivEintrag): string[] {
  return [
    eintrag.ziel,
    eintrag.dateiname,
    eintrag.kategorie,
    eintrag.aufgabe,
    eintrag.faelligAm,
    eintrag.durchgefuehrtAm,
    eintrag.hochgeladenVon,
    String(eintrag.groesseBytes),
    eintrag.sha256,
  ]
}

/** Erläuterung, die dem Archiv beiliegt. */
export function baueLiesmich(angaben: {
  anwendung: string
  organisation: string
  von: string
  bis: string
  anzahl: number
  erstelltAm: string
  erstelltVon: string
  kategorien: string
}): string {
  return [
    `${angaben.anwendung} – Archiv der Nachweise`,
    angaben.organisation ? `${angaben.organisation}` : '',
    '',
    `Zeitraum:      ${angaben.von} bis ${angaben.bis}`,
    `Kategorien:    ${angaben.kategorien}`,
    `Nachweise:     ${angaben.anzahl}`,
    `Erstellt:      ${angaben.erstelltAm} von ${angaben.erstelltVon}`,
    '',
    'Inhalt',
    '------',
    'INHALT.csv               Verzeichnis aller Dateien mit Angaben zur Herkunft',
    'PRUEFSUMMEN.sha256       Prüfsummen im Format von sha256sum',
    'nach Kategorie/Aufgabe/  die Nachweise selbst',
    '',
    'Unverändertheit prüfen',
    '----------------------',
    'Die Prüfsummen wurden beim Hochladen der jeweiligen Datei gebildet und',
    'seither unverändert mitgeführt. Sie lassen sich ohne diese Anwendung',
    'nachrechnen – im entpackten Archiv:',
    '',
    '    sha256sum -c PRUEFSUMMEN.sha256',
    '',
    'unter Windows in der PowerShell je Datei:',
    '',
    '    Get-FileHash -Algorithm SHA256 <Datei>',
    '',
    'Stimmen alle Summen überein, ist der Bestand seit dem Hochladen',
    'unverändert. Weicht eine ab, ist die betroffene Datei nicht mehr der',
    'Nachweis, der sie einmal war.',
    '',
  ]
    .filter((zeile, index, alle) => !(zeile === '' && alle[index - 1] === ''))
    .join('\n')
}
