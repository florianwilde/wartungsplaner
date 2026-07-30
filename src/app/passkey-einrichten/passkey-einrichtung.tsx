'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { startRegistration } from '@simplewebauthn/browser'
import { AlertCircle, Fingerprint } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

/**
 * Einrichtung eines Passkeys, wenn die Rolle ihn verlangt.
 *
 * Bewusst derselbe Ablauf wie im Konto – nur ohne die Verwaltung ringsum,
 * damit hier nichts ablenkt.
 */
export function PasskeyEinrichtung() {
  const router = useRouter()
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const registriere = async () => {
    setFehler(null)
    setLaeuft(true)

    try {
      const start = await fetch('/api/passkeys/registrierung', { method: 'POST' })
      const startDaten = await start.json()
      if (!start.ok) throw new Error(startDaten.fehler ?? 'Start fehlgeschlagen.')

      const antwort = await startRegistration(startDaten.optionen)

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

      toast.success('Passkey hinterlegt.')
      // Die Weiterleitung übernimmt die Sitzungsprüfung: Sie lässt jetzt
      // wieder durch.
      router.replace('/')
      router.refresh()
    } catch (error) {
      const meldung = error instanceof Error ? error.message : 'Unbekannter Fehler.'
      setFehler(
        /abort|NotAllowed/i.test(meldung)
          ? 'Der Vorgang wurde abgebrochen. Ohne Passkey geht es nicht weiter.'
          : meldung,
      )
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className="space-y-4">
      <Button onClick={registriere} disabled={laeuft} className="w-full">
        <Fingerprint className="size-4" />
        {laeuft ? 'Einrichtung läuft …' : 'Passkey jetzt einrichten'}
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
