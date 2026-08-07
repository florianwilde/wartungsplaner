import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldAlert } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { holeBenutzer } from '@/lib/session'
import { ROLLEN_BEZEICHNUNG } from '@/lib/rbac'

export const metadata: Metadata = { title: 'Kein Zugriff' }

export default async function KeinZugriffSeite() {
  const benutzer = await holeBenutzer()

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <span className="bg-destructive/10 text-destructive mb-2 flex size-10 items-center justify-center rounded-lg">
            <ShieldAlert className="size-5" />
          </span>
          <CardTitle>Kein Zugriff</CardTitle>
          <CardDescription>
            Für diesen Bereich fehlt Ihnen die erforderliche Berechtigung.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {benutzer ? (
            <p className="text-muted-foreground text-sm">
              Angemeldet als <strong>{benutzer.name}</strong> mit der Rolle{' '}
              <strong>{ROLLEN_BEZEICHNUNG[benutzer.role]}</strong>. Wenden Sie sich an
              einen Administrator, wenn Sie weitergehende Rechte benötigen.
            </p>
          ) : null}
          <Button asChild>
            <Link href="/">Zurück zum Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
