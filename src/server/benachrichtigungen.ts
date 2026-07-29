/**
 * Ermittelt und versendet die E-Mail-Benachrichtigungen.
 *
 * Grundsätze:
 *  - Je Person entsteht eine Sammelnachricht, nicht eine Nachricht je Aufgabe.
 *  - Der Versand ist wiederholungssicher: Jeder gemeldete Vorgang wird in
 *    `SentNotification` festgehalten. Ein mehrfacher Lauf am selben Tag
 *    erzeugt deshalb keine zweite Nachricht.
 *  - Überfällige Vorgänge werden bewusst wöchentlich erneut gemeldet, damit
 *    sie nicht nach der ersten Nachricht in Vergessenheit geraten.
 *  - Ein Fehler bei einer Empfängerin bricht den Lauf nicht ab.
 */
import type { NotificationKind } from '@prisma/client'

import { schreibeAuditLeise } from '@/lib/audit'
import {
  compareDates,
  differenceInDays,
  formatDate,
  kalenderwochenSchluessel,
  todayInBerlin,
  wochentagIso,
} from '@/lib/dates'
import { KRITIKALITAET_BEZEICHNUNG, SCHWERE_BEZEICHNUNG } from '@/lib/labels'
import {
  baueAbweichungsMail,
  baueAufgabenMail,
  baueEskalationsMail,
  baueWochenuebersichtMail,
  type AbweichungsEintrag,
  type AufgabenEintrag,
  type EskalationsEintrag,
  type MailInhalt,
  type MailRahmen,
} from '@/lib/mail-vorlagen'
import { prisma } from '@/lib/prisma'
import { bewerteAmpel } from '@/lib/scheduling'
import { holeBranding } from '@/server/branding'
import { istMailVersandKonfiguriert, versendeMail } from '@/server/mailer'
import {
  holeBenachrichtigungsEinstellungen,
  type BenachrichtigungsEinstellungen,
} from '@/server/benachrichtigungs-einstellungen'

export type BenachrichtigungsErgebnis = {
  versendet: number
  empfaenger: number
  fehlgeschlagen: number
  uebersprungen: string | null
  dauerMs: number
}

/** Basisadresse der Anwendung für Verweise in den Nachrichten. */
export function appBasisUrl(): string {
  return (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

/**
 * Wöchentlicher Zähler für wiederkehrende Meldungen: Ab dem ersten Tag der
 * Überschreitung wird alle sieben Tage erneut erinnert.
 */
function wiederholungsStufe(tageUeberschritten: number): number {
  return Math.max(0, Math.floor(tageUeberschritten / 7))
}

/** Bereits gemeldete Schlüssel einer Art nachschlagen. */
async function bereitsGemeldet(
  kind: NotificationKind,
  schluessel: string[],
): Promise<Set<string>> {
  if (schluessel.length === 0) return new Set()
  const treffer = await prisma.sentNotification.findMany({
    where: { kind, key: { in: schluessel } },
    select: { key: true },
  })
  return new Set(treffer.map((t) => t.key))
}

/** Versendet eine Nachricht und protokolliert die enthaltenen Vorgänge. */
async function versendeUndProtokolliere(
  kind: NotificationKind,
  empfaenger: string,
  inhalt: MailInhalt,
  schluessel: string[],
): Promise<boolean> {
  const ergebnis = await versendeMail(empfaenger, inhalt)
  if (!ergebnis.erfolg) return false

  // Erst nach erfolgreichem Versand festhalten – sonst würde ein Fehlschlag
  // die Meldung dauerhaft unterdrücken.
  await prisma.sentNotification.createMany({
    data: schluessel.map((key) => ({
      kind,
      key,
      recipient: empfaenger,
      subject: inhalt.betreff,
      itemCount: schluessel.length,
    })),
    skipDuplicates: true,
  })

  await schreibeAuditLeise({
    userId: null,
    action: 'NOTIFICATION_SENT',
    entityType: 'Notification',
    entityId: kind,
    payload: {
      empfaenger,
      betreff: inhalt.betreff,
      vorgaenge: schluessel.length,
    },
  })

  return true
}

// ---------------------------------------------------------------------------
// Datenbeschaffung
// ---------------------------------------------------------------------------

type OffeneFaelligkeit = {
  occurrenceId: string
  taskId: string
  titel: string
  kategorie: string
  kritikalitaet: string
  faelligAm: Date
  ueberfaellig: boolean
  tageUeberschritten: number
  baldFaellig: boolean
  besitzerId: string
  besitzerName: string
  besitzerEmail: string
  besitzerMoechteMail: boolean
}

async function ladeOffeneFaelligkeiten(heute: Date): Promise<OffeneFaelligkeit[]> {
  const offene = await prisma.occurrence.findMany({
    where: { status: { in: ['OPEN', 'OVERDUE'] }, task: { active: true } },
    include: {
      task: {
        select: {
          id: true,
          title: true,
          leadTimeDays: true,
          graceDays: true,
          criticality: true,
          category: { select: { name: true } },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              active: true,
              notifyByEmail: true,
            },
          },
        },
      },
    },
  })

  return offene
    .filter((o) => o.task.owner.active)
    .map((o) => {
      const ampel = bewerteAmpel(
        o.dueDate,
        o.task.leadTimeDays,
        o.task.graceDays,
        heute,
      )
      return {
        occurrenceId: o.id,
        taskId: o.task.id,
        titel: o.task.title,
        kategorie: o.task.category.name,
        kritikalitaet: KRITIKALITAET_BEZEICHNUNG[o.task.criticality],
        faelligAm: o.dueDate,
        ueberfaellig: ampel === 'ueberfaellig',
        // Tage seit dem Ende der Karenzfrist
        tageUeberschritten: Math.max(
          0,
          differenceInDays(o.dueDate, heute) - o.task.graceDays,
        ),
        baldFaellig: ampel === 'bald',
        besitzerId: o.task.owner.id,
        besitzerName: o.task.owner.name,
        besitzerEmail: o.task.owner.email,
        besitzerMoechteMail: o.task.owner.notifyByEmail,
      }
    })
}

type OffeneAbweichung = {
  findingId: string
  titel: string
  aufgabe: string
  schwere: string
  frist: Date
  fristUeberschritten: boolean
  tageUeberschritten: number
  verantwortlichId: string
  verantwortlichName: string
  verantwortlichEmail: string
  verantwortlichMoechteMail: boolean
}

async function ladeOffeneAbweichungen(heute: Date): Promise<OffeneAbweichung[]> {
  const abweichungen = await prisma.finding.findMany({
    where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    include: {
      responsible: {
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          notifyByEmail: true,
        },
      },
      execution: {
        select: {
          occurrence: { select: { task: { select: { title: true } } } },
        },
      },
    },
  })

  return abweichungen
    .filter((a) => a.responsible.active)
    .map((a) => ({
      findingId: a.id,
      titel: a.title,
      aufgabe: a.execution.occurrence.task.title,
      schwere: SCHWERE_BEZEICHNUNG[a.severity],
      frist: a.dueDate,
      fristUeberschritten: compareDates(a.dueDate, heute) < 0,
      tageUeberschritten: Math.max(0, differenceInDays(a.dueDate, heute)),
      verantwortlichId: a.responsible.id,
      verantwortlichName: a.responsible.name,
      verantwortlichEmail: a.responsible.email,
      verantwortlichMoechteMail: a.responsible.notifyByEmail,
    }))
}

// ---------------------------------------------------------------------------
// Hauptablauf
// ---------------------------------------------------------------------------

export async function versendeBenachrichtigungen(
  heute: Date = todayInBerlin(),
): Promise<BenachrichtigungsErgebnis> {
  const beginn = Date.now()
  const leer: BenachrichtigungsErgebnis = {
    versendet: 0,
    empfaenger: 0,
    fehlgeschlagen: 0,
    uebersprungen: null,
    dauerMs: 0,
  }

  if (!istMailVersandKonfiguriert()) {
    return { ...leer, uebersprungen: 'Kein Mailserver konfiguriert (SMTP_HOST fehlt).', dauerMs: Date.now() - beginn }
  }

  const einstellungen = await holeBenachrichtigungsEinstellungen()
  if (!einstellungen.enabled) {
    return { ...leer, uebersprungen: 'Der Versand ist im Administrationsbereich deaktiviert.', dauerMs: Date.now() - beginn }
  }

  const branding = await holeBranding()
  const rahmen: MailRahmen = {
    anwendung: branding.appName,
    organisation: branding.organisation,
    markenfarbe: branding.primaryColor,
    appUrl: appBasisUrl(),
    stichtag: heute,
  }

  let versendet = 0
  let fehlgeschlagen = 0
  const empfaengerAdressen = new Set<string>()

  const faelligkeiten = await ladeOffeneFaelligkeiten(heute)
  const abweichungen = await ladeOffeneAbweichungen(heute)

  if (einstellungen.aufgabenAktiv) {
    const ergebnis = await versendeAufgabenMails(rahmen, faelligkeiten)
    versendet += ergebnis.versendet
    fehlgeschlagen += ergebnis.fehlgeschlagen
    ergebnis.empfaenger.forEach((e) => empfaengerAdressen.add(e))
  }

  if (einstellungen.abweichungenAktiv) {
    const ergebnis = await versendeAbweichungsMails(
      rahmen,
      abweichungen,
      einstellungen.abweichungVorlaufTage,
      heute,
    )
    versendet += ergebnis.versendet
    fehlgeschlagen += ergebnis.fehlgeschlagen
    ergebnis.empfaenger.forEach((e) => empfaengerAdressen.add(e))
  }

  if (einstellungen.eskalationAktiv && einstellungen.eskalationUserId) {
    const ergebnis = await versendeEskalation(rahmen, faelligkeiten, einstellungen, heute)
    versendet += ergebnis.versendet
    fehlgeschlagen += ergebnis.fehlgeschlagen
    ergebnis.empfaenger.forEach((e) => empfaengerAdressen.add(e))
  }

  if (
    einstellungen.wochenuebersichtAktiv &&
    wochentagIso(heute) === einstellungen.wochenuebersichtTag
  ) {
    const ergebnis = await versendeWochenuebersicht(rahmen, faelligkeiten, abweichungen, heute)
    versendet += ergebnis.versendet
    fehlgeschlagen += ergebnis.fehlgeschlagen
    ergebnis.empfaenger.forEach((e) => empfaengerAdressen.add(e))
  }

  return {
    versendet,
    empfaenger: empfaengerAdressen.size,
    fehlgeschlagen,
    uebersprungen: null,
    dauerMs: Date.now() - beginn,
  }
}

type TeilErgebnis = {
  versendet: number
  fehlgeschlagen: number
  empfaenger: string[]
}

// --- Aufgaben --------------------------------------------------------------

async function versendeAufgabenMails(
  rahmen: MailRahmen,
  faelligkeiten: OffeneFaelligkeit[],
): Promise<TeilErgebnis> {
  const relevant = faelligkeiten.filter(
    (f) => (f.baldFaellig || f.ueberfaellig) && f.besitzerMoechteMail && f.besitzerEmail,
  )

  // Schlüssel: bald fällige Termine einmalig, überfällige wöchentlich erneut.
  const schluesselFuer = (f: OffeneFaelligkeit) =>
    f.ueberfaellig
      ? `occurrence:${f.occurrenceId}:ueberfaellig:${wiederholungsStufe(f.tageUeberschritten)}`
      : `occurrence:${f.occurrenceId}:faellig`

  const gemeldet = await bereitsGemeldet(
    'AUFGABEN',
    relevant.map(schluesselFuer),
  )
  const neu = relevant.filter((f) => !gemeldet.has(schluesselFuer(f)))

  const proBenutzer = new Map<string, OffeneFaelligkeit[]>()
  for (const eintrag of neu) {
    const liste = proBenutzer.get(eintrag.besitzerId) ?? []
    liste.push(eintrag)
    proBenutzer.set(eintrag.besitzerId, liste)
  }

  const ergebnis: TeilErgebnis = { versendet: 0, fehlgeschlagen: 0, empfaenger: [] }

  for (const liste of proBenutzer.values()) {
    // Überfällige zuerst, dann nach Termin.
    liste.sort(
      (a, b) =>
        Number(b.ueberfaellig) - Number(a.ueberfaellig) ||
        compareDates(a.faelligAm, b.faelligAm),
    )

    const eintraege: AufgabenEintrag[] = liste.map((f) => ({
      aufgabe: f.titel,
      kategorie: f.kategorie,
      faelligAm: f.faelligAm,
      ueberfaellig: f.ueberfaellig,
      kritikalitaet: f.kritikalitaet,
      url: `${rahmen.appUrl}/tasks/${f.taskId}`,
    }))

    const mail = baueAufgabenMail(rahmen, liste[0].besitzerName, eintraege)
    const erfolg = await versendeUndProtokolliere(
      'AUFGABEN',
      liste[0].besitzerEmail,
      mail,
      liste.map(schluesselFuer),
    )

    if (erfolg) {
      ergebnis.versendet++
      ergebnis.empfaenger.push(liste[0].besitzerEmail)
    } else {
      ergebnis.fehlgeschlagen++
    }
  }

  return ergebnis
}

// --- Abweichungen ----------------------------------------------------------

async function versendeAbweichungsMails(
  rahmen: MailRahmen,
  abweichungen: OffeneAbweichung[],
  vorlaufTage: number,
  heute: Date,
): Promise<TeilErgebnis> {
  const relevant = abweichungen.filter((a) => {
    if (!a.verantwortlichMoechteMail || !a.verantwortlichEmail) return false
    // Fällig innerhalb des Vorlaufs oder bereits überschritten.
    return differenceInDays(heute, a.frist) <= vorlaufTage
  })

  const schluesselFuer = (a: OffeneAbweichung) =>
    a.fristUeberschritten
      ? `finding:${a.findingId}:ueberschritten:${wiederholungsStufe(a.tageUeberschritten)}`
      : `finding:${a.findingId}:frist`

  const gemeldet = await bereitsGemeldet(
    'ABWEICHUNGEN',
    relevant.map(schluesselFuer),
  )
  const neu = relevant.filter((a) => !gemeldet.has(schluesselFuer(a)))

  const proBenutzer = new Map<string, OffeneAbweichung[]>()
  for (const eintrag of neu) {
    const liste = proBenutzer.get(eintrag.verantwortlichId) ?? []
    liste.push(eintrag)
    proBenutzer.set(eintrag.verantwortlichId, liste)
  }

  const ergebnis: TeilErgebnis = { versendet: 0, fehlgeschlagen: 0, empfaenger: [] }

  for (const liste of proBenutzer.values()) {
    liste.sort((a, b) => compareDates(a.frist, b.frist))

    const eintraege: AbweichungsEintrag[] = liste.map((a) => ({
      titel: a.titel,
      aufgabe: a.aufgabe,
      schwere: a.schwere,
      frist: a.frist,
      fristUeberschritten: a.fristUeberschritten,
      url: `${rahmen.appUrl}/findings`,
    }))

    const mail = baueAbweichungsMail(rahmen, liste[0].verantwortlichName, eintraege)
    const erfolg = await versendeUndProtokolliere(
      'ABWEICHUNGEN',
      liste[0].verantwortlichEmail,
      mail,
      liste.map(schluesselFuer),
    )

    if (erfolg) {
      ergebnis.versendet++
      ergebnis.empfaenger.push(liste[0].verantwortlichEmail)
    } else {
      ergebnis.fehlgeschlagen++
    }
  }

  return ergebnis
}

// --- Eskalation ------------------------------------------------------------

async function versendeEskalation(
  rahmen: MailRahmen,
  faelligkeiten: OffeneFaelligkeit[],
  einstellungen: BenachrichtigungsEinstellungen,
  heute: Date,
): Promise<TeilErgebnis> {
  const ergebnis: TeilErgebnis = { versendet: 0, fehlgeschlagen: 0, empfaenger: [] }

  const empfaenger = await prisma.user.findUnique({
    where: { id: einstellungen.eskalationUserId ?? '' },
    select: { name: true, email: true, active: true },
  })
  if (!empfaenger?.active || !empfaenger.email) return ergebnis

  const betroffen = faelligkeiten.filter(
    (f) => f.ueberfaellig && f.tageUeberschritten > einstellungen.eskalationAbTagen,
  )
  if (betroffen.length === 0) return ergebnis

  // Eine Eskalation je Kalenderwoche – sonst würde täglich gemahnt.
  const schluessel = `eskalation:${kalenderwochenSchluessel(heute)}`
  const gemeldet = await bereitsGemeldet('ESKALATION', [schluessel])
  if (gemeldet.has(schluessel)) return ergebnis

  betroffen.sort((a, b) => b.tageUeberschritten - a.tageUeberschritten)

  const eintraege: EskalationsEintrag[] = betroffen.map((f) => ({
    aufgabe: f.titel,
    kategorie: f.kategorie,
    faelligAm: f.faelligAm,
    ueberfaellig: true,
    kritikalitaet: f.kritikalitaet,
    url: `${rahmen.appUrl}/tasks/${f.taskId}`,
    verantwortlich: f.besitzerName,
  }))

  const mail = baueEskalationsMail(
    rahmen,
    empfaenger.name,
    einstellungen.eskalationAbTagen,
    eintraege,
  )

  if (await versendeUndProtokolliere('ESKALATION', empfaenger.email, mail, [schluessel])) {
    ergebnis.versendet++
    ergebnis.empfaenger.push(empfaenger.email)
  } else {
    ergebnis.fehlgeschlagen++
  }

  return ergebnis
}

// --- Wochenübersicht -------------------------------------------------------

async function versendeWochenuebersicht(
  rahmen: MailRahmen,
  faelligkeiten: OffeneFaelligkeit[],
  abweichungen: OffeneAbweichung[],
  heute: Date,
): Promise<TeilErgebnis> {
  const ergebnis: TeilErgebnis = { versendet: 0, fehlgeschlagen: 0, empfaenger: [] }
  const woche = kalenderwochenSchluessel(heute)

  const benutzer = await prisma.user.findMany({
    where: { active: true, notifyByEmail: true },
    select: { id: true, name: true, email: true },
  })

  const schluessel = benutzer.map((b) => `user:${b.id}:${woche}`)
  const gemeldet = await bereitsGemeldet('WOCHENUEBERSICHT', schluessel)

  for (const person of benutzer) {
    const key = `user:${person.id}:${woche}`
    if (gemeldet.has(key) || !person.email) continue

    const eigeneAufgaben = faelligkeiten
      .filter((f) => f.besitzerId === person.id)
      .sort((a, b) => compareDates(a.faelligAm, b.faelligAm))
    const eigeneAbweichungen = abweichungen
      .filter((a) => a.verantwortlichId === person.id)
      .sort((a, b) => compareDates(a.frist, b.frist))

    // Wer nichts offen hat, bekommt auch keine Wochenmail.
    if (eigeneAufgaben.length === 0 && eigeneAbweichungen.length === 0) continue

    const mail = baueWochenuebersichtMail(
      rahmen,
      person.name,
      eigeneAufgaben.map((f) => ({
        aufgabe: f.titel,
        kategorie: f.kategorie,
        faelligAm: f.faelligAm,
        ueberfaellig: f.ueberfaellig,
        kritikalitaet: f.kritikalitaet,
        url: `${rahmen.appUrl}/tasks/${f.taskId}`,
      })),
      eigeneAbweichungen.map((a) => ({
        titel: a.titel,
        aufgabe: a.aufgabe,
        schwere: a.schwere,
        frist: a.frist,
        fristUeberschritten: a.fristUeberschritten,
        url: `${rahmen.appUrl}/findings`,
      })),
    )

    if (await versendeUndProtokolliere('WOCHENUEBERSICHT', person.email, mail, [key])) {
      ergebnis.versendet++
      ergebnis.empfaenger.push(person.email)
    } else {
      ergebnis.fehlgeschlagen++
    }
  }

  return ergebnis
}

/** Menschenlesbare Zusammenfassung für Protokoll und Oberfläche. */
export function fasseErgebnisZusammen(
  ergebnis: BenachrichtigungsErgebnis,
  heute: Date,
): string {
  if (ergebnis.uebersprungen) {
    return `Kein Versand am ${formatDate(heute)}: ${ergebnis.uebersprungen}`
  }
  return (
    `${ergebnis.versendet} Nachrichten an ${ergebnis.empfaenger} Empfänger ` +
    `(${ergebnis.fehlgeschlagen} fehlgeschlagen, ${ergebnis.dauerMs} ms).`
  )
}
