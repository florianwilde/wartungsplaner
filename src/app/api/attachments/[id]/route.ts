import { readFile } from 'node:fs/promises'
import { NextResponse, type NextRequest } from 'next/server'

import { schreibeAuditLeise } from '@/lib/audit'
import { prisma } from '@/lib/prisma'
import { holeBenutzer } from '@/lib/session'
import { absoluterPfad } from '@/server/dateiablage'

export const dynamic = 'force-dynamic'

/**
 * Liefert einen Nachweis aus dem Upload-Volume aus.
 * Jeder Abruf wird protokolliert, weil Nachweise Prüfungsgegenstand sind.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const benutzer = await holeBenutzer()
  if (!benutzer) {
    return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })
  }

  const { id } = await params
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      storedPath: true,
      mimeType: true,
      sizeBytes: true,
      sha256: true,
      archiviertAm: true,
    },
  })

  if (!attachment) {
    return NextResponse.json({ fehler: 'Nachweis nicht gefunden.' }, { status: 404 })
  }

  // Nach Ablauf der Aufbewahrungsfrist entfernt. Der Eintrag bleibt bestehen,
  // damit belegbar ist, dass es diesen Nachweis gab - die Datei ist bewusst
  // fort. Das gehoert klar gesagt, sonst sucht jemand nach einem Fehler.
  if (attachment.archiviertAm) {
    return NextResponse.json(
      {
        fehler:
          'Dieser Nachweis wurde nach Ablauf der Aufbewahrungsfrist entfernt. ' +
          'Dateiname, Groesse und Pruefsumme bleiben zum Beleg erhalten.',
        entferntAm: attachment.archiviertAm,
        sha256: attachment.sha256,
      },
      { status: 410 },
    )
  }

  let inhalt: Buffer
  try {
    inhalt = await readFile(absoluterPfad(attachment.storedPath))
  } catch (error) {
    console.error(`Nachweis ${attachment.id} konnte nicht gelesen werden:`, error)
    return NextResponse.json(
      { fehler: 'Die Datei ist im Ablageverzeichnis nicht auffindbar.' },
      { status: 410 },
    )
  }

  await schreibeAuditLeise({
    userId: benutzer.id,
    action: 'ATTACHMENT_DOWNLOADED',
    entityType: 'Attachment',
    entityId: attachment.id,
    payload: { dateiname: attachment.filename, sha256: attachment.sha256 },
  })

  // RFC 5987 für Umlaute im Dateinamen.
  const asciiName = attachment.filename.replace(/[^\x20-\x7e]/g, '_')
  const utf8Name = encodeURIComponent(attachment.filename)

  return new NextResponse(new Uint8Array(inhalt), {
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(inhalt.byteLength),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${utf8Name}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
