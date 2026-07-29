import { readFile } from 'node:fs/promises'
import { NextResponse, type NextRequest } from 'next/server'

import { holeBranding } from '@/server/branding'
import { absoluterPfad } from '@/server/dateiablage'
import { mimeTypFuerPfad, type BrandingBildArt } from '@/lib/bilder'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ARTEN: BrandingBildArt[] = ['logo', 'logo-dunkel', 'favicon']

/**
 * Liefert das konfigurierte Logo bzw. Favicon aus dem Upload-Volume.
 *
 * Der Endpunkt ist bewusst ohne Anmeldung erreichbar: Das Logo erscheint
 * bereits auf der Anmeldeseite. Ausgeliefert werden ausschließlich Pfade, die
 * in der Branding-Konfiguration hinterlegt sind – beliebige Dateipfade lassen
 * sich darüber nicht abrufen.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ art: string }> },
) {
  const { art } = await params
  if (!ARTEN.includes(art as BrandingBildArt)) {
    return NextResponse.json({ fehler: 'Unbekannte Bildart.' }, { status: 404 })
  }

  const branding = await holeBranding()
  const pfad =
    art === 'logo'
      ? branding.logoPath
      : art === 'logo-dunkel'
        ? branding.logoDarkPath
        : branding.faviconPath

  if (!pfad) {
    return NextResponse.json(
      { fehler: 'Für diese Bildart ist kein eigenes Motiv hinterlegt.' },
      { status: 404 },
    )
  }

  let inhalt: Buffer
  try {
    inhalt = await readFile(absoluterPfad(pfad))
  } catch (error) {
    console.error(`Branding-Datei "${pfad}" nicht lesbar:`, error)
    return NextResponse.json({ fehler: 'Datei nicht gefunden.' }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(inhalt), {
    headers: {
      'Content-Type': mimeTypFuerPfad(pfad),
      'Content-Length': String(inhalt.byteLength),
      // Der Dateiname enthält eine Zufallskennung; ein Wechsel des Logos
      // ändert die URL und umgeht damit den Zwischenspeicher.
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      // Hochgeladene SVG-Dateien könnten Skripte enthalten. Beim Einbinden per
      // <img> werden diese ohnehin nicht ausgeführt; die Sandbox verhindert es
      // zusätzlich beim direkten Aufruf der URL.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  })
}
