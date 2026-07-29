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
    // Server Actions erhalten Dateianhänge bis 25 MB (plus Overhead).
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },
}

export default nextConfig
