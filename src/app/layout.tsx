import type { Metadata } from 'next'
import { Toaster } from 'sonner'

import { baueMarkenCss } from '@/lib/branding'
import { holeBranding } from '@/server/branding'

import './globals.css'

/**
 * Titel und Symbol richten sich nach der Konfiguration unter
 * `/admin/erscheinungsbild`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const branding = await holeBranding()

  return {
    title: {
      default: branding.appName,
      template: `%s · ${branding.appName}`,
    },
    description:
      'Verwaltung wiederkehrender IT-Prüf- und Wartungsaufgaben mit revisionssicherem Nachweis.',
    applicationName: branding.appName,
    icons: branding.faviconPath
      ? { icon: '/api/branding/favicon' }
      : { icon: '/marke.svg' },
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const branding = await holeBranding()

  // Die Farbwerte sind zuvor auf #rrggbb normalisiert worden; es gelangt
  // damit ausschließlich validiertes CSS in die Seite.
  const markenCss = baueMarkenCss(branding.primaryColor, branding.accentColor)

  return (
    <html lang="de" suppressHydrationWarning>
      <head>
        <style
          id="markenfarben"
          dangerouslySetInnerHTML={{ __html: markenCss }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
