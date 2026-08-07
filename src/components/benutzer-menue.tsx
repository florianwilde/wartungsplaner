'use client'

import Link from 'next/link'
import { ChevronDown, KeyRound, LogOut, UserRound } from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function BenutzerMenue({
  name,
  email,
  rolle,
  nurSso,
}: {
  name: string
  email: string
  rolle: string
  nurSso: boolean
}) {
  const initialen = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((teil) => teil[0]?.toUpperCase())
    .join('')

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent focus:ring-ring flex items-center gap-2 rounded-md px-2 py-1.5 text-sm focus:ring-2 focus:outline-none">
        <span className="bg-secondary text-secondary-foreground flex size-7 items-center justify-center rounded-full text-xs font-semibold">
          {initialen || <UserRound className="size-4" />}
        </span>
        <span className="hidden max-w-40 truncate lg:inline">{name}</span>
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate">{name}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {email}
          </span>
          <span className="text-muted-foreground block text-xs font-normal">
            {rolle}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/konto">
            <UserRound />
            Mein Konto
          </Link>
        </DropdownMenuItem>

        {!nurSso ? (
          <DropdownMenuItem asChild>
            <Link href="/passwort-aendern">
              <KeyRound />
              Passwort ändern
            </Link>
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem asChild>
          {/* Bewusst ein gewöhnliches Formular an einen eigenen Endpunkt:
              Eine Server Action liefe durch die Middleware, die das
              Sitzungs-Cookie neu ausstellt – die Abmeldung bliebe wirkungslos.
              Siehe src/app/api/abmelden/route.ts. */}
          <form method="post" action="/api/abmelden" className="w-full">
            <button type="submit" className="flex w-full items-center gap-2">
              <LogOut />
              Abmelden
            </button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
