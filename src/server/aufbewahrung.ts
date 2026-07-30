/**
 * Aufbewahrung der Nachweisdateien.
 *
 * Der Bestand wächst sonst unbegrenzt, und hochgeladene Belege enthalten
 * personenbezogene Daten – ein AD-Export nennt Namen von Beschäftigten. Nach
 * Ablauf der Frist wird deshalb die **Datei** entfernt, nicht der Eintrag:
 * Datum, Person, Ergebnis, Dateiname und Prüfsumme bleiben und belegen
 * weiterhin, dass geprüft wurde und wie der Nachweis lautete.
 *
 * Zwei Grundsätze, weil die Funktion löscht:
 *
 *  - Sie ist im Auslieferungszustand **aus**. Gelöscht wird nie ungefragt.
 *  - Es gibt stets eine **Vorschau**, die dasselbe ermittelt, ohne etwas
 *    anzufassen. Wer nicht vorher sehen kann, was verschwindet, schaltet so
 *    etwas zu Recht nicht ein.
 *
 * Bewusst ohne `server-only`: Der Lauf soll sich auch aus einem Skript heraus
 * ausführen und prüfen lassen – wie schon der Erledigen-Vorgang.
 */
import { unlink } from 'node:fs/promises'

import { schreibeAuditLeise } from '@/lib/audit'
import {
  fasseAufbewahrungZusammen,
  geltendeFrist,
  istFaellig,
  type AufbewahrungsErgebnis,
} from '@/lib/aufbewahrung'
import { todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { absoluterPfad } from '@/server/dateiablage'

export const EINSTELLUNGEN_ID = 'singleton'

export type AufbewahrungsEinstellungen = {
  aktiv: boolean
  standardMonate: number
  letzterLaufAm: Date | null
  letzteAnzahl: number
}

export const STANDARD_AUFBEWAHRUNG: AufbewahrungsEinstellungen = {
  aktiv: false,
  standardMonate: 120,
  letzterLaufAm: null,
  letzteAnzahl: 0,
}

export async function holeAufbewahrungsEinstellungen(): Promise<AufbewahrungsEinstellungen> {
  try {
    const datensatz = await prisma.aufbewahrungsEinstellung.findUnique({
      where: { id: EINSTELLUNGEN_ID },
    })
    if (!datensatz) return STANDARD_AUFBEWAHRUNG

    return {
      aktiv: datensatz.aktiv,
      standardMonate: datensatz.standardMonate,
      letzterLaufAm: datensatz.letzterLaufAm,
      letzteAnzahl: datensatz.letzteAnzahl,
    }
  } catch (error) {
    console.error('Aufbewahrungseinstellungen nicht lesbar:', error)
    return STANDARD_AUFBEWAHRUNG
  }
}

export type FaelligeDatei = {
  attachmentId: string
  dateiname: string
  storedPath: string
  sizeBytes: number
  aufgabe: string
  kategorie: string
  durchgefuehrtAm: Date
  fristMonate: number
}

/**
 * Ermittelt, welche Dateien nach Ablauf der Frist zu entfernen wären.
 *
 * Maßgeblich ist der Zeitpunkt der **Durchführung**, nicht der des
 * Hochladens – danach fragt eine Aufbewahrungsvorschrift. Belege, die noch an
 * keiner Durchführung hängen, bleiben unangetastet: Sie gehören zu einem
 * laufenden Prüfbogen.
 */
export async function ermittleFaellige(
  heute: Date = todayInBerlin(),
): Promise<{ faellig: FaelligeDatei[]; geprueft: number }> {
  const einstellungen = await holeAufbewahrungsEinstellungen()

  const anhaenge = await prisma.attachment.findMany({
    where: {
      // Bereits entfernte bleiben außen vor.
      archiviertAm: null,
      execution: { isNot: null },
    },
    select: {
      id: true,
      filename: true,
      storedPath: true,
      sizeBytes: true,
      execution: {
        select: {
          executedAt: true,
          occurrence: {
            select: {
              task: {
                select: {
                  title: true,
                  category: { select: { name: true, aufbewahrungMonate: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const faellig: FaelligeDatei[] = []

  for (const anhang of anhaenge) {
    const durchfuehrung = anhang.execution!
    const kategorie = durchfuehrung.occurrence.task.category
    const frist = geltendeFrist(
      kategorie.aufbewahrungMonate,
      einstellungen.standardMonate,
    )

    if (!istFaellig(durchfuehrung.executedAt, heute, frist.monate)) continue

    faellig.push({
      attachmentId: anhang.id,
      dateiname: anhang.filename,
      storedPath: anhang.storedPath,
      sizeBytes: anhang.sizeBytes,
      aufgabe: durchfuehrung.occurrence.task.title,
      kategorie: kategorie.name,
      durchgefuehrtAm: durchfuehrung.executedAt,
      fristMonate: frist.monate,
    })
  }

  return { faellig, geprueft: anhaenge.length }
}

/**
 * Führt die Aufbewahrung aus.
 *
 * `nurVorschau` ermittelt dasselbe, fasst aber nichts an – derselbe Code, um
 * auszuschließen, dass Vorschau und Wirklichkeit auseinanderlaufen.
 */
export async function fuehreAufbewahrungAus(
  ausgeloestById: string | null = null,
  nurVorschau = false,
  heute: Date = todayInBerlin(),
): Promise<AufbewahrungsErgebnis> {
  const beginn = Date.now()
  const { faellig, geprueft } = await ermittleFaellige(heute)

  const ergebnis: AufbewahrungsErgebnis = {
    geprueft,
    entfernt: 0,
    freigegebenBytes: 0,
    fehlgeschlagen: 0,
    dauerMs: 0,
  }

  if (nurVorschau) {
    ergebnis.entfernt = faellig.length
    ergebnis.freigegebenBytes = faellig.reduce((summe, d) => summe + d.sizeBytes, 0)
    ergebnis.dauerMs = Date.now() - beginn
    return ergebnis
  }

  for (const datei of faellig) {
    try {
      // Erst die Datei, dann die Kennzeichnung: Bricht es dazwischen ab, ist
      // die Datei fort und der Eintrag noch unmarkiert – das meldet der
      // Integritätslauf als fehlend und ist damit sichtbar. Umgekehrt bliebe
      // ein als entfernt markierter Nachweis mit Datei liegen, ohne dass es
      // jemandem auffiele.
      await unlink(absoluterPfad(datei.storedPath))
    } catch (error) {
      // Fehlt die Datei bereits, ist das Ziel erreicht – nur ein echter
      // Fehler zählt.
      const code = (error as NodeJS.ErrnoException)?.code
      if (code !== 'ENOENT') {
        console.error(`Nachweis ${datei.storedPath} nicht entfernbar:`, error)
        ergebnis.fehlgeschlagen++
        continue
      }
    }

    await prisma.attachment.update({
      where: { id: datei.attachmentId },
      data: { archiviertAm: new Date() },
    })

    ergebnis.entfernt++
    ergebnis.freigegebenBytes += datei.sizeBytes
  }

  ergebnis.dauerMs = Date.now() - beginn

  if (ergebnis.entfernt > 0 || ergebnis.fehlgeschlagen > 0) {
    await schreibeAuditLeise({
      userId: ausgeloestById,
      action: 'AUFBEWAHRUNG_AUSGEFUEHRT',
      entityType: 'System',
      entityId: null,
      payload: {
        geprueft: ergebnis.geprueft,
        entfernt: ergebnis.entfernt,
        freigegebenBytes: ergebnis.freigegebenBytes,
        fehlgeschlagen: ergebnis.fehlgeschlagen,
      },
    })
  }

  await prisma.aufbewahrungsEinstellung.upsert({
    where: { id: EINSTELLUNGEN_ID },
    update: {
      letzterLaufAm: new Date(),
      letzteAnzahl: ergebnis.entfernt,
      updatedById: ausgeloestById,
    },
    create: {
      id: EINSTELLUNGEN_ID,
      ...STANDARD_AUFBEWAHRUNG,
      letzterLaufAm: new Date(),
      letzteAnzahl: ergebnis.entfernt,
      updatedById: ausgeloestById,
    },
  })

  return ergebnis
}

export { fasseAufbewahrungZusammen }
