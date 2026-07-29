/**
 * E-Mail-Versand über SMTP.
 *
 * Der Versand ist nur aktiv, wenn `SMTP_HOST` gesetzt ist – analog zum
 * OIDC-Provider bleibt die Anwendung ohne Konfiguration vollständig nutzbar.
 * Die Zugangsdaten stehen ausschließlich in der `.env`.
 */
import nodemailer, { type Transporter } from 'nodemailer'

import type { MailInhalt } from '@/lib/mail-vorlagen'

/** Ist ein Mailserver konfiguriert? */
export function istMailVersandKonfiguriert(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim())
}

/** Absenderadresse; fällt auf einen unverfänglichen Standard zurück. */
export function absender(): string {
  return process.env.SMTP_FROM?.trim() || 'wartungsplaner@localhost'
}

// Der Transporter wird am globalen Objekt gehalten, damit bei Hot-Reload und
// über Anfragen hinweg dieselbe Verbindung wiederverwendet wird.
const globalForMail = globalThis as unknown as {
  wartungsplanerTransport: Transporter | undefined
}

function holeTransport(): Transporter {
  if (globalForMail.wartungsplanerTransport) {
    return globalForMail.wartungsplanerTransport
  }

  const host = process.env.SMTP_HOST?.trim()
  if (!host) {
    throw new Error(
      'Es ist kein Mailserver konfiguriert. Bitte SMTP_HOST in der .env setzen.',
    )
  }

  const port = Number(process.env.SMTP_PORT ?? '587')
  const benutzer = process.env.SMTP_USER?.trim()
  const passwort = process.env.SMTP_PASSWORD ?? ''

  const transport = nodemailer.createTransport({
    host,
    port: Number.isFinite(port) ? port : 587,
    // Port 465 spricht von Beginn an TLS, 587 verwendet STARTTLS.
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: benutzer ? { user: benutzer, pass: passwort } : undefined,
    tls: {
      // Nur für interne Mailserver mit eigenem Zertifikat auf "false" setzen.
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
    },
    // Ein hängender Mailserver darf den täglichen Job nicht blockieren.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })

  globalForMail.wartungsplanerTransport = transport
  return transport
}

export type VersandErgebnis =
  | { erfolg: true; messageId: string }
  | { erfolg: false; fehler: string }

/**
 * Versendet eine Nachricht. Fehler werden zurückgegeben statt geworfen, damit
 * ein einzelner Fehlschlag den Rest eines Sammellaufs nicht abbricht.
 */
export async function versendeMail(
  empfaenger: string,
  inhalt: MailInhalt,
): Promise<VersandErgebnis> {
  if (!istMailVersandKonfiguriert()) {
    return {
      erfolg: false,
      fehler: 'Es ist kein Mailserver konfiguriert (SMTP_HOST fehlt).',
    }
  }

  try {
    const ergebnis = await holeTransport().sendMail({
      from: absender(),
      to: empfaenger,
      subject: inhalt.betreff,
      text: inhalt.text,
      html: inhalt.html,
    })
    return { erfolg: true, messageId: ergebnis.messageId }
  } catch (error) {
    const nachricht = error instanceof Error ? error.message : String(error)
    console.error(`E-Mail an ${empfaenger} fehlgeschlagen:`, nachricht)
    return { erfolg: false, fehler: nachricht }
  }
}

/** Prüft die Erreichbarkeit des Mailservers, ohne etwas zu versenden. */
export async function pruefeMailVerbindung(): Promise<VersandErgebnis> {
  if (!istMailVersandKonfiguriert()) {
    return {
      erfolg: false,
      fehler: 'Es ist kein Mailserver konfiguriert (SMTP_HOST fehlt).',
    }
  }

  try {
    await holeTransport().verify()
    return { erfolg: true, messageId: '' }
  } catch (error) {
    const nachricht = error instanceof Error ? error.message : String(error)
    return { erfolg: false, fehler: nachricht }
  }
}

/** Setzt den zwischengespeicherten Transporter zurück (nach Konfigwechsel). */
export function verwerfeTransport(): void {
  globalForMail.wartungsplanerTransport?.close()
  globalForMail.wartungsplanerTransport = undefined
}
