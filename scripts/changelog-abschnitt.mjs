/**
 * Liest den Abschnitt einer Fassung aus CHANGELOG.md.
 *
 * Wird von release.sh aufgerufen, um die Beschreibung eines Releases zu
 * erzeugen. Getrennt gehalten, damit sich die Textaufbereitung ohne
 * Netzzugriff prüfen lässt.
 *
 * Aufruf:  node scripts/changelog-abschnitt.mjs 1.8.0
 */
import fs from 'node:fs'
import path from 'node:path'

const fassung = (process.argv[2] ?? '').replace(/^v/, '').trim()
if (!fassung) {
  console.error('Aufruf: node scripts/changelog-abschnitt.mjs <Fassung>')
  process.exit(2)
}

const pfad = path.join(process.cwd(), 'CHANGELOG.md')
let inhalt
try {
  inhalt = fs.readFileSync(pfad, 'utf8')
} catch {
  console.error(`CHANGELOG.md nicht gefunden (${pfad}).`)
  process.exit(1)
}

const zeilen = inhalt.split(/\r?\n/)

// Überschrift der gesuchten Fassung, etwa "## [1.8.0] – 2026-07-30"
const beginn = zeilen.findIndex((zeile) =>
  new RegExp(`^##\\s+\\[?${fassung.replace(/\./g, '\\.')}\\]?\\s`).test(zeile),
)
if (beginn < 0) {
  console.error(`Im Changelog gibt es keinen Abschnitt für ${fassung}.`)
  process.exit(1)
}

// Bis zur nächsten Fassungsüberschrift.
let ende = zeilen.length
for (let i = beginn + 1; i < zeilen.length; i++) {
  if (/^##\s/.test(zeilen[i])) {
    ende = i
    break
  }
}

const abschnitt = zeilen
  .slice(beginn + 1, ende)
  // Trennlinien am Ende gehören zur Gliederung der Datei, nicht zum Inhalt.
  .filter((zeile) => zeile.trim() !== '---')
  .join('\n')
  .trim()

if (!abschnitt) {
  console.error(`Der Abschnitt für ${fassung} ist leer.`)
  process.exit(1)
}

process.stdout.write(abschnitt + '\n')
