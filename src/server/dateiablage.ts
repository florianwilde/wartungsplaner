import { createHash, randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { baueSpeicherpfad, bereinigeDateinamen, pruefeDatei } from '@/lib/uploads'
import { beschreibe, darfAngenommenWerden } from '@/lib/virenpruefung'
import { istVirenpruefungPflicht, pruefeInhalt } from '@/server/virenpruefung'

/** Wurzelverzeichnis der Nachweise (Docker-Volume). */
export function uploadVerzeichnis(): string {
  return path.resolve(process.env.UPLOAD_DIR?.trim() || '/app/uploads')
}

/**
 * Setzt einen in der Datenbank gespeicherten relativen Pfad zu einem
 * absoluten Pfad zusammen und stellt sicher, dass er das Upload-Verzeichnis
 * nicht verlässt (Schutz vor Path Traversal).
 */
export function absoluterPfad(relativerPfad: string): string {
  const wurzel = uploadVerzeichnis()
  const ziel = path.resolve(wurzel, relativerPfad)
  if (ziel !== wurzel && !ziel.startsWith(wurzel + path.sep)) {
    throw new Error('Ungültiger Speicherpfad.')
  }
  return ziel
}

export type GespeicherteDatei = {
  filename: string
  storedPath: string
  mimeType: string
  sizeBytes: number
  sha256: string
}

/**
 * Schreibt eine hochgeladene Datei in das Upload-Verzeichnis und liefert die
 * Metadaten für den Datenbankeintrag.
 *
 * Der Aufrufer muss bei einem Fehler im weiteren Verlauf
 * `entferneDateien()` aufrufen, damit keine verwaisten Dateien zurückbleiben.
 */
export async function speichereDatei(datei: File): Promise<GespeicherteDatei> {
  const anzeigename = bereinigeDateinamen(datei.name)
  const pruefung = pruefeDatei(datei.name, datei.size, datei.type)
  if (!pruefung.ok) throw new Error(pruefung.fehler)

  const inhalt = Buffer.from(await datei.arrayBuffer())

  // Größe nach dem Lesen erneut prüfen: `File.size` stammt vom Client.
  const nachpruefung = pruefeDatei(datei.name, inhalt.byteLength, datei.type)
  if (!nachpruefung.ok) throw new Error(nachpruefung.fehler)

  // Vor dem Schreiben prüfen: Eine als Schadprogramm erkannte Datei soll gar
  // nicht erst im Ablageverzeichnis landen. Belege werden später von anderen
  // Personen heruntergeladen – ohne Prüfung wäre die Nachweisablage ein
  // bequemer Verteilweg, dem man auch noch vertraut.
  const status = await pruefeInhalt(inhalt)
  const urteil = darfAngenommenWerden(status, istVirenpruefungPflicht())
  if (!urteil.erlaubt) {
    console.warn(`Datei „${anzeigename}“ abgelehnt: ${beschreibe(status)}`)
    throw new Error(urteil.grund ?? 'Die Datei wurde nicht angenommen.')
  }
  if (status.art === 'nicht-erreichbar') {
    // Angenommen, aber nicht stillschweigend: Wer später wissen will, ob
    // geprüft wurde, findet es im Protokoll.
    console.warn(
      `Datei „${anzeigename}“ ohne Virenprüfung übernommen: ${beschreibe(status)}`,
    )
  }

  const sha256 = createHash('sha256').update(inhalt).digest('hex')
  const relativerPfad = baueSpeicherpfad(randomUUID(), pruefung.endung, new Date())
  const ziel = absoluterPfad(relativerPfad)

  await mkdir(path.dirname(ziel), { recursive: true })
  await writeFile(ziel, inhalt, { flag: 'wx' })

  return {
    filename: anzeigename,
    storedPath: relativerPfad,
    mimeType: pruefung.mimeType,
    sizeBytes: inhalt.byteLength,
    sha256,
  }
}

/** Entfernt zuvor geschriebene Dateien (Aufräumen nach einem Fehler). */
export async function entferneDateien(relativePfade: string[]): Promise<void> {
  await Promise.all(
    relativePfade.map(async (pfad) => {
      try {
        await unlink(absoluterPfad(pfad))
      } catch (error) {
        console.error(`Datei "${pfad}" konnte nicht entfernt werden:`, error)
      }
    }),
  )
}
