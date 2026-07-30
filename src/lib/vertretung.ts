/**
 * Vertretung bei Abwesenheit.
 *
 * Fällt jemand länger aus, laufen die Fälligkeiten heute schlicht über: Die
 * Erinnerungen gehen an ein Postfach, das niemand liest. Eine Vertretung
 * verschiebt die Meldungen für einen Zeitraum an eine andere Person – die
 * Zuständigkeit selbst bleibt unangetastet. Wer die Aufgabe besitzt, besitzt
 * sie weiterhin; nur die Post wird umgeleitet.
 *
 * Reine Funktionen ohne Datenbank, damit die Regeln prüfbar bleiben.
 */
import { compareDates, formatDate } from '@/lib/dates'

/** Vertretungsangabe einer Person. */
export type Vertretung = {
  /** Wer vertritt – null bedeutet: keine Vertretung hinterlegt. */
  vertretungId: string | null
  /** Erster Tag der Abwesenheit; null = ab sofort. */
  von: Date | null
  /** Letzter Tag der Abwesenheit; null = bis auf Weiteres. */
  bis: Date | null
}

/**
 * Gilt die Vertretung am Stichtag?
 *
 * Beide Grenzen zählen mit: Wer „bis 12.08.“ abwesend ist, wird am 12.08.
 * noch vertreten.
 */
export function istVertretungAktiv(
  vertretung: Vertretung,
  heute: Date,
): boolean {
  if (!vertretung.vertretungId) return false
  if (vertretung.von && compareDates(heute, vertretung.von) < 0) return false
  if (vertretung.bis && compareDates(heute, vertretung.bis) > 0) return false
  return true
}

/** Eine hinterlegte Vertretung, die erst später greift. */
export function istVertretungGeplant(
  vertretung: Vertretung,
  heute: Date,
): boolean {
  return Boolean(
    vertretung.vertretungId &&
      vertretung.von &&
      compareDates(heute, vertretung.von) < 0,
  )
}

/** Eine hinterlegte Vertretung, deren Zeitraum vorbei ist. */
export function istVertretungAbgelaufen(
  vertretung: Vertretung,
  heute: Date,
): boolean {
  return Boolean(
    vertretung.vertretungId &&
      vertretung.bis &&
      compareDates(heute, vertretung.bis) > 0,
  )
}

export type VertretungsPruefung = { ok: true } | { ok: false; fehler: string }

/**
 * Prüft eine Eingabe, bevor sie gespeichert wird.
 *
 * `vertretungId === null` bedeutet „Vertretung aufheben“ und ist immer
 * zulässig; die Zeitraumangaben werden dann nicht betrachtet.
 */
export function pruefeVertretung(eingabe: {
  personId: string
  vertretungId: string | null
  von: Date | null
  bis: Date | null
  /** Ist die vertretende Person vorhanden und aktiv? */
  vertretungAktiv: boolean
  /** Darf die vertretende Person Prüfungen durchführen? */
  vertretungDarfDurchfuehren: boolean
}): VertretungsPruefung {
  if (!eingabe.vertretungId) return { ok: true }

  if (eingabe.vertretungId === eingabe.personId) {
    return { ok: false, fehler: 'Niemand kann sich selbst vertreten.' }
  }
  if (!eingabe.vertretungAktiv) {
    return {
      ok: false,
      fehler: 'Die vertretende Person muss ein aktives Konto haben.',
    }
  }
  if (!eingabe.vertretungDarfDurchfuehren) {
    return {
      ok: false,
      fehler:
        'Die vertretende Person muss Prüfungen durchführen dürfen; eine reine Leseberechtigung genügt nicht.',
    }
  }
  if (eingabe.von && eingabe.bis && compareDates(eingabe.bis, eingabe.von) < 0) {
    return { ok: false, fehler: 'Das Ende darf nicht vor dem Beginn liegen.' }
  }

  return { ok: true }
}

/** Höchstzahl der Sprünge entlang einer Vertretungskette. */
export const MAX_KETTE = 5

export type Aufloesung = {
  /** Die Person, die die Meldung tatsächlich erhält. */
  empfaengerId: string
  /**
   * Weg dorthin, ohne die Ausgangsperson. Leer, wenn niemand vertritt.
   * Länger als ein Eintrag bei verketteten Abwesenheiten.
   */
  kette: string[]
  /** Die Kette wurde abgebrochen (Ring oder zu tief). */
  abgebrochen: boolean
}

/**
 * Ermittelt, wer die Meldungen einer Person erhält.
 *
 * Vertretungen dürfen sich verketten: Ist auch die Vertretung abwesend, geht
 * die Meldung weiter. Ein Ring (A vertritt B, B vertritt A) darf dabei nicht
 * zur Endlosschleife werden – dann bleibt es bei der zuletzt erreichten
 * Person, und der Aufrufer erfährt über `abgebrochen`, dass die Angabe
 * unsinnig ist.
 */
export function loeseVertretung(
  personId: string,
  vertretungen: Map<string, Vertretung>,
  heute: Date,
): Aufloesung {
  const kette: string[] = []
  const gesehen = new Set<string>([personId])
  let aktuell = personId

  for (let sprung = 0; sprung < MAX_KETTE; sprung++) {
    const vertretung = vertretungen.get(aktuell)
    if (!vertretung || !istVertretungAktiv(vertretung, heute)) {
      return { empfaengerId: aktuell, kette, abgebrochen: false }
    }

    const naechste = vertretung.vertretungId!
    if (gesehen.has(naechste)) {
      // Ring: Die Meldung bliebe sonst ewig unterwegs.
      return { empfaengerId: aktuell, kette, abgebrochen: true }
    }

    gesehen.add(naechste)
    kette.push(naechste)
    aktuell = naechste
  }

  return { empfaengerId: aktuell, kette, abgebrochen: true }
}

/** Zeitraum in Worten, für Oberfläche und Nachrichten. */
export function beschreibeZeitraum(von: Date | null, bis: Date | null): string {
  if (von && bis) return `${formatDate(von)} bis ${formatDate(bis)}`
  if (von) return `ab ${formatDate(von)}`
  if (bis) return `bis ${formatDate(bis)}`
  return 'bis auf Weiteres'
}
