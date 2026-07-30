[← Handbuch](README.md)

# Fälligkeiten erledigen

Eine Fälligkeit ist ein einzelner Termin einer Aufgabe. Sie zu erledigen heißt:
festhalten, dass die Prüfung stattgefunden hat, mit welchem Ergebnis, und was
das belegt.

Erledigen dürfen alle Personen mit Ausführungsrecht – nicht nur die
verantwortliche.

## Wo Sie erledigen können

- **Dashboard** – unter „Nächste Fälligkeiten“
- **Aufgabe** – unter „Offene Fälligkeiten“
- **Kalender** – über den jeweiligen Termin

Überall öffnet derselbe Dialog.

## Die Wegwahl

Steht für die Aufgabe ein Prüfbogen bereit, fragt der Dialog zuerst nach dem
Vorgehen:

**Prüfbogen ausfüllen** – der Befund wird Punkt für Punkt festgehalten, daraus
entsteht ein PDF-Nachweis. Sie werden zum Bogen geführt. Die Fälligkeit
erledigen Sie **danach** hier im Dialog; das PDF wird dabei als Nachweis
übernommen.

**Ohne Prüfbogen protokollieren** – der gewohnte Weg: Ergebnis, Kommentar,
Dateien anhängen.

> Der abgeschlossene Prüfbogen erledigt die Fälligkeit **nicht** von selbst.
> Zum Erledigen gehören Ergebnis und Abweichungen mit Frist und
> Verantwortlichkeit – Angaben, die ein Prüfbogen nicht enthält. Diese
> Entscheidung bleibt bei Ihnen.

## Der Dialog

### Ergebnis

| Ergebnis | Bedeutung |
| --- | --- |
| **In Ordnung** | Die Prüfung verlief vollständig ohne Beanstandung. |
| **In Ordnung mit Bemerkungen** | Kleinere Auffälligkeiten, kein Handlungsbedarf mit Frist. |
| **Abweichung** | Es wurde etwas festgestellt, das nachverfolgt werden muss. |

Beim Ergebnis **Abweichung** verlangt die Anwendung mindestens eine erfasste
Abweichung. Eine Feststellung ohne Verantwortlichkeit und Frist verliert sich
sonst.

### Durchgeführt am

Das tatsächliche Datum der Prüfung, nicht der Tag der Erfassung. Es darf nicht
in der Zukunft liegen. Aus diesem Datum ergibt sich, ob die Prüfung als
pünktlich gilt – die Karenztage der Aufgabe zählen dabei mit.

### Kommentar

Was geprüft wurde, welche Systeme, welche Auffälligkeiten. Der Kommentar
erscheint in der Aufgabenhistorie und im Bericht.

### Nachweise

Dateien, die die Prüfung belegen: Protokolle, Screenshots, Exporte. Zugelassen
sind pdf, png, jpg, txt, log, csv, xlsx und docx bis 25 MB je Datei.

Jede Datei erhält beim Hochladen eine **SHA-256-Prüfsumme**. Sie wird
mitgeführt und lässt sich jederzeit nachrechnen – siehe
[Unversehrtheit der Nachweise](unversehrtheit.md).

### Nachweispflicht

Ist an der Aufgabe „Nachweis verpflichtend“ gesetzt, verlangt der Dialog
mindestens einen Beleg. Als solcher zählt auch ein **abgeschlossener
Prüfbogen** zu dieser Fälligkeit – dann ist keine zusätzliche Datei nötig.

### Abweichungen

Feststellungen, die nachverfolgt werden sollen: Titel, Beschreibung, Schwere,
verantwortliche Person und Frist. Sie erscheinen anschließend unter
**Abweichungen** und werden dort bis zum Abschluss verfolgt. Siehe
[Abweichungen nachverfolgen](abweichungen.md).

## Was danach geschieht

- Die Fälligkeit gilt als erledigt.
- Der **Folgetermin** entsteht nach dem Rhythmus der Aufgabe.
- Ein zum Bogen erzeugtes PDF und dessen Belege wandern an die Durchführung.
- Alles erscheint in der Historie der Aufgabe und in den Auswertungen.

## Warum sich nichts nachträglich ändern lässt

Eine protokollierte Durchführung ist **unveränderlich**. Das ist keine
Bequemlichkeit der Anwendung, sondern der Kern ihres Zwecks: Ein Nachweis, der
sich im Nachhinein anpassen lässt, ist kein Nachweis.

Ist etwas falsch erfasst worden, wird die Korrektur als **neuer, protokollierter
Vorgang** festgehalten. Wer wann was geändert hat, steht im Audit-Log.

Auch das Audit-Log selbst lässt sich nicht ändern – das verhindert die
Datenbank, nicht nur die Anwendung.

## Eine Prüfung aussetzen

Fällt eine Prüfung aus – System abgeschaltet, Wartungsfenster verschoben –,
lässt sich die Fälligkeit **aussetzen** statt sie falsch zu erledigen. Das
dürfen Administratoren, und es verlangt eine Begründung. Ausgesetzte
Fälligkeiten stehen auf der Seite der Aufgabe und lassen sich dort wieder
aufnehmen. In der Compliance-Übersicht werden sie getrennt ausgewiesen und
zählen nicht gegen den Erfüllungsgrad.
