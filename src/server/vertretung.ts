/**
 * Vertretung bei Abwesenheit: Datenbankzugriff und Audit.
 *
 * Die Regeln liegen in `@/lib/vertretung` und sind dort geprüft. Hier kommt
 * hinzu, wer eine Vertretung setzen darf und wie sie sich auf die
 * Empfängerermittlung der Benachrichtigungen auswirkt.
 *
 * Bewusst ohne `import 'server-only'`, damit der Integrationstest das Modul
 * unmittelbar aufrufen kann.
 */
import { schreibeAudit } from '@/lib/audit'
import { todayInBerlin } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { canExecute } from '@/lib/rbac'
import {
  beschreibeZeitraum,
  istVertretungAktiv,
  loeseVertretung,
  pruefeVertretung,
  type Vertretung,
} from '@/lib/vertretung'

/** Fachlicher Fehler; der Text erscheint unverändert in der Oberfläche. */
export class VertretungsFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'VertretungsFehler'
  }
}

export type VertretungsAngabe = {
  vertretungId: string | null
  von: Date | null
  bis: Date | null
}

export type VertretungsStand = {
  personId: string
  personName: string
  vertretungId: string | null
  vertretungName: string | null
  von: Date | null
  bis: Date | null
  /** Gilt die Vertretung heute? */
  aktiv: boolean
}

/**
 * Setzt oder hebt die Vertretung einer Person auf.
 *
 * `handelnderId` ist die Person, die die Änderung vornimmt – das darf man
 * für sich selbst, sonst nur mit Verwaltungsrecht. Der Unterschied landet im
 * Audit-Log, damit später erkennbar ist, ob jemand fremde Post umgeleitet
 * hat.
 */
export async function setzeVertretung(
  personId: string,
  angabe: VertretungsAngabe,
  handelnderId: string,
  darfFremde: boolean,
): Promise<void> {
  if (personId !== handelnderId && !darfFremde) {
    throw new VertretungsFehler(
      'Die Vertretung einer anderen Person darf nur die Verwaltung ändern.',
    )
  }

  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: { id: true, name: true },
  })
  if (!person) throw new VertretungsFehler('Die Person wurde nicht gefunden.')

  const kandidat = angabe.vertretungId
    ? await prisma.user.findUnique({
        where: { id: angabe.vertretungId },
        select: { id: true, name: true, active: true, role: true },
      })
    : null

  if (angabe.vertretungId && !kandidat) {
    throw new VertretungsFehler('Die vertretende Person wurde nicht gefunden.')
  }

  const pruefung = pruefeVertretung({
    personId,
    vertretungId: angabe.vertretungId,
    von: angabe.von,
    bis: angabe.bis,
    vertretungAktiv: kandidat?.active ?? false,
    vertretungDarfDurchfuehren: kandidat ? canExecute(kandidat.role) : false,
  })
  if (!pruefung.ok) throw new VertretungsFehler(pruefung.fehler)

  // Ein Ring bringt niemandem etwas: Beide wären abwesend, die Meldung käme
  // im Kreis wieder an. Lieber vor dem Speichern ablehnen.
  if (angabe.vertretungId) {
    const alle = await ladeVertretungsKarte()
    alle.set(personId, {
      vertretungId: angabe.vertretungId,
      von: angabe.von,
      bis: angabe.bis,
    })
    const aufloesung = loeseVertretung(personId, alle, todayInBerlin())
    if (aufloesung.abgebrochen) {
      throw new VertretungsFehler(
        'Diese Angabe ergibt einen Kreis: Die vertretende Person wird am Ende wieder von dieser Person vertreten.',
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: personId },
      data: {
        vertretungId: angabe.vertretungId,
        vertretungVon: angabe.vertretungId ? angabe.von : null,
        vertretungBis: angabe.vertretungId ? angabe.bis : null,
      },
    })

    await schreibeAudit(
      {
        userId: handelnderId,
        action: angabe.vertretungId ? 'VERTRETUNG_GESETZT' : 'VERTRETUNG_AUFGEHOBEN',
        entityType: 'User',
        entityId: personId,
        payload: angabe.vertretungId
          ? {
              person: person.name,
              vertretung: kandidat!.name,
              zeitraum: beschreibeZeitraum(angabe.von, angabe.bis),
              fuerAndere: personId !== handelnderId,
            }
          : { person: person.name, fuerAndere: personId !== handelnderId },
      },
      tx,
    )
  })
}

/** Alle hinterlegten Vertretungen als Karte für die Kettenauflösung. */
export async function ladeVertretungsKarte(): Promise<Map<string, Vertretung>> {
  const personen = await prisma.user.findMany({
    where: { vertretungId: { not: null } },
    select: {
      id: true,
      vertretungId: true,
      vertretungVon: true,
      vertretungBis: true,
    },
  })

  return new Map(
    personen.map((p) => [
      p.id,
      { vertretungId: p.vertretungId, von: p.vertretungVon, bis: p.vertretungBis },
    ]),
  )
}

/** Stand einer einzelnen Person – für die Kontoseite. */
export async function ladeVertretung(
  personId: string,
  heute: Date = todayInBerlin(),
): Promise<VertretungsStand | null> {
  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: {
      id: true,
      name: true,
      vertretungId: true,
      vertretungVon: true,
      vertretungBis: true,
      vertretung: { select: { name: true } },
    },
  })
  if (!person) return null

  return {
    personId: person.id,
    personName: person.name,
    vertretungId: person.vertretungId,
    vertretungName: person.vertretung?.name ?? null,
    von: person.vertretungVon,
    bis: person.vertretungBis,
    aktiv: istVertretungAktiv(
      {
        vertretungId: person.vertretungId,
        von: person.vertretungVon,
        bis: person.vertretungBis,
      },
      heute,
    ),
  }
}

/**
 * Wen vertritt diese Person gerade?
 *
 * Für den Hinweis auf dem Dashboard: Wer die Aufgaben einer abwesenden Person
 * im Blick behalten soll, muss davon erfahren, ohne in fremde Konten zu
 * sehen.
 */
export async function ladeVertretungenFuer(
  personId: string,
  heute: Date = todayInBerlin(),
): Promise<{ personId: string; name: string; zeitraum: string }[]> {
  const abwesende = await prisma.user.findMany({
    where: { vertretungId: personId, active: true },
    select: {
      id: true,
      name: true,
      vertretungId: true,
      vertretungVon: true,
      vertretungBis: true,
    },
    orderBy: { name: 'asc' },
  })

  return abwesende
    .filter((p) =>
      istVertretungAktiv(
        { vertretungId: p.vertretungId, von: p.vertretungVon, bis: p.vertretungBis },
        heute,
      ),
    )
    .map((p) => ({
      personId: p.id,
      name: p.name,
      zeitraum: beschreibeZeitraum(p.vertretungVon, p.vertretungBis),
    }))
}

/** Übersicht aller Vertretungen – für die Benutzerverwaltung. */
export async function ladeAlleVertretungen(
  heute: Date = todayInBerlin(),
): Promise<VertretungsStand[]> {
  const personen = await prisma.user.findMany({
    where: { vertretungId: { not: null } },
    select: {
      id: true,
      name: true,
      vertretungId: true,
      vertretungVon: true,
      vertretungBis: true,
      vertretung: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  })

  return personen.map((p) => ({
    personId: p.id,
    personName: p.name,
    vertretungId: p.vertretungId,
    vertretungName: p.vertretung?.name ?? null,
    von: p.vertretungVon,
    bis: p.vertretungBis,
    aktiv: istVertretungAktiv(
      { vertretungId: p.vertretungId, von: p.vertretungVon, bis: p.vertretungBis },
      heute,
    ),
  }))
}
