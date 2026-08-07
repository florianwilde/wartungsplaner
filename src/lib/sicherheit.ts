/**
 * Bausteine der Sicherheitshärtung.
 *
 * Reine Funktionen ohne Framework-Bezug, damit sie sowohl in der
 * Edge-Laufzeit (proxy.ts) als auch in Tests verwendbar sind.
 */

/**
 * Erzeugt einen zufälligen Nonce für die Content-Security-Policy.
 * Verwendet die Web-Crypto-API, die in der Edge- und der Node-Laufzeit
 * gleichermaßen zur Verfügung steht.
 */
export function erzeugeNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  // btoa erwartet eine Zeichenkette aus Codepunkten 0–255.
  return btoa(String.fromCharCode(...bytes))
}

export type CspOptionen = {
  nonce: string
  /** In der Entwicklung benötigt Next.js `unsafe-eval` für Hot-Reloading. */
  entwicklung?: boolean
  /** Bei HTTPS wird zusätzlich auf sichere Verbindungen umgestellt. */
  https?: boolean
}

/**
 * Baut die Content-Security-Policy.
 *
 * Skripte werden über einen Nonce freigegeben; `strict-dynamic` erlaubt den
 * von Next.js nachgeladenen Bündeln, weitere Skripte zu laden, ohne dass eine
 * Positivliste gepflegt werden muss. Inline-Stile bleiben zugelassen, weil
 * sowohl Next.js als auch die Markenfarben Stile direkt einbetten – das
 * Risiko ist dort deutlich geringer als bei Skripten.
 */
export function baueContentSecurityPolicy({
  nonce,
  entwicklung = false,
  https = false,
}: CspOptionen): string {
  const skriptQuellen = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    entwicklung ? "'unsafe-eval'" : '',
  ].filter(Boolean)

  const richtlinien: string[] = [
    "default-src 'self'",
    `script-src ${skriptQuellen.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    // data: für eingebettete Symbole, blob: für Vorschauen gewählter Dateien
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    // Formulare dürfen ausschließlich an die eigene Anwendung gesendet werden
    "form-action 'self'",
    // Einbettung in fremde Seiten unterbinden (Schutz vor Clickjacking)
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ]

  if (https) richtlinien.push('upgrade-insecure-requests')

  return richtlinien.join('; ')
}

/**
 * Weitere Schutz-Header.
 *
 * `Strict-Transport-Security` wird nur bei einer HTTPS-Anfrage gesetzt – sonst
 * würde eine Installation ohne Zertifikat unerreichbar.
 */
export function baueSicherheitsHeader(https: boolean): Record<string, string> {
  const header: Record<string, string> = {
    // Verhindert das Erraten des Inhaltstyps (relevant bei Nachweisdateien)
    'X-Content-Type-Options': 'nosniff',
    // Ergänzt frame-ancestors für ältere Browser
    'X-Frame-Options': 'DENY',
    // Keine Adressen an fremde Seiten weitergeben
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Nicht benötigte Browserfunktionen abschalten
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
    // Ältere Browser: Anwendung nicht über andere Domains einbinden
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  }

  if (https) {
    header['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  }

  return header
}

/**
 * Entfernt Steuerzeichen (C0-Bereich und DEL) aus einer Zeichenkette.
 *
 * Sie sind in Dateinamen, Anzeigenamen und E-Mail-Kopfzeilen gleichermaßen
 * unerwünscht: Im Dateisystem sind sie teils unzulässig, in Kopfzeilen
 * erlaubt ein Zeilenumbruch das Einschleusen weiterer Zeilen, und in der
 * Anzeige sind sie unsichtbar – was sie zum bequemen Versteck macht.
 */
export function ohneSteuerzeichen(text: string, ersatz = ''): string {
  // Absichtlich Steuerzeichen: genau die sollen hier weg.
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u001f\u007f]/g, ersatz)
}

/**
 * Entfernt Steuerzeichen aus einer Zeichenkette und macht sie einzeilig.
 *
 * Wird auf alle Werte angewandt, die in E-Mail-Kopfzeilen landen. Ein
 * Zeilenumbruch im Betreff könnte sonst weitere Kopfzeilen einschleusen
 * (Header Injection).
 */
export function einzeilig(text: string, maxLaenge = 200): string {
  return ohneSteuerzeichen(text, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLaenge)
}
