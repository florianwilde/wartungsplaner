'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { startAuthentication } from '@simplewebauthn/browser'
import { AlertCircle, Fingerprint } from 'lucide-react'

import { Button } from '@/components/ui/button'

/**
 * Anmeldung mit Passkey.
 *
 * Ablauf: Aufgabe beim Server holen, das Gerät signieren lassen, das Ergebnis
 * an Auth.js übergeben. Eine E-Mail-Adresse wird nicht benötigt – der Browser
 * bietet die passenden Passkeys von sich aus an.
 */
export function PasskeyAnmeldung({ weiter }: { weiter: string }) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const anmelden = async () => {
    setFehler(null)
    setLaeuft(true)

    try {
      const start = await fetch('/api/passkeys/anmeldung', { method: 'POST' })
      const daten = await start.json()
      if (!start.ok) throw new Error(daten.fehler ?? 'Start fehlgeschlagen.')

      const antwort = await startAuthentication(daten.optionen)

      const ergebnis = await signIn('passkey', {
        vorgangId: daten.vorgangId,
        antwort: JSON.stringify(antwort),
        redirect: false,
      })

      if (ergebnis?.error) {
        setFehler(
          'Die Anmeldung mit diesem Passkey ist fehlgeschlagen. Bitte versuchen Sie es erneut oder verwenden Sie Ihr Passwort.',
        )
        return
      }

      // Vollständiges Neuladen, damit das Sitzungs-Cookie überall greift.
      window.location.href = weiter
    } catch (error) {
      const meldung = error instanceof Error ? error.message : 'Unbekannter Fehler.'
      // Ein Abbruch im Dialog des Betriebssystems ist kein Fehler.
      if (/abort|NotAllowed/i.test(meldung)) {
        setFehler(null)
      } else {
        setFehler(meldung)
      }
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={anmelden}
        disabled={laeuft}
      >
        <Fingerprint className="size-4" />
        {laeuft ? 'Anmeldung läuft …' : 'Mit Passkey anmelden'}
      </Button>

      {fehler ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {fehler}
        </p>
      ) : null}
    </div>
  )
}
