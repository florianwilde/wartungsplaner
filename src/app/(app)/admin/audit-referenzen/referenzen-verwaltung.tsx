'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import {
  AlleAuswaehlen,
  Sammelleiste,
  ZeileAuswaehlen,
  useSammelauswahl,
} from '@/components/sammelauswahl'
import { referenzenSammelLoeschen } from '@/server/actions/sammelaktionen'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  RAHMENWERK_VORSCHLAEGE,
  anzeigeName,
  nachRahmenwerk,
} from '@/lib/audit-referenzen'
import {
  referenzLoeschen,
  referenzSpeichern,
} from '@/server/actions/audit-referenzen'

export type ReferenzAnzeige = {
  id: string
  kuerzel: string
  bezeichnung: string
  rahmenwerk: string | null
  beschreibung: string | null
  aktiv: boolean
  anzahlAufgaben: number
}

function SpeichernButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : 'Speichern'}
    </Button>
  )
}

export function ReferenzenVerwaltung({
  referenzen,
}: {
  referenzen: ReferenzAnzeige[]
}) {
  const router = useRouter()
  const [bearbeitet, setBearbeitet] = useState<ReferenzAnzeige | null>(null)
  const [neu, setNeu] = useState(false)
  const [laeuft, starte] = useTransition()

  const offen = neu || bearbeitet !== null

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await referenzSpeichern(
        bearbeitet?.id ?? null,
        vorher,
        formData,
      )
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setNeu(false)
        setBearbeitet(null)
        router.refresh()
      } else if (antwort.fehler) {
        toast.error(antwort.fehler)
      }
      return antwort
    },
    {},
  )

  const loesche = (referenz: ReferenzAnzeige) =>
    starte(async () => {
      const antwort = await referenzLoeschen(referenz.id)
      if (antwort.fehler) toast.error(antwort.fehler)
      else {
        toast.success(antwort.erfolg ?? 'Gelöscht.')
        router.refresh()
      }
    })

  const alleIds = referenzen.map((r) => r.id)
  const auswahl = useSammelauswahl(alleIds)
  const [sammelLaeuft, starteSammel] = useTransition()

  /** Löscht die markierten Referenzen – zugeordnete bleiben geschützt. */
  const markierteLoeschen = () => {
    const anzahl = auswahl.markiert.length
    if (
      !confirm(
        `${anzahl} ${anzahl === 1 ? 'Referenz' : 'Referenzen'} löschen? ` +
          'Referenzen mit zugeordneten Aufgaben werden dabei abgelehnt.',
      )
    ) {
      return
    }

    starteSammel(async () => {
      const antwort = await referenzenSammelLoeschen(auswahl.markiert)
      if (antwort.fehler) {
        // Die Meldung nennt die blockierenden Einträge und ist deshalb
        // länger als üblich – sie darf nicht nach zwei Sekunden weg sein.
        toast.error(antwort.fehler, { duration: 12000 })
        return
      }
      toast.success(antwort.erfolg ?? 'Gelöscht.')
      auswahl.leeren()
      router.refresh()
    })
  }

  const gruppen = nachRahmenwerk(referenzen)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {referenzen.length > 0 ? (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <AlleAuswaehlen
              alleMarkiert={auswahl.alleMarkiert}
              teilweise={auswahl.teilweise}
              onChange={auswahl.alleUmschalten}
            />
            Alle markieren
          </label>
        ) : (
          <span />
        )}
        <Button onClick={() => setNeu(true)}>
          <Plus className="size-4" />
          Referenz anlegen
        </Button>
      </div>

      <Sammelleiste
        anzahl={auswahl.markiert.length}
        einzahl="Referenz"
        mehrzahl="Referenzen"
        onAbwaehlen={auswahl.leeren}
      >
        <Button
          variant="destructive"
          size="sm"
          disabled={sammelLaeuft}
          onClick={markierteLoeschen}
        >
          <Trash2 className="size-4" />
          {sammelLaeuft ? 'Wird gelöscht …' : 'Markierte löschen'}
        </Button>
      </Sammelleiste>

      {referenzen.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Audit-Referenzen</CardTitle>
            <CardDescription>
              Legen Sie die Anforderungen an, gegen die geprüft wird – etwa
              „ISO 27001 A.8.13“. Anschließend lassen sich Aufgaben ihnen
              zuordnen und Auswertungen danach filtern.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        gruppen.map((gruppe) => (
          <Card key={gruppe.rahmenwerk ?? 'ohne'}>
            <CardHeader>
              <CardTitle>{gruppe.rahmenwerk ?? 'Ohne Rahmenwerk'}</CardTitle>
              <CardDescription>
                {gruppe.eintraege.length}{' '}
                {gruppe.eintraege.length === 1 ? 'Referenz' : 'Referenzen'}
                {gruppe.rahmenwerk === null
                  ? ' · aus früheren Freitexten übernommen; das Rahmenwerk lässt sich nachtragen'
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {gruppe.eintraege.map((referenz) => (
                  <li
                    key={referenz.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-md border p-3 ${
                      auswahl.istMarkiert(referenz.id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span className="kein-druck mt-1">
                        <ZeileAuswaehlen
                          markiert={auswahl.istMarkiert(referenz.id)}
                          onChange={() => auswahl.umschalten(referenz.id)}
                          bezeichnung={referenz.kuerzel}
                        />
                      </span>
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{referenz.kuerzel}</span>
                        {!referenz.aktiv ? (
                          <Badge variant="neutral">inaktiv</Badge>
                        ) : null}
                        {referenz.anzahlAufgaben > 0 ? (
                          <Link
                            href={`/tasks?referenz=${referenz.id}`}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                          >
                            {referenz.anzahlAufgaben}{' '}
                            {referenz.anzahlAufgaben === 1 ? 'Aufgabe' : 'Aufgaben'}
                            <ArrowRight className="size-3" />
                          </Link>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            keine Aufgabe zugeordnet
                          </span>
                        )}
                      </div>
                      {referenz.bezeichnung !== referenz.kuerzel ? (
                        <p className="mt-0.5 text-sm">{referenz.bezeichnung}</p>
                      ) : null}
                      {referenz.beschreibung ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {referenz.beschreibung}
                        </p>
                      ) : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBearbeitet(referenz)}
                      >
                        <Pencil className="size-4" />
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={laeuft || referenz.anzahlAufgaben > 0}
                        title={
                          referenz.anzahlAufgaben > 0
                            ? 'Zugeordnete Aufgaben verhindern das Löschen. Deaktivieren Sie die Referenz stattdessen.'
                            : undefined
                        }
                        onClick={() => loesche(referenz)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog
        open={offen}
        onOpenChange={(auf) => {
          if (!auf) {
            setNeu(false)
            setBearbeitet(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {bearbeitet ? 'Audit-Referenz bearbeiten' : 'Audit-Referenz anlegen'}
            </DialogTitle>
            <DialogDescription>
              {bearbeitet
                ? anzeigeName(bearbeitet)
                : 'Eine Anforderung, gegen die geprüft wird.'}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="rahmenwerk">Rahmenwerk</Label>
                <Input
                  id="rahmenwerk"
                  name="rahmenwerk"
                  list="rahmenwerke"
                  maxLength={60}
                  placeholder="ISO 27001"
                  defaultValue={bearbeitet?.rahmenwerk ?? ''}
                />
                <datalist id="rahmenwerke">
                  {RAHMENWERK_VORSCHLAEGE.map((wert) => (
                    <option key={wert} value={wert} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kuerzel">Kurzzeichen</Label>
                <Input
                  id="kuerzel"
                  name="kuerzel"
                  required
                  maxLength={60}
                  placeholder="A.8.13"
                  defaultValue={bearbeitet?.kuerzel ?? ''}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bezeichnung">Bezeichnung</Label>
              <Input
                id="bezeichnung"
                name="bezeichnung"
                maxLength={200}
                placeholder="Informationssicherung"
                defaultValue={bearbeitet?.bezeichnung ?? ''}
              />
              <p className="text-xs text-muted-foreground">
                Ohne Angabe steht das Kurzzeichen für sich.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="beschreibung">Beschreibung</Label>
              <Textarea
                id="beschreibung"
                name="beschreibung"
                rows={3}
                maxLength={1000}
                defaultValue={bearbeitet?.beschreibung ?? ''}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="aktiv"
                defaultChecked={bearbeitet?.aktiv ?? true}
                className="size-4"
              />
              Aktiv – zur Zuordnung an Aufgaben anbieten
            </label>

            {status.fehler ? (
              <p role="alert" className="text-sm text-destructive">
                {status.fehler}
              </p>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setNeu(false)
                  setBearbeitet(null)
                }}
              >
                Abbrechen
              </Button>
              <SpeichernButton />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
