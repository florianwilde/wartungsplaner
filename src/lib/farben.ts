/**
 * Farb-Hilfsfunktionen für das konfigurierbare Erscheinungsbild.
 *
 * Alle Funktionen sind rein und arbeiten mit Hex-Farben (#rrggbb), weil das
 * Format sowohl von `<input type="color">` als auch von pdfkit und exceljs
 * verstanden wird. Die Umrechnungen folgen der sRGB-Spezifikation.
 */

export type Rgb = { r: number; g: number; b: number }

/** Prüft, ob eine Zeichenkette eine Hex-Farbe der Form #rrggbb ist. */
export function istHexFarbe(wert: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(wert.trim())
}

/**
 * Normalisiert eine Farbeingabe auf #rrggbb (Kleinbuchstaben).
 * Akzeptiert auch Kurzform (#abc) und fehlende Raute.
 * @returns die normalisierte Farbe oder `null` bei ungültiger Eingabe.
 */
export function normalisiereHex(wert: string): string | null {
  let text = wert.trim().toLowerCase()
  if (!text.startsWith('#')) text = `#${text}`

  if (/^#[0-9a-f]{3}$/.test(text)) {
    const [, r, g, b] = text
    return `#${r}${r}${g}${g}${b}${b}`
  }
  if (/^#[0-9a-f]{6}$/.test(text)) return text

  return null
}

export function hexZuRgb(hex: string): Rgb {
  const normalisiert = normalisiereHex(hex)
  if (!normalisiert) {
    throw new Error(`Ungültige Farbe: "${hex}" (erwartet #rrggbb)`)
  }
  return {
    r: parseInt(normalisiert.slice(1, 3), 16),
    g: parseInt(normalisiert.slice(3, 5), 16),
    b: parseInt(normalisiert.slice(5, 7), 16),
  }
}

export function rgbZuHex({ r, g, b }: Rgb): string {
  const teil = (wert: number) =>
    Math.max(0, Math.min(255, Math.round(wert)))
      .toString(16)
      .padStart(2, '0')
  return `#${teil(r)}${teil(g)}${teil(b)}`
}

/** Relative Leuchtdichte nach WCAG 2.1 (0 = schwarz, 1 = weiß). */
export function relativeLeuchtdichte(hex: string): number {
  const { r, g, b } = hexZuRgb(hex)
  const kanal = (wert: number) => {
    const anteil = wert / 255
    return anteil <= 0.03928
      ? anteil / 12.92
      : Math.pow((anteil + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * kanal(r) + 0.7152 * kanal(g) + 0.0722 * kanal(b)
}

/** Kontrastverhältnis zweier Farben nach WCAG 2.1 (1 bis 21). */
export function kontrastVerhaeltnis(farbeA: string, farbeB: string): number {
  const a = relativeLeuchtdichte(farbeA)
  const b = relativeLeuchtdichte(farbeB)
  const hell = Math.max(a, b)
  const dunkel = Math.min(a, b)
  return (hell + 0.05) / (dunkel + 0.05)
}

/**
 * Wählt Weiß oder ein dunkles Anthrazit als Vordergrundfarbe – je nachdem,
 * was auf der gegebenen Hintergrundfarbe besser lesbar ist. So bleibt
 * Schrift auf Schaltflächen auch bei sehr hellen Wunschfarben lesbar.
 */
export function lesbareVordergrundfarbe(hintergrund: string): string {
  const WEISS = '#ffffff'
  const ANTHRAZIT = '#1c1c1c'
  return kontrastVerhaeltnis(hintergrund, WEISS) >=
    kontrastVerhaeltnis(hintergrund, ANTHRAZIT)
    ? WEISS
    : ANTHRAZIT
}

/** Mindestkontrast für normalen Text nach WCAG 2.1 Stufe AA. */
export const KONTRAST_AA = 4.5

/**
 * Bester erreichbarer Kontrast einer Hintergrundfarbe gegen die
 * bestmögliche Vordergrundfarbe.
 *
 * Bei mittleren Helligkeiten (z. B. reinem Mittelgrau) ist Stufe AA
 * rechnerisch mit keiner Vordergrundfarbe erreichbar – die Oberfläche weist
 * bei der Farbwahl darauf hin.
 */
export function besterKontrast(hintergrund: string): number {
  return kontrastVerhaeltnis(hintergrund, lesbareVordergrundfarbe(hintergrund))
}

/** Erreicht die Farbe als Schaltflächenhintergrund die WCAG-Stufe AA? */
export function erreichtKontrastAA(hintergrund: string): boolean {
  return besterKontrast(hintergrund) >= KONTRAST_AA
}

/**
 * Mischt zwei Farben. `anteil` = 0 liefert `farbeA`, 1 liefert `farbeB`.
 */
export function mische(farbeA: string, farbeB: string, anteil: number): string {
  const a = hexZuRgb(farbeA)
  const b = hexZuRgb(farbeB)
  const gewicht = Math.max(0, Math.min(1, anteil))
  return rgbZuHex({
    r: a.r + (b.r - a.r) * gewicht,
    g: a.g + (b.g - a.g) * gewicht,
    b: a.b + (b.b - a.b) * gewicht,
  })
}

/** Hellt eine Farbe in Richtung Weiß auf. */
export function aufhellen(hex: string, anteil: number): string {
  return mische(hex, '#ffffff', anteil)
}

/** Dunkelt eine Farbe in Richtung Schwarz ab. */
export function abdunkeln(hex: string, anteil: number): string {
  return mische(hex, '#000000', anteil)
}

/**
 * Erzeugt aus Primär- und Akzentfarbe die abgeleiteten Farbwerte für das
 * helle und das dunkle Farbschema.
 */
export function leiteFarbschemaAb(primaer: string, akzent: string) {
  return {
    hell: {
      primary: primaer,
      primaryForeground: lesbareVordergrundfarbe(primaer),
      ring: primaer,
      accentSoft: aufhellen(akzent, 0.9),
      accentSoftForeground: abdunkeln(primaer, 0.35),
    },
    dunkel: {
      // Im dunklen Schema wird die Marke aufgehellt, damit sie auf dunklem
      // Grund ausreichend Kontrast behält.
      primary: aufhellen(primaer, 0.35),
      primaryForeground: lesbareVordergrundfarbe(aufhellen(primaer, 0.35)),
      ring: aufhellen(primaer, 0.2),
      accentSoft: abdunkeln(primaer, 0.55),
      accentSoftForeground: aufhellen(akzent, 0.75),
    },
  }
}
