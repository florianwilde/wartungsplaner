/**
 * Anbindung an `clamd` über TCP.
 *
 * Bewusst ohne zusätzliche Abhängigkeit: Das INSTREAM-Protokoll ist eine
 * Handvoll Bytes, und eine Bibliothek dafür wäre mehr Pflege als Nutzen.
 *
 * Der Dienst ist freiwillig. Ohne `CLAMAV_HOST` wird nicht geprüft, und die
 * Anwendung läuft unverändert – das Signaturverzeichnis von ClamAV belegt
 * rund ein Gigabyte, das soll niemand ungefragt mitschleppen müssen.
 */
import net from 'node:net'

import { baueStrom, werteAntwortAus, type Pruefstatus } from '@/lib/virenpruefung'

/** Ist ein Prüfdienst hinterlegt? */
export function istVirenpruefungEingerichtet(): boolean {
  return Boolean(process.env.CLAMAV_HOST?.trim())
}

/** Gilt die Prüfung als verpflichtend? */
export function istVirenpruefungPflicht(): boolean {
  return process.env.VIRENPRUEFUNG_PFLICHT?.trim().toLowerCase() === 'true'
}

function zeitgrenzeMs(): number {
  const wert = Number(process.env.CLAMAV_TIMEOUT_MS?.trim())
  return Number.isFinite(wert) && wert > 0 ? wert : 30_000
}

/**
 * Prüft einen Inhalt und liefert den Zustand der Prüfung.
 *
 * Wirft nicht: Ein ausgefallener Prüfdienst ist ein Zustand, kein Fehler –
 * wie damit umzugehen ist, entscheidet `darfAngenommenWerden`.
 */
export async function pruefeInhalt(inhalt: Buffer): Promise<Pruefstatus> {
  const host = process.env.CLAMAV_HOST?.trim()
  if (!host) return { art: 'nicht-eingerichtet' }

  const port = Number(process.env.CLAMAV_PORT?.trim()) || 3310
  const grenze = zeitgrenzeMs()

  return new Promise<Pruefstatus>((aufloesen) => {
    let erledigt = false
    const fertig = (status: Pruefstatus) => {
      if (erledigt) return
      erledigt = true
      verbindung.destroy()
      aufloesen(status)
    }

    const verbindung = net.createConnection({ host, port })
    verbindung.setTimeout(grenze)

    let antwort = ''

    verbindung.on('connect', () => {
      // Das "z"-Präfix verlangt nullterminierte Befehle.
      verbindung.write('zINSTREAM\0')
      for (const teil of baueStrom(inhalt)) verbindung.write(teil)
    })

    verbindung.on('data', (teil) => {
      antwort += teil.toString('utf8')
      // clamd schließt die Antwort mit einem Nullbyte ab.
      if (antwort.includes('\0')) fertig(werteAntwortAus(antwort))
    })

    verbindung.on('end', () => {
      fertig(
        antwort
          ? werteAntwortAus(antwort)
          : {
              art: 'nicht-erreichbar',
              grund: 'Der Prüfdienst hat die Verbindung ohne Antwort beendet.',
            },
      )
    })

    verbindung.on('timeout', () => {
      fertig({
        art: 'nicht-erreichbar',
        grund: `Zeitüberschreitung nach ${grenze} ms.`,
      })
    })

    verbindung.on('error', (fehler) => {
      fertig({ art: 'nicht-erreichbar', grund: fehler.message })
    })
  })
}

/**
 * Fragt den Dienst nach seiner Erreichbarkeit (PING/PONG).
 * Für die Anzeige im Administrationsbereich.
 */
export async function pruefeVerbindung(): Promise<
  { erreichbar: true; version: string } | { erreichbar: false; grund: string }
> {
  const host = process.env.CLAMAV_HOST?.trim()
  if (!host) {
    return { erreichbar: false, grund: 'Kein Prüfdienst hinterlegt (CLAMAV_HOST).' }
  }

  const port = Number(process.env.CLAMAV_PORT?.trim()) || 3310

  return new Promise((aufloesen) => {
    let erledigt = false
    const fertig = (
      ergebnis:
        { erreichbar: true; version: string } | { erreichbar: false; grund: string },
    ) => {
      if (erledigt) return
      erledigt = true
      verbindung.destroy()
      aufloesen(ergebnis)
    }

    const verbindung = net.createConnection({ host, port })
    verbindung.setTimeout(5000)

    let antwort = ''
    verbindung.on('connect', () => verbindung.write('zVERSION\0'))
    verbindung.on('data', (teil) => {
      antwort += teil.toString('utf8')
      if (antwort.includes('\0')) {
        fertig({ erreichbar: true, version: antwort.replace(/\0/g, '').trim() })
      }
    })
    verbindung.on('timeout', () =>
      fertig({ erreichbar: false, grund: 'Zeitüberschreitung nach 5000 ms.' }),
    )
    verbindung.on('error', (fehler) =>
      fertig({ erreichbar: false, grund: fehler.message }),
    )
    verbindung.on('end', () => {
      if (!antwort) {
        fertig({ erreichbar: false, grund: 'Keine Antwort erhalten.' })
      }
    })
  })
}
