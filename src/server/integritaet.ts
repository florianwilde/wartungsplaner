/**
 * Integritätslauf über die abgelegten Nachweise.
 *
 * Die Anwendung führt zu jedem Nachweis eine SHA-256-Prüfsumme. Ohne einen
 * regelmäßigen Abgleich ist das eine Behauptung: Ein stiller Verlust im
 * Ablageverzeichnis – gelöschtes Volume, defekter Datenträger, unvollständig
 * eingespielte Sicherung – fiele erst auf, wenn Jahre später jemand einen
 * Download versucht. Dann ist er nicht mehr zu heilen.
 *
 * Der Lauf prüft beide Richtungen: Zu jedem Eintrag die Datei, und zu jeder
 * Datei den Eintrag.
 *
 * Bewusst ohne `server-only`: Der Lauf soll sich auch aus einem Skript heraus
 * ausführen und prüfen lassen – wie schon der Erledigen-Vorgang.
 */
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

import { schreibeAuditLeise } from '@/lib/audit'
import {
  fasseLaufZusammen,
  istUnversehrt,
  kappeBefunde,
  schwerwiegendeBefunde,
  type Befund,
  type LaufErgebnis,
} from '@/lib/integritaet'
import { prisma } from '@/lib/prisma'
import { uploadVerzeichnis } from '@/server/dateiablage'

/**
 * Errechnet die Prüfsumme einer Datei.
 *
 * Bewusst als Datenstrom: Eine 25-MB-Datei vollständig in den Speicher zu
 * laden ist bei einem Lauf über tausende Nachweise nicht nötig.
 */
async function pruefsummeVon(absolut: string): Promise<string> {
  return new Promise((aufloesen, ablehnen) => {
    const hash = createHash('sha256')
    const strom = createReadStream(absolut)
    strom.on('error', ablehnen)
    strom.on('data', (teil) => hash.update(teil))
    strom.on('end', () => aufloesen(hash.digest('hex')))
  })
}

/** Alle Dateien unterhalb eines Verzeichnisses, relativ zur Wurzel. */
async function sammleDateien(wurzel: string, unterverzeichnis = ''): Promise<string[]> {
  const absolut = path.join(wurzel, unterverzeichnis)

  let eintraege
  try {
    eintraege = await readdir(absolut, { withFileTypes: true })
  } catch {
    // Fehlt das Verzeichnis, gibt es schlicht keine Dateien.
    return []
  }

  const gefunden: string[] = []
  for (const eintrag of eintraege) {
    const relativ = unterverzeichnis
      ? `${unterverzeichnis}/${eintrag.name}`
      : eintrag.name

    if (eintrag.isDirectory()) {
      gefunden.push(...(await sammleDateien(wurzel, relativ)))
    } else if (eintrag.isFile()) {
      gefunden.push(relativ)
    }
  }
  return gefunden
}

/**
 * Prüft alle Nachweise und liefert das Ergebnis, ohne es zu speichern.
 * Getrennt gehalten, damit sich der Lauf auch außerhalb der Anwendung
 * ausführen lässt.
 */
export async function pruefeNachweise(): Promise<LaufErgebnis> {
  const beginn = Date.now()
  const wurzel = uploadVerzeichnis()
  const befunde: Befund[] = []

  let fehlend = 0
  let abweichend = 0
  let unlesbar = 0

  // Nach Ablauf der Aufbewahrungsfrist entfernte Nachweise bleiben außen
  // vor: Ihre Datei fehlt mit Absicht. Sie hier zu melden hieße, jeden Lauf
  // mit Beanstandungen enden zu lassen – und echte Verluste gingen darin
  // unter.
  const anhaenge = await prisma.attachment.findMany({
    where: { archiviertAm: null },
    select: { id: true, filename: true, storedPath: true, sha256: true },
    orderBy: { uploadedAt: 'asc' },
  })

  // Ihre Pfade zählen dennoch als bekannt, damit eine zurückgespielte
  // Sicherung sie nicht als verwaist ausweist.
  const archivierte = await prisma.attachment.findMany({
    where: { archiviertAm: { not: null } },
    select: { storedPath: true },
  })

  const bekanntePfade = new Set<string>(
    archivierte.map((a) => a.storedPath.replace(/\\/g, '/')),
  )

  for (const anhang of anhaenge) {
    // Normalisiert vergleichen: In der Datenbank stehen Schrägstriche, das
    // Dateisystem kann unter Windows Rückwärtsschrägstriche liefern.
    bekanntePfade.add(anhang.storedPath.replace(/\\/g, '/'))

    const absolut = path.resolve(wurzel, anhang.storedPath)

    try {
      const angaben = await stat(absolut)
      if (!angaben.isFile()) {
        fehlend++
        befunde.push({
          art: 'FEHLEND',
          pfad: anhang.storedPath,
          dateiname: anhang.filename,
          erwartet: anhang.sha256,
          gefunden: null,
        })
        continue
      }
    } catch {
      fehlend++
      befunde.push({
        art: 'FEHLEND',
        pfad: anhang.storedPath,
        dateiname: anhang.filename,
        erwartet: anhang.sha256,
        gefunden: null,
      })
      continue
    }

    let gefunden: string
    try {
      gefunden = await pruefsummeVon(absolut)
    } catch {
      unlesbar++
      befunde.push({
        art: 'UNLESBAR',
        pfad: anhang.storedPath,
        dateiname: anhang.filename,
        erwartet: anhang.sha256,
        gefunden: null,
      })
      continue
    }

    if (gefunden !== anhang.sha256) {
      abweichend++
      befunde.push({
        art: 'ABWEICHEND',
        pfad: anhang.storedPath,
        dateiname: anhang.filename,
        erwartet: anhang.sha256,
        gefunden,
      })
    }
  }

  // Gegenrichtung: Dateien ohne Eintrag. Das Erscheinungsbild legt seine
  // Dateien unter "branding/" ab und gehört nicht zu den Nachweisen.
  const imVerzeichnis = await sammleDateien(wurzel)
  let verwaist = 0
  for (const relativ of imVerzeichnis) {
    if (relativ.startsWith('branding/')) continue
    if (bekanntePfade.has(relativ)) continue

    verwaist++
    befunde.push({
      art: 'VERWAIST',
      pfad: relativ,
      dateiname: null,
      erwartet: null,
      gefunden: null,
    })
  }

  return {
    geprueft: anhaenge.length,
    fehlend,
    abweichend,
    verwaist,
    unlesbar,
    befunde,
    dauerMs: Date.now() - beginn,
  }
}

/**
 * Führt den Lauf aus, hält das Ergebnis fest und protokolliert es.
 * Bei Beanstandungen wird zusätzlich die Administration benachrichtigt.
 */
export async function fuehreIntegritaetslaufAus(
  ausgeloestById: string | null = null,
): Promise<LaufErgebnis & { laufId: string }> {
  const ergebnis = await pruefeNachweise()
  const { gespeichert, gekappt } = kappeBefunde(ergebnis.befunde)

  const lauf = await prisma.integritaetsLauf.create({
    data: {
      dauerMs: ergebnis.dauerMs,
      ausgeloestById,
      geprueft: ergebnis.geprueft,
      fehlend: ergebnis.fehlend,
      abweichend: ergebnis.abweichend,
      verwaist: ergebnis.verwaist,
      unlesbar: ergebnis.unlesbar,
      befundeJson: { befunde: gespeichert, gekappt },
    },
    select: { id: true },
  })

  await schreibeAuditLeise({
    userId: ausgeloestById,
    action: 'INTEGRITAETSLAUF',
    entityType: 'System',
    entityId: lauf.id,
    payload: {
      geprueft: ergebnis.geprueft,
      fehlend: ergebnis.fehlend,
      abweichend: ergebnis.abweichend,
      verwaist: ergebnis.verwaist,
      unlesbar: ergebnis.unlesbar,
      dauerMs: ergebnis.dauerMs,
    },
  })

  if (!istUnversehrt(ergebnis)) {
    console.error(
      `[Wartungsplaner] Integritätslauf mit Beanstandungen: ` +
        `${schwerwiegendeBefunde(ergebnis)} Nachweise betroffen.`,
    )
    await meldeBeanstandungen(ergebnis)
  }

  return { ...ergebnis, laufId: lauf.id }
}

/**
 * Meldet Beanstandungen an die Administration.
 *
 * Ein fehlender Nachweis ist nichts, was bis zum nächsten Blick ins
 * Dashboard warten sollte.
 */
async function meldeBeanstandungen(ergebnis: LaufErgebnis): Promise<void> {
  try {
    const { istMailVersandKonfiguriert, versendeMail } = await import('@/server/mailer')
    if (!istMailVersandKonfiguriert()) return

    const { holeBenachrichtigungsEinstellungen } =
      await import('@/server/benachrichtigungs-einstellungen')
    const einstellungen = await holeBenachrichtigungsEinstellungen()
    if (!einstellungen.enabled) return

    const { baueIntegritaetsMail } = await import('@/lib/mail-vorlagen')
    const { holeBranding } = await import('@/server/branding')
    const { todayInBerlin } = await import('@/lib/dates')

    const empfaenger = await prisma.user.findMany({
      where: { role: 'ADMIN', active: true, notifyByEmail: true },
      select: { name: true, email: true },
    })
    if (empfaenger.length === 0) return

    const branding = await holeBranding()
    const rahmen = {
      anwendung: branding.appName,
      organisation: branding.organisation,
      markenfarbe: branding.primaryColor,
      appUrl: (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(
        /\/+$/,
        '',
      ),
      stichtag: todayInBerlin(),
    }

    for (const person of empfaenger) {
      const mail = baueIntegritaetsMail(rahmen, person.name, {
        geprueft: ergebnis.geprueft,
        fehlend: ergebnis.fehlend,
        abweichend: ergebnis.abweichend,
        unlesbar: ergebnis.unlesbar,
        verwaist: ergebnis.verwaist,
        befunde: ergebnis.befunde
          .filter((b) => b.art !== 'VERWAIST')
          .slice(0, 20)
          .map((b) => ({
            art: b.art,
            dateiname: b.dateiname ?? b.pfad,
          })),
      })
      await versendeMail(person.email, mail)
    }
  } catch (error) {
    console.error('Meldung des Integritätslaufs fehlgeschlagen:', error)
  }
}

/** Die letzten Läufe für die Übersicht im Administrationsbereich. */
export async function ladeLetzteLaeufe(anzahl = 10) {
  return prisma.integritaetsLauf.findMany({
    orderBy: { gestartetAm: 'desc' },
    take: anzahl,
    include: { ausgeloestBy: { select: { name: true } } },
  })
}

export { fasseLaufZusammen }
