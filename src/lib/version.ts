/**
 * Angaben zur laufenden Fassung.
 *
 * Die Werte werden zur Bauzeit aus der `package.json` bzw. dem Build-Argument
 * `GIT_COMMIT` eingesetzt (siehe `next.config.ts` und `Dockerfile`). Zur
 * Laufzeit sind sie unveränderlich – so beschreibt die Anzeige stets genau den
 * ausgelieferten Stand.
 */

export const APP_VERSION = process.env.APP_VERSION ?? '0.0.0'

/** Zeitpunkt des Builds als ISO-Zeichenkette (leer bei unbekannt). */
export const APP_BUILD_TIME = process.env.APP_BUILD_TIME ?? ''

/** Verkürzter Git-Commit des Builds (leer, wenn nicht übergeben). */
export const APP_GIT_COMMIT = process.env.APP_GIT_COMMIT ?? ''

/** Kurzform für die Fußzeile, z. B. "v1.1.0" oder "v1.1.0 (a1b2c3d4e5f6)". */
export function versionKurz(): string {
  return APP_GIT_COMMIT
    ? `v${APP_VERSION} (${APP_GIT_COMMIT})`
    : `v${APP_VERSION}`
}

/** Ausführliche Angabe für den Administrationsbereich und Reports. */
export function versionAusfuehrlich(): string {
  const teile = [`Version ${APP_VERSION}`]
  if (APP_GIT_COMMIT) teile.push(`Commit ${APP_GIT_COMMIT}`)
  if (APP_BUILD_TIME) {
    const zeitpunkt = new Date(APP_BUILD_TIME)
    if (!Number.isNaN(zeitpunkt.getTime())) {
      teile.push(
        `erstellt am ${new Intl.DateTimeFormat('de-DE', {
          timeZone: 'Europe/Berlin',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(zeitpunkt)}`,
      )
    }
  }
  return teile.join(' · ')
}
