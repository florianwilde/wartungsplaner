/**
 * Kalender-Abonnement: Fälligkeiten im gewohnten Kalender.
 *
 * Kalenderprogramme können sich nicht anmelden – sie rufen eine Adresse ab,
 * sonst nichts. Der Zugang ist deshalb ein langes Geheimnis in der Adresse,
 * das jederzeit neu erzeugt werden kann. Damit hängt an der Adresse genau
 * eine Person, und niemand sieht mehr als die eigenen Fälligkeiten.
 *
 * Bewusst ohne `import 'server-only'`, damit der Integrationstest das Modul
 * unmittelbar aufrufen kann.
 */
import { randomBytes } from 'node:crypto'

import { schreibeAudit } from '@/lib/audit'
import { formatDate, todayInBerlin } from '@/lib/dates'
import { baueKalender, type Kalendereintrag } from '@/lib/ical'
import { KRITIKALITAET_BEZEICHNUNG } from '@/lib/labels'
import { prisma } from '@/lib/prisma'
import { istVertretungAktiv } from '@/lib/vertretung'

/** Länge des Geheimnisses in Bytes; als Hexzeichen doppelt so lang. */
const TOKEN_BYTES = 32

/** Erzeugt ein neues Geheimnis und gibt es zurück. */
export async function erneuereKalenderToken(benutzerId: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString('hex')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: benutzerId },
      data: { kalenderToken: token },
    })
    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'KALENDER_ABO_ERNEUERT',
        entityType: 'User',
        entityId: benutzerId,
        payload: {},
      },
      tx,
    )
  })

  return token
}

/** Hebt das Abonnement auf; bestehende Adressen laufen danach ins Leere. */
export async function entferneKalenderToken(benutzerId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: benutzerId },
      data: { kalenderToken: null },
    })
    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'KALENDER_ABO_AUFGEHOBEN',
        entityType: 'User',
        entityId: benutzerId,
        payload: {},
      },
      tx,
    )
  })
}

export async function ladeKalenderToken(benutzerId: string): Promise<string | null> {
  const benutzer = await prisma.user.findUnique({
    where: { id: benutzerId },
    select: { kalenderToken: true },
  })
  return benutzer?.kalenderToken ?? null
}

/**
 * Erzeugt den Kalender zu einem Geheimnis.
 *
 * `null` bedeutet: Das Geheimnis gehört zu niemandem (mehr). Die Route
 * antwortet dann mit 404 und verrät nichts weiter.
 */
export async function baueKalenderFuerToken(
  token: string,
  appUrl: string,
  jetzt: Date = new Date(),
): Promise<{ name: string; inhalt: string } | null> {
  if (!token || token.length < 32) return null

  const benutzer = await prisma.user.findUnique({
    where: { kalenderToken: token },
    select: { id: true, name: true, active: true },
  })
  if (!benutzer || !benutzer.active) return null

  const heute = todayInBerlin()

  // Wer vertritt, soll die Termine der abwesenden Person ebenfalls sehen –
  // sonst müsste man im Urlaubsfall zwei Kalender vergleichen.
  const vertretene = (
    await prisma.user.findMany({
      where: { vertretungId: benutzer.id, active: true },
      select: {
        id: true,
        name: true,
        vertretungId: true,
        vertretungVon: true,
        vertretungBis: true,
      },
    })
  ).filter((person) =>
    istVertretungAktiv(
      {
        vertretungId: person.vertretungId,
        von: person.vertretungVon,
        bis: person.vertretungBis,
      },
      heute,
    ),
  )

  const namen = new Map(vertretene.map((p) => [p.id, p.name]))
  const besitzerIds = [benutzer.id, ...vertretene.map((p) => p.id)]

  const faelligkeiten = await prisma.occurrence.findMany({
    where: {
      status: { in: ['OPEN', 'OVERDUE'] },
      task: { active: true, ownerId: { in: besitzerIds } },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      dueDate: true,
      task: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          criticality: true,
          leadTimeDays: true,
          evidenceRequired: true,
          category: { select: { name: true } },
        },
      },
    },
  })

  const eintraege: Kalendereintrag[] = faelligkeiten.map((occurrence) => {
    const fuer = namen.get(occurrence.task.ownerId)
    const beschreibung = [
      `Kategorie: ${occurrence.task.category.name}`,
      `Kritikalität: ${KRITIKALITAET_BEZEICHNUNG[occurrence.task.criticality]}`,
      `Fällig am ${formatDate(occurrence.dueDate)}`,
      occurrence.task.evidenceRequired ? 'Nachweis verpflichtend' : null,
      fuer ? `In Vertretung für ${fuer}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      uid: `occurrence-${occurrence.id}`,
      tag: occurrence.dueDate,
      titel: fuer
        ? `${occurrence.task.title} (Vertretung ${fuer})`
        : occurrence.task.title,
      beschreibung,
      url: `${appUrl}/tasks/${occurrence.task.id}`,
      kategorie: occurrence.task.category.name,
      // Der Vorlauf der Aufgabe ist bereits die abgestimmte Vorwarnzeit;
      // eine zweite Zahl im Kalender wäre eine Quelle für Widersprüche.
      erinnerungTage: occurrence.task.leadTimeDays,
    }
  })

  return {
    name: `Wartungsplaner – ${benutzer.name}`,
    inhalt: baueKalender({
      name: `Wartungsplaner – ${benutzer.name}`,
      beschreibung: 'Offene und überfällige Prüfungen',
      eintraege,
      jetzt,
      domain: 'wartungsplaner',
    }),
  }
}
