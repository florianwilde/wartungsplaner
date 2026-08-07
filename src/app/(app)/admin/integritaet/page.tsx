import type { Metadata } from 'next'
import { AlertTriangle, CheckCircle2, FileQuestion } from 'lucide-react'

import { SeitenKopf } from '@/components/seiten-kopf'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { formatDateTime } from '@/lib/dates'
import {
  BEFUND_BEZEICHNUNG,
  istUnversehrt,
  schwerwiegendeBefunde,
  type Befund,
  type BefundArt,
} from '@/lib/integritaet'
import { canAdminister } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { ladeLetzteLaeufe } from '@/server/integritaet'
import { LaufStarten } from './lauf-starten'

export const metadata: Metadata = { title: 'Unversehrtheit der Nachweise' }
export const dynamic = 'force-dynamic'

/** Die in `befundeJson` abgelegte Struktur. */
type Befundblock = { befunde?: Befund[]; gekappt?: number }

export default async function IntegritaetSeite() {
  const benutzer = await erforderlicherBenutzer()
  if (!canAdminister(benutzer.role)) {
    return (
      <p className="bg-destructive/10 text-destructive rounded-md p-4 text-sm">
        Diese Seite ist der Administration vorbehalten.
      </p>
    )
  }

  const laeufe = await ladeLetzteLaeufe(10)
  const letzter = laeufe[0]
  const block = (letzter?.befundeJson as Befundblock | null) ?? null
  const befunde = block?.befunde ?? []
  const gekappt = block?.gekappt ?? 0

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Unversehrtheit der Nachweise"
        beschreibung="Gleicht jeden hinterlegten Nachweis mit seiner SHA-256-Prüfsumme ab und sucht Dateien ohne Eintrag. Läuft täglich nach dem Fälligkeitsabgleich."
        aktionen={<LaufStarten />}
      />

      {letzter ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {istUnversehrt(letzter) ? (
                <>
                  <CheckCircle2 className="text-status-ok size-5" />
                  Nachweiskette unversehrt
                </>
              ) : (
                <>
                  <AlertTriangle className="text-destructive size-5" />
                  {schwerwiegendeBefunde(letzter)}{' '}
                  {schwerwiegendeBefunde(letzter) === 1
                    ? 'Nachweis beanstandet'
                    : 'Nachweise beanstandet'}
                </>
              )}
            </CardTitle>
            <CardDescription>
              Letzter Lauf am {formatDateTime(letzter.gestartetAm)} ·{' '}
              {letzter.ausgeloestBy
                ? `von ${letzter.ausgeloestBy.name} ausgelöst`
                : 'geplanter Lauf'}{' '}
              · {letzter.dauerMs} ms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-5">
              <Zahl label="Geprüft" wert={letzter.geprueft} />
              <Zahl label="Fehlend" wert={letzter.fehlend} warnend />
              <Zahl label="Verändert" wert={letzter.abweichend} warnend />
              <Zahl label="Nicht lesbar" wert={letzter.unlesbar} warnend />
              <Zahl label="Ohne Eintrag" wert={letzter.verwaist} />
            </div>

            {befunde.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Befunde</p>
                <ul className="space-y-2">
                  {befunde.map((befund, index) => (
                    <li
                      key={`${befund.pfad}-${index}`}
                      className="border-border rounded-md border p-3 text-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span className="font-medium">
                          {befund.dateiname ?? befund.pfad}
                        </span>
                        <BefundBadge art={befund.art} />
                      </div>
                      <p className="text-muted-foreground mt-1 font-mono text-[11px] break-all">
                        {befund.pfad}
                      </p>
                      {befund.art === 'ABWEICHEND' ? (
                        <p className="text-muted-foreground mt-1 font-mono text-[11px] break-all">
                          erwartet {befund.erwartet}
                          <br />
                          gefunden {befund.gefunden}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {gekappt > 0 ? (
                  <p className="text-muted-foreground text-xs">
                    Weitere {gekappt} Befunde wurden nicht einzeln festgehalten; die
                    Zahlen oben sind vollständig.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="bg-status-ok/10 text-status-ok flex items-start gap-2 rounded-md p-3 text-sm">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                Jede hinterlegte Datei ist vorhanden und stimmt mit ihrer Prüfsumme
                überein.
              </p>
            )}

            {letzter.verwaist > 0 ? (
              <p className="bg-muted text-muted-foreground flex items-start gap-2 rounded-md p-3 text-xs">
                <FileQuestion className="mt-0.5 size-4 shrink-0" />
                Dateien ohne Eintrag beeinträchtigen die Nachweiskette nicht – es fehlt
                kein Beleg und keiner wurde verändert. Sie entstehen etwa, wenn ein
                Vorgang nach dem Schreiben der Datei abbricht.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Noch kein Lauf</CardTitle>
            <CardDescription>
              Die Prüfung läuft täglich nach dem Fälligkeitsabgleich. Sie lässt sich
              jederzeit von Hand anstoßen.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {laeufe.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>Frühere Läufe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-left">
                    <th className="py-2 font-medium">Zeitpunkt</th>
                    <th className="py-2 font-medium">Ausgelöst von</th>
                    <th className="py-2 text-right font-medium">Geprüft</th>
                    <th className="py-2 text-right font-medium">Beanstandet</th>
                    <th className="py-2 text-right font-medium">Ohne Eintrag</th>
                    <th className="py-2 text-right font-medium">Dauer</th>
                  </tr>
                </thead>
                <tbody>
                  {laeufe.slice(1).map((lauf) => (
                    <tr
                      key={lauf.id}
                      className="border-border/60 border-b last:border-0"
                    >
                      <td className="py-2">{formatDateTime(lauf.gestartetAm)}</td>
                      <td className="text-muted-foreground py-2">
                        {lauf.ausgeloestBy?.name ?? 'geplanter Lauf'}
                      </td>
                      <td className="py-2 text-right">{lauf.geprueft}</td>
                      <td className="py-2 text-right">
                        {schwerwiegendeBefunde(lauf) > 0 ? (
                          <span className="text-destructive font-medium">
                            {schwerwiegendeBefunde(lauf)}
                          </span>
                        ) : (
                          '–'
                        )}
                      </td>
                      <td className="text-muted-foreground py-2 text-right">
                        {lauf.verwaist > 0 ? lauf.verwaist : '–'}
                      </td>
                      <td className="text-muted-foreground py-2 text-right">
                        {lauf.dauerMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function Zahl({
  label,
  wert,
  warnend = false,
}: {
  label: string
  wert: number
  warnend?: boolean
}) {
  return (
    <div className="border-border rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={
          warnend && wert > 0
            ? 'text-destructive text-xl font-semibold'
            : 'text-xl font-semibold'
        }
      >
        {wert}
      </p>
    </div>
  )
}

function BefundBadge({ art }: { art: BefundArt }) {
  return (
    <Badge variant={art === 'VERWAIST' ? 'neutral' : 'danger'}>
      {BEFUND_BEZEICHNUNG[art]}
    </Badge>
  )
}
