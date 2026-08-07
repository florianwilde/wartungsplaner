/**
 * Nachweisarchiv als ZIP.
 *
 * Ein Report zeigt, dass geprüft wurde. Ein Audit will die Nachweise selbst –
 * und zwar so, dass sie auch außerhalb dieser Anwendung überprüfbar bleiben.
 * Deshalb liegen dem Archiv eine Prüfsummenliste im Format von `sha256sum`
 * und eine Erläuterung bei: Niemand muss der Anwendung glauben, dass die
 * Dateien unverändert sind – man kann es nachrechnen.
 *
 * Das Archiv wird als Datenstrom gebaut. Ein Jahresbestand kann hunderte
 * Megabyte umfassen; ihn erst vollständig im Speicher zusammenzusetzen wäre
 * genau dann ein Problem, wenn das Archiv am dringendsten gebraucht wird.
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'

import archiver from 'archiver'

import { BOM, TRENNZEICHEN, maskiereCsvFeld } from '@/lib/csv'
import { formatDate, formatDateTime, toISODate } from '@/lib/dates'
import {
  INHALT_SPALTEN,
  archivPfad,
  baueLiesmich,
  bauePruefsummenListe,
  macheEindeutig,
  inhaltZeile,
  type ArchivEintrag,
} from '@/lib/archiv'
import { prisma } from '@/lib/prisma'
import { absoluterPfad } from '@/server/dateiablage'
import { holeBranding } from '@/server/branding'

import type { Zeitraum } from './daten'

export type ArchivInhalt = {
  eintraege: ArchivEintrag[]
  /** Nachweise, deren Datei fehlt – sie kommen nicht ins Archiv */
  fehlend: { dateiname: string; pfad: string }[]
  gesamtBytes: number
}

/**
 * Stellt zusammen, was ins Archiv gehört.
 *
 * Maßgeblich ist der Zeitpunkt der Durchführung: Danach fragt ein Audit, und
 * danach ist ein Nachweis einem Prüfzeitraum zuzuordnen.
 */
export async function sammleArchivInhalt(
  zeitraum: Zeitraum,
  kategorieIds: string[],
): Promise<ArchivInhalt> {
  const anhaenge = await prisma.attachment.findMany({
    where: {
      // Nach Ablauf der Frist entfernte Nachweise sind nicht mehr da; sie
      // wuerden das Archiv nur mit Fehlmeldungen fuellen.
      archiviertAm: null,
      execution: {
        executedAt: {
          gte: zeitraum.von,
          lte: new Date(zeitraum.bis.getTime() + 24 * 60 * 60 * 1000 - 1),
        },
        occurrence: {
          task: kategorieIds.length > 0 ? { categoryId: { in: kategorieIds } } : {},
        },
      },
    },
    orderBy: { uploadedAt: 'asc' },
    include: {
      uploadedBy: { select: { name: true } },
      execution: {
        select: {
          executedAt: true,
          occurrence: {
            select: {
              dueDate: true,
              task: {
                select: { title: true, category: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  })

  const roh = anhaenge
    .filter((a) => a.execution !== null)
    .map((a) => {
      const durchfuehrung = a.execution!
      const aufgabe = durchfuehrung.occurrence.task
      return {
        quelle: a.storedPath,
        sha256: a.sha256,
        dateiname: a.filename,
        kategorie: aufgabe.category.name,
        aufgabe: aufgabe.title,
        faelligAm: toISODate(durchfuehrung.occurrence.dueDate),
        durchgefuehrtAm: formatDate(durchfuehrung.executedAt),
        hochgeladenVon: a.uploadedBy.name,
        groesseBytes: a.sizeBytes,
      }
    })

  const pfade = macheEindeutig(roh.map((e) => archivPfad(e)))

  const eintraege: ArchivEintrag[] = []
  const fehlend: { dateiname: string; pfad: string }[] = []
  let gesamtBytes = 0

  for (const [index, eintrag] of roh.entries()) {
    // Eine fehlende Datei darf das Archiv nicht scheitern lassen. Sie wird
    // ausgelassen und in der Erläuterung benannt – ein unvollständiges, aber
    // ehrliches Archiv ist mehr wert als gar keines.
    try {
      const angaben = await stat(absoluterPfad(eintrag.quelle))
      if (!angaben.isFile()) throw new Error('keine Datei')
    } catch {
      fehlend.push({ dateiname: eintrag.dateiname, pfad: eintrag.quelle })
      continue
    }

    eintraege.push({ ...eintrag, ziel: pfade[index] })
    gesamtBytes += eintrag.groesseBytes
  }

  return { eintraege, fehlend, gesamtBytes }
}

/**
 * Baut das Archiv und liefert es als Datenstrom.
 *
 * Der Aufrufer muss den Strom vollständig lesen; Fehler beim Lesen einer
 * Datei beenden ihn mit einem Fehler, statt ein halbes Archiv auszuliefern.
 */
export async function erzeugeNachweisArchiv(
  zeitraum: Zeitraum,
  kategorieIds: string[],
  erstelltVon: string,
  kategorienText: string,
): Promise<{ strom: Readable; inhalt: ArchivInhalt }> {
  const inhalt = await sammleArchivInhalt(zeitraum, kategorieIds)
  const branding = await holeBranding()

  const archiv = archiver('zip', { zlib: { level: 6 } })

  archiv.on('warning', (fehler: unknown) => {
    console.warn('Archiv-Warnung:', fehler)
  })

  // --- Erläuterung ---------------------------------------------------------
  let liesmich = baueLiesmich({
    anwendung: branding.appName,
    organisation: branding.organisation,
    von: formatDate(zeitraum.von),
    bis: formatDate(zeitraum.bis),
    anzahl: inhalt.eintraege.length,
    erstelltAm: formatDateTime(new Date()),
    erstelltVon,
    kategorien: kategorienText,
  })

  if (inhalt.fehlend.length > 0) {
    liesmich +=
      [
        'Nicht enthaltene Nachweise',
        '--------------------------',
        'Zu den folgenden Einträgen war im Ablageverzeichnis keine Datei',
        'auffindbar. Sie fehlen deshalb in diesem Archiv:',
        '',
        ...inhalt.fehlend.map((f) => `  ${f.dateiname}  (${f.pfad})`),
        '',
      ].join('\n') + '\n'
  }

  archiv.append(liesmich, { name: 'LIESMICH.txt' })

  // --- Inhaltsverzeichnis --------------------------------------------------
  const csv =
    BOM +
    [
      [...INHALT_SPALTEN].map(maskiereCsvFeld).join(TRENNZEICHEN),
      ...inhalt.eintraege.map((e) =>
        inhaltZeile(e).map(maskiereCsvFeld).join(TRENNZEICHEN),
      ),
    ].join('\r\n') +
    '\r\n'
  archiv.append(csv, { name: 'INHALT.csv' })

  // --- Prüfsummen ----------------------------------------------------------
  archiv.append(bauePruefsummenListe(inhalt.eintraege), {
    name: 'PRUEFSUMMEN.sha256',
  })

  // --- Die Nachweise selbst ------------------------------------------------
  for (const eintrag of inhalt.eintraege) {
    archiv.append(createReadStream(absoluterPfad(eintrag.quelle)), {
      name: eintrag.ziel,
    })
  }

  void archiv.finalize()

  return { strom: archiv, inhalt }
}

/** Dateiname des Archivs. */
export function baueArchivDateiname(zeitraum: Zeitraum): string {
  return `wartungsplaner-nachweise-${toISODate(zeitraum.von)}_${toISODate(
    zeitraum.bis,
  )}.zip`
}
