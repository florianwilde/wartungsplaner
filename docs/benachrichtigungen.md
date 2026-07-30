[← Handbuch](README.md)

# Benachrichtigungen

Ohne Nachrichten müsste jemand täglich ins Dashboard schauen. Die Anwendung
meldet sich deshalb von selbst – zurückhaltend und wiederholungssicher.

Eingerichtet wird das unter **Administration → Benachrichtigungen**. Ohne
konfigurierten Mailserver (`SMTP_HOST` in der `.env`) bleibt der Versand aus.

## Die Nachrichtenarten

| Art | Wann | An wen |
| --- | --- | --- |
| **Anstehende Prüfungen** | Sobald die Vorlaufzeit beginnt; bei Überfälligkeit wöchentlich erneut | Verantwortliche Person |
| **Abweichungen** | Wenn die Frist näher rückt oder überschritten ist | Verantwortliche Person |
| **Gegenzeichnung** | Sofort beim Vorlegen eines Prüfnachweises | Verantwortliche Person der Aufgabe, sonst alle mit Ausführungsrecht |
| **Zurückweisung** | Sofort | Erfassende Person |
| **Eskalation** | Bei lange überfälligen Prüfungen | Eine zentrale Stelle |
| **Wochenübersicht** | An einem festgelegten Wochentag | Je Person, sofern etwas offen ist |
| **Unversehrtheit** | Bei Beanstandungen im Prüfsummenlauf | Administration |

## Grundsätze

**Eine Sammelnachricht statt einer je Aufgabe.** Wer zehn offene Prüfungen
hat, bekommt eine Mail mit zehn Zeilen – nicht zehn Mails.

**Kein Vorgang wird zweimal gemeldet.** Jede Meldung wird festgehalten; ein
mehrfacher Lauf am selben Tag erzeugt keine zweite Nachricht. Überfälliges
wird dagegen bewusst wöchentlich erneut gemeldet.

**Der Versand darf nichts blockieren.** Ein nicht erreichbarer Mailserver ist
kein Grund, eine Gegenzeichnung abzulehnen. Fehler werden protokolliert, nicht
weitergereicht.

## Je Person abschalten

Wer keine Nachrichten möchte, kann das im eigenen Konto abschalten. Die
Eskalation an die zentrale Stelle bleibt davon unberührt.

## Testnachricht

Im Administrationsbereich lässt sich eine Testnachricht versenden, um die
SMTP-Einstellungen zu prüfen, ohne auf den nächsten Lauf zu warten.
