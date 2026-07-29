/**
 * Helles und dunkles Farbschema.
 *
 * Die Auswahl wird in einem Cookie gehalten, damit der Server bereits beim
 * Rendern weiß, welches Schema gilt – sonst würde die Seite beim Laden kurz
 * hell aufblitzen. Für die Einstellung „Systemvorgabe“ entscheidet ein kleines
 * Skript im Kopf der Seite, das vor dem ersten Zeichnen läuft.
 *
 * Reine Funktionen ohne Framework-Bezug, damit sie testbar bleiben.
 */

export type Farbschema = 'hell' | 'dunkel' | 'system'

export const FARBSCHEMA_COOKIE = 'farbschema'

/** Ein Jahr – die Auswahl soll nicht ständig neu getroffen werden müssen. */
export const FARBSCHEMA_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const FARBSCHEMA_STANDARD: Farbschema = 'system'

export const FARBSCHEMA_BEZEICHNUNG: Record<Farbschema, string> = {
  hell: 'Hell',
  dunkel: 'Dunkel',
  system: 'Systemvorgabe',
}

/** Prüft und normalisiert einen Cookie-Wert. */
export function leseFarbschema(wert: string | undefined | null): Farbschema {
  if (wert === 'hell' || wert === 'dunkel' || wert === 'system') return wert
  return FARBSCHEMA_STANDARD
}

/**
 * Wird beim Rendern auf dem Server die Klasse `dark` gesetzt?
 *
 * Bei „Systemvorgabe“ ist die Vorliebe des Geräts serverseitig nicht bekannt.
 * Es wird dann nichts gesetzt; das Skript im Seitenkopf ergänzt die Klasse,
 * bevor die Seite gezeichnet wird.
 */
export function istDunkelServerseitig(schema: Farbschema): boolean {
  return schema === 'dunkel'
}

/** Wert für das `color-scheme` der Seite – steuert auch Bildlaufleisten. */
export function colorSchemeWert(schema: Farbschema): string {
  if (schema === 'hell') return 'light'
  if (schema === 'dunkel') return 'dark'
  return 'light dark'
}

/** Wert für die Hinweisfenster (sonner). */
export function toasterSchema(schema: Farbschema): 'light' | 'dark' | 'system' {
  if (schema === 'hell') return 'light'
  if (schema === 'dunkel') return 'dark'
  return 'system'
}

/**
 * Skript für den Seitenkopf.
 *
 * Läuft vor dem ersten Zeichnen und setzt die Klasse `dark` anhand des Cookies
 * bzw. – bei „Systemvorgabe“ – anhand der Einstellung des Geräts. Ohne diesen
 * Schritt würde die Seite bei dunklem Schema kurz hell aufleuchten.
 *
 * Bewusst kompakt und ohne Abhängigkeiten gehalten; Fehler werden
 * verschluckt, damit ein Problem hier niemals die Seite blockiert.
 */
export const FARBSCHEMA_SKRIPT = `(function(){try{
var t=document.cookie.match(/(?:^|;\\s*)${FARBSCHEMA_COOKIE}=([^;]*)/);
var w=t?decodeURIComponent(t[1]):'${FARBSCHEMA_STANDARD}';
var d=w==='dunkel'||(w!=='hell'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var e=document.documentElement;
e.classList.toggle('dark',d);
e.style.colorScheme=d?'dark':'light';
}catch(_){}})();`

/** Baut die Cookie-Zeichenkette für den Browser. */
export function baueFarbschemaCookie(schema: Farbschema): string {
  return [
    `${FARBSCHEMA_COOKIE}=${schema}`,
    'path=/',
    `max-age=${FARBSCHEMA_COOKIE_MAX_AGE}`,
    'samesite=lax',
  ].join('; ')
}

/** Reihenfolge der Auswahl in der Oberfläche. */
export const FARBSCHEMA_AUSWAHL: Farbschema[] = ['hell', 'dunkel', 'system']
