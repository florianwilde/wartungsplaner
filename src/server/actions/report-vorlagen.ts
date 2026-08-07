'use server'

import { revalidatePath } from 'next/cache'

import { schreibeAudit } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { canAdminister } from '@/lib/rbac'
import {
  normalisiereSpalten,
  pruefeVorlagenName,
  type Ausrichtung,
} from '@/lib/report-vorlagen'
import { benutzerFuerAktion } from '@/lib/session'
import { speichereVorlage } from '@/server/report-vorlagen'
import { fehlerbehandlung } from '@/lib/fehler'
import { REPORT_TYPEN, type ReportTyp } from '@/server/reports/typen'

const fehlertext = fehlerbehandlung('Unerwarteter Fehler bei den Report-Vorlagen')

export type VorlagenStatus = { fehler?: string; erfolg?: string }

/** Legt eine Vorlage an oder speichert Änderungen. */
export async function vorlageSpeichern(
  vorlagenId: string | null,
  _status: VorlagenStatus,
  formData: FormData,
): Promise<VorlagenStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const typ = String(formData.get('typ') ?? '') as ReportTyp
    if (!REPORT_TYPEN.includes(typ)) {
      return { fehler: 'Bitte eine gültige Reportart wählen.' }
    }

    const name = pruefeVorlagenName(String(formData.get('name') ?? ''))
    if (!name) {
      return { fehler: 'Der Name muss mindestens 3 Zeichen haben.' }
    }

    const namensKonflikt = await prisma.reportTemplate.findFirst({
      where: {
        reportTyp: typ,
        name,
        ...(vorlagenId ? { id: { not: vorlagenId } } : {}),
      },
      select: { id: true },
    })
    if (namensKonflikt) {
      return {
        fehler: `Für diese Reportart gibt es bereits eine Vorlage namens „${name}“.`,
      }
    }

    const spalten = normalisiereSpalten(typ, formData.getAll('spalten').map(String))

    const gespeichert = await speichereVorlage(
      {
        name,
        typ,
        istStandard: formData.get('istStandard') === 'on',
        ausrichtung: (formData.get('ausrichtung') === 'quer'
          ? 'quer'
          : 'hoch') as Ausrichtung,
        spalten,
        mitDeckblatt: formData.get('mitDeckblatt') === 'on',
        deckblattUntertitel: String(formData.get('deckblattUntertitel') ?? ''),
        einleitung: String(formData.get('einleitung') ?? ''),
        schluss: String(formData.get('schluss') ?? ''),
        mitUnterschriften: formData.get('mitUnterschriften') === 'on',
        unterschriftLinks: String(formData.get('unterschriftLinks') ?? ''),
        unterschriftRechts: String(formData.get('unterschriftRechts') ?? ''),
      },
      admin.id,
      vorlagenId,
    )

    await schreibeAudit({
      userId: admin.id,
      action: vorlagenId ? 'REPORT_VORLAGE_GEAENDERT' : 'REPORT_VORLAGE_ANGELEGT',
      entityType: 'ReportTemplate',
      entityId: gespeichert.id,
      payload: {
        name: gespeichert.name,
        reportTyp: typ,
        standard: gespeichert.istStandard,
        spalten: spalten.length,
      },
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/report-vorlagen')
  revalidatePath('/reports')
  return { erfolg: 'Die Vorlage wurde gespeichert.' }
}

/** Löscht eine Vorlage. */
export async function vorlageLoeschen(vorlagenId: string): Promise<VorlagenStatus> {
  try {
    const admin = await benutzerFuerAktion(canAdminister)

    const vorlage = await prisma.reportTemplate.findUnique({
      where: { id: vorlagenId },
      select: { id: true, name: true, reportTyp: true },
    })
    if (!vorlage) return { fehler: 'Die Vorlage wurde nicht gefunden.' }

    await prisma.$transaction(async (tx) => {
      await tx.reportTemplate.delete({ where: { id: vorlagenId } })
      await schreibeAudit(
        {
          userId: admin.id,
          action: 'REPORT_VORLAGE_GELOESCHT',
          entityType: 'ReportTemplate',
          entityId: vorlagenId,
          payload: { name: vorlage.name, reportTyp: vorlage.reportTyp },
        },
        tx,
      )
    })
  } catch (error) {
    return { fehler: fehlertext(error) }
  }

  revalidatePath('/admin/report-vorlagen')
  revalidatePath('/reports')
  return { erfolg: 'Die Vorlage wurde gelöscht.' }
}
