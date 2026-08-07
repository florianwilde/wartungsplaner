'use client'

import { useEffect, useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FARBSCHEMA_AUSWAHL,
  FARBSCHEMA_BEZEICHNUNG,
  FARBSCHEMA_COOKIE,
  baueFarbschemaCookie,
  type Farbschema,
} from '@/lib/farbschema'
import { cn } from '@/lib/utils'

const SYMBOLE: Record<Farbschema, typeof Sun> = {
  hell: Sun,
  dunkel: Moon,
  system: Monitor,
}

/** Liest die aktuelle Auswahl aus dem Cookie. */
function ausCookie(): Farbschema {
  const treffer = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${FARBSCHEMA_COOKIE}=([^;]*)`),
  )
  const wert = treffer ? decodeURIComponent(treffer[1]) : 'system'
  return wert === 'hell' || wert === 'dunkel' ? wert : 'system'
}

/** Wendet ein Schema sofort auf das Dokument an. */
function wendeAn(schema: Farbschema): void {
  const dunkel =
    schema === 'dunkel' ||
    (schema === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', dunkel)
  document.documentElement.style.colorScheme = dunkel ? 'dark' : 'light'
}

export function FarbschemaUmschalter({
  className,
  mitBeschriftung = false,
}: {
  className?: string
  mitBeschriftung?: boolean
}) {
  // Beim ersten Rendern auf dem Server ist die Auswahl nicht bekannt; sie wird
  // unmittelbar nach dem Einhängen aus dem Cookie nachgezogen.
  const [schema, setSchema] = useState<Farbschema>('system')
  const [bereit, setBereit] = useState(false)

  // Das Cookie ist beim Rendern auf dem Server nicht lesbar; der Wert wird
  // deshalb nach dem Einhängen genau einmal nachgezogen.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSchema(ausCookie())
    setBereit(true)
  }, [])

  // Bei „Systemvorgabe“ auf einen Wechsel der Geräteeinstellung reagieren.
  useEffect(() => {
    if (schema !== 'system') return
    const abfrage = window.matchMedia('(prefers-color-scheme: dark)')
    const beiWechsel = () => wendeAn('system')
    abfrage.addEventListener('change', beiWechsel)
    return () => abfrage.removeEventListener('change', beiWechsel)
  }, [schema])

  const waehle = (neu: Farbschema) => {
    // `document.cookie` ist die Schnittstelle des Browsers, kein Zustand der
    // Komponente – und dies hier ist ein Ereignisbehandler, kein Rendern.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = baueFarbschemaCookie(neu)
    setSchema(neu)
    wendeAn(neu)
  }

  const Symbol = SYMBOLE[schema]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Farbschema wählen"
        title="Farbschema wählen"
        className={cn(
          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring',
          className,
        )}
      >
        <Symbol className="size-4" />
        {mitBeschriftung ? (
          <span>{bereit ? FARBSCHEMA_BEZEICHNUNG[schema] : 'Farbschema'}</span>
        ) : null}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Farbschema</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FARBSCHEMA_AUSWAHL.map((wert) => {
          const Eintrag = SYMBOLE[wert]
          return (
            <DropdownMenuItem key={wert} onSelect={() => waehle(wert)}>
              <Eintrag />
              <span className="flex-1">{FARBSCHEMA_BEZEICHNUNG[wert]}</span>
              {bereit && schema === wert ? (
                <Check className="size-4 opacity-70" />
              ) : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
