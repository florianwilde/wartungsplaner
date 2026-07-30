'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { integritaetslaufStarten } from '@/server/actions/integritaet'

export function LaufStarten() {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      type="button"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await integritaetslaufStarten()
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Prüfung abgeschlossen.')
            router.refresh()
          }
        })
      }
    >
      <ShieldCheck className="size-4" />
      {laeuft ? 'Wird geprüft …' : 'Jetzt prüfen'}
    </Button>
  )
}
