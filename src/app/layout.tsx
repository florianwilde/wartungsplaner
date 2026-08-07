import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'
import { Toaster } from 'sonner'

import { baueMarkenCss } from '@/lib/branding'
import {
  FARBSCHEMA_COOKIE,
  FARBSCHEMA_SKRIPT,
  colorSchemeWert,
  istDunkelServerseitig,
  leseFarbschema,
  toasterSchema,
} from '@/lib/farbschema'
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
  // Der Nonce stammt aus proxy.ts und gehört zur Content-Security-Policy.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  const farbschema = leseFarbschema((await cookies()).get(FARBSCHEMA_COOKIE)?.value)

  // Die Farbwerte sind zuvor auf #rrggbb normalisiert worden; es gelangt
  // damit ausschließlich validiertes CSS in die Seite.
  const markenCss = baueMarkenCss(branding.primaryColor, branding.accentColor)

  return (
    <html
      lang="de"
      className={istDunkelServerseitig(farbschema) ? 'dark' : undefined}
      style={{ colorScheme: colorSchemeWert(farbschema) }}
      suppressHydrationWarning
    >
      <head>
        <style
          id="markenfarben"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: markenCss }}
        />
        {/*
          Setzt das Farbschema, bevor die Seite gezeichnet wird. Ohne diesen
          Schritt würde bei „Systemvorgabe“ oder dunklem Schema kurz die helle
          Fassung aufblitzen.
        */}
        <script
          id="farbschema"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: FARBSCHEMA_SKRIPT }}
        />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster
          position="top-right"
          richColors
          closeButton
          theme={toasterSchema(farbschema)}
        />
      </body>
    </html>
  )
}
