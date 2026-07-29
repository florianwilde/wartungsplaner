'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellOff } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { benutzerMailEmpfangUmschalten } from '@/server/actions/benachrichtigungen'

export function MailEmpfangSchalter({
  userId,
  empfangen,
}: {
  userId: string
  empfangen: boolean
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await benutzerMailEmpfangUmschalten(userId, !empfangen)
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Gespeichert.')
            router.refresh()
          }
        })
      }
    >
      {empfangen ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      {empfangen ? 'Abmelden' : 'Anmelden'}
    </Button>
  )
}
