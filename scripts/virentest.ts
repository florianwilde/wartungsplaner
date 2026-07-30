/**
 * Integrationstest der Virenprüfung gegen einen laufenden clamd.
 *
 * Geprüft wird mit der EICAR-Testdatei – einer harmlosen Zeichenkette, auf
 * die jedes Virenschutzprogramm anspricht. Sie ist genau dafür gedacht und
 * enthält keinen Schadcode.
 *
 * Ausführen:  npm run test:viren
 *
 * Voraussetzung: laufender Prüfdienst, etwa
 *   docker compose -f docker-compose.yml -f docker-compose.clamav.yml up -d clamav
 * und CLAMAV_HOST gesetzt (der Test verwendet sonst localhost).
 */
process.env.CLAMAV_HOST = process.env.CLAMAV_HOST?.trim() || 'localhost'

import { darfAngenommenWerden, beschreibe } from '../src/lib/virenpruefung'
import { pruefeInhalt, pruefeVerbindung } from '../src/server/virenpruefung'

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

// Die EICAR-Testzeichenkette, bewusst zusammengesetzt, damit diese Datei
// selbst nicht als Fund gemeldet wird.
const EICAR =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}' +
  '$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'

async function main() {
  console.log('Virentest startet …\n')

  const verbindung = await pruefeVerbindung()
  if (!verbindung.erreichbar) {
    console.error(`\nPrüfdienst nicht erreichbar: ${verbindung.grund}`)
    console.error('Bitte clamav starten, siehe Kopf dieser Datei.')
    process.exitCode = 1
    return
  }
  console.log(`  OK   Prüfdienst erreichbar: ${verbindung.version}\n`)
  testAnzahl++

  // --- Saubere Datei ------------------------------------------------------
  const sauber = await pruefeInhalt(
    Buffer.from('Ein ganz gewöhnlicher Prüfbericht ohne Auffälligkeiten.'),
  )
  pruefe(
    sauber.art === 'geprueft' && sauber.befund.sauber,
    'Eine harmlose Datei wird als sauber gemeldet',
  )
  pruefe(
    darfAngenommenWerden(sauber, false).erlaubt &&
      darfAngenommenWerden(sauber, true).erlaubt,
    'Und in beiden Betriebsarten angenommen',
  )

  // --- Testvirus ----------------------------------------------------------
  const befallen = await pruefeInhalt(Buffer.from(EICAR))
  pruefe(
    befallen.art === 'geprueft' && !befallen.befund.sauber,
    `Die EICAR-Testdatei wird erkannt (${beschreibe(befallen)})`,
  )

  const urteilOhnePflicht = darfAngenommenWerden(befallen, false)
  pruefe(
    !urteilOhnePflicht.erlaubt,
    'Sie wird abgewiesen – auch ohne eingeschaltete Pflicht',
  )
  pruefe(
    (urteilOhnePflicht.grund ?? '').includes('EICAR') ||
      (urteilOhnePflicht.grund ?? '').includes('Eicar'),
    'Die Meldung nennt den Namen des Fundes',
  )

  // --- Datenstrom über mehrere Abschnitte ---------------------------------
  //
  // Der Inhalt wird in Abschnitten zu 64 KB übertragen. Eine Datei von 400 KB
  // durchläuft also sieben Abschnitte; kommt eine saubere Antwort zurück, hat
  // die Rahmung des Datenstroms gestimmt.
  //
  // Bewusst mit harmlosem Inhalt: Die EICAR-Signatur greift nur, wenn sie die
  // ganze Datei ausmacht – eingebettet in andere Daten meldet ClamAV nichts,
  // und das ist so vorgesehen, nicht etwa ein Fehler der Übertragung.
  const gross = Buffer.alloc(400_000, 0x41)
  const grossBefund = await pruefeInhalt(gross)
  pruefe(
    grossBefund.art === 'geprueft' && grossBefund.befund.sauber,
    'Eine Datei über mehrere Abschnitte wird vollständig übertragen',
  )

  // --- Ausfall des Dienstes -----------------------------------------------
  const vorher = process.env.CLAMAV_PORT
  process.env.CLAMAV_PORT = '3311' // niemand hört hier zu
  const ausgefallen = await pruefeInhalt(Buffer.from('egal'))
  process.env.CLAMAV_PORT = vorher

  pruefe(
    ausgefallen.art === 'nicht-erreichbar',
    'Ein nicht erreichbarer Dienst wird als solcher gemeldet, nicht als sauber',
  )
  pruefe(
    darfAngenommenWerden(ausgefallen, false).erlaubt,
    'Ohne Pflicht wird die Datei dann dennoch angenommen',
  )
  pruefe(
    !darfAngenommenWerden(ausgefallen, true).erlaubt,
    'Mit Pflicht wird sie abgelehnt',
  )

  console.log(
    `\nErgebnis: ${testAnzahl - fehlerAnzahl} von ${testAnzahl} Prüfungen bestanden.`,
  )
  if (fehlerAnzahl > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('\nVirentest abgebrochen:', error)
  process.exitCode = 1
})
