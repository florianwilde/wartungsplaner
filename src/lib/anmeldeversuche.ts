/**
 * Begrenzung fehlgeschlagener Anmeldeversuche (Schutz vor Erraten von
 * Passwörtern).
 *
 * Bewusst als reine, zeitparametrisierte Logik mit einem eigenen Speicher:
 * Damit ist das Verhalten vollständig testbar. Der Speicher liegt im
 * Arbeitsspeicher des Prozesses – für eine Installation mit einem
 * App-Container ist das ausreichend und kommt ohne zusätzliche Infrastruktur
 * aus. Bei mehreren Instanzen müsste er durch einen gemeinsamen Speicher
 * (etwa Redis) ersetzt werden; die Schnittstelle bleibt dabei gleich.
 */

/** Höchstzahl Fehlversuche je Kennung innerhalb des Zeitfensters. */
export const MAX_FEHLVERSUCHE = 5

/** Länge des Zeitfensters in Millisekunden (15 Minuten). */
export const ZEITFENSTER_MS = 15 * 60 * 1000

/** Sperrdauer nach Überschreiten der Höchstzahl (15 Minuten). */
export const SPERRDAUER_MS = 15 * 60 * 1000

export type VersuchsEintrag = {
  /** Zeitpunkte der Fehlversuche innerhalb des Zeitfensters */
  fehlversuche: number[]
  /** Zeitpunkt, bis zu dem gesperrt ist (0 = keine Sperre) */
  gesperrtBis: number
}

export type Versuchsspeicher = Map<string, VersuchsEintrag>

/** Erzeugt einen neuen, leeren Speicher (für Tests und den Produktivbetrieb). */
export function neuerSpeicher(): Versuchsspeicher {
  return new Map()
}

export type PruefErgebnis =
  { erlaubt: true } | { erlaubt: false; verbleibendeSekunden: number }

/**
 * Prüft, ob für eine Kennung derzeit ein Anmeldeversuch zulässig ist.
 * Die Kennung sollte E-Mail und Adresse verbinden, damit weder ein einzelnes
 * Konto noch eine einzelne Adresse allein blockiert werden kann.
 */
export function pruefeVersuch(
  speicher: Versuchsspeicher,
  kennung: string,
  jetzt: number,
): PruefErgebnis {
  const eintrag = speicher.get(kennung)
  if (!eintrag) return { erlaubt: true }

  if (eintrag.gesperrtBis > jetzt) {
    return {
      erlaubt: false,
      verbleibendeSekunden: Math.ceil((eintrag.gesperrtBis - jetzt) / 1000),
    }
  }

  return { erlaubt: true }
}

/**
 * Vermerkt einen Fehlversuch und sperrt die Kennung, sobald die Höchstzahl
 * innerhalb des Zeitfensters erreicht ist.
 *
 * @returns true, wenn mit diesem Versuch eine Sperre ausgelöst wurde.
 */
export function vermerkeFehlversuch(
  speicher: Versuchsspeicher,
  kennung: string,
  jetzt: number,
): boolean {
  const eintrag = speicher.get(kennung) ?? { fehlversuche: [], gesperrtBis: 0 }

  // Nur Versuche innerhalb des gleitenden Zeitfensters zählen.
  const aktuelle = eintrag.fehlversuche.filter(
    (zeitpunkt) => jetzt - zeitpunkt < ZEITFENSTER_MS,
  )
  aktuelle.push(jetzt)

  const sperreAusgeloest = aktuelle.length >= MAX_FEHLVERSUCHE
  speicher.set(kennung, {
    fehlversuche: sperreAusgeloest ? [] : aktuelle,
    gesperrtBis: sperreAusgeloest ? jetzt + SPERRDAUER_MS : eintrag.gesperrtBis,
  })

  return sperreAusgeloest
}

/** Löscht die Fehlversuche nach einer erfolgreichen Anmeldung. */
export function setzeZurueck(speicher: Versuchsspeicher, kennung: string): void {
  speicher.delete(kennung)
}

/**
 * Entfernt abgelaufene Einträge. Wird gelegentlich aufgerufen, damit der
 * Speicher bei vielen unterschiedlichen Kennungen nicht unbegrenzt wächst.
 */
export function raeumeAuf(speicher: Versuchsspeicher, jetzt: number): number {
  let entfernt = 0
  for (const [kennung, eintrag] of speicher) {
    const nochGesperrt = eintrag.gesperrtBis > jetzt
    const nochVersuche = eintrag.fehlversuche.some(
      (zeitpunkt) => jetzt - zeitpunkt < ZEITFENSTER_MS,
    )
    if (!nochGesperrt && !nochVersuche) {
      speicher.delete(kennung)
      entfernt++
    }
  }
  return entfernt
}

/** Baut die Kennung aus E-Mail-Adresse und Netzwerkadresse. */
export function baueKennung(email: string, adresse: string): string {
  return `${email.trim().toLowerCase()}|${adresse}`
}
