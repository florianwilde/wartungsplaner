'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, UserCog, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  nachweisUebernehmen,
  nachweisVerwerfen,
} from '@/server/actions/nachweise'

/**
 * Hinweis auf einen Entwurf, den eine andere Person angelegt hat.
 *
 * Ohne Ausweg wäre ein solcher Bogen eine Sackgasse: Ausfüllen darf nur die
 * erfassende Person, und ein zweiter Bogen derselben Vorlage lässt sich für
 * dieselbe Fälligkeit nicht anlegen.
 */
/**
 * Verwirft den eigenen Entwurf.
 *
 * Ein versehentlich angelegter Bogen ließe sich sonst nicht mehr loswerden:
 * Zu derselben Fälligkeit lässt sich kein zweiter Bogen derselben Vorlage
 * anlegen.
 */
export function EigenenEntwurfVerwerfen({
  nachweisId,
  taskId,
}: {
  nachweisId: string
  taskId: string
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await nachweisVerwerfen(nachweisId)
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Verworfen.')
            router.push(`/tasks/${taskId}`)
          }
        })
      }
    >
      <Trash2 className="size-4" />
      Entwurf verwerfen
    </Button>
  )
}

export function FremderEntwurf({
  nachweisId,
  erfasstVon,
  taskId,
  darfVerwerfen,
}: {
  nachweisId: string
  erfasstVon: string
  taskId: string
  /** Administration darf auch fremde Entwürfe verwerfen. */
  darfVerwerfen: boolean
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <div className="space-y-3 rounded-md border border-status-warn/40 bg-status-warn/10 p-4">
      <div className="flex items-start gap-2">
        <UserCog className="mt-0.5 size-5 shrink-0 text-status-warn" />
        <div className="min-w-0">
          <p className="font-medium">Dieser Entwurf gehört {erfasstVon}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Ausfüllen darf ihn nur die erfassende Person. Übernehmen Sie den
            Bogen, um weiterzuarbeiten – die bisherigen Angaben bleiben
            erhalten. Wer übernimmt, gilt als erfassende Person und kann
            anschließend nicht selbst gegenzeichnen.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={laeuft}
          onClick={() =>
            starte(async () => {
              const ergebnis = await nachweisUebernehmen(nachweisId)
              if (ergebnis.fehler) toast.error(ergebnis.fehler)
              else {
                toast.success(ergebnis.erfolg ?? 'Übernommen.')
                router.refresh()
              }
            })
          }
        >
          <UserCheck className="size-4" />
          Entwurf übernehmen
        </Button>

        {darfVerwerfen ? (
          <Button
            type="button"
            variant="outline"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const ergebnis = await nachweisVerwerfen(nachweisId)
                if (ergebnis.fehler) toast.error(ergebnis.fehler)
                else {
                  toast.success(ergebnis.erfolg ?? 'Verworfen.')
                  router.push(`/tasks/${taskId}`)
                }
              })
            }
          >
            <Trash2 className="size-4" />
            Entwurf verwerfen
          </Button>
        ) : null}
      </div>
    </div>
  )
}
