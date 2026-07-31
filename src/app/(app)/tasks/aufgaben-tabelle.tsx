'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CircleSlash, CirclePlay, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlleAuswaehlen,
  Sammelleiste,
  ZeileAuswaehlen,
  useSammelauswahl,
} from '@/components/sammelauswahl'
import {
  AmpelBadge,
  FaelligkeitsStatusBadge,
  KategoriePunkt,
  KritikalitaetBadge,
} from '@/components/status-anzeigen'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  aufgabenSammelAktivierung,
  aufgabenSammelLoeschen,
} from '@/server/actions/sammelaktionen'
import type { Ampel } from '@/lib/scheduling'
import type { Criticality, OccurrenceStatus } from '@prisma/client'

/**
 * Eine Zeile der Aufgabenliste.
 *
 * Bewusst vorbereitet statt roher Datenbankobjekte: Ampel und Intervalltext
 * ergeben sich aus dem Stichtag, und der gehört auf den Server – sonst
 * bewertet der Browser des Betrachters mit seiner eigenen Uhr.
 */
export type AufgabenZeile = {
  id: string
  titel: string
  aktiv: boolean
  nachweispflicht: boolean
  referenzen: { id: string; kuerzel: string; langname: string }[]
  kategorie: { name: string; farbe: string }
  verantwortlich: string
  intervall: string
  kritikalitaet: Criticality
  naechste: {
    datum: string
    status: OccurrenceStatus
    ampel: Ampel
  } | null
  /** Zahl der protokollierten Durchführungen – entscheidet über das Löschen. */
  durchfuehrungen: number
}

export function AufgabenTabelle({
  aufgaben,
  darfVerwalten,
}: {
  aufgaben: AufgabenZeile[]
  darfVerwalten: boolean
}) {
  const router = useRouter()
  const auswahl = useSammelauswahl(aufgaben.map((a) => a.id))
  const [laeuft, starte] = useTransition()

  const markierte = aufgaben.filter((a) => auswahl.istMarkiert(a.id))
  const mitHistorie = markierte.filter((a) => a.durchfuehrungen > 0).length

  const loeschen = () => {
    const anzahl = auswahl.markiert.length
    if (
      !confirm(
        `${anzahl} ${anzahl === 1 ? 'Aufgabe' : 'Aufgaben'} unwiderruflich löschen?\n\n` +
          'Aufgaben mit protokollierten Durchführungen werden dabei abgelehnt – ' +
          'deren Historie bliebe sonst nicht erhalten.',
      )
    ) {
      return
    }

    starte(async () => {
      const antwort = await aufgabenSammelLoeschen(auswahl.markiert)
      if (antwort.fehler) {
        // Die Meldung nennt die blockierenden Aufgaben und ist deshalb länger
        // als üblich – sie darf nicht nach zwei Sekunden verschwinden.
        toast.error(antwort.fehler, { duration: 12000 })
        return
      }
      toast.success(antwort.erfolg ?? 'Gelöscht.')
      auswahl.leeren()
      router.refresh()
    })
  }

  const aktivierung = (aktiv: boolean) =>
    starte(async () => {
      const antwort = await aufgabenSammelAktivierung(auswahl.markiert, aktiv)
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(antwort.erfolg ?? 'Geändert.')
        auswahl.leeren()
        router.refresh()
      }
    })

  return (
    <div className="space-y-3">
      {darfVerwalten ? (
        <Sammelleiste
          anzahl={auswahl.markiert.length}
          einzahl="Aufgabe"
          mehrzahl="Aufgaben"
          onAbwaehlen={auswahl.leeren}
        >
          <Button
            variant="outline"
            size="sm"
            disabled={laeuft}
            onClick={() => aktivierung(false)}
          >
            <CircleSlash className="size-4" />
            Deaktivieren
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={laeuft}
            onClick={() => aktivierung(true)}
          >
            <CirclePlay className="size-4" />
            Aktivieren
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={laeuft || mitHistorie > 0}
            onClick={loeschen}
            title={
              mitHistorie === 0
                ? undefined
                : mitHistorie === 1
                  ? 'Eine markierte Aufgabe hat bereits Durchführungen.'
                  : `${mitHistorie} markierte Aufgaben haben bereits Durchführungen.`
            }
          >
            <Trash2 className="size-4" />
            Löschen
          </Button>
        </Sammelleiste>
      ) : null}

      {/* Warum die Schaltfläche gesperrt ist, gehört sichtbar an die Stelle –
          ein Titel-Attribut allein findet niemand. */}
      {darfVerwalten && mitHistorie > 0 ? (
        <p className="text-xs text-muted-foreground">
          {mitHistorie === 1
            ? 'Eine markierte Aufgabe hat bereits Durchführungen und lässt sich deshalb nicht löschen'
            : `${mitHistorie} markierte Aufgaben haben bereits Durchführungen und lassen sich deshalb nicht löschen`}
          {' '}– die Historie bliebe sonst nicht erhalten. Deaktivieren Sie
          {mitHistorie === 1 ? ' sie ' : ' diese '}stattdessen.
        </p>
      ) : null}

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {darfVerwalten ? (
                <TableHead className="kein-druck w-10">
                  <AlleAuswaehlen
                    alleMarkiert={auswahl.alleMarkiert}
                    teilweise={auswahl.teilweise}
                    onChange={auswahl.alleUmschalten}
                  />
                </TableHead>
              ) : null}
              <TableHead>Aufgabe</TableHead>
              <TableHead>Kategorie</TableHead>
              <TableHead>Verantwortlich</TableHead>
              <TableHead>Intervall</TableHead>
              <TableHead>Nächste Fälligkeit</TableHead>
              <TableHead>Kritikalität</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {aufgaben.map((aufgabe) => (
              <TableRow
                key={aufgabe.id}
                className={auswahl.istMarkiert(aufgabe.id) ? 'bg-primary/5' : ''}
              >
                {darfVerwalten ? (
                  <TableCell className="kein-druck">
                    <ZeileAuswaehlen
                      markiert={auswahl.istMarkiert(aufgabe.id)}
                      onChange={() => auswahl.umschalten(aufgabe.id)}
                      bezeichnung={aufgabe.titel}
                    />
                  </TableCell>
                ) : null}

                <TableCell>
                  <Link
                    href={`/tasks/${aufgabe.id}`}
                    className="font-medium hover:underline"
                  >
                    {aufgabe.titel}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {!aufgabe.aktiv ? (
                      <Badge variant="secondary">Deaktiviert</Badge>
                    ) : null}
                    {aufgabe.nachweispflicht ? (
                      <Badge variant="outline">Nachweis nötig</Badge>
                    ) : null}
                    {aufgabe.referenzen.map((referenz) => (
                      <Badge
                        key={referenz.id}
                        variant="outline"
                        title={referenz.langname}
                      >
                        {referenz.kuerzel}
                      </Badge>
                    ))}
                  </div>
                </TableCell>

                <TableCell>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <KategoriePunkt farbe={aufgabe.kategorie.farbe} />
                    {aufgabe.kategorie.name}
                  </span>
                </TableCell>

                <TableCell className="whitespace-nowrap">
                  {aufgabe.verantwortlich}
                </TableCell>

                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {aufgabe.intervall}
                </TableCell>

                <TableCell>
                  {aufgabe.naechste ? (
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <span>{aufgabe.naechste.datum}</span>
                      {aufgabe.naechste.status === 'SUSPENDED' ? (
                        <FaelligkeitsStatusBadge status="SUSPENDED" />
                      ) : (
                        <AmpelBadge ampel={aufgabe.naechste.ampel} />
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </TableCell>

                <TableCell>
                  <KritikalitaetBadge kritikalitaet={aufgabe.kritikalitaet} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
