# Sicherheit

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

## Was die Anwendung selbst tut

- **Sitzungen** über Auth.js mit JWT; beim Abmelden wird ein Zähler am
  Benutzer erhöht, sodass ausgestellte Token sofort ungültig sind.
- **Anmeldeversuche** werden gezählt und nach mehreren Fehlschlägen
  zeitweise gesperrt.
- **Passkeys** (WebAuthn) sind möglich und lassen sich erzwingen.
- **Schutz-Header** einschließlich Content-Security-Policy mit Nonce
  werden auf jede Antwort gesetzt (`src/lib/sicherheit.ts`).
- **Hochgeladene Dateien** werden gegen eine Whitelist geprüft, in der
  Größe begrenzt, mit SHA-256 gehasht und – sofern ClamAV eingerichtet ist
  – vor dem Ablegen geprüft. Ausgeliefert werden sie stets als Download
  mit `X-Content-Type-Options: nosniff`.
- **Das Protokoll** ist per Datenbank-Trigger nur anfügbar. Auch ein
  erzwungenes Löschen von Aufgaben samt Nachweisen bleibt darin sichtbar.
- **Fehlermeldungen** aus dem Datenbankzugriff erreichen den Browser
  nicht (`src/lib/fehler.ts`).

## Was Sie selbst tun müssen

- `AUTH_SECRET` einmalig erzeugen und geheim halten (`openssl rand -base64 32`).
- Die Anwendung **nur über HTTPS** erreichbar machen. Ohne TLS ist das
  Sitzungs-Cookie mitlesbar.
- Das Startpasswort des ersten Kontos sofort ändern – die Anwendung
  verlangt es beim ersten Anmelden.
- Die Datenbank und das Upload-Volume in die Sicherung aufnehmen. Ohne
  beides ist ein Nachweis wertlos.
- Den Datenbankport nicht nach außen veröffentlichen (die Vorgabe in
  `docker-compose.yml` tut das nicht; `docker-compose.dev.yml` schon).
