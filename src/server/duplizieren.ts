/**
 * Aufgaben duplizieren – Datenbankteil.
 *
 * Die Regeln zu Titeln und Namen liegen in `@/lib/duplizieren`. Hier steht,
 * was tatsächlich kopiert wird.
 *
 * Bewusst ohne `import 'server-only'`, damit der Integrationstest das Modul
 * unmittelbar aufrufen kann.
 */
import { schreibeAudit } from '@/lib/audit'
import { eindeutigerName, nameFuerBogenKopie } from '@/lib/duplizieren'
import { prisma } from '@/lib/prisma'
import { erzeugeErsteFaelligkeit } from '@/server/faelligkeiten'

/** Fachlicher Fehler; der Text erscheint unverändert in der Oberfläche. */
export class DuplizierFehler extends Error {
  constructor(nachricht: string) {
    super(nachricht)
    this.name = 'DuplizierFehler'
  }
}

export type DuplizierEingabe = {
  /** Ein Titel je neuer Aufgabe; bereits geprüft und entdoppelt. */
  titel: string[]
  startDate: Date
  /** Fest zugeordnete Prüfbögen mitkopieren? */
  mitBoegen: boolean
  aktiv: boolean
}

export type DuplizierErgebnis = {
  ids: string[]
  /** Wie viele Prüfbogen-Vorlagen dabei entstanden sind. */
  boegen: number
}

/**
 * Legt aus einer Aufgabe eine oder mehrere neue an.
 *
 * Übernommen wird alles außer der Vergangenheit: Fälligkeiten,
 * Durchführungen und Nachweise der Vorlage bleiben, wo sie sind. Eine Kopie
 * beginnt bei null – sonst stünde eine erfundene Historie in den Berichten.
 */
export async function dupliziereAufgabe(
  taskId: string,
  eingabe: DuplizierEingabe,
  benutzerId: string,
): Promise<DuplizierErgebnis> {
  const quelle = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      auditReferenzen: { select: { referenzId: true } },
      pruefboegen: { include: { punkte: { orderBy: { position: 'asc' } } } },
    },
  })
  if (!quelle) throw new DuplizierFehler('Die Aufgabe wurde nicht gefunden.')

  const besitzer = await prisma.user.findUnique({
    where: { id: quelle.ownerId },
    select: { active: true, name: true },
  })
  if (!besitzer?.active) {
    throw new DuplizierFehler(
      `Die verantwortliche Person der Vorlage (${besitzer?.name ?? 'unbekannt'}) ist deaktiviert. Bitte zuerst die Aufgabe umhängen.`,
    )
  }

  // Der Titel einer Aufgabe darf mehrfach vorkommen, der Name eines
  // Prüfbogens nicht – die vergebenen Namen also vorher einsammeln.
  const vergebeneNamen = eingabe.mitBoegen
    ? new Set(
        (await prisma.pruefbogenVorlage.findMany({ select: { name: true } })).map(
          (vorlage) => vorlage.name,
        ),
      )
    : new Set<string>()

  const ids: string[] = []
  let boegen = 0

  await prisma.$transaction(async (tx) => {
    for (const titel of eingabe.titel) {
      const erstellt = await tx.task.create({
        data: {
          title: titel,
          description: quelle.description,
          instructionsMd: quelle.instructionsMd,
          categoryId: quelle.categoryId,
          ownerId: quelle.ownerId,
          intervalType: quelle.intervalType,
          intervalValue: quelle.intervalValue,
          scheduleMode: quelle.scheduleMode,
          startDate: eingabe.startDate,
          leadTimeDays: quelle.leadTimeDays,
          graceDays: quelle.graceDays,
          evidenceRequired: quelle.evidenceRequired,
          criticality: quelle.criticality,
          active: eingabe.aktiv,
          auditReferenzen: {
            create: quelle.auditReferenzen.map((zuordnung) => ({
              referenzId: zuordnung.referenzId,
            })),
          },
        },
      })

      if (eingabe.mitBoegen) {
        for (const bogen of quelle.pruefboegen) {
          const name = eindeutigerName(
            nameFuerBogenKopie(bogen.name, titel),
            vergebeneNamen,
          )
          vergebeneNamen.add(name)

          await tx.pruefbogenVorlage.create({
            data: {
              name,
              beschreibung: bogen.beschreibung,
              taskId: erstellt.id,
              vierAugen: bogen.vierAugen,
              aktiv: bogen.aktiv,
              updatedById: benutzerId,
              punkte: {
                create: bogen.punkte.map((punkt) => ({
                  position: punkt.position,
                  frage: punkt.frage,
                  hinweis: punkt.hinweis,
                  art: punkt.art,
                  pflicht: punkt.pflicht,
                })),
              },
            },
          })
          boegen++
        }
      }

      await schreibeAudit(
        {
          userId: benutzerId,
          action: 'TASK_CREATED',
          entityType: 'Task',
          entityId: erstellt.id,
          payload: {
            titel: erstellt.title,
            intervall: erstellt.intervalType,
            planungsmodus: erstellt.scheduleMode,
            aktiv: erstellt.active,
            dupliziertVon: quelle.title,
            mitPruefboegen: eingabe.mitBoegen ? quelle.pruefboegen.length : 0,
          },
        },
        tx,
      )

      if (erstellt.active) {
        await erzeugeErsteFaelligkeit(
          tx,
          erstellt.id,
          eingabe.startDate,
          benutzerId,
        )
      }

      ids.push(erstellt.id)
    }
  })

  return { ids, boegen }
}
