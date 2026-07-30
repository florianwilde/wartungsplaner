import Link from 'next/link'

import { SeitenKopf } from '@/components/seiten-kopf'
import { erforderlicheRolle } from '@/lib/session'
import { AdminNavigation } from './admin-navigation'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await erforderlicheRolle('ADMIN')

  return (
    <div className="space-y-6">
      <SeitenKopf
        titel="Administration"
        beschreibung="Benutzerverwaltung, Kategorien und revisionssicheres Protokoll."
      />

      <AdminNavigation
        eintraege={[
          { href: '/admin/benutzer', label: 'Benutzer' },
          { href: '/admin/kategorien', label: 'Kategorien' },
          { href: '/admin/erscheinungsbild', label: 'Erscheinungsbild' },
          { href: '/admin/benachrichtigungen', label: 'Benachrichtigungen' },
          { href: '/admin/pruefboegen', label: 'Prüfbögen' },
          { href: '/admin/report-vorlagen', label: 'Report-Vorlagen' },
          { href: '/admin/import-export', label: 'Import / Export' },
          { href: '/admin/system', label: 'System' },
          { href: '/admin/audit', label: 'Audit-Log' },
        ]}
      />

      {children}

      <p className="text-xs text-muted-foreground">
        Hinweis: Benutzer werden nie gelöscht, sondern deaktiviert – sonst wäre
        das Protokoll nicht mehr vollständig zuordenbar. Siehe auch{' '}
        <Link href="/admin/audit" className="underline hover:no-underline">
          Audit-Log
        </Link>
        .
      </p>
    </div>
  )
}
