import { BenutzerMenue } from '@/components/benutzer-menue'
import {
  Hauptnavigation,
  type NavigationsEintrag,
} from '@/components/hauptnavigation'
import { MarkenzeichenKompakt } from '@/components/markenzeichen'
import { ROLLEN_BEZEICHNUNG, canAdminister } from '@/lib/rbac'
import { erforderlicherBenutzer } from '@/lib/session'
import { versionKurz } from '@/lib/version'
import { holeBranding } from '@/server/branding'

const GRUNDNAVIGATION: NavigationsEintrag[] = [
  { href: '/', label: 'Dashboard', icon: 'dashboard' },
  { href: '/tasks', label: 'Aufgaben', icon: 'aufgaben' },
  { href: '/findings', label: 'Abweichungen', icon: 'abweichungen' },
  { href: '/nachweise', label: 'Nachweise', icon: 'nachweise' },
  { href: '/calendar', label: 'Kalender', icon: 'kalender' },
  { href: '/reports', label: 'Reports', icon: 'reports' },
]

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const benutzer = await erforderlicherBenutzer()
  const branding = await holeBranding()

  const eintraege: NavigationsEintrag[] = canAdminister(benutzer.role)
    ? [...GRUNDNAVIGATION, { href: '/admin', label: 'Admin', icon: 'admin' }]
    : GRUNDNAVIGATION

  return (
    <div className="flex min-h-screen flex-col">
      <Hauptnavigation
        eintraege={eintraege}
        markenzeichen={<MarkenzeichenKompakt branding={branding} />}
        benutzerBereich={
          <BenutzerMenue
            name={benutzer.name}
            email={benutzer.email}
            rolle={ROLLEN_BEZEICHNUNG[benutzer.role]}
            nurSso={benutzer.authProvider === 'OIDC'}
          />
        }
      />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="kein-druck border-t border-border py-4">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 px-4 text-xs text-muted-foreground sm:px-6">
          <span>
            {branding.appName}
            {branding.organisation ? ` · ${branding.organisation}` : ''} – interne
            Anwendung zur Nachweisführung wiederkehrender IT-Prüfungen. Alle
            Zeitangaben in Europe/Berlin.
          </span>
          <span className="tabular-nums">{versionKurz()}</span>
        </div>
      </footer>
    </div>
  )
}
