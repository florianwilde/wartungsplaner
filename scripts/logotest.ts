/**
 * Test der Logo-Einbettung in die PDF-Berichte.
 *
 * Ob ein SVG wirklich im PDF landet, lässt sich nur an einem erzeugten
 * Dokument zeigen – Einheitentests decken nur die Rechnung dahinter ab.
 * Geprüft wird außerdem der wichtigere Fall: Ein unbrauchbares Logo darf den
 * Bericht nicht verhindern.
 *
 * Ausführen:  npm run test:logo
 * Eine Datenbank wird nicht gebraucht.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import PDFDocument from 'pdfkit'

import { ladeReportLogo, zeichneLogo } from '../src/server/reports/logo'

let fehlerAnzahl = 0
let testAnzahl = 0

function pruefe(bedingung: boolean, beschreibung: string) {
  testAnzahl++
  if (bedingung) {
    console.log(`  OK   ${beschreibung}`)
  } else {
    fehlerAnzahl++
    console.error(`  FEHL ${beschreibung}`)
  }
}

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 60">
  <rect x="0" y="0" width="240" height="60" fill="#0F5C9E"/>
  <circle cx="30" cy="30" r="20" fill="#ffffff"/>
  <path d="M60 45 L90 15 L120 45 Z" fill="#ffffff"/>
</svg>`

/** Baut ein einseitiges PDF und liefert es als Puffer. */
function baueSeite(zeichne: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((erfuellen, ablehnen) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40 })
    const teile: Buffer[] = []
    doc.on('data', (stueck: Buffer) => teile.push(stueck))
    doc.on('end', () => erfuellen(Buffer.concat(teile)))
    doc.on('error', ablehnen)

    try {
      zeichne(doc)
    } catch (error) {
      ablehnen(error)
      return
    }
    doc.end()
  })
}

async function main() {
  console.log('Logotest startet …\n')
  const ordner = await mkdtemp(path.join(tmpdir(), 'logotest-'))

  try {
    const svgPfad = path.join(ordner, 'logo.svg')
    await writeFile(svgPfad, SVG, 'utf8')

    // --- SVG ---------------------------------------------------------------
    const logo = await ladeReportLogo(svgPfad)
    pruefe(logo?.art === 'svg', 'Ein SVG wird als Vektorgrafik erkannt')
    pruefe(
      logo?.art === 'svg' && logo.breite === 240 && logo.hoehe === 60,
      'Die Größe kommt aus dem viewBox',
    )

    const ohneLogo = await baueSeite((doc) => {
      doc.text('Bericht ohne Logo')
    })
    const mitLogo = await baueSeite((doc) => {
      const breite = zeichneLogo(doc, logo, 40, 40, 130, 26)
      pruefe(
        breite > 0 && breite <= 130,
        'Die belegte Breite wird gemeldet und überschreitet den Kasten nicht',
      )
      doc.text('Bericht mit Logo', 40, 80)
    })

    pruefe(
      mitLogo.subarray(0, 5).toString() === '%PDF-',
      'Das Ergebnis ist ein gültiges PDF',
    )
    pruefe(
      mitLogo.length > ohneLogo.length + 200,
      'Mit Logo enthält das PDF spürbar mehr Inhalt',
    )

    // --- Rasterbild --------------------------------------------------------
    // Ein kleines PNG (1×1, weiß) als Zeichenkette in Base64.
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const pngPfad = path.join(ordner, 'logo.png')
    await writeFile(pngPfad, png)

    const rasterLogo = await ladeReportLogo(pngPfad)
    pruefe(rasterLogo?.art === 'bild', 'Ein PNG bleibt ein Rasterbild')
    const mitRaster = await baueSeite((doc) => {
      zeichneLogo(doc, rasterLogo, 40, 40, 130, 26)
    })
    pruefe(
      mitRaster.subarray(0, 5).toString() === '%PDF-',
      'Auch mit Rasterlogo entsteht ein gültiges PDF',
    )

    // --- Fehlerfälle -------------------------------------------------------
    pruefe((await ladeReportLogo(null)) === null, 'Ohne Logo kommt nichts zurück')

    const fremdPfad = path.join(ordner, 'logo.webp')
    await writeFile(fremdPfad, 'egal')
    pruefe(
      (await ladeReportLogo(fremdPfad)) === null,
      'Ein nicht einbettbares Format wird übergangen',
    )

    // Ein umbenanntes PNG würde die Erzeugung sonst mitten im Lauf abbrechen.
    const getarntPfad = path.join(ordner, 'getarnt.svg')
    await writeFile(getarntPfad, png)
    pruefe(
      (await ladeReportLogo(getarntPfad)) === null,
      'Ein umbenanntes Rasterbild wird am Inhalt erkannt',
    )

    pruefe(
      (await ladeReportLogo(path.join(ordner, 'gibtsnicht.svg'))) === null,
      'Eine fehlende Datei führt nicht zum Abbruch',
    )

    // Kaputtes SVG: Der Bericht muss trotzdem entstehen.
    const kaputtPfad = path.join(ordner, 'kaputt.svg')
    await writeFile(kaputtPfad, '<svg viewBox="0 0 10 10"><pathd="M M M"/>', 'utf8')
    const kaputt = await ladeReportLogo(kaputtPfad)
    const trotzdem = await baueSeite((doc) => {
      zeichneLogo(doc, kaputt, 40, 40, 130, 26)
      doc.text('Bericht trotz kaputtem Logo')
    })
    pruefe(
      trotzdem.subarray(0, 5).toString() === '%PDF-',
      'Ein fehlerhaftes SVG verhindert den Bericht nicht',
    )
  } finally {
    await rm(ordner, { recursive: true, force: true })
  }

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nLogotest abgebrochen:', error)
  process.exitCode = 1
})
