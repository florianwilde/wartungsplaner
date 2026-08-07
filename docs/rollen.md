[← Handbuch](README.md)

# Rollen und Berechtigungen

Jedes Konto hat genau eine Rolle. Sie entscheidet, was sichtbar und was
möglich ist.

| Rolle             | Darf                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Administrator** | alles: Stammdaten, Benutzer, Prüfbögen, Audit-Referenzen, Erscheinungsbild, Benachrichtigungen             |
| **Bearbeiter**    | Prüfungen durchführen, Nachweise hochladen, Prüfbögen ausfüllen und gegenzeichnen, Abweichungen bearbeiten |
| **Prüfer**        | alles lesen, nichts ändern                                                                                 |

## Was das im Alltag bedeutet

**Aufgaben anlegen und ändern** ist Sache der Administration. Der Zuschnitt
der Prüfungen – Intervalle, Fristen, Nachweispflicht – bestimmt, wogegen
später gemessen wird; das soll nicht nebenbei geändert werden.

**Durchführen darf jede Person mit Bearbeiterrecht**, nicht nur die
verantwortliche. Die Verantwortlichkeit sagt, wer sich kümmert, nicht wer es
tun darf – sonst stünde eine Prüfung still, sobald jemand im Urlaub ist.

**Gegenzeichnen** kann nur, wer den Nachweis nicht selbst erfasst hat. Das ist
der Kern des Vier-Augen-Prinzips und wird serverseitig durchgesetzt, nicht nur
in der Oberfläche.

**Die Rolle Prüfer** ist für externe oder interne Auditoren gedacht: Sie sehen
den vollständigen Bestand samt Nachweisen und Audit-Log, können aber nichts
verändern. Damit lässt sich ein Audit begleiten, ohne Zugangsdaten zu teilen
oder Berichte per Mail zu verschicken.

## Was niemand darf

- Eine **protokollierte Durchführung** ändern oder löschen
- Einen **gegengezeichneten Prüfnachweis** ändern
- Das **Audit-Log** ändern oder löschen – das verhindert die Datenbank selbst,
  nicht nur die Anwendung
- Einen **Benutzer löschen**, der im Audit-Log vorkommt. Konten werden
  deaktiviert; sonst verlöre das Protokoll seinen Bezug.

Korrekturen erfolgen ausschließlich als neuer, protokollierter Vorgang.
