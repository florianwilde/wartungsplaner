/**
 * Einheitliche Fehlerbehandlung der Server Actions.
 *
 * Die Konvention der Anwendung lautet: Wirft eigener Code einen Fehler, ist
 * dessen Text für die anfragende Person bestimmt und darf angezeigt werden
 * („Die gewählte Kategorie existiert nicht.“).
 *
 * Für Fehler aus fremden Schichten gilt das ausdrücklich nicht. Prisma nennt
 * in seinen Meldungen Tabellen, Spalten und Feldnamen – bei einer verletzten
 * Eindeutigkeit etwa den betroffenen Index. Das gehört ins Protokoll, nicht
 * in den Browser. Solche Fehler werden deshalb ersetzt.
 */

/** Erkennt Fehler aus dem Datenbankzugriff anhand ihres Klassennamens. */
function istDatenbankFehler(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name.startsWith('PrismaClient') || error.name === 'PrismaClientError')
  )
}

/**
 * Erzeugt die `fehlertext`-Funktion eines Moduls.
 *
 * @param kontext Wird dem Protokolleintrag vorangestellt, damit ein
 *   unerwarteter Fehler dem Modul zuzuordnen ist.
 * @param ersatz  Was die anfragende Person zu sehen bekommt, wenn der Fehler
 *   nicht für ihre Augen bestimmt ist.
 */
export function fehlerbehandlung(
  kontext: string,
  ersatz = 'Die Aktion konnte nicht ausgeführt werden.',
): (error: unknown) => string {
  return (error: unknown): string => {
    if (error instanceof Error && !istDatenbankFehler(error)) {
      const meldung = error.message.trim()
      if (meldung) return meldung
    }
    console.error(`${kontext}:`, error)
    return ersatz
  }
}
