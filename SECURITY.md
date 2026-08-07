# Security Policy

_Die ausführliche Fassung mit Bedrohungsmodell, umgesetzten Maßnahmen und
bekannten Einschränkungen steht in **[SICHERHEIT.md](SICHERHEIT.md)**. Diese
Datei nennt nur den Meldeweg – GitHub sucht sie unter diesem Namen._

## Eine Lücke melden

**Bitte nicht als öffentliches Issue.** Der Wartungsplaner verwaltet
Prüfnachweise; eine offen beschriebene Lücke trifft jeden Betrieb, der die
Anwendung einsetzt, bevor er nachziehen kann.

Zwei Wege:

- Über GitHub: _Security_ → _Report a vulnerability_ (Private Vulnerability
  Reporting).
- Per E-Mail an die im Profil hinterlegte Adresse, gern verschlüsselt.

Hilfreich sind: betroffene Version, Art der Lücke, ein Weg zum Nachstellen
und – falls vorhanden – eine Einschätzung der Auswirkung. Sie bekommen
innerhalb von sieben Tagen eine Rückmeldung.

Dies ist ein Nebenprojekt ohne Bereitschaftsdienst. Ein Kopfgeld gibt es
nicht; auf Wunsch werden Sie im Änderungsprotokoll genannt.

## Unterstützte Versionen

Korrekturen gibt es für die jeweils neueste Ausgabe. Ältere Stände werden
nicht rückwirkend gepflegt.

## Was Sie beim Betrieb selbst tun müssen

- `AUTH_SECRET` einmalig erzeugen und geheim halten
  (`openssl rand -base64 32`).
- Die Anwendung **nur über HTTPS** erreichbar machen. Ohne TLS ist das
  Sitzungs-Cookie mitlesbar.
- Das Startpasswort des ersten Kontos sofort ändern – die Anwendung
  verlangt es beim ersten Anmelden.
- Datenbank und Upload-Volume in die Sicherung aufnehmen. Ohne beides ist
  ein Nachweis wertlos.
- Den Datenbankport nicht nach außen veröffentlichen (die Vorgabe in
  `docker-compose.yml` tut das nicht; `docker-compose.dev.yml` schon).
