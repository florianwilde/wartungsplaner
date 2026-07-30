/**
 * Benachrichtigungen rund um die Gegenzeichnung.
 *
 * Anders als die täglichen Sammelnachrichten gehen zwei davon sofort hinaus:
 * Ein vorgelegter Prüfbogen und eine Zurückweisung sind Ereignisse, auf die
 * jemand reagieren soll. Käme die Nachricht erst mit dem nächsten Tageslauf,
 * bliebe der Vorgang bis dahin unbemerkt liegen – genau das soll das
 * Vier-Augen-Prinzip verhindern.
 *
 * Der Versand darf den Vorgang nie zum Scheitern bringen: Ein nicht
 * erreichbarer Mailserver ist kein Grund, eine Gegenzeichnung abzulehnen.
 * Fehler werden deshalb protokolliert, nicht weitergereicht.
 */
import { differenceInDays, todayInBerlin } from '@/lib/dates'
import {
  auffaelligePunkte,
  type Antwort,
  type Pruefpunkt,
  type PruefpunktErgebnis,
} from '@/lib/nachweise'
import {
  baueGegenzeichnungsMail,
  baueZurueckweisungsMail,
  type GegenzeichnungsEintrag,
  type MailRahmen,
} from '@/lib/mail-vorlagen'
import { prisma } from '@/lib/prisma'
import { loeseVertretung } from '@/lib/vertretung'
import { holeBranding } from '@/server/branding'
import { ladeVertretungsKarte } from '@/server/vertretung'
import { holeBenachrichtigungsEinstellungen } from '@/server/benachrichtigungs-einstellungen'
import { istMailVersandKonfiguriert, versendeMail } from '@/server/mailer'
import { schreibeAuditLeise } from '@/lib/audit'

/** Basisadresse der Anwendung für Verweise in den Nachrichten. */
function appUrl(): string {
  return (process.env.APP_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')
}

async function rahmenBauen(heute: Date): Promise<MailRahmen> {
  const branding = await holeBranding()
  return {
    anwendung: branding.appName,
    organisation: branding.organisation,
    markenfarbe: branding.primaryColor,
    appUrl: appUrl(),
    stichtag: heute,
  }
}

/** Ist der Versand überhaupt eingeschaltet? */
async function versandMoeglich(): Promise<boolean> {
  if (!istMailVersandKonfiguriert()) return false
  const einstellungen = await holeBenachrichtigungsEinstellungen()
  return einstellungen.enabled && einstellungen.gegenzeichnungAktiv
}

/**
 * Wer darf gegenzeichnen und soll gefragt werden?
 *
 * Zuerst die verantwortliche Person der Aufgabe – sie kennt den Vorgang. Ist
 * sie selbst die erfassende, geht die Bitte an alle übrigen Personen mit
 * Ausführungsrecht. Eine Rundmail an alle wäre der schnellere Weg, würde aber
 * dazu führen, dass sich niemand zuständig fühlt.
 */
async function empfaenger(
  erfasstById: string,
  ownerId: string,
): Promise<{ id: string; name: string; email: string }[]> {
  if (ownerId !== erfasstById) {
    // Ist die zuständige Person abwesend, bittet die Vertretung um die
    // Gegenzeichnung – sonst läge der Bogen bis zur Rückkehr.
    const karte = await ladeVertretungsKarte()
    const { empfaengerId } = loeseVertretung(ownerId, karte, todayInBerlin())

    // Wer den Bogen erfasst hat, darf ihn nicht gegenzeichnen. Führt die
    // Vertretung dorthin, bleibt es beim Weg über alle Übrigen.
    if (empfaengerId !== erfasstById) {
      const person = await prisma.user.findFirst({
        where: { id: empfaengerId, active: true, notifyByEmail: true },
        select: { id: true, name: true, email: true },
      })
      if (person) return [person]
    }
  }

  return prisma.user.findMany({
    where: {
      active: true,
      notifyByEmail: true,
      role: { in: ['ADMIN', 'EDITOR'] },
      id: { not: erfasstById },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  })
}

/** Anzahl der Prüfpunkte mit Befund. */
function zaehleFeststellungen(nachweis: {
  vorlage: { punkte: { id: string; position: number; frage: string; art: string; pflicht: boolean }[] }
  antworten: { punktId: string; ergebnis: string | null; wert: string | null }[]
}): number {
  const punkte: Pruefpunkt[] = nachweis.vorlage.punkte.map((p) => ({
    id: p.id,
    position: p.position,
    frage: p.frage,
    art: p.art as Pruefpunkt['art'],
    pflicht: p.pflicht,
  }))
  const antworten: Antwort[] = nachweis.antworten.map((a) => ({
    punktId: a.punktId,
    ergebnis: (a.ergebnis as PruefpunktErgebnis | null) ?? null,
    wert: a.wert,
  }))
  return auffaelligePunkte(punkte, antworten).length
}

/** Bittet um Gegenzeichnung, sobald ein Nachweis vorgelegt wurde. */
export async function meldeVorlage(nachweisId: string): Promise<void> {
  try {
    if (!(await versandMoeglich())) return

    const nachweis = await ladeFuerMail(nachweisId)
    if (!nachweis || nachweis.status !== 'VORGELEGT') return

    const heute = todayInBerlin()
    const rahmen = await rahmenBauen(heute)
    const eintrag: GegenzeichnungsEintrag = {
      pruefbogen: nachweis.vorlage.name,
      aufgabe: nachweis.occurrence.task.title,
      erfasstVon: nachweis.erfasstBy.name,
      vorgelegtAm: nachweis.vorgelegtAm ?? new Date(),
      feststellungen: zaehleFeststellungen(nachweis),
      url: `${rahmen.appUrl}/nachweise/${nachweis.id}`,
      ueberfaellig: false,
    }

    const personen = await empfaenger(
      nachweis.erfasstById,
      nachweis.occurrence.task.ownerId,
    )

    for (const person of personen) {
      const schluessel = `nachweis:${nachweis.id}:gegenzeichnung:${person.id}`
      const schonGemeldet = await prisma.sentNotification.findFirst({
        where: { kind: 'GEGENZEICHNUNG', key: schluessel },
        select: { id: true },
      })
      if (schonGemeldet) continue

      const mail = baueGegenzeichnungsMail(rahmen, person.name, [eintrag])
      const ergebnis = await versendeMail(person.email, mail)
      if (!ergebnis.erfolg) continue

      await prisma.sentNotification.create({
        data: {
          kind: 'GEGENZEICHNUNG',
          key: schluessel,
          recipient: person.email,
          subject: mail.betreff,
          itemCount: 1,
        },
      })
    }

    await schreibeAuditLeise({
      userId: null,
      action: 'NOTIFICATION_SENT',
      entityType: 'Notification',
      entityId: 'GEGENZEICHNUNG',
      payload: { nachweis: nachweis.vorlage.name, empfaenger: personen.length },
    })
  } catch (error) {
    console.error('Bitte um Gegenzeichnung konnte nicht versendet werden:', error)
  }
}

/** Meldet der erfassenden Person, dass ihr Nachweis zurückgewiesen wurde. */
export async function meldeZurueckweisung(
  nachweisId: string,
  begruendung: string,
): Promise<void> {
  try {
    if (!(await versandMoeglich())) return

    const nachweis = await ladeFuerMail(nachweisId)
    if (!nachweis) return

    const erfasser = await prisma.user.findFirst({
      where: { id: nachweis.erfasstById, active: true, notifyByEmail: true },
      select: { name: true, email: true },
    })
    if (!erfasser) return

    const rahmen = await rahmenBauen(todayInBerlin())
    const mail = baueZurueckweisungsMail(rahmen, erfasser.name, {
      pruefbogen: nachweis.vorlage.name,
      aufgabe: nachweis.occurrence.task.title,
      geprueftVon: nachweis.geprueftBy?.name ?? 'der prüfenden Person',
      begruendung,
      url: `${rahmen.appUrl}/nachweise/${nachweis.id}`,
    })

    const ergebnis = await versendeMail(erfasser.email, mail)
    if (!ergebnis.erfolg) return

    await prisma.sentNotification.create({
      data: {
        kind: 'ZURUECKWEISUNG',
        // Eine erneute Zurückweisung desselben Bogens ist ein neuer Vorgang und
        // soll wieder gemeldet werden – daher der Zeitpunkt im Schlüssel.
        key: `nachweis:${nachweis.id}:zurueckgewiesen:${Date.now()}`,
        recipient: erfasser.email,
        subject: mail.betreff,
        itemCount: 1,
      },
    })
  } catch (error) {
    console.error('Meldung der Zurückweisung konnte nicht versendet werden:', error)
  }
}

/**
 * Erinnert an Nachweise, die schon eine Weile auf ihre Gegenzeichnung warten.
 *
 * Läuft im Tageslauf mit den übrigen Benachrichtigungen. Die erste Bitte ging
 * bereits beim Vorlegen hinaus; hier geht es um die, die liegen geblieben sind.
 */
export async function versendeGegenzeichnungsErinnerungen(
  rahmen: MailRahmen,
  heute: Date = todayInBerlin(),
): Promise<{ versendet: number; fehlgeschlagen: number; empfaenger: string[] }> {
  const ergebnis = { versendet: 0, fehlgeschlagen: 0, empfaenger: [] as string[] }

  const einstellungen = await holeBenachrichtigungsEinstellungen()
  if (!einstellungen.gegenzeichnungAktiv) return ergebnis

  const offene = await prisma.nachweis.findMany({
    where: { status: 'VORGELEGT' },
    include: {
      vorlage: { include: { punkte: true } },
      antworten: true,
      erfasstBy: { select: { name: true } },
      occurrence: {
        select: { task: { select: { title: true, ownerId: true } } },
      },
    },
  })

  // Nur die, die länger warten als vereinbart.
  const wartende = offene.filter((n) => {
    if (!n.vorgelegtAm) return false
    const tage = differenceInDays(n.vorgelegtAm, heute)
    return tage >= einstellungen.gegenzeichnungAbTagen
  })
  if (wartende.length === 0) return ergebnis

  // Je Empfänger eine Sammelnachricht, nicht eine je Nachweis.
  const proPerson = new Map<
    string,
    { name: string; email: string; eintraege: GegenzeichnungsEintrag[]; schluessel: string[] }
  >()

  for (const nachweis of wartende) {
    const personen = await empfaenger(
      nachweis.erfasstById,
      nachweis.occurrence.task.ownerId,
    )
    const eintrag: GegenzeichnungsEintrag = {
      pruefbogen: nachweis.vorlage.name,
      aufgabe: nachweis.occurrence.task.title,
      erfasstVon: nachweis.erfasstBy.name,
      vorgelegtAm: nachweis.vorgelegtAm!,
      feststellungen: zaehleFeststellungen(nachweis),
      url: `${rahmen.appUrl}/nachweise/${nachweis.id}`,
      ueberfaellig: true,
    }

    // Wöchentlich erneut erinnern, damit ein Vorgang nicht in Vergessenheit
    // gerät, die Erinnerung aber nicht täglich eintrifft.
    const stufe = Math.floor(
      differenceInDays(nachweis.vorgelegtAm!, heute) / 7,
    )

    for (const person of personen) {
      const schluessel = `nachweis:${nachweis.id}:wartet:${person.id}:${stufe}`
      const schonGemeldet = await prisma.sentNotification.findFirst({
        where: { kind: 'GEGENZEICHNUNG', key: schluessel },
        select: { id: true },
      })
      if (schonGemeldet) continue

      const bestand = proPerson.get(person.id) ?? {
        name: person.name,
        email: person.email,
        eintraege: [],
        schluessel: [],
      }
      bestand.eintraege.push(eintrag)
      bestand.schluessel.push(schluessel)
      proPerson.set(person.id, bestand)
    }
  }

  for (const person of proPerson.values()) {
    const mail = baueGegenzeichnungsMail(rahmen, person.name, person.eintraege)
    const versand = await versendeMail(person.email, mail)
    if (!versand.erfolg) {
      ergebnis.fehlgeschlagen++
      continue
    }

    await prisma.sentNotification.createMany({
      data: person.schluessel.map((key) => ({
        kind: 'GEGENZEICHNUNG' as const,
        key,
        recipient: person.email,
        subject: mail.betreff,
        itemCount: person.schluessel.length,
      })),
      skipDuplicates: true,
    })

    ergebnis.versendet++
    ergebnis.empfaenger.push(person.email)
  }

  return ergebnis
}

function ladeFuerMail(nachweisId: string) {
  return prisma.nachweis.findUnique({
    where: { id: nachweisId },
    include: {
      vorlage: { include: { punkte: true } },
      antworten: true,
      erfasstBy: { select: { name: true } },
      geprueftBy: { select: { name: true } },
      occurrence: {
        select: { task: { select: { title: true, ownerId: true } } },
      },
    },
  })
}
