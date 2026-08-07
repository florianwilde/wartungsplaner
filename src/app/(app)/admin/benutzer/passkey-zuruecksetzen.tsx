'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { passkeysZuruecksetzen } from '@/server/actions/passkeys'

/**
 * Entfernt alle Passkeys eines Kontos – gedacht für den Fall, dass jemand
 * sein Gerät verloren hat und sich nicht mehr anmelden kann.
 */
export function PasskeysZuruecksetzenButton({
  userId,
  name,
  anzahl,
}: {
  userId: string
  name: string
  anzahl: number
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [laeuft, starte] = useTransition()

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOffen(true)}>
        <KeyRound className="size-4" />
        Passkeys
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passkeys zurücksetzen</DialogTitle>
            <DialogDescription>
              Für {name} {anzahl === 1 ? 'ist' : 'sind'} {anzahl}{' '}
              {anzahl === 1 ? 'Passkey' : 'Passkeys'} hinterlegt. Beim Zurücksetzen{' '}
              {anzahl === 1 ? 'wird er' : 'werden sie'} entfernt – etwa nach einem
              Geräteverlust. Die Person meldet sich danach mit Passwort an und kann neue
              Passkeys anlegen.
            </DialogDescription>
          </DialogHeader>

          <p className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
            Der Vorgang wird im Audit-Log festgehalten. Ist für das Konto kein Passwort
            hinterlegt, lehnt die Anwendung das Zurücksetzen ab – sonst bliebe der
            Zugang verschlossen.
          </p>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              disabled={laeuft}
              onClick={() =>
                starte(async () => {
                  const ergebnis = await passkeysZuruecksetzen(userId)
                  if (ergebnis.fehler) toast.error(ergebnis.fehler)
                  else {
                    toast.success(ergebnis.erfolg ?? 'Zurückgesetzt.')
                    setOffen(false)
                    router.refresh()
                  }
                })
              }
            >
              Passkeys entfernen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
