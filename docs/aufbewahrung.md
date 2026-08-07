[← Handbuch](README.md)

# Aufbewahrung

Der Bestand an Nachweisdateien wächst sonst unbegrenzt, und hochgeladene
Belege enthalten personenbezogene Daten – ein AD-Export nennt Namen von
Beschäftigten. Unter **Administration → Aufbewahrung** lässt sich festlegen,
wie lange die Dateien vorgehalten werden.

## Was entfernt wird – und was nicht

Nach Ablauf der Frist wird die **Datei** entfernt, **nicht der Eintrag**.

| Bleibt                                                     | Entfällt                           |
| ---------------------------------------------------------- | ---------------------------------- |
| Die Durchführung mit Datum, Person, Ergebnis und Kommentar | Der Inhalt der hochgeladenen Datei |
| Dateiname, Größe und SHA-256-Prüfsumme des Nachweises      | Damit auch der Download            |
| Abweichungen samt Maßnahmen                                |                                    |
| Prüfnachweise und ihre Antworten                           |                                    |
| Das Audit-Log                                              |                                    |

Gelöscht wird also der Inhalt, nicht die Tatsache: Es bleibt belegbar, dass es
diesen Nachweis gab, wie er hieß und welche Prüfsumme er trug. Wer die Datei
später doch braucht, findet sie in einer
[Sicherung](../README.md#datensicherung-und-wiederherstellung).

## Fristen festlegen

- **Vorgabe in Monaten** – gilt für alle Kategorien ohne eigene Angabe
- **Abweichend je Kategorie** – ein Restore-Test-Protokoll darf früher
  entfallen als der Nachweis einer Berechtigungsprüfung

Zulässig sind 6 bis 360 Monate. Maßgeblich ist der Zeitpunkt der
**Durchführung**, nicht der des Hochladens – danach fragt eine
Aufbewahrungsvorschrift.

## Erst schauen, dann entfernen

Die Funktion ist im Auslieferungszustand **aus**. Gelöscht wird nie ungefragt.

Die **Vorschau** ermittelt dasselbe wie der tatsächliche Lauf, fasst aber
nichts an – bewusst derselbe Code, damit Vorschau und Wirklichkeit nicht
auseinanderlaufen können. Sie ist auch dann nutzbar, wenn die Aufbewahrung
ausgeschaltet ist.

Das Entfernen verlangt zusätzlich eine Rückfrage. Ist die Funktion
eingeschaltet, läuft sie täglich nach dem
[Prüfsummenlauf](unversehrtheit.md) mit.

## Zusammenspiel mit den übrigen Funktionen

- Der **Prüfsummenlauf** meldet entfernte Nachweise weder als fehlend noch als
  verwaist. Täte er das, ginge jeder echte Verlust im Rauschen unter.
- Das **Archiv-ZIP** lässt sie aus.
- Der **Download** nennt den Grund und den Zeitpunkt statt eines Fehlers.

## Zur Einordnung

Eine Aufbewahrungsfrist ist kein reines Aufräumen. Prüfnachweise, die
personenbezogene Daten enthalten, sollen nicht unbefristet vorgehalten werden;
zugleich verlangen Normen und Verträge oft eine Mindestdauer. Die richtige
Frist ergibt sich aus beidem und ist eine Entscheidung Ihres Hauses – die
Anwendung setzt sie nur um.
