'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { nachRahmenwerk } from '@/lib/audit-referenzen'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  INTERVALL_BEZEICHNUNG,
  PLANUNGSMODUS_BEZEICHNUNG,
  type IntervallTyp,
} from '@/lib/scheduling'
import { KRITIKALITAET_BEZEICHNUNG } from '@/lib/labels'
import type { AktionsStatus } from '@/server/actions/aufgaben'

export type AufgabenFormularWerte = {
  title: string
  description: string
  instructionsMd: string
  categoryId: string
  ownerId: string
  intervalType: IntervallTyp
  intervalValue: number | null
  scheduleMode: 'FIXED' | 'AFTER_COMPLETION'
  startDate: string
  leadTimeDays: number
  graceDays: number
  evidenceRequired: boolean
  criticality: 'LOW' | 'MEDIUM' | 'HIGH'
  /** Kennungen der zugeordneten Audit-Referenzen */
  auditReferenzIds: string[]
  active: boolean
}

type Auswahl = { id: string; name: string }

function SpeichernButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : label}
    </Button>
  )
}

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AufgabenFormular({
  aktion,
  werte,
  kategorien,
  personen,
  referenzen,
  absendeLabel,
  /** Bei „Anlegen“ enthält `erfolg` die neue ID, sonst eine Meldung. */
  leitetZuDetailWeiter = false,
  abbrechenHref,
}: {
  aktion: (status: AktionsStatus, formData: FormData) => Promise<AktionsStatus>
  werte: AufgabenFormularWerte
  kategorien: Auswahl[]
  personen: Auswahl[]
  /** Auswählbare Audit-Referenzen, nur aktive. */
  referenzen: {
    id: string
    kuerzel: string
    bezeichnung: string
    rahmenwerk: string | null
  }[]
  absendeLabel: string
  leitetZuDetailWeiter?: boolean
  abbrechenHref: string
}) {
  const router = useRouter()
  const [intervallTyp, setIntervallTyp] = useState<IntervallTyp>(werte.intervalType)
  const [gewaehlteReferenzen, setGewaehlteReferenzen] = useState<string[]>(
    werte.auditReferenzIds,
  )

  const [status, formAction] = useActionState(
    async (vorher: AktionsStatus, formData: FormData) => {
      const ergebnis = await aktion(vorher, formData)
      if (ergebnis.erfolg) {
        if (leitetZuDetailWeiter) {
          toast.success('Die Aufgabe wurde angelegt.')
          router.push(`/tasks/${ergebnis.erfolg}`)
        } else {
          toast.success(ergebnis.erfolg)
          router.refresh()
        }
      }
      return ergebnis
    },
    {},
  )

  return (
    <form action={formAction} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>
            Worum geht es, wer ist verantwortlich und wie kritisch ist die Prüfung?
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="title">Titel</Label>
            <Input
              id="title"
              name="title"
              defaultValue={werte.title}
              required
              maxLength={200}
              placeholder="z. B. Restore-Test ERP-System"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Kurzbeschreibung</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={werte.description}
              maxLength={2000}
              rows={2}
              placeholder="Ein bis zwei Sätze zum Zweck der Prüfung"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoryId">Kategorie</Label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={werte.categoryId}
              required
              className={selectKlassen}
            >
              <option value="">Bitte wählen …</option>
              {kategorien.map((kategorie) => (
                <option key={kategorie.id} value={kategorie.id}>
                  {kategorie.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerId">Verantwortlich</Label>
            <select
              id="ownerId"
              name="ownerId"
              defaultValue={werte.ownerId}
              required
              className={selectKlassen}
            >
              <option value="">Bitte wählen …</option>
              {personen.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="criticality">Kritikalität</Label>
            <select
              id="criticality"
              name="criticality"
              defaultValue={werte.criticality}
              className={selectKlassen}
            >
              {(['HIGH', 'MEDIUM', 'LOW'] as const).map((stufe) => (
                <option key={stufe} value={stufe}>
                  {KRITIKALITAET_BEZEICHNUNG[stufe]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Audit-Referenzen (optional)</Label>
            <input
              type="hidden"
              name="auditReferenzen"
              value={gewaehlteReferenzen.join(',')}
            />

            {referenzen.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                Noch keine Audit-Referenzen hinterlegt. Sie werden unter Administration
                → Audit-Referenzen gepflegt.
              </p>
            ) : (
              <>
                <div className="border-border space-y-3 rounded-md border p-3">
                  {nachRahmenwerk(referenzen).map((gruppe) => (
                    <div key={gruppe.rahmenwerk ?? 'ohne'} className="space-y-1.5">
                      <p className="text-muted-foreground text-xs font-medium">
                        {gruppe.rahmenwerk ?? 'Ohne Rahmenwerk'}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {gruppe.eintraege.map((referenz) => (
                          <label
                            key={referenz.id}
                            className="flex items-start gap-2 text-sm"
                            title={referenz.bezeichnung}
                          >
                            <input
                              type="checkbox"
                              checked={gewaehlteReferenzen.includes(referenz.id)}
                              onChange={(e) =>
                                setGewaehlteReferenzen((bisher) =>
                                  e.target.checked
                                    ? [...bisher, referenz.id]
                                    : bisher.filter((id) => id !== referenz.id),
                                )
                              }
                              className="mt-0.5 size-4"
                            />
                            <span>{referenz.kuerzel}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">
                  Mehrfachauswahl möglich – eine Prüfung deckt oft mehrere Anforderungen
                  ab. Listen und Auswertungen lassen sich danach filtern.
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Planung</CardTitle>
          <CardDescription>
            Intervall, Startdatum sowie Vorlauf- und Karenztage bestimmen, wann die
            Aufgabe fällig und wann sie überfällig wird.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="intervalType">Intervall</Label>
            <select
              id="intervalType"
              name="intervalType"
              value={intervallTyp}
              onChange={(e) => setIntervallTyp(e.target.value as IntervallTyp)}
              className={selectKlassen}
            >
              {(Object.keys(INTERVALL_BEZEICHNUNG) as IntervallTyp[]).map((typ) => (
                <option key={typ} value={typ}>
                  {INTERVALL_BEZEICHNUNG[typ]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="intervalValue">
              Anzahl Tage{' '}
              {intervallTyp === 'EVERY_N_DAYS' ? '' : '(nur bei „Alle N Tage“)'}
            </Label>
            <Input
              id="intervalValue"
              name="intervalValue"
              type="number"
              min={1}
              max={3650}
              defaultValue={werte.intervalValue ?? ''}
              disabled={intervallTyp !== 'EVERY_N_DAYS'}
              required={intervallTyp === 'EVERY_N_DAYS'}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="scheduleMode">Rhythmus</Label>
            <select
              id="scheduleMode"
              name="scheduleMode"
              defaultValue={werte.scheduleMode}
              className={selectKlassen}
            >
              {(['FIXED', 'AFTER_COMPLETION'] as const).map((modus) => (
                <option key={modus} value={modus}>
                  {PLANUNGSMODUS_BEZEICHNUNG[modus]}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground text-xs">
              „Fester Rhythmus“ hält den Takt auch bei verspäteter Erledigung. „Ab
              Erledigungsdatum“ rechnet das Intervall ab dem Tag der tatsächlichen
              Durchführung.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startDate">Startdatum (erste Fälligkeit)</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={werte.startDate}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="leadTimeDays">Vorlaufzeit in Tagen</Label>
            <Input
              id="leadTimeDays"
              name="leadTimeDays"
              type="number"
              min={0}
              max={365}
              defaultValue={werte.leadTimeDays}
            />
            <p className="text-muted-foreground text-xs">
              Ab so vielen Tagen vor dem Termin erscheint die Aufgabe als „bald fällig“
              auf dem Dashboard.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="graceDays">Karenztage</Label>
            <Input
              id="graceDays"
              name="graceDays"
              type="number"
              min={0}
              max={365}
              defaultValue={werte.graceDays}
            />
            <p className="text-muted-foreground text-xs">
              Erst nach Ablauf dieser Tage gilt die Fälligkeit als überfällig.
            </p>
          </div>

          <div className="flex items-start gap-3 sm:col-span-2">
            <Checkbox
              id="evidenceRequired"
              name="evidenceRequired"
              defaultChecked={werte.evidenceRequired}
            />
            <div className="space-y-1">
              <Label htmlFor="evidenceRequired">Nachweis verpflichtend</Label>
              <p className="text-muted-foreground text-xs">
                Die Durchführung kann dann nur mit mindestens einer hochgeladenen Datei
                abgeschlossen werden.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 sm:col-span-2">
            <Checkbox id="active" name="active" defaultChecked={werte.active} />
            <div className="space-y-1">
              <Label htmlFor="active">Aufgabe ist aktiv</Label>
              <p className="text-muted-foreground text-xs">
                Nur aktive Aufgaben erzeugen neue Fälligkeiten.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prüfanleitung</CardTitle>
          <CardDescription>
            Schritt-für-Schritt-Anleitung im Markdown-Format. Sie wird beim Erledigen
            angezeigt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            id="instructionsMd"
            name="instructionsMd"
            defaultValue={werte.instructionsMd}
            rows={14}
            maxLength={20000}
            className="font-mono text-xs"
            placeholder={
              '## Durchführung\n1. Erster Schritt\n2. Zweiter Schritt\n\n## Nachweise\n- Protokoll als PDF'
            }
          />
        </CardContent>
      </Card>

      {status.fehler ? (
        <p
          role="alert"
          className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {status.fehler}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <SpeichernButton label={absendeLabel} />
        <Button variant="ghost" asChild>
          <Link href={abbrechenHref}>Abbrechen</Link>
        </Button>
      </div>
    </form>
  )
}
