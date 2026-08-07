'use client'

import { useActionState, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { useRouter } from 'next/navigation'
import { AlertCircle, KeyRound, Pencil, Power, UserPlus } from 'lucide-react'
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
import { PASSWORT_MINDESTLAENGE } from '@/lib/passwort'
import { ROLLEN_BESCHREIBUNG, ROLLEN_BEZEICHNUNG } from '@/lib/rbac'
import {
  benutzerAendern,
  benutzerAktivierungUmschalten,
  benutzerAnlegen,
  passwortZuruecksetzen,
} from '@/server/actions/benutzer'

const selectKlassen =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

const ROLLEN = ['ADMIN', 'EDITOR', 'AUDITOR'] as const

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

function RollenHinweis({ rolle }: { rolle: (typeof ROLLEN)[number] }) {
  return <p className="text-muted-foreground text-xs">{ROLLEN_BESCHREIBUNG[rolle]}</p>
}

export function BenutzerAnlegenDialog() {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [verfahren, setVerfahren] = useState<'LOCAL' | 'OIDC'>('LOCAL')
  const [rolle, setRolle] = useState<(typeof ROLLEN)[number]>('EDITOR')

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await benutzerAnlegen(vorher, formData)
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
        <UserPlus className="size-4" />
        Benutzer anlegen
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer anlegen</DialogTitle>
            <DialogDescription>
              Konten werden ausschließlich durch die Administration vergeben.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="neu-name">Name</Label>
              <Input id="neu-name" name="name" required maxLength={120} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neu-email">E-Mail-Adresse</Label>
              <Input id="neu-email" name="email" type="email" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neu-role">Rolle</Label>
              <select
                id="neu-role"
                name="role"
                value={rolle}
                onChange={(e) => setRolle(e.target.value as (typeof ROLLEN)[number])}
                className={selectKlassen}
              >
                {ROLLEN.map((wert) => (
                  <option key={wert} value={wert}>
                    {ROLLEN_BEZEICHNUNG[wert]}
                  </option>
                ))}
              </select>
              <RollenHinweis rolle={rolle} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neu-provider">Anmeldeverfahren</Label>
              <select
                id="neu-provider"
                name="authProvider"
                value={verfahren}
                onChange={(e) => setVerfahren(e.target.value as 'LOCAL' | 'OIDC')}
                className={selectKlassen}
              >
                <option value="LOCAL">Passwort (interne Benutzerverwaltung)</option>
                <option value="OIDC">Nur SSO (kein lokales Passwort)</option>
              </select>
            </div>

            {verfahren === 'LOCAL' ? (
              <div className="space-y-2">
                <Label htmlFor="neu-password">Startpasswort</Label>
                <Input
                  id="neu-password"
                  name="password"
                  type="text"
                  minLength={PASSWORT_MINDESTLAENGE}
                  required
                  autoComplete="off"
                />
                <p className="text-muted-foreground text-xs">
                  Mindestens {PASSWORT_MINDESTLAENGE} Zeichen aus drei der vier
                  Kategorien. Der Benutzer muss es beim ersten Login ändern.
                </p>
              </div>
            ) : (
              <p className="bg-muted text-muted-foreground rounded-md p-3 text-xs">
                Das Konto erhält kein lokales Passwort. Die Anmeldung erfolgt über den
                Identity Provider; die Verknüpfung geschieht beim ersten Login über die
                E-Mail-Adresse.
              </p>
            )}

            <Fehlermeldung text={status.fehler} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Benutzer anlegen" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function BenutzerBearbeitenDialog({
  benutzer,
}: {
  benutzer: { id: string; name: string; role: 'ADMIN' | 'EDITOR' | 'AUDITOR' }
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)
  const [rolle, setRolle] = useState(benutzer.role)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await benutzerAendern(vorher, formData)
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
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Rollenänderungen wirken sofort, ohne dass sich der Benutzer neu anmelden
              muss.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="userId" value={benutzer.id} />

            <div className="space-y-2">
              <Label htmlFor={`name-${benutzer.id}`}>Name</Label>
              <Input
                id={`name-${benutzer.id}`}
                name="name"
                defaultValue={benutzer.name}
                required
                maxLength={120}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`role-${benutzer.id}`}>Rolle</Label>
              <select
                id={`role-${benutzer.id}`}
                name="role"
                value={rolle}
                onChange={(e) => setRolle(e.target.value as typeof rolle)}
                className={selectKlassen}
              >
                {ROLLEN.map((wert) => (
                  <option key={wert} value={wert}>
                    {ROLLEN_BEZEICHNUNG[wert]}
                  </option>
                ))}
              </select>
              <RollenHinweis rolle={rolle} />
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

export function PasswortZuruecksetzenDialog({
  userId,
  name,
}: {
  userId: string
  name: string
}) {
  const router = useRouter()
  const [offen, setOffen] = useState(false)

  const [status, formAction] = useActionState(
    async (vorher: { fehler?: string; erfolg?: string }, formData: FormData) => {
      const antwort = await passwortZuruecksetzen(vorher, formData)
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
        <KeyRound className="size-4" />
        Passwort
      </Button>

      <Dialog open={offen} onOpenChange={setOffen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Passwort zurücksetzen</DialogTitle>
            <DialogDescription>
              Neues Startpasswort für {name}. Der Wechsel wird beim nächsten Login
              erzwungen.
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="userId" value={userId} />

            <div className="space-y-2">
              <Label htmlFor={`pw-${userId}`}>Startpasswort</Label>
              <Input
                id={`pw-${userId}`}
                name="password"
                type="text"
                minLength={PASSWORT_MINDESTLAENGE}
                required
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">
                Übermitteln Sie das Passwort auf einem getrennten Weg, nicht per E-Mail
                zusammen mit dem Benutzernamen.
              </p>
            </div>

            <Fehlermeldung text={status.fehler} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOffen(false)}>
                Abbrechen
              </Button>
              <AbsendenButton label="Passwort setzen" />
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function AktivierungSchalter({
  userId,
  aktiv,
}: {
  userId: string
  aktiv: boolean
}) {
  const router = useRouter()
  const [laeuft, starte] = useTransition()

  return (
    <Button
      variant={aktiv ? 'ghost' : 'default'}
      size="sm"
      disabled={laeuft}
      onClick={() =>
        starte(async () => {
          const ergebnis = await benutzerAktivierungUmschalten(userId, !aktiv)
          if (ergebnis.fehler) toast.error(ergebnis.fehler)
          else {
            toast.success(ergebnis.erfolg ?? 'Gespeichert.')
            router.refresh()
          }
        })
      }
    >
      <Power className="size-4" />
      {aktiv ? 'Deaktivieren' : 'Aktivieren'}
    </Button>
  )
}
