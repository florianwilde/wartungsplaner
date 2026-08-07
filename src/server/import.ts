/**
 * Einspielen geprüfter Importdaten.
 *
 * Grundsätze:
 *  - Es wird ausschließlich geschrieben, was die Prüfung (`@/lib/import-export`)
 *    zuvor freigegeben hat. Die Prüfung läuft vor dem Schreiben erneut, damit
 *    zwischen Vorschau und Bestätigung keine Lücke entsteht.
 *  - Alles geschieht in einer Transaktion: entweder vollständig oder gar nicht.
 *  - Jeder Lauf erzeugt Audit-Einträge.
 *  - Bestehende Aufgaben werden aktualisiert, ihre Fälligkeiten und
 *    Durchführungen bleiben unangetastet.
 */
import type { Prisma } from '@prisma/client'

import { schreibeAudit } from '@/lib/audit'
import { parseISODate } from '@/lib/dates'
import type {
  AufgabeDaten,
  BenutzerDaten,
  ImportVorschau,
  KategorieDaten,
  PruefbogenDaten,
  ReferenzDaten,
} from '@/lib/import-export'
import { prisma } from '@/lib/prisma'
import { erzeugeErsteFaelligkeit } from '@/server/faelligkeiten'

export type ImportErgebnis = {
  angelegt: number
  aktualisiert: number
  uebersprungen: number
}

// ---------------------------------------------------------------------------
// Kategorien
// ---------------------------------------------------------------------------

export async function schreibeKategorien(
  vorschau: ImportVorschau<KategorieDaten>,
  benutzerId: string,
): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { angelegt: 0, aktualisiert: 0, uebersprungen: 0 }

  await prisma.$transaction(async (tx) => {
    for (const eintrag of vorschau.eintraege) {
      if (eintrag.vorgang === 'unveraendert') {
        ergebnis.uebersprungen++
        continue
      }

      const vorhanden = await tx.category.findFirst({
        where: { name: { equals: eintrag.daten.name, mode: 'insensitive' } },
        select: { id: true },
      })

      if (vorhanden) {
        await tx.category.update({ where: { id: vorhanden.id }, data: eintrag.daten })
        ergebnis.aktualisiert++
      } else {
        await tx.category.create({ data: eintrag.daten })
        ergebnis.angelegt++
      }
    }

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'IMPORT_AUSGEFUEHRT',
        entityType: 'Category',
        entityId: null,
        payload: { bereich: 'Kategorien', ...ergebnis },
      },
      tx,
    )
  })

  return ergebnis
}

// ---------------------------------------------------------------------------
// Benutzer
// ---------------------------------------------------------------------------

export async function schreibeBenutzer(
  vorschau: ImportVorschau<BenutzerDaten>,
  benutzerId: string,
): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { angelegt: 0, aktualisiert: 0, uebersprungen: 0 }

  await prisma.$transaction(async (tx) => {
    for (const eintrag of vorschau.eintraege) {
      if (eintrag.vorgang === 'unveraendert') {
        ergebnis.uebersprungen++
        continue
      }

      const daten = eintrag.daten
      const vorhanden = await tx.user.findUnique({
        where: { email: daten.email },
        select: { id: true },
      })

      if (vorhanden) {
        // Anmeldeverfahren und Passwort bleiben bewusst unangetastet.
        await tx.user.update({
          where: { id: vorhanden.id },
          data: {
            name: daten.name,
            role: daten.role as Prisma.UserUpdateInput['role'],
            active: daten.active,
            notifyByEmail: daten.notifyByEmail,
          },
        })
        ergebnis.aktualisiert++
      } else {
        // Neue Konten entstehen ohne Passwort. Für lokale Konten vergibt die
        // Administration anschließend ein Startpasswort; SSO-Konten brauchen
        // keines.
        await tx.user.create({
          data: {
            name: daten.name,
            email: daten.email,
            role: daten.role as Prisma.UserCreateInput['role'],
            authProvider: daten.authProvider as Prisma.UserCreateInput['authProvider'],
            active: daten.active,
            notifyByEmail: daten.notifyByEmail,
            passwordHash: null,
            mustChangePassword: false,
          },
        })
        ergebnis.angelegt++
      }
    }

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'IMPORT_AUSGEFUEHRT',
        entityType: 'User',
        entityId: null,
        payload: {
          bereich: 'Benutzer',
          ...ergebnis,
          hinweis: 'Neue lokale Konten haben noch kein Passwort',
        },
      },
      tx,
    )
  })

  return ergebnis
}

// ---------------------------------------------------------------------------
// Aufgaben
// ---------------------------------------------------------------------------

export async function schreibeAufgaben(
  vorschau: ImportVorschau<AufgabeDaten>,
  benutzerId: string,
): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { angelegt: 0, aktualisiert: 0, uebersprungen: 0 }

  // Zuordnung der fachlichen Schlüssel auf die technischen IDs.
  const [kategorien, benutzer] = await Promise.all([
    prisma.category.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({ select: { id: true, email: true } }),
  ])
  const kategorieId = new Map(kategorien.map((k) => [k.name.toLowerCase(), k.id]))
  const benutzerIdNachEmail = new Map(
    benutzer.map((b) => [b.email.toLowerCase(), b.id]),
  )

  await prisma.$transaction(async (tx) => {
    for (const eintrag of vorschau.eintraege) {
      if (eintrag.vorgang === 'unveraendert') {
        ergebnis.uebersprungen++
        continue
      }

      const daten = eintrag.daten
      const categoryId = kategorieId.get(daten.kategorieName.toLowerCase())
      const ownerId = benutzerIdNachEmail.get(daten.verantwortlichEmail.toLowerCase())

      // Kann nach der Prüfung nur eintreten, wenn parallel etwas gelöscht
      // wurde – dann bricht die Transaktion ab, statt halb zu schreiben.
      if (!categoryId || !ownerId) {
        throw new Error(
          `Für „${daten.title}“ fehlt inzwischen die Kategorie oder die verantwortliche Person.`,
        )
      }

      const gemeinsam = {
        title: daten.title,
        description: daten.description,
        instructionsMd: daten.instructionsMd,
        categoryId,
        ownerId,
        intervalType: daten.intervalType as Prisma.TaskCreateInput['intervalType'],
        intervalValue: daten.intervalValue,
        scheduleMode: daten.scheduleMode as Prisma.TaskCreateInput['scheduleMode'],
        startDate: parseISODate(daten.startDate),
        leadTimeDays: daten.leadTimeDays,
        graceDays: daten.graceDays,
        evidenceRequired: daten.evidenceRequired,
        criticality: daten.criticality as Prisma.TaskCreateInput['criticality'],
        active: daten.active,
      }

      const vorhanden = await tx.task.findFirst({
        where: { title: { equals: daten.title, mode: 'insensitive' } },
        select: { id: true, active: true },
      })

      const referenzIds = await loeseReferenzenAuf(tx, daten.auditReferenzen)

      if (vorhanden) {
        await tx.task.update({
          where: { id: vorhanden.id },
          data: {
            ...gemeinsam,
            // Die Datei gibt den vollständigen Stand vor.
            auditReferenzen: {
              deleteMany: {},
              create: referenzIds.map((referenzId) => ({ referenzId })),
            },
          },
        })

        // Wird eine zuvor deaktivierte Aufgabe wieder aktiviert und hat keine
        // unerledigte Fälligkeit, entsteht sofort wieder eine.
        if (!vorhanden.active && gemeinsam.active) {
          const offene = await tx.occurrence.count({
            where: {
              taskId: vorhanden.id,
              status: { in: ['OPEN', 'OVERDUE', 'SUSPENDED'] },
            },
          })
          if (offene === 0) {
            await erzeugeErsteFaelligkeit(
              tx,
              vorhanden.id,
              gemeinsam.startDate,
              benutzerId,
            )
          }
        }

        ergebnis.aktualisiert++
      } else {
        const neu = await tx.task.create({
          data: {
            ...gemeinsam,
            auditReferenzen: {
              create: referenzIds.map((referenzId) => ({ referenzId })),
            },
          },
        })
        if (neu.active) {
          await erzeugeErsteFaelligkeit(tx, neu.id, gemeinsam.startDate, benutzerId)
        }
        ergebnis.angelegt++
      }
    }

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'IMPORT_AUSGEFUEHRT',
        entityType: 'Task',
        entityId: null,
        payload: { bereich: 'Aufgaben', ...ergebnis },
      },
      tx,
    )
  })

  return ergebnis
}

/**
 * Löst die Anzeigenamen aus der Datei in Audit-Referenzen auf.
 *
 * Unbekannte Referenzen werden angelegt statt abgewiesen: Ein Import soll
 * einen Bestand aus einer anderen Installation übernehmen können, ohne dass
 * vorher jede Anforderung von Hand nachgepflegt werden muss. Die Aufteilung
 * in Rahmenwerk und Kurzzeichen folgt dem Anzeigenamen; steht dort nur ein
 * Kurzzeichen, bleibt das Rahmenwerk leer und lässt sich nachtragen.
 */
async function loeseReferenzenAuf(
  tx: Prisma.TransactionClient,
  liste: string,
): Promise<string[]> {
  const namen = [
    ...new Set(
      liste
        .split(',')
        .map((eintrag) => eintrag.trim())
        .filter(Boolean),
    ),
  ]
  if (namen.length === 0) return []

  const ids: string[] = []
  for (const name of namen) {
    const { rahmenwerk, kuerzel } = zerlegeAnzeigenamen(name)

    const vorhanden = await tx.auditReferenz.findFirst({
      where: { rahmenwerk, kuerzel },
      select: { id: true },
    })
    if (vorhanden) {
      ids.push(vorhanden.id)
      continue
    }

    const erstellt = await tx.auditReferenz.create({
      data: { rahmenwerk, kuerzel, bezeichnung: kuerzel },
      select: { id: true },
    })
    ids.push(erstellt.id)
  }
  return ids
}

/**
 * Trennt „ISO 27001 A.8.13“ in Rahmenwerk und Kurzzeichen.
 *
 * Der letzte Bestandteil gilt als Kurzzeichen – das trifft die gängige
 * Schreibweise. Steht dort nur ein Wort, gibt es kein Rahmenwerk.
 */
function zerlegeAnzeigenamen(name: string): {
  rahmenwerk: string | null
  kuerzel: string
} {
  const teile = name.split(/\s+/).filter(Boolean)
  if (teile.length < 2) return { rahmenwerk: null, kuerzel: name }
  return {
    rahmenwerk: teile.slice(0, -1).join(' '),
    kuerzel: teile.at(-1)!,
  }
}

// ---------------------------------------------------------------------------
// Audit-Referenzen
// ---------------------------------------------------------------------------

/**
 * Spielt Audit-Referenzen ein.
 *
 * Zugeordnet wird über Rahmenwerk und Kurzzeichen zusammen – dieselbe
 * Kennung kann in zwei Rahmenwerken Verschiedenes bedeuten.
 *
 * Zuordnungen zu Aufgaben bleiben unangetastet: Der Import pflegt die
 * Stammdaten, nicht die Zuweisung.
 */
export async function schreibeAuditReferenzen(
  vorschau: ImportVorschau<ReferenzDaten>,
  benutzerId: string,
): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { angelegt: 0, aktualisiert: 0, uebersprungen: 0 }

  await prisma.$transaction(async (tx) => {
    for (const eintrag of vorschau.eintraege) {
      if (eintrag.vorgang === 'unveraendert') {
        ergebnis.uebersprungen++
        continue
      }

      const { kuerzel, rahmenwerk } = eintrag.daten
      const vorhanden = await tx.auditReferenz.findFirst({
        where: {
          kuerzel: { equals: kuerzel, mode: 'insensitive' },
          rahmenwerk:
            rahmenwerk === null ? null : { equals: rahmenwerk, mode: 'insensitive' },
        },
        select: { id: true },
      })

      if (vorhanden) {
        await tx.auditReferenz.update({
          where: { id: vorhanden.id },
          data: eintrag.daten,
        })
        ergebnis.aktualisiert++
      } else {
        await tx.auditReferenz.create({ data: eintrag.daten })
        ergebnis.angelegt++
      }
    }

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'IMPORT_AUSGEFUEHRT',
        entityType: 'AuditReferenz',
        entityId: null,
        payload: { bereich: 'Audit-Referenzen', ...ergebnis },
      },
      tx,
    )
  })

  return ergebnis
}

// ---------------------------------------------------------------------------
// Prüfbögen
// ---------------------------------------------------------------------------

/**
 * Spielt Prüfbögen samt ihrer Prüfpunkte ein.
 *
 * **Die Prüfpunkte eines bereits benutzten Bogens werden nie ersetzt.** An
 * ihnen hängen Antworten, Belege und Abweichungen geführter Nachweise; ein
 * Austausch würde diese Datensätze über die Fremdschlüssel mitlöschen und
 * damit einen abgeschlossenen Nachweis nachträglich verändern. Die Prüfung
 * in `@/lib/import-export` lehnt solche Dateien deshalb schon vorher ab –
 * hier steht die zweite Absicherung, falls sich zwischen Vorschau und
 * Bestätigung etwas geändert hat.
 */
export async function schreibePruefboegen(
  vorschau: ImportVorschau<PruefbogenDaten>,
  benutzerId: string,
): Promise<ImportErgebnis> {
  const ergebnis: ImportErgebnis = { angelegt: 0, aktualisiert: 0, uebersprungen: 0 }

  await prisma.$transaction(async (tx) => {
    for (const eintrag of vorschau.eintraege) {
      if (eintrag.vorgang === 'unveraendert') {
        ergebnis.uebersprungen++
        continue
      }

      const { name, beschreibung, aufgabe, vierAugen, aktiv, punkte } = eintrag.daten

      let taskId: string | null = null
      if (aufgabe) {
        const gefunden = await tx.task.findFirst({
          where: { title: { equals: aufgabe, mode: 'insensitive' } },
          select: { id: true },
        })
        if (!gefunden) {
          throw new Error(
            `Die Aufgabe „${aufgabe}" gibt es nicht mehr. Bitte die Vorschau erneut erzeugen.`,
          )
        }
        taskId = gefunden.id
      }

      const vorhanden = await tx.pruefbogenVorlage.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { id: true, _count: { select: { nachweise: true } } },
      })

      if (!vorhanden) {
        await tx.pruefbogenVorlage.create({
          data: {
            name,
            beschreibung,
            taskId,
            vierAugen,
            aktiv,
            updatedById: benutzerId,
            punkte: { create: punkte },
          },
        })
        ergebnis.angelegt++
        continue
      }

      await tx.pruefbogenVorlage.update({
        where: { id: vorhanden.id },
        data: { name, beschreibung, taskId, vierAugen, aktiv, updatedById: benutzerId },
      })

      // Nur wenn noch nie mit dem Bogen geprüft wurde, dürfen die
      // Prüfpunkte neu geschrieben werden.
      if (vorhanden._count.nachweise === 0) {
        await tx.pruefbogenPunkt.deleteMany({ where: { vorlageId: vorhanden.id } })
        await tx.pruefbogenPunkt.createMany({
          data: punkte.map((punkt) => ({ ...punkt, vorlageId: vorhanden.id })),
        })
      }

      ergebnis.aktualisiert++
    }

    await schreibeAudit(
      {
        userId: benutzerId,
        action: 'IMPORT_AUSGEFUEHRT',
        entityType: 'PruefbogenVorlage',
        entityId: null,
        payload: { bereich: 'Prüfbögen', ...ergebnis },
      },
      tx,
    )
  })

  return ergebnis
}
