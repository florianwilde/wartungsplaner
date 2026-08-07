'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export function AdminNavigation({
  eintraege,
}: {
  eintraege: { href: string; label: string }[]
}) {
  const pfad = usePathname()

  return (
    <nav className="kein-druck bg-muted flex gap-1 rounded-lg p-1">
      {eintraege.map((eintrag) => {
        const aktiv = pfad === eintrag.href || pfad.startsWith(`${eintrag.href}/`)
        return (
          <Link
            key={eintrag.href}
            href={eintrag.href}
            aria-current={aktiv ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              aktiv
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {eintrag.label}
          </Link>
        )
      })}
    </nav>
  )
}
