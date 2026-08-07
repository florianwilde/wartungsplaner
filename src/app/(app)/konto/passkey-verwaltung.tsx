'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { AlertCircle, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateTime } from '@/lib/dates'
import { geraeteArtText } from '@/lib/webauthn'
import { passkeyEntfernen, passkeyUmbenennen } from '@/server/actions/passkeys'

export type PasskeyAnzeige = {
  id: string
  name: string
  deviceType: string
  backedUp: boolean
  createdAt: Date
  lastUsedAt: Date | null
}

export function PasskeyVerwaltung({
  passkeys,
  hinweis,
  nurSso,
}: {
  passkeys: PasskeyAnzeige[]
  /** Grund, warum Passkeys nicht möglich sind (sonst null). */
  hinweis: string | null
  nurSso: boolean
}) {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [umbenennen, setUmbenennen] = useState<PasskeyAnzeige | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const [aktion, starteAktion] = useTransition()

  const registriere = async () => {
    setFehler(null)
    setLaeuft(true)

    try {
      // 1. Vorgang beim Server anstoßen
      const start = await fetch('/api/passkeys/registrierung', { method: 'POST' })
      const startDaten = await start.json()
      if (!start.ok) throw new Error(startDaten.fehler ?? 'Start fehlgeschlagen.')

      // 2. Gerät nach dem Schlüssel fragen
      const antwort = await startRegistration(startDaten.optionen)

      // 3. Namen erfragen und beim Server hinterlegen
      const name =
        window.prompt(
          'Name für diesen Passkey (zur Wiedererkennung):',
          startDaten.namensvorschlag ?? 'Passkey',
        ) ?? ''
      if (!name.trim()) {
        setLaeuft(false)
        return
      }

      const abschluss = await fetch('/api/passkeys/registrierung', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vorgangId: startDaten.vorgangId,
          antwort,
          name,
        }),
      })
      const abschlussDaten = await abschluss.json()
      if (!abschluss.ok) {
        throw new Error(abschlussDaten.fehler ?? 'Speichern fehlgeschlagen.')
      }

      toast.success(`Passkey „${abschlussDaten.passkey.name}“ wurde hinterlegt.`)
      router.refresh()
    } catch (error) {
      // Bricht die Person den Dialog des Betriebssystems ab, ist das kein Fehler.
      const meldung = error instanceof Error ? error.message : 'Unbekannter Fehler.'
      if (/abort|NotAllowed/i.test(meldung)) {
        setFehler('Der Vorgang wurde abgebrochen.')
      } else {
        setFehler(meldung)
      }
    } finally {
      setLaeuft(false)
    }
  }

  if (nurSso) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Passkeys</CardTitle>
          <CardDescription>
            Dieses Konto wird über SSO verwaltet. Passkeys hinterlegen Sie direkt beim
            Identity Provider Ihres Unternehmens.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4" />
              Passkeys
            </CardTitle>
            <CardDescription>
              Melden Sie sich mit Windows Hello, Touch ID oder einem
              Sicherheitsschlüssel an – ohne Passwort. Der geheime Teil des Schlüssels
              verlässt Ihr Gerät nie.
            </CardDescription>
          </div>
          <Button size="sm" onClick={registriere} disabled={laeuft || !!hinweis}>
            <Plus className="size-4" />
            {laeuft ? 'Vorgang läuft …' : 'Passkey hinzufügen'}
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {hinweis ? (
            <p className="bg-status-warn/15 text-status-warn flex items-start gap-2 rounded-md p-3 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {hinweis}
            </p>
          ) : null}

          {fehler ? (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {fehler}
            </p>
          ) : null}

          {passkeys.length === 0 ? (
            <p className="border-border text-muted-foreground rounded-lg border border-dashed px-4 py-8 text-center text-sm">
              Es ist noch kein Passkey hinterlegt.
            </p>
          ) : (
            <ul className="space-y-2">
              {passkeys.map((passkey) => (
                <li
                  key={passkey.id}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{passkey.name}</span>
                      <Badge variant="neutral">
                        {geraeteArtText(passkey.deviceType, passkey.backedUp)}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Hinterlegt am {formatDateTime(passkey.createdAt)} ·{' '}
                      {passkey.lastUsedAt
                        ? `zuletzt verwendet am ${formatDateTime(passkey.lastUsedAt)}`
                        : 'noch nicht verwendet'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUmbenennen(passkey)
                        setNeuerName(passkey.name)
                      }}
                    >
                      <Pencil className="size-4" />
                      Umbenennen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={aktion}
                      onClick={() =>
                        starteAktion(async () => {
                          const ergebnis = await passkeyEntfernen(passkey.id)
                          if (ergebnis.fehler) toast.error(ergebnis.fehler)
                          else {
                            toast.success(ergebnis.erfolg ?? 'Entfernt.')
                            router.refresh()
                          }
                        })
                      }
                    >
                      <Trash2 className="size-4" />
                      Entfernen
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={umbenennen !== null}
        onOpenChange={(offen) => !offen && setUmbenennen(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passkey umbenennen</DialogTitle>
            <DialogDescription>
              Ein sprechender Name hilft, das Gerät später wiederzuerkennen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="passkey-name">Name</Label>
            <Input
              id="passkey-name"
              value={neuerName}
              onChange={(e) => setNeuerName(e.target.value)}
              maxLength={60}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setUmbenennen(null)}>
              Abbrechen
            </Button>
            <Button
              disabled={aktion || neuerName.trim().length < 2}
              onClick={() =>
                starteAktion(async () => {
                  if (!umbenennen) return
                  const ergebnis = await passkeyUmbenennen(umbenennen.id, neuerName)
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else {
                    toast.success(ergebnis.erfolg ?? 'Gespeichert.')
                    setUmbenennen(null)
                    router.refresh()
                  }
                })
              }
            >
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
