'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
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
import { SCHWERE_BEZEICHNUNG } from '@/lib/labels'
import {
  abweichungBearbeiten,
  abweichungSchliessen,
} from '@/server/actions/abweichungen'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export type AbweichungWerte = {
  id: string
  title: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  responsibleId: string
  dueDate: string
  status: 'OPEN' | 'IN_PROGRESS'
}

function AbsendenButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Wird gespeichert …' : label}
    </Button>
  )
}

function Fehlermeldung({ text }: { text?: string }) {
  if (!text) return null
  return (
    <p
      role="alert"
      className="bg-destructive/10 text-destructive flex items-start gap-2 rounded-md p-3 text-sm"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {text}
    </p>
  )
}

export function BearbeitenDialog({
  abweichung,
  personen,
}: {
  abweichung: AbweichungWerte
  personen: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await abweichungBearbeiten(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOffen(true)}>
        <Pencil className="size-4" />
        Bearbeiten
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abweichung bearbeiten</DialogTitle>
            <DialogDescription>
              Änderungen werden revisionssicher protokolliert.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="findingId" value={abweichung.id} />

            <div className="space-y-2">
              <Label htmlFor={`title-${abweichung.id}`}>Titel</Label>
              <Input
                id={`title-${abweichung.id}`}
                name="title"
                defaultValue={abweichung.title}
                maxLength={200}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`description-${abweichung.id}`}>
                Beschreibung und Maßnahme
              </Label>
              <Textarea
                id={`description-${abweichung.id}`}
                name="description"
                defaultValue={abweichung.description}
                rows={4}
                maxLength={4000}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor={`severity-${abweichung.id}`}>Schweregrad</Label>
                <select
                  id={`severity-${abweichung.id}`}
                  name="severity"
                  defaultValue={abweichung.severity}
                  className={selectKlassen}
                >
                  {(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((stufe) => (
                    <option key={stufe} value={stufe}>
                      {SCHWERE_BEZEICHNUNG[stufe]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`status-${abweichung.id}`}>Status</Label>
                <select
                  id={`status-${abweichung.id}`}
                  name="status"
                  defaultValue={abweichung.status}
                  className={selectKlassen}
                >
                  <option value="OPEN">Offen</option>
                  <option value="IN_PROGRESS">In Bearbeitung</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`responsible-${abweichung.id}`}>Verantwortlich</Label>
                <select
                  id={`responsible-${abweichung.id}`}
                  name="responsibleId"
                  defaultValue={abweichung.responsibleId}
                  className={selectKlassen}
                >
                  {personen.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`dueDate-${abweichung.id}`}>Frist</Label>
                <Input
                  id={`dueDate-${abweichung.id}`}
                  name="dueDate"
                  type="date"
                  defaultValue={abweichung.dueDate}
                  required
                />
              </div>
            </div>

            <Fehlermeldung text={status.fehler} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Speichern" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function SchliessenDialog({
  findingId,
  titel,
}: {
  findingId: string
  titel: string
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await abweichungSchliessen(vorher, formData)
      if (antwort.erfolg) {
        toast.success(antwort.erfolg)
        setOffen(false)
        router.refresh()
      }
      return antwort
    },
    {},
  )

  return (
    <>
      <Button size="sm" onClick={() => setOffen(true)}>
        <CheckCircle2 className="size-4" />
        Schließen
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abweichung schließen</DialogTitle>
            <DialogDescription>{titel}</DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="findingId" value={findingId} />

            <div className="space-y-2">
              <Label htmlFor={`closing-${findingId}`}>
                Abschlusskommentar (umgesetzte Maßnahme)
              </Label>
              <Textarea
                id={`closing-${findingId}`}
                name="closingComment"
                rows={4}
                minLength={10}
                maxLength={4000}
                required
                placeholder="Welche Maßnahme wurde umgesetzt und wodurch ist die Wirksamkeit belegt?"
              />
              <p className="text-muted-foreground text-xs">
                Eine geschlossene Abweichung kann nicht wieder geöffnet werden.
              </p>
            </div>

            <Fehlermeldung text={status.fehler} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Abweichung schließen" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
