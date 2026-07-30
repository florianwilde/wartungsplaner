/**
 * Nachweismodul: Datenbankzugriff und Ablaufsteuerung.
 *
 * Die fachlichen Regeln liegen in `@/lib/nachweise` und sind dort getestet.
 * Hier kommt die Anbindung an Datenbank, Dateiablage und Audit-Log hinzu.
 */
import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { schreibeAudit } from '@/lib/audit'
import { formatDate, todayInBerlin } from '@/lib/dates'
import {
  auffaelligePunkte,
  ergebnisPasst,
  istAenderbar,
  pruefeUebergang,
  pruefeVollstaendigkeit,
  type Antwort,
  type NachweisStatus,
  type Pruefpunkt,
  type PruefpunktErgebnis,
  type Uebergang,
} from '@/lib/nachweise'
import { prisma } from '@/lib/prisma'
import { baueSpeicherpfad } from '@/lib/uploads'
import {
  absoluterPfad,
  entferneDateien,
  speichereDatei,
  type GespeicherteDatei,
} from '@/server/dateiablage'
import { protokolliereDurchfuehrung } from '@/server/durchfuehrung-service'
import { erzeugeNachweisPdf } from '@/server/reports/nachweis-pdf'
import { holeBranding } from '@/server/branding'

/** Fachlicher Fehler; der Text erscheint unverändert in der Oberfläche. */
export class NachweisFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'NachweisFehler'
  }
}

/** Lädt einen Nachweis mit allem, was für Anzeige und Prüfung nötig ist. */
export async function ladeNachweis(nachweisId: string) {
  return prisma.nachweis.findUnique({
    where: { id: nachweisId },
    include: {
      vorlage: { include: { punkte: { orderBy: { position: 'asc' } } } },
      antworten: true,
      erfasstBy: { select: { id: true, name: true } },
      geprueftBy: { select: { id: true, name: true } },
      attachment: { select: { id: true, filename: true, sha256: true } },
      belege: {
        orderBy: { uploadedAt: 'asc' },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          sizeBytes: true,
          sha256: true,
          punktId: true,
          uploadedAt: true,
          uploadedBy: { select: { name: true } },
        },
      },
      occurrence: {
        include: {
          task: { select: { id: true, title: true, category: { select: { name: true } } } },
          execution: { select: { id: true } },
        },
      },
    },
  })
}

/** Wandelt Datenbankzeilen in die Form der reinen Prüffunktionen. */
function alsPunkte(
  punkte: { id: string; position: number; frage: string; art: string; pflicht: boolean }[],
): Pruefpunkt[] {
  return punkte.map((p) => ({
    id: p.id,
    position: p.position,
    frage: p.frage,
    art: p.art as Pruefpunkt['art'],
    pflicht: p.pflicht,
  }))
}

function alsAntworten(
  antworten: { punktId: string; ergebnis: string | null; wert: string | null }[],
): Antwort[] {
  return antworten.map((a) => ({
    punktId: a.punktId,
    ergebnis: (a.ergebnis as PruefpunktErgebnis | null) ?? null,
    wert: a.wert,
  }))
}

/**
 * Legt einen Nachweis für eine Fälligkeit an.
 * Je Fälligkeit und Vorlage entsteht höchstens ein Nachweis.
 */
export async function starteNachweis(
  occurrenceId: string,
  vorlageId: string,
  benutzerId: string,
): Promise<string> {
  const [occurrence, vorlage] = await Promise.all([
    prisma.occurrence.findUnique({
      where: { id: occurrenceId },
      select: { id: true, status: true, task: { select: { title: true } } },
    }),
    prisma.pruefbogenVorlage.findUnique({
      where: { id: vorlageId },
      select: { id: true, name: true, aktiv: true, _count: { select: { punkte: true } } },
    }),
  ])

  if (!occurrence) throw new NachweisFehler('Die Fälligkeit wurde nicht gefunden.')
  if (!vorlage) throw new NachweisFehler('Der Prüfbogen wurde nicht gefunden.')
  if (!vorlage.aktiv) throw new NachweisFehler('Dieser Prüfbogen ist nicht aktiv.')
  if (vorlage._count.punkte === 0) {
    throw new NachweisFehler('Dieser Prüfbogen enthält noch keine Prüfpunkte.')
  }

  const vorhanden = await prisma.nachweis.findFirst({
    where: { occurrenceId, vorlageId },
    select: { id: true },
  })
  if (vorhanden) return vorhanden.id

  const nachweis = await prisma.$transaction(async (tx) => {
    const erstellt = await tx.nachweis.create({
      data: {
        vorlageId,
        occurrenceId,
        erfasstById: benutzerId,
        status: 'ENTWURF',
      },
      select: { id: true },
    })

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'NACHWEIS_BEGONNEN',
        entityType: 'Nachweis',
        entityId: erstellt.id,
        payload: { pruefbogen: vorlage.name, aufgabe: occurrence.task.title },
      },
      tx,
    )

    return erstellt
  })

  return nachweis.id
}

export type AntwortEingabe = {
  punktId: string
  ergebnis: PruefpunktErgebnis | null
  wert: string | null
  bemerkung: string | null
}

export type FeststellungAnzeige = {
  punktId: string
  position: number
  frage: string
  ergebnis: string
  bemerkung: string | null
  /** Kennung der bereits daraus angelegten Abweichung */
  findingId: string | null
}

/**
 * Feststellungen eines abgeschlossenen Nachweises samt Hinweis darauf, ob
 * daraus bereits eine Abweichung entstanden ist.
 */
export async function ladeFeststellungen(
  nachweisId: string,
): Promise<FeststellungAnzeige[]> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) return []

  const auffaellig = auffaelligePunkte(
    alsPunkte(nachweis.vorlage.punkte),
    alsAntworten(nachweis.antworten),
  )
  if (auffaellig.length === 0) return []

  const findings = await prisma.finding.findMany({
    where: {
      punktId: { in: auffaellig.map((e) => e.punkt.id) },
      execution: { occurrenceId: nachweis.occurrenceId },
    },
    select: { id: true, punktId: true },
  })

  return auffaellig.map((eintrag) => {
    const antwort = nachweis.antworten.find((a) => a.punktId === eintrag.punkt.id)
    return {
      punktId: eintrag.punkt.id,
      position: eintrag.punkt.position,
      frage: eintrag.punkt.frage,
      ergebnis: String(eintrag.antwort.ergebnis),
      bemerkung: antwort?.bemerkung ?? null,
      findingId: findings.find((f) => f.punktId === eintrag.punkt.id)?.id ?? null,
    }
  })
}

export type AbweichungAusFeststellung = {
  punktId: string
  title: string
  description: string | null
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  responsibleId: string
  dueDate: Date
}

/**
 * Legt aus einer Feststellung eine Abweichung an.
 *
 * Titel und Beschreibung kommen aus dem Prüfpunkt, müssen also nicht erneut
 * eingegeben werden. Der Rückverweis auf den Prüfpunkt bleibt erhalten, damit
 * später nachvollziehbar ist, woher die Abweichung stammt.
 */
export async function erzeugeAbweichungAusFeststellung(
  nachweisId: string,
  eingabe: AbweichungAusFeststellung,
  benutzerId: string,
): Promise<string> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) throw new NachweisFehler('Der Nachweis wurde nicht gefunden.')

  const punkt = nachweis.vorlage.punkte.find((p) => p.id === eingabe.punktId)
  if (!punkt) {
    throw new NachweisFehler('Der Prüfpunkt gehört nicht zu diesem Nachweis.')
  }

  // Eine Abweichung hängt immer an einer Durchführung. Die entsteht mit dem
  // Abschluss des Nachweises – vorher gibt es nichts, woran sie hängen könnte.
  const executionId = nachweis.occurrence.execution?.id
  if (!executionId) {
    throw new NachweisFehler(
      'Abweichungen lassen sich erst anlegen, wenn der Nachweis abgeschlossen ist.',
    )
  }

  const bereitsVorhanden = await prisma.finding.findFirst({
    where: { executionId, punktId: eingabe.punktId },
    select: { id: true },
  })
  if (bereitsVorhanden) {
    throw new NachweisFehler(
      `Zu Prüfpunkt ${punkt.position} gibt es bereits eine Abweichung.`,
    )
  }

  const verantwortlich = await prisma.user.findFirst({
    where: { id: eingabe.responsibleId, active: true },
    select: { id: true },
  })
  if (!verantwortlich) {
    throw new NachweisFehler('Die verantwortliche Person wurde nicht gefunden.')
  }

  const finding = await prisma.$transaction(async (tx) => {
    const erstellt = await tx.finding.create({
      data: {
        executionId,
        punktId: eingabe.punktId,
        title: eingabe.title,
        description: eingabe.description,
        severity: eingabe.severity,
        responsibleId: eingabe.responsibleId,
        dueDate: eingabe.dueDate,
        status: 'OPEN',
      },
      select: { id: true, title: true, severity: true },
    })

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'FINDING_CREATED',
        entityType: 'Finding',
        entityId: erstellt.id,
        payload: {
          titel: erstellt.title,
          schwere: erstellt.severity,
          herkunft: `Prüfbogen „${nachweis.vorlage.name}“, Prüfpunkt ${punkt.position}`,
        },
      },
      tx,
    )

    return erstellt
  })

  return finding.id
}

/** Höchstzahl an Belegen je Prüfbogen. */
export const MAX_BELEGE = 25

/**
 * Nimmt Belege zu einem Prüfbogen entgegen – AD-Export, Screenshot,
 * Herstellerprotokoll und dergleichen.
 *
 * Die Dateien hängen zunächst nur am Prüfbogen, denn eine Durchführung gibt es
 * zu diesem Zeitpunkt noch nicht. Mit dem Abschluss werden sie ihr zugeordnet,
 * ohne dass die Datei kopiert wird.
 */
export async function fuegeBelegeHinzu(
  nachweisId: string,
  benutzerId: string,
  dateien: File[],
  punktId: string | null,
): Promise<number> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) throw new NachweisFehler('Der Nachweis wurde nicht gefunden.')
  pruefeBearbeitbar(nachweis, benutzerId)

  if (dateien.length === 0) {
    throw new NachweisFehler('Bitte mindestens eine Datei auswählen.')
  }
  if (nachweis.belege.length + dateien.length > MAX_BELEGE) {
    throw new NachweisFehler(
      `Je Prüfbogen sind höchstens ${MAX_BELEGE} Belege möglich (bereits vorhanden: ${nachweis.belege.length}).`,
    )
  }
  if (punktId && !nachweis.vorlage.punkte.some((p) => p.id === punktId)) {
    throw new NachweisFehler('Der gewählte Prüfpunkt gehört nicht zu diesem Bogen.')
  }

  const geschrieben: GespeicherteDatei[] = []
  try {
    for (const datei of dateien) {
      geschrieben.push(await speichereDatei(datei))
    }

    await prisma.$transaction(async (tx) => {
      for (const datei of geschrieben) {
        await tx.attachment.create({
          data: {
            nachweisId,
            punktId,
            // Die Durchführung wird beim Abschluss nachgetragen.
            executionId: nachweis.occurrence.execution?.id ?? null,
            uploadedById: benutzerId,
            ...datei,
          },
        })
      }

      await schreibeAudit(
        {
          userId: benutzerId,
          action: 'NACHWEIS_BELEG_HINZUGEFUEGT',
          entityType: 'Nachweis',
          entityId: nachweisId,
          payload: {
            dateien: geschrieben.map((d) => ({
              dateiname: d.filename,
              sha256: d.sha256,
            })),
            ...(punktId
              ? {
                  pruefpunkt:
                    nachweis.vorlage.punkte.find((p) => p.id === punktId)?.position ?? null,
                }
              : {}),
          },
        },
        tx,
      )
    })
  } catch (error) {
    await entferneDateien(geschrieben.map((d) => d.storedPath))
    throw error instanceof NachweisFehler
      ? error
      : new NachweisFehler(
          error instanceof Error ? error.message : 'Die Belege konnten nicht gespeichert werden.',
        )
  }

  return geschrieben.length
}

/** Entfernt einen Beleg, solange der Prüfbogen noch bearbeitet werden darf. */
export async function entferneBeleg(
  nachweisId: string,
  belegId: string,
  benutzerId: string,
): Promise<void> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) throw new NachweisFehler('Der Nachweis wurde nicht gefunden.')
  pruefeBearbeitbar(nachweis, benutzerId)

  const beleg = await prisma.attachment.findFirst({
    where: { id: belegId, nachweisId },
    select: { id: true, filename: true, sha256: true, storedPath: true },
  })
  if (!beleg) throw new NachweisFehler('Der Beleg gehört nicht zu diesem Prüfbogen.')

  await prisma.$transaction(async (tx) => {
    await tx.attachment.delete({ where: { id: beleg.id } })
    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'NACHWEIS_BELEG_ENTFERNT',
        entityType: 'Nachweis',
        entityId: nachweisId,
        payload: { dateiname: beleg.filename, sha256: beleg.sha256 },
      },
      tx,
    )
  })

  await entferneDateien([beleg.storedPath])
}

/** Gemeinsame Regel für alle Änderungen an einem Prüfbogen. */
function pruefeBearbeitbar(
  nachweis: { status: string; erfasstById: string },
  benutzerId: string,
): void {
  if (!istAenderbar(nachweis.status as NachweisStatus)) {
    throw new NachweisFehler(
      'Dieser Nachweis ist nicht mehr änderbar. Ein gegengezeichneter Nachweis bleibt unverändert; Korrekturen erfolgen als neuer Vorgang.',
    )
  }
  if (nachweis.erfasstById !== benutzerId) {
    throw new NachweisFehler('Nur die erfassende Person kann diesen Nachweis bearbeiten.')
  }
}

/** Speichert Zwischenstand oder endgültige Antworten. */
export async function speichereAntworten(
  nachweisId: string,
  benutzerId: string,
  bemerkung: string | null,
  eingaben: AntwortEingabe[],
): Promise<void> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) throw new NachweisFehler('Der Nachweis wurde nicht gefunden.')

  pruefeBearbeitbar(nachweis, benutzerId)

  const punkte = new Map(nachweis.vorlage.punkte.map((p) => [p.id, p]))

  // Vor dem Schreiben prüfen, dass jedes Ergebnis zur Art des Punkts passt.
  for (const eingabe of eingaben) {
    const punkt = punkte.get(eingabe.punktId)
    if (!punkt) {
      throw new NachweisFehler('Zu diesem Prüfbogen gehört ein unbekannter Prüfpunkt.')
    }
    if (!ergebnisPasst(punkt.art as Pruefpunkt['art'], eingabe.ergebnis)) {
      throw new NachweisFehler(
        `Das Ergebnis passt nicht zur Art des Prüfpunkts „${punkt.frage}“.`,
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const eingabe of eingaben) {
      await tx.nachweisAntwort.upsert({
        where: {
          nachweisId_punktId: { nachweisId, punktId: eingabe.punktId },
        },
        update: {
          ergebnis: eingabe.ergebnis,
          wert: eingabe.wert,
          bemerkung: eingabe.bemerkung,
        },
        create: {
          nachweisId,
          punktId: eingabe.punktId,
          ergebnis: eingabe.ergebnis,
          wert: eingabe.wert,
          bemerkung: eingabe.bemerkung,
        },
      })
    }

    await tx.nachweis.update({
      where: { id: nachweisId },
      data: {
        bemerkung,
        // Nach einer Zurückweisung beginnt die Bearbeitung erneut.
        status: nachweis.status === 'ZURUECKGEWIESEN' ? 'ENTWURF' : nachweis.status,
        ablehnungsgrund: nachweis.status === 'ZURUECKGEWIESEN' ? null : nachweis.ablehnungsgrund,
      },
    })
  })
}

export type UebergangErgebnis = {
  neuerStatus: NachweisStatus
  /** Gesetzt, wenn dabei ein PDF-Nachweis entstanden ist */
  attachmentId: string | null
  /** Prüfpunkte mit Feststellung – Vorschlag für Abweichungen */
  feststellungen: { frage: string; ergebnis: string; bemerkung: string | null }[]
}

/**
 * Führt einen Zustandswechsel aus.
 *
 * Beim Abschluss (gegenzeichnen bzw. abschliessen) entsteht das PDF und wird
 * als Anhang an der Durchführung hinterlegt – mit SHA-256 wie jeder andere
 * Nachweis, damit die Nachweiskette geschlossen bleibt.
 */
export async function fuehreUebergangAus(
  nachweisId: string,
  uebergang: Uebergang,
  benutzerId: string,
  begruendung: string | null,
): Promise<UebergangErgebnis> {
  const nachweis = await ladeNachweis(nachweisId)
  if (!nachweis) throw new NachweisFehler('Der Nachweis wurde nicht gefunden.')

  const punkte = alsPunkte(nachweis.vorlage.punkte)
  const antworten = alsAntworten(nachweis.antworten)
  const stand = pruefeVollstaendigkeit(punkte, antworten)

  const pruefung = pruefeUebergang(uebergang, {
    status: nachweis.status as NachweisStatus,
    vierAugen: nachweis.vorlage.vierAugen,
    handelnderId: benutzerId,
    erfasstById: nachweis.erfasstById,
    vollstaendig: stand.vollstaendig,
  })

  if (!pruefung.erlaubt) {
    const zusatz =
      stand.offenePflichtpunkte.length > 0
        ? ` Offen: Prüfpunkt ${stand.offenePflichtpunkte.join(', ')}.`
        : ''
    throw new NachweisFehler(pruefung.grund + zusatz)
  }

  if (uebergang === 'zurueckweisen' && (!begruendung || begruendung.trim().length < 10)) {
    throw new NachweisFehler(
      'Bitte begründen Sie die Zurückweisung (mindestens 10 Zeichen).',
    )
  }

  const wirdAbgeschlossen = pruefung.neuerStatus === 'GEGENGEZEICHNET'
  let attachmentId: string | null = nachweis.attachmentId

  // --- PDF erzeugen und als Anhang hinterlegen -------------------------
  if (wirdAbgeschlossen) {
    const branding = await holeBranding()
    const pdf = await erzeugeNachweisPdf({
      anwendung: branding.appName,
      organisation: branding.organisation,
      markenfarbe: branding.primaryColor,
      aufgabe: nachweis.occurrence.task.title,
      kategorie: nachweis.occurrence.task.category.name,
      faelligAm: nachweis.occurrence.dueDate,
      pruefbogen: nachweis.vorlage.name,
      beschreibung: nachweis.vorlage.beschreibung,
      erfasstVon: nachweis.erfasstBy.name,
      erfasstAm: nachweis.erfasstAm,
      geprueftVon: uebergang === 'gegenzeichnen' ? await nameVon(benutzerId) : null,
      geprueftAm: uebergang === 'gegenzeichnen' ? new Date() : null,
      bemerkung: nachweis.bemerkung,
      punkte: nachweis.vorlage.punkte.map((punkt) => {
        const antwort = nachweis.antworten.find((a) => a.punktId === punkt.id)
        return {
          position: punkt.position,
          frage: punkt.frage,
          hinweis: punkt.hinweis,
          art: punkt.art as Pruefpunkt['art'],
          ergebnis: (antwort?.ergebnis as PruefpunktErgebnis | null) ?? null,
          wert: antwort?.wert ?? null,
          bemerkung: antwort?.bemerkung ?? null,
          belege: nachweis.belege
            .filter((beleg) => beleg.punktId === punkt.id)
            .map((beleg) => beleg.filename),
        }
      }),
      // Die Belege stehen mit Prüfsumme im PDF: Das Dokument allein belegt
      // damit, welche Dateien zur Prüfung gehörten und dass sie unverändert
      // sind – auch außerhalb der Anwendung.
      belege: nachweis.belege.map((beleg) => ({
        dateiname: beleg.filename,
        sha256: beleg.sha256,
        groesseBytes: beleg.sizeBytes,
        pruefpunkt:
          nachweis.vorlage.punkte.find((p) => p.id === beleg.punktId)?.position ?? null,
      })),
    })

    const sha256 = createHash('sha256').update(pdf).digest('hex')
    const dateiname = `Nachweis ${nachweis.vorlage.name} ${formatDate(
      nachweis.occurrence.dueDate,
    )}.pdf`.replace(/[\\/:*?"<>|]/g, '-')

    const relativerPfad = baueSpeicherpfad(
      `nachweis-${nachweis.id}`,
      'pdf',
      new Date(),
    )
    const ziel = absoluterPfad(relativerPfad)
    await mkdir(path.dirname(ziel), { recursive: true })
    await writeFile(ziel, pdf)

    const datei = {
      filename: dateiname,
      storedPath: relativerPfad,
      mimeType: 'application/pdf',
      sizeBytes: pdf.byteLength,
      sha256,
    }

    let executionId: string

    if (nachweis.occurrence.execution) {
      // Die Fälligkeit ist bereits erledigt – der Nachweis kommt zur
      // bestehenden Durchführung hinzu.
      executionId = nachweis.occurrence.execution.id
      const anhang = await prisma.attachment.create({
        data: {
          executionId,
          uploadedById: benutzerId,
          ...datei,
        },
        select: { id: true },
      })
      attachmentId = anhang.id
    } else {
      // Regelfall: Der Nachweis entstand aus einer offenen Fälligkeit. Mit
      // der Gegenzeichnung gilt die Prüfung als durchgeführt – erst dadurch
      // gibt es eine Durchführung, an der das PDF hängen kann. Der Folgetermin
      // entsteht dabei wie bei jeder anderen Erledigung.
      const feststellungenVorhanden = auffaelligePunkte(punkte, antworten).length > 0
      try {
        const durchfuehrung = await protokolliereDurchfuehrung(
          {
            occurrenceId: nachweis.occurrenceId,
            result: feststellungenVorhanden ? 'OK_WITH_REMARKS' : 'OK',
            comment: `Erstellt aus dem Prüfbogen „${nachweis.vorlage.name}“.`,
            durchgefuehrtAm: todayInBerlin(),
            abweichungen: [],
            nachweise: [datei],
          },
          nachweis.erfasstById,
        )
        executionId = durchfuehrung.executionId
        const anhang = await prisma.attachment.findFirst({
          where: { executionId, sha256 },
          select: { id: true },
        })
        attachmentId = anhang?.id ?? null
      } catch (error) {
        await entferneDateien([relativerPfad])
        throw new NachweisFehler(
          error instanceof Error
            ? `Die Durchführung konnte nicht protokolliert werden: ${error.message}`
            : 'Die Durchführung konnte nicht protokolliert werden.',
        )
      }
    }

    // Die während der Prüfung hochgeladenen Belege gehören ab jetzt zur
    // Durchführung. Die Dateien bleiben liegen, wo sie sind – nur die
    // Zuordnung kommt hinzu, damit sie an der Aufgabe und in den Reports
    // erscheinen.
    await prisma.attachment.updateMany({
      where: { nachweisId, executionId: null },
      data: { executionId },
    })
  }

  // --- Zustandswechsel schreiben ---------------------------------------
  const jetzt = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.nachweis.update({
      where: { id: nachweisId },
      data: {
        status: pruefung.neuerStatus,
        vorgelegtAm: uebergang === 'vorlegen' ? jetzt : nachweis.vorgelegtAm,
        geprueftById:
          uebergang === 'gegenzeichnen' || uebergang === 'zurueckweisen'
            ? benutzerId
            : uebergang === 'abschliessen'
              ? benutzerId
              : nachweis.geprueftById,
        geprueftAm:
          uebergang === 'gegenzeichnen' || uebergang === 'abschliessen' ? jetzt : null,
        ablehnungsgrund: uebergang === 'zurueckweisen' ? begruendung : null,
        attachmentId,
      },
    })

    await schreibeAudit(
      {
        userId: benutzerId,
        action:
          uebergang === 'vorlegen'
            ? 'NACHWEIS_VORGELEGT'
            : uebergang === 'gegenzeichnen'
              ? 'NACHWEIS_GEGENGEZEICHNET'
              : uebergang === 'zurueckweisen'
                ? 'NACHWEIS_ZURUECKGEWIESEN'
                : 'NACHWEIS_ABGESCHLOSSEN',
        entityType: 'Nachweis',
        entityId: nachweisId,
        payload: {
          pruefbogen: nachweis.vorlage.name,
          aufgabe: nachweis.occurrence.task.title,
          beantwortet: `${stand.beantwortet}/${stand.gesamt}`,
          ...(begruendung ? { begruendung } : {}),
          ...(attachmentId && attachmentId !== nachweis.attachmentId
            ? { nachweisPdf: 'als Anhang hinterlegt' }
            : {}),
        },
      },
      tx,
    )
  })

  const feststellungen = auffaelligePunkte(punkte, antworten).map((eintrag) => {
    const antwort = nachweis.antworten.find((a) => a.punktId === eintrag.punkt.id)
    return {
      frage: eintrag.punkt.frage,
      ergebnis: String(eintrag.antwort.ergebnis),
      bemerkung: antwort?.bemerkung ?? null,
    }
  })

  return { neuerStatus: pruefung.neuerStatus, attachmentId, feststellungen }
}

async function nameVon(benutzerId: string): Promise<string> {
  const benutzer = await prisma.user.findUnique({
    where: { id: benutzerId },
    select: { name: true },
  })
  return benutzer?.name ?? 'unbekannt'
}

/** Vorlagen, die für eine Aufgabe in Frage kommen. */
export async function ladeVerfuegbareVorlagen(taskId: string) {
  return prisma.pruefbogenVorlage.findMany({
    where: {
      aktiv: true,
      // Fest zugeordnete Bögen dieser Aufgabe sowie allgemeine Vorlagen.
      OR: [{ taskId }, { taskId: null }],
    },
    orderBy: [{ taskId: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      beschreibung: true,
      vierAugen: true,
      taskId: true,
      _count: { select: { punkte: true } },
    },
  })
}

/** Nachweise, die auf eine Gegenzeichnung warten. */
export async function ladeOffeneGegenzeichnungen(benutzerId: string) {
  return prisma.nachweis.findMany({
    where: {
      status: 'VORGELEGT',
      // Die eigene Erfassung darf man nicht gegenzeichnen.
      erfasstById: { not: benutzerId },
    },
    orderBy: { vorgelegtAm: 'asc' },
    include: {
      vorlage: { select: { name: true } },
      erfasstBy: { select: { name: true } },
      occurrence: {
        select: {
          dueDate: true,
          task: { select: { id: true, title: true } },
        },
      },
    },
  })
}

/** Heutiges Datum – für Vorbelegungen in Formularen. */
export function heute(): Date {
  return todayInBerlin()
}
