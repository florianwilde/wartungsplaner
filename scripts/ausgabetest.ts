/**
 * Rauchtest der erzeugten Dateien: Excel, ZIP und PDF.
 *
 * Anlass war eine erzwungene Paketfassung (`uuid` in `exceljs`): Solche
 * Eingriffe fallen weder bei der Typprüfung noch in den Unit-Tests auf – erst
 * die erzeugte Datei zeigt, ob die Bibliothek noch tut, was sie soll.
 *
 * Geprüft wird nicht der Inhalt im Einzelnen, sondern dass überhaupt eine
 * wohlgeformte Datei entsteht: Excel und ZIP beginnen beide mit der Kennung
 * `PK`, ein PDF mit `%PDF-`.
 *
 * Ausführen:  npm run test:ausgabe
 * Eine Datenbank wird nicht gebraucht.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { once } from 'node:events'

import archiver from 'archiver'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'

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

async function main() {
  console.log('Ausgabetest startet …\n')
  const ordner = await mkdtemp(path.join(tmpdir(), 'ausgabetest-'))

  try {
    // --- Excel ------------------------------------------------------------
    const mappe = new ExcelJS.Workbook()
    mappe.creator = 'Wartungsplaner'
    const blatt = mappe.addWorksheet('Prüfungen')
    blatt.columns = [
      { header: 'Aufgabe', key: 'aufgabe', width: 40 },
      { header: 'Fällig am', key: 'faellig', width: 14 },
      { header: 'Ergebnis', key: 'ergebnis', width: 20 },
    ]
    blatt.addRow({
      aufgabe: 'Restore-Test ERP – Umlaute: äöüß',
      faellig: new Date(2026, 6, 31),
      ergebnis: 'In Ordnung',
    })
    blatt.getRow(1).font = { bold: true }
    // Bedingte Formatierung: genau hier greift exceljs auf uuid zu.
    blatt.addConditionalFormatting({
      ref: 'C2:C100',
      rules: [
        {
          type: 'containsText',
          operator: 'containsText',
          text: 'Abweichung',
          priority: 1,
          style: { font: { color: { argb: 'FFB91C1C' } } },
        },
      ],
    })

    // exceljs bringt einen eigenen Buffer-Typ mit; zur Laufzeit ist es ein
    // gewöhnlicher Node-Buffer.
    const excel = Buffer.from((await mappe.xlsx.writeBuffer()) as unknown as Uint8Array)
    pruefe(excel.length > 2000, 'Die Excel-Mappe hat einen plausiblen Umfang')
    pruefe(
      excel.subarray(0, 2).toString('latin1') === 'PK',
      'Die Excel-Mappe ist ein gültiges ZIP-Paket',
    )

    // Wieder einlesen: Erst das beweist, dass die Datei brauchbar ist.
    const gelesen = new ExcelJS.Workbook()
    await gelesen.xlsx.load(excel as unknown as ExcelJS.Buffer)
    const zelle = gelesen.getWorksheet('Prüfungen')?.getCell('A2').value
    pruefe(
      String(zelle).includes('äöüß'),
      'Die Mappe lässt sich zurücklesen, Umlaute bleiben erhalten',
    )

    // --- ZIP --------------------------------------------------------------
    const zipPfad = path.join(ordner, 'archiv.zip')
    const ziel = createWriteStream(zipPfad)
    const archiv = archiver('zip', { zlib: { level: 6 } })
    archiv.pipe(ziel)
    archiv.append('Inhalt des Archivs\n', { name: 'LIESMICH.txt' })
    archiv.append(excel, { name: 'bericht.xlsx' })
    await archiv.finalize()
    await once(ziel, 'close')

    const { readFile } = await import('node:fs/promises')
    const zip = await readFile(zipPfad)
    pruefe(
      zip.subarray(0, 2).toString('latin1') === 'PK',
      'Das ZIP-Archiv ist wohlgeformt',
    )
    // Die Namen stehen im Zentralverzeichnis des Archivs im Klartext –
    // das belegt den Inhalt zuverlässiger als ein Größenvergleich (eine
    // xlsx-Datei ist bereits gepackt und schrumpft nicht weiter).
    const namen = zip.toString('latin1')
    pruefe(
      namen.includes('bericht.xlsx') && namen.includes('LIESMICH.txt'),
      'Das Archiv führt beide Einträge',
    )

    // --- PDF --------------------------------------------------------------
    const pdf = await new Promise<Buffer>((erfuellen, ablehnen) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const teile: Buffer[] = []
      doc.on('data', (s: Buffer) => teile.push(s))
      doc.on('end', () => erfuellen(Buffer.concat(teile)))
      doc.on('error', ablehnen)
      doc.font('Helvetica').fontSize(12).text('Prüfbericht – Umlaute: äöüß')
      doc.end()
    })
    pruefe(pdf.subarray(0, 5).toString() === '%PDF-', 'Das PDF ist wohlgeformt')
  } finally {
    await rm(ordner, { recursive: true, force: true })
  }

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nAusgabetest abgebrochen:', error)
  process.exitCode = 1
})
