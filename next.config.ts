import { readFileSync } from 'node:fs'
import type { NextConfig } from 'next'

// Versionsnummer aus der package.json, damit es genau eine Quelle gibt.
const paket = JSON.parse(readFileSync('./package.json', 'utf8')) as {
  version: string
}

const nextConfig: NextConfig = {
  // Standalone-Build für ein schlankes Production-Image (siehe Dockerfile)
  output: 'standalone',
  // Pakete, die nicht gebündelt, sondern zur Laufzeit aus node_modules geladen
  // werden. pdfkit lädt seine Schriftmetriken über das Dateisystem nach,
  // exceljs und bcryptjs enthalten Node-spezifischen Code.
  serverExternalPackages: ['pdfkit', 'exceljs', 'bcryptjs', 'node-cron'],
  // Zur Bauzeit eingefrorene Angaben zur laufenden Fassung. Der Commit wird im
  // Dockerfile als Build-Argument durchgereicht.
  env: {
    APP_VERSION: paket.version,
    APP_BUILD_TIME: new Date().toISOString(),
    APP_GIT_COMMIT: (process.env.GIT_COMMIT ?? '').slice(0, 12),
  },
  experimental: {
    serverActions: {
      // Dateianhänge bis 25 MB (plus Overhead durch die Kodierung).
      bodySizeLimit: '30mb',
      // CSRF-Schutz: Next.js vergleicht bei jedem Aufruf einer Server Action
      // den Origin-Header mit dem Host. Hinter einem Reverse Proxy weicht der
      // Host ab, deshalb wird die öffentliche Adresse hier ausdrücklich
      // erlaubt. Ohne diesen Eintrag würden gültige Aufrufe abgewiesen –
      // fremde Ursprünge bleiben in jedem Fall gesperrt.
      allowedOrigins: erlaubteUrspruenge(),
    },
  },
}

/**
 * Ursprünge, die Server Actions aufrufen dürfen: die konfigurierte Adresse der
 * Anwendung sowie – nur in der Entwicklung – localhost.
 */
function erlaubteUrspruenge(): string[] {
  const urspruenge = new Set<string>()

  for (const wert of [process.env.APP_URL, process.env.AUTH_URL]) {
    const adresse = wert?.trim()
    if (!adresse) continue
    try {
      urspruenge.add(new URL(adresse).host)
    } catch {
      // Ungültige Angaben werden stillschweigend übergangen; die Anwendung
      // bleibt dann beim strengen Standardverhalten von Next.js.
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    urspruenge.add('localhost:3000')
  }

  return [...urspruenge]
}

export default nextConfig
