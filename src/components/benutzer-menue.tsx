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
import { abmelden } from '@/app/abmelden-action'

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
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring">
        <span className="flex size-7 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
          {initialen || <UserRound className="size-4" />}
        </span>
        <span className="hidden max-w-40 truncate lg:inline">{name}</span>
        <ChevronDown className="size-4 opacity-60" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block truncate">{name}</span>
          <span className="block truncate text-xs font-normal text-muted-foreground">
            {email}
          </span>
          <span className="block text-xs font-normal text-muted-foreground">
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
          <form action={abmelden} className="w-full">
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
