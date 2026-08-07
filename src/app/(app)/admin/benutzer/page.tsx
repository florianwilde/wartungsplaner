import type { Metadata } from 'next'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { istOidcAktiv, oidcAnzeigename } from '@/auth'
import { formatDateTime, todayInBerlin, toISODate } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { ROLLEN_BEZEICHNUNG } from '@/lib/rbac'
import { erforderlicheRolle } from '@/lib/session'
import { beschreibeZeitraum, istVertretungAktiv } from '@/lib/vertretung'
import {
  AktivierungSchalter,
  BenutzerAnlegenDialog,
  BenutzerBearbeitenDialog,
  PasswortZuruecksetzenDialog,
} from './benutzer-aktionen'
import { PasskeysZuruecksetzenButton } from './passkey-zuruecksetzen'
import { VertretungDialog } from './vertretung-dialog'

export const metadata: Metadata = { title: 'Benutzer' }
export const dynamic = 'force-dynamic'

export default async function BenutzerSeite() {
  const admin = await erforderlicheRolle('ADMIN')

  const benutzer = await prisma.user.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    include: {
      vertretung: { select: { name: true } },
      _count: { select: { ownedTasks: true, executions: true, passkeys: true } },
    },
  })

  const sso = istOidcAktiv()
  const heute = todayInBerlin()

  // Wählbare Vertretungen: aktive Konten mit Ausführungsrecht.
  const kandidaten = benutzer
    .filter((p) => p.active && (p.role === 'ADMIN' || p.role === 'EDITOR'))
    .map((p) => ({ id: p.id, name: p.name }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Benutzer</CardTitle>
          <CardDescription>
            {sso
              ? `Interne Konten und SSO-Konten (${oidcAnzeigename()}). Über SSO neu angelegte Konten erhalten zunächst die Rolle Auditor.`
              : 'Interne Benutzerverwaltung. SSO ist nicht konfiguriert.'}
          </CardDescription>
        </div>
        <BenutzerAnlegenDialog />
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Rolle</TableHead>
              <TableHead>Anmeldung</TableHead>
              <TableHead>Passkeys</TableHead>
              <TableHead>Letzter Login</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {benutzer.map((person) => (
              <TableRow key={person.id}>
                <TableCell>
                  <span className="font-medium">{person.name}</span>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {!person.active ? (
                      <Badge variant="secondary">Deaktiviert</Badge>
                    ) : null}
                    {person.mustChangePassword ? (
                      <Badge variant="warn">Passwortwechsel offen</Badge>
                    ) : null}
                    {person.id === admin.id ? (
                      <Badge variant="outline">Sie</Badge>
                    ) : null}
                    {person.vertretung &&
                    istVertretungAktiv(
                      {
                        vertretungId: person.vertretungId,
                        von: person.vertretungVon,
                        bis: person.vertretungBis,
                      },
                      heute,
                    ) ? (
                      <Badge variant="secondary">
                        vertreten durch {person.vertretung.name}
                      </Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {person.email}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {ROLLEN_BEZEICHNUNG[person.role]}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {person.authProvider === 'OIDC' ? 'SSO' : 'Passwort'}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                  {person._count.passkeys}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {person.lastLoginAt ? formatDateTime(person.lastLoginAt) : 'nie'}
                </TableCell>
                <TableCell>
                  <div className="kein-druck flex flex-wrap justify-end gap-2">
                    <BenutzerBearbeitenDialog
                      benutzer={{
                        id: person.id,
                        name: person.name,
                        role: person.role,
                      }}
                    />
                    {person.active &&
                    (person.role === 'ADMIN' || person.role === 'EDITOR') ? (
                      <VertretungDialog
                        personId={person.id}
                        name={person.name}
                        personen={kandidaten.filter((k) => k.id !== person.id)}
                        hinweis={
                          person.vertretung
                            ? `Hinterlegt: ${person.vertretung.name} · ${beschreibeZeitraum(
                                person.vertretungVon,
                                person.vertretungBis,
                              )}`
                            : null
                        }
                        start={{
                          vertretungId: person.vertretungId,
                          von: person.vertretungVon
                            ? toISODate(person.vertretungVon)
                            : '',
                          bis: person.vertretungBis
                            ? toISODate(person.vertretungBis)
                            : '',
                        }}
                      />
                    ) : null}
                    {person.authProvider === 'LOCAL' ? (
                      <PasswortZuruecksetzenDialog
                        userId={person.id}
                        name={person.name}
                      />
                    ) : null}
                    {person._count.passkeys > 0 ? (
                      <PasskeysZuruecksetzenButton
                        userId={person.id}
                        name={person.name}
                        anzahl={person._count.passkeys}
                      />
                    ) : null}
                    {person.id !== admin.id ? (
                      <AktivierungSchalter userId={person.id} aktiv={person.active} />
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <p className="text-muted-foreground mt-4 text-xs">
          {benutzer.length} Konten, davon {benutzer.filter((b) => b.active).length}{' '}
          aktiv.
        </p>
      </CardContent>
    </Card>
  )
}
