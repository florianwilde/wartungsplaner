[← Handbuch](README.md)

# Unversehrtheit der Nachweise

Die Anwendung führt zu jedem Nachweis eine SHA-256-Prüfsumme. Ohne einen
regelmäßigen Abgleich wäre das eine Behauptung: Ein stiller Verlust im
Ablageverzeichnis – gelöschtes Volume, defekter Datenträger, unvollständig
eingespielte Sicherung – fiele erst auf, wenn Jahre später jemand einen
Download versucht. Dann ist er nicht mehr zu heilen.

Deshalb prüft die Anwendung ihre eigene Ablage: **Administration →
Unversehrtheit**.

## Was geprüft wird

Der Lauf geht **beide Richtungen**: zu jedem Eintrag die Datei, und zu jeder
Datei den Eintrag.

| Befund                  | Bedeutung                                                                |
| ----------------------- | ------------------------------------------------------------------------ |
| **Datei fehlt**         | Zum Eintrag gibt es keine Datei mehr.                                    |
| **Prüfsumme weicht ab** | Die Datei ist da, ihr Inhalt hat sich verändert.                         |
| **Datei nicht lesbar**  | Rechteproblem oder Datenträgerfehler.                                    |
| **Datei ohne Eintrag**  | Eine Datei liegt im Verzeichnis, ohne dass ein Nachweis darauf verweist. |

Die ersten drei mindern die **Beweiskraft** – sie gelten als Beanstandung. Eine
Datei ohne Eintrag ist unordentlich, aber es fehlt kein Beleg und keiner wurde
verändert; sie zählt deshalb ausdrücklich nicht dagegen. Solche Dateien
entstehen etwa, wenn ein Vorgang nach dem Schreiben der Datei abbricht.

## Wann der Lauf stattfindet

- **Täglich** im Anschluss an den Fälligkeitsabgleich
- **Von Hand** über „Jetzt prüfen“
- Über den HTTP-Auslöser: `POST /api/cron?aufgabe=integritaet` mit dem
  `CRON_TOKEN` als Bearer-Token

## Wenn etwas beanstandet wird

Die Administration erhält eine Nachricht – ein fehlender Nachweis soll nicht
bis zum nächsten Blick ins Dashboard warten. Die Seite nennt jeden Befund mit
Pfad und, bei abweichender Prüfsumme, die erwartete und die tatsächliche
Summe.

**Ein fehlender oder veränderter Nachweis lässt sich nicht nachträglich
wiederherstellen.** Prüfen Sie die Sicherung und das Ablageverzeichnis; siehe
[Datensicherung](../README.md#datensicherung-und-wiederherstellung).

## Frühere Läufe

Die Seite führt die letzten Läufe mit Zeitpunkt, auslösender Person, Anzahl
geprüfter Nachweise, Beanstandungen und Dauer. Damit ist belegbar, dass die
Ablage nicht nur heute, sondern durchgehend geprüft wurde.
