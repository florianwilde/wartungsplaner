/**
 * Laden und Speichern der Report-Vorlagen.
 *
 * Ohne eigene Vorlage greift die eingebaute Fassung aus
 * `@/lib/report-vorlagen`. Dadurch bleibt die Anwendung ohne jede
 * Konfiguration vollständig nutzbar.
 */
import {
  eingebauteVorlage,
  normalisiereSpalten,
  saeubereText,
  type Ausrichtung,
  type ReportVorlage,
} from '@/lib/report-vorlagen'
import { prisma } from '@/lib/prisma'
import type { ReportTyp } from '@/server/reports/typen'

type Datensatz = {
  id: string
  name: string
  reportTyp: string
  istStandard: boolean
  ausrichtung: string
  spalten: string[]
  mitDeckblatt: boolean
  deckblattUntertitel: string | null
  einleitung: string | null
  schluss: string | null
  mitUnterschriften: boolean
  unterschriftLinks: string | null
  unterschriftRechts: string | null
}

/** Wandelt einen Datensatz in eine geprüfte Vorlage um. */
function ausDatensatz(datensatz: Datensatz): ReportVorlage {
  const typ = datensatz.reportTyp as ReportTyp
  return {
    id: datensatz.id,
    name: datensatz.name,
    typ,
    istStandard: datensatz.istStandard,
    ausrichtung: (datensatz.ausrichtung === 'quer' ? 'quer' : 'hoch') as Ausrichtung,
    spalten: normalisiereSpalten(typ, datensatz.spalten),
    mitDeckblatt: datensatz.mitDeckblatt,
    deckblattUntertitel: datensatz.deckblattUntertitel,
    einleitung: datensatz.einleitung,
    schluss: datensatz.schluss,
    mitUnterschriften: datensatz.mitUnterschriften,
    unterschriftLinks: datensatz.unterschriftLinks,
    unterschriftRechts: datensatz.unterschriftRechts,
  }
}

/** Alle Vorlagen einer Reportart, Standard zuerst. */
export async function ladeVorlagen(typ: ReportTyp): Promise<ReportVorlage[]> {
  const datensaetze = await prisma.reportTemplate.findMany({
    where: { reportTyp: typ },
    orderBy: [{ istStandard: 'desc' }, { name: 'asc' }],
  })
  return datensaetze.map(ausDatensatz)
}

/** Alle Vorlagen, nach Reportart gruppiert. */
export async function ladeAlleVorlagen(): Promise<
  Record<string, ReportVorlage[]>
> {
  const datensaetze = await prisma.reportTemplate.findMany({
    orderBy: [{ reportTyp: 'asc' }, { istStandard: 'desc' }, { name: 'asc' }],
  })

  const gruppiert: Record<string, ReportVorlage[]> = {}
  for (const datensatz of datensaetze) {
    const vorlage = ausDatensatz(datensatz)
    ;(gruppiert[vorlage.typ] ??= []).push(vorlage)
  }
  return gruppiert
}

/**
 * Ermittelt die zu verwendende Vorlage.
 *
 * Reihenfolge: ausdrücklich gewählte Vorlage, sonst die als Standard
 * gekennzeichnete, sonst die eingebaute.
 */
export async function holeVorlage(
  typ: ReportTyp,
  vorlagenId: string | null,
): Promise<ReportVorlage> {
  if (vorlagenId) {
    const gewaehlt = await prisma.reportTemplate.findFirst({
      where: { id: vorlagenId, reportTyp: typ },
    })
    if (gewaehlt) return ausDatensatz(gewaehlt)
  }

  const standard = await prisma.reportTemplate.findFirst({
    where: { reportTyp: typ, istStandard: true },
  })
  if (standard) return ausDatensatz(standard)

  return eingebauteVorlage(typ)
}

export type VorlagenEingabe = {
  name: string
  typ: ReportTyp
  istStandard: boolean
  ausrichtung: Ausrichtung
  spalten: string[]
  mitDeckblatt: boolean
  deckblattUntertitel: string | null
  einleitung: string | null
  schluss: string | null
  mitUnterschriften: boolean
  unterschriftLinks: string | null
  unterschriftRechts: string | null
}

/** Legt eine Vorlage an oder aktualisiert sie. */
export async function speichereVorlage(
  eingabe: VorlagenEingabe,
  benutzerId: string,
  vorlagenId: string | null,
) {
  const daten = {
    name: eingabe.name,
    reportTyp: eingabe.typ,
    istStandard: eingabe.istStandard,
    ausrichtung: eingabe.ausrichtung,
    spalten: normalisiereSpalten(eingabe.typ, eingabe.spalten),
    mitDeckblatt: eingabe.mitDeckblatt,
    deckblattUntertitel: saeubereText(eingabe.deckblattUntertitel, 120),
    einleitung: saeubereText(eingabe.einleitung),
    schluss: saeubereText(eingabe.schluss),
    mitUnterschriften: eingabe.mitUnterschriften,
    unterschriftLinks: saeubereText(eingabe.unterschriftLinks, 80),
    unterschriftRechts: saeubereText(eingabe.unterschriftRechts, 80),
    updatedById: benutzerId,
  }

  return prisma.$transaction(async (tx) => {
    const gespeichert = vorlagenId
      ? await tx.reportTemplate.update({ where: { id: vorlagenId }, data: daten })
      : await tx.reportTemplate.create({ data: daten })

    // Je Reportart darf es nur einen Standard geben.
    if (gespeichert.istStandard) {
      await tx.reportTemplate.updateMany({
        where: { reportTyp: eingabe.typ, id: { not: gespeichert.id } },
        data: { istStandard: false },
      })
    }

    return gespeichert
  })
}
