'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, Mail, Play, Send } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  benachrichtigungenSpeichern,
  benachrichtigungslaufStarten,
  testnachrichtSenden,
} from '@/server/actions/benachrichtigungen'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type BenachrichtigungsWerte = {
  enabled: boolean
  aufgabenAktiv: boolean
  abweichungenAktiv: boolean
  abweichungVorlaufTage: number
  eskalationAktiv: boolean
  eskalationAbTagen: number
  eskalationUserId: string | null
  wochenuebersichtAktiv: boolean
  wochenuebersichtTag: number
}

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Einstellungen speichern'}
    </Button>
  )
}

/** Schalter mit Beschriftung und erläuterndem Text. */
function Schalter({
  name,
  label,
  beschreibung,
  standard,
  gesetzt,
  setzeGesetzt,
  deaktiviert,
}: {
  name: string
  label: string
  beschreibung: string
  standard?: boolean
  gesetzt?: boolean
  setzeGesetzt?: (wert: boolean) => void
  deaktiviert?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox
        id={name}
        name={name}
        defaultChecked={setzeGesetzt ? undefined : standard}
        checked={setzeGesetzt ? gesetzt : undefined}
        onCheckedChange={
          setzeGesetzt ? (wert) => setzeGesetzt(wert === true) : undefined
        }
        disabled={deaktiviert}
      />
      <div className="space-y-1">
        <Label htmlFor={name}>{label}</Label>
        <p className="text-xs text-muted-foreground">{beschreibung}</p>
      </div>
    </div>
  )
}

export function BenachrichtigungenFormular({
  werte,
  smtpKonfiguriert,
  smtpBeschreibung,
  personen,
  wochentage,
  mailZeitplan,
}: {
  werte: BenachrichtigungsWerte
  smtpKonfiguriert: boolean
  smtpBeschreibung: string
  personen: { id: string; name: string; email: string }[]
  wochentage: { wert: number; label: string }[]
  mailZeitplan: string
}) {
  const router = useRouter()
  const [aktiv, setAktiv] = useState(werte.enabled)
  const [eskalation, setEskalation] = useState(werte.eskalationAktiv)
  const [wochenuebersicht, setWochenuebersicht] = useState(werte.wochenuebersichtAktiv)
  const [testLaeuft, starteTest] = useTransition()
  const [laufLaeuft, starteLauf] = useTransition()

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await benachrichtigungenSpeichern(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" />
            Mailserver
          </CardTitle>
          <CardDescription>
            Die Zugangsdaten stehen ausschließlich in der Datei <code>.env</code>{' '}
            und werden beim Start des Containers gelesen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p
            className={
              smtpKonfiguriert
                ? 'rounded-md bg-status-ok/10 p-3 text-sm text-status-ok'
                : 'rounded-md bg-status-warn/15 p-3 text-sm text-status-warn'
            }
          >
            {smtpBeschreibung}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!smtpKonfiguriert || testLaeuft}
              onClick={() =>
                starteTest(async () => {
                  const ergebnis = await testnachrichtSenden()
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else toast.success(ergebnis.erfolg ?? 'Versendet.')
                })
              }
            >
              <Send className="size-4" />
              {testLaeuft ? 'Wird gesendet …' : 'Testnachricht an mich senden'}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!smtpKonfiguriert || !werte.enabled || laufLaeuft}
              onClick={() =>
                starteLauf(async () => {
                  const ergebnis = await benachrichtigungslaufStarten()
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else {
                    toast.success(ergebnis.erfolg ?? 'Lauf durchgeführt.')
                    router.refresh()
                  }
                })
              }
            >
              <Play className="size-4" />
              {laufLaeuft ? 'Lauf läuft …' : 'Lauf jetzt starten'}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Planmäßiger Versand: <code>{mailZeitplan}</code> (Europe/Berlin).
            Anpassbar über <code>MAIL_CRON_SCHEDULE</code> in der{' '}
            <code>.env</code>.
          </p>
        </CardContent>
      </Card>

      <form action={formAction} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Versand</CardTitle>
            <CardDescription>
              Hauptschalter und Auswahl der Nachrichtenarten.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Schalter
              name="enabled"
              label="E-Mail-Benachrichtigungen aktiv"
              beschreibung="Ohne diesen Schalter versendet die Anwendung keine Nachrichten – unabhängig von den folgenden Einstellungen."
              gesetzt={aktiv}
              setzeGesetzt={setAktiv}
              deaktiviert={!smtpKonfiguriert}
            />

            <div className="space-y-5 border-l-2 border-border pl-4">
              <Schalter
                name="aufgabenAktiv"
                label="Anstehende und überfällige Prüfungen"
                beschreibung="Eine Sammelnachricht je verantwortlicher Person, sobald eine Prüfung in die Vorlaufzeit rückt. Überfällige Prüfungen werden wöchentlich erneut gemeldet."
                standard={werte.aufgabenAktiv}
                deaktiviert={!aktiv}
              />

              <Schalter
                name="abweichungenAktiv"
                label="Fristen von Abweichungen"
                beschreibung="Erinnert die verantwortliche Person, bevor die Frist einer Abweichung abläuft, und danach wöchentlich."
                standard={werte.abweichungenAktiv}
                deaktiviert={!aktiv}
              />

              <div className="max-w-xs space-y-2">
                <Label htmlFor="abweichungVorlaufTage">
                  Vorlauf für Abweichungsfristen (Tage)
                </Label>
                <Input
                  id="abweichungVorlaufTage"
                  name="abweichungVorlaufTage"
                  type="number"
                  min={0}
                  max={90}
                  defaultValue={werte.abweichungVorlaufTage}
                  disabled={!aktiv}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eskalation</CardTitle>
            <CardDescription>
              Meldet lange überfällige Prüfungen zusätzlich an eine zentrale
              Stelle – höchstens einmal je Kalenderwoche.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Schalter
              name="eskalationAktiv"
              label="Eskalation aktiv"
              beschreibung="Sammelnachricht über alle Prüfungen, die die Schwelle überschreiten."
              gesetzt={eskalation}
              setzeGesetzt={setEskalation}
              deaktiviert={!aktiv}
            />

            <div className="grid gap-4 border-l-2 border-border pl-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="eskalationAbTagen">Ab wie vielen Tagen Verzug</Label>
                <Input
                  id="eskalationAbTagen"
                  name="eskalationAbTagen"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={werte.eskalationAbTagen}
                  disabled={!aktiv || !eskalation}
                />
                <p className="text-xs text-muted-foreground">
                  Gezählt ab dem Ende der Karenzfrist.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eskalationUserId">Empfänger</Label>
                <select
                  id="eskalationUserId"
                  name="eskalationUserId"
                  defaultValue={werte.eskalationUserId ?? ''}
                  disabled={!aktiv || !eskalation}
                  className={selectKlassen}
                >
                  <option value="">Bitte wählen …</option>
                  {personen.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name} ({person.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wochenübersicht</CardTitle>
            <CardDescription>
              Fasst einmal wöchentlich alle offenen Prüfungen und Abweichungen je
              Person zusammen. Wer nichts offen hat, erhält keine Nachricht.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Schalter
              name="wochenuebersichtAktiv"
              label="Wochenübersicht versenden"
              beschreibung="Unabhängig davon, ob die Vorgänge bereits einzeln gemeldet wurden."
              gesetzt={wochenuebersicht}
              setzeGesetzt={setWochenuebersicht}
              deaktiviert={!aktiv}
            />

            <div className="max-w-xs space-y-2 border-l-2 border-border pl-4">
              <Label htmlFor="wochenuebersichtTag">Wochentag</Label>
              <select
                id="wochenuebersichtTag"
                name="wochenuebersichtTag"
                defaultValue={String(werte.wochenuebersichtTag)}
                disabled={!aktiv || !wochenuebersicht}
                className={selectKlassen}
              >
                {wochentage.map((tag) => (
                  <option key={tag.wert} value={tag.wert}>
                    {tag.label}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {status.fehler ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {status.fehler}
          </p>
        ) : null}

        <SpeichernButton />
      </form>
    </div>
  )
}
