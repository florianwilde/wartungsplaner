'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Copy, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  kalenderAboAufheben,
  kalenderAboErneuern,
} from '@/server/actions/kalender'

/**
 * Kalender-Abonnement im eigenen Konto.
 *
 * Die Adresse enthält das Geheimnis und ist deshalb wie ein Passwort zu
 * behandeln – das steht auch dort, wo sie angezeigt wird.
 */
export function KalenderAbo({ adresse }: { adresse: string | null }) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()
  const [sichtbar, setSichtbar] = useState(false)

  const erneuern = () =>
    starte(async () => {
      const antwort = await kalenderAboErneuern()
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(antwort.erfolg ?? 'Bereit.')
        setSichtbar(true)
        router.refresh()
      }
    })

  const aufheben = () =>
    starte(async () => {
      const antwort = await kalenderAboAufheben()
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(antwort.erfolg ?? 'Aufgehoben.')
        setSichtbar(false)
        router.refresh()
      }
    })

  const kopieren = async () => {
    if (!adresse) return
    try {
      await navigator.clipboard.writeText(adresse)
      toast.success('Die Adresse steht in der Zwischenablage.')
    } catch {
      // Ohne HTTPS verweigern Browser den Zugriff auf die Zwischenablage.
      setSichtbar(true)
      toast.error('Kopieren nicht möglich – bitte die Adresse von Hand markieren.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalender abonnieren</CardTitle>
        <CardDescription>
          Ihre offenen Fälligkeiten als Kalender, den Outlook laufend abruft –
          so stehen die Prüfungen dort, wo Sie ohnehin planen. Vertreten Sie
          jemanden, kommen dessen Termine mit.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {adresse ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                readOnly
                value={sichtbar ? adresse : '•'.repeat(48)}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 font-mono text-xs"
                aria-label="Kalenderadresse"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSichtbar((wert) => !wert)}
              >
                {sichtbar ? 'Verbergen' : 'Anzeigen'}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={kopieren}>
                <Copy className="size-4" />
                Kopieren
              </Button>
            </div>

            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Die Adresse ist wie ein Passwort zu behandeln: Wer sie hat, sieht
              Ihre Fälligkeiten. Geben Sie sie nicht weiter. Besteht der
              Verdacht, dass sie in falsche Hände geraten ist, erzeugen Sie eine
              neue – die alte läuft dann ins Leere.
            </p>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={laeuft}
                onClick={erneuern}
              >
                <RefreshCw className="size-4" />
                Neue Adresse erzeugen
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={laeuft}
                onClick={aufheben}
              >
                <Trash2 className="size-4" />
                Abonnement aufheben
              </Button>
            </div>

            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground">
                So abonnieren Sie den Kalender in Outlook
              </summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Im Kalender auf „Kalender hinzufügen“ gehen</li>
                <li>„Aus dem Internet abonnieren“ wählen</li>
                <li>Die Adresse einfügen und benennen</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                Outlook ruft abonnierte Kalender in eigenem Takt ab; eine
                Änderung erscheint deshalb nicht sofort.
              </p>
            </details>
          </>
        ) : (
          <Button type="button" disabled={laeuft} onClick={erneuern}>
            <CalendarPlus className="size-4" />
            {laeuft ? 'Wird eingerichtet …' : 'Kalender-Abonnement einrichten'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
