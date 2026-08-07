[← Handbuch](README.md)

# Erste Schritte

## Anmelden

Mit E-Mail-Adresse und Passwort, wahlweise mit einem **Passkey** (Windows
Hello, Touch ID, Sicherheitsschlüssel) oder – wenn eingerichtet – über das
Unternehmens-SSO. Siehe [Benutzer und Anmeldung](benutzer-und-anmeldung.md).

Nach fünf Fehlversuchen ist die Anmeldung für 15 Minuten gesperrt.

## Beim ersten Mal ist alles leer

Eine frische Installation enthält nur Ihr Verwaltungskonto – keine
Kategorien, keine Aufgaben, keine Audit-Referenzen. Das ist so gewollt:
Welche Prüfungen in welchem Abstand laufen, entscheidet Ihre Organisation,
nicht die Anwendung.

Zwei Wege zum Anfang:

**Mit dem beiliegenden Prüfplan starten.** Unter `beispiele/pruefplan/`
liegt ein Ausgangsbestand nach ISO/IEC 27001:2022 und VDA ISA 6: sechs
Kategorien, 49 Audit-Referenzen, 30 wiederkehrende Prüfungen mit
Prüfanleitung und neun Prüfbögen. Eingespielt wird er über
[Import und Export](import-und-export.md) – vier Dateien in fester
Reihenfolge. Was Sie vorher anpassen sollten (die verantwortlichen Personen
und die Startdaten), steht in der LIESMICH.md daneben.

Danach durchgehen und streichen, was für Sie nicht gilt. Ein übernommener
Prüfplan, den niemand geprüft hat, ist im Audit schlechter als eine kurze
Liste, hinter der jemand steht.

**Bei null anfangen.** Erst unter _Administration → Kategorien_ die
Gliederung anlegen, dann unter _Aufgaben_ die eigenen Prüfungen erfassen –
siehe [Aufgaben anlegen](aufgaben-anlegen.md).

## Das Dashboard

Die erste Seite nach der Anmeldung beantwortet die Frage: _Was ist jetzt zu
tun?_

- **Kennzahlen** – überfällig, diese Woche fällig, offen gesamt, offene
  Abweichungen
- **Nächste Fälligkeiten** – der Zeitraum lässt sich einstellen: diese Woche,
  30 Tage, 90 Tage oder alle offenen. Überfällige erscheinen immer, auch
  außerhalb des Zeitraums – sie würden sonst gerade dann verschwinden, wenn sie
  am dringendsten sind. Die Auswahl bleibt gespeichert.
- **Warten auf Ihre Gegenzeichnung** – erscheint, sobald ein Prüfnachweis
  vorliegt, den Sie gegenzeichnen können

Erledigen lässt sich direkt von hier.

## Die Bereiche

| Bereich          | Wofür                                                        |
| ---------------- | ------------------------------------------------------------ |
| **Dashboard**    | Was ist jetzt zu tun                                         |
| **Aufgaben**     | Alle Prüfungen, Filter, Historie je Aufgabe                  |
| **Abweichungen** | Feststellungen mit Frist und Verantwortlichkeit              |
| **Nachweise**    | Prüfbögen: eigene offene, zur Gegenzeichnung, abgeschlossene |
| **Kalender**     | Monatsansicht der Termine                                    |
| **Reports**      | Auswertungen als PDF und Excel, Archiv                       |
| **Admin**        | Stammdaten und Einstellungen                                 |

## Die Ampel verstehen

| Farbe    | Bedeutung                                                 |
| -------- | --------------------------------------------------------- |
| **Grün** | Der Termin liegt noch außerhalb der Vorlaufzeit.          |
| **Gelb** | Bald fällig – die Vorlaufzeit hat begonnen.               |
| **Rot**  | Überfällig – der Termin samt Karenzfrist ist verstrichen. |

Vorlauf und Karenz werden je Aufgabe eingestellt.

## Zeitzone

Alle Termine gelten in **Europe/Berlin**, unabhängig davon, wo der Server
steht oder mit welcher Einstellung der Browser läuft.

## Dunkles Farbschema

Umschaltbar in der Kopfzeile zwischen hell, dunkel und Systemvorgabe – auch
schon auf der Anmeldeseite. Die Auswahl bleibt gespeichert.
