import type { Metadata } from 'next'
import { BellOff } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/prisma'
import { erforderlicheRolle } from '@/lib/session'
import {
  WOCHENTAGE,
  holeBenachrichtigungsEinstellungen,
} from '@/server/benachrichtigungs-einstellungen'
import { absender, istMailVersandKonfiguriert } from '@/server/mailer'
import { BenachrichtigungenFormular } from './benachrichtigungen-formular'
import { MailEmpfangSchalter } from './empfang-schalter'

export const metadata: Metadata = { title: 'Benachrichtigungen' }
export const dynamic = 'force-dynamic'

const ART_BEZEICHNUNG: Record<string, string> = {
  AUFGABEN: 'Prüfungen',
  ABWEICHUNGEN: 'Abweichungen',
  ESKALATION: 'Eskalation',
  WOCHENUEBERSICHT: 'Wochenübersicht',
  TEST: 'Testnachricht',
}

export default async function BenachrichtigungenSeite() {
  await erforderlicheRolle('ADMIN')

  const [einstellungen, personen, letzteNachrichten] = await Promise.all([
    holeBenachrichtigungsEinstellungen(),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, notifyByEmail: true },
    }),
    prisma.sentNotification.findMany({
      orderBy: { sentAt: 'desc' },
      take: 15,
      select: {
        id: true,
        kind: true,
        recipient: true,
        subject: true,
        sentAt: true,
        itemCount: true,
      },
    }),
  ])

  const konfiguriert = istMailVersandKonfiguriert()
  const beschreibung = konfiguriert
    ? `Mailserver ${process.env.SMTP_HOST} · Absender ${absender()}`
    : 'Es ist kein Mailserver hinterlegt. Setzen Sie SMTP_HOST (und ggf. SMTP_USER, SMTP_PASSWORD, SMTP_FROM) in der .env und starten Sie den Stack neu.'

  const ohneEmpfang = personen.filter((p) => !p.notifyByEmail)

  return (
    <div className="space-y-6">
      <BenachrichtigungenFormular
        werte={einstellungen}
        smtpKonfiguriert={konfiguriert}
        smtpBeschreibung={beschreibung}
        personen={personen.map((p) => ({ id: p.id, name: p.name, email: p.email }))}
        wochentage={WOCHENTAGE}
        mailZeitplan={process.env.MAIL_CRON_SCHEDULE?.trim() || '0 7 * * *'}
      />

      <Card>
        <CardHeader>
          <CardTitle>Empfänger</CardTitle>
          <CardDescription>
            Wer keine Benachrichtigungen wünscht, lässt sich hier einzeln
            abmelden. Die Abmeldung gilt für alle Nachrichtenarten.
            {ohneEmpfang.length > 0 ? (
              <>
                {' '}
                Derzeit abgemeldet: {ohneEmpfang.length} von {personen.length}.
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Benachrichtigungen</TableHead>
                <TableHead className="text-right">Aktion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personen.map((person) => (
                <TableRow key={person.id}>
                  <TableCell className="font-medium">{person.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {person.email}
                  </TableCell>
                  <TableCell>
                    {person.notifyByEmail ? (
                      <Badge variant="ok">Aktiv</Badge>
                    ) : (
                      <Badge variant="neutral">
                        <BellOff className="size-3" />
                        Abgemeldet
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <MailEmpfangSchalter
                      userId={person.id}
                      empfangen={person.notifyByEmail}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Zuletzt versendet</CardTitle>
          <CardDescription>
            Die letzten 15 Nachrichten. Der Versand ist wiederholungssicher:
            Derselbe Vorgang wird nicht zweimal gemeldet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {letzteNachrichten.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              Es wurde noch keine Nachricht versendet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Art</TableHead>
                  <TableHead>Empfänger</TableHead>
                  <TableHead>Betreff</TableHead>
                  <TableHead className="text-right">Vorgänge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {letzteNachrichten.map((nachricht) => (
                  <TableRow key={nachricht.id}>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatDateTime(nachricht.sentAt)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {ART_BEZEICHNUNG[nachricht.kind] ?? nachricht.kind}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {nachricht.recipient}
                    </TableCell>
                    <TableCell className="max-w-80 truncate">
                      {nachricht.subject}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {nachricht.itemCount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
