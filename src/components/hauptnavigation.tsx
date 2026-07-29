'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  FileBarChart,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  X,
} from 'lucide-react'

import { cn } from '@/lib/utils'

export type NavigationsEintrag = {
  href: string
  label: string
  icon: keyof typeof ICONS
}

const ICONS = {
  dashboard: LayoutDashboard,
  aufgaben: ListChecks,
  abweichungen: AlertTriangle,
  kalender: CalendarDays,
  reports: FileBarChart,
  admin: Settings,
}

function istAktiv(pfad: string, href: string): boolean {
  if (href === '/') return pfad === '/'
  return pfad === href || pfad.startsWith(`${href}/`)
}

export function Hauptnavigation({
  eintraege,
  benutzerBereich,
}: {
  eintraege: NavigationsEintrag[]
  benutzerBereich: React.ReactNode
}) {
  const pfad = usePathname()
  const [offen, setOffen] = useState(false)

  return (
    <header className="kein-druck sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ClipboardCheck className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            Wartungsplaner
          </span>
        </Link>

        <nav className="hidden flex-1 items-center gap-0.5 md:flex">
          {eintraege.map((eintrag) => {
            const Icon = ICONS[eintrag.icon]
            const aktiv = istAktiv(pfad, eintrag.href)
            return (
              <Link
                key={eintrag.href}
                href={eintrag.href}
                aria-current={aktiv ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  aktiv
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {eintrag.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden md:block">{benutzerBereich}</div>
          <button
            type="button"
            onClick={() => setOffen((o) => !o)}
            aria-label={offen ? 'Menü schließen' : 'Menü öffnen'}
            aria-expanded={offen}
            className="rounded-md p-2 hover:bg-accent md:hidden"
          >
            {offen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {offen ? (
        <div className="border-t border-border px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {eintraege.map((eintrag) => {
              const Icon = ICONS[eintrag.icon]
              const aktiv = istAktiv(pfad, eintrag.href)
              return (
                <Link
                  key={eintrag.href}
                  href={eintrag.href}
                  onClick={() => setOffen(false)}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                    aktiv
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60',
                  )}
                >
                  <Icon className="size-4" />
                  {eintrag.label}
                </Link>
              )
            })}
          </nav>
          <div className="mt-3 border-t border-border pt-3">
            {benutzerBereich}
          </div>
        </div>
      ) : null}
    </header>
  )
}
