import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Standalone-Build für ein schlankes Production-Image (siehe Dockerfile)
  output: 'standalone',
  // Pakete, die nicht gebündelt, sondern zur Laufzeit aus node_modules geladen
  // werden. pdfkit lädt seine Schriftmetriken über das Dateisystem nach,
  // exceljs und bcryptjs enthalten Node-spezifischen Code.
  serverExternalPackages: ['pdfkit', 'exceljs', 'bcryptjs', 'node-cron'],
  experimental: {
    // Server Actions erhalten Dateianhänge bis 25 MB (plus Overhead).
    serverActions: {
      bodySizeLimit: '30mb',
    },
  },
}

export default nextConfig
