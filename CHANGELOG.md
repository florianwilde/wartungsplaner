# Änderungsverlauf

Alle nennenswerten Änderungen am Wartungsplaner werden in dieser Datei
dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt der [Semantischen Versionierung](https://semver.org/lang/de/):

- **Hauptversion** (1.x.x) – Änderungen, die einen Eingriff beim Update erfordern
- **Nebenversion** (x.1.x) – neue Funktionen, abwärtskompatibel
- **Korrekturversion** (x.x.1) – Fehlerbehebungen und Kleinigkeiten

---

## [Unveröffentlicht]

Noch keine Änderungen.

---

## [1.1.0] – 2026-07-29

### Hinzugefügt

- **Konfigurierbares Erscheinungsbild** unter *Administration → Erscheinungsbild*:
  Anwendungsname, Organisation, Primär- und Akzentfarbe, Logo für helle und
  dunkle Oberflächen sowie Browsersymbol lassen sich ohne Neustart ändern.
  Änderungen wirken sofort für alle Benutzer und werden protokolliert.
- **Corporate Design der Beispiel GmbH** als Auslieferungszustand:
  Markenfarben aus der Bildmarke, mitgeliefertes Logo als SVG.
- **Kontrastprüfung nach WCAG 2.1** bei der Farbwahl: Die Oberfläche weist
  darauf hin, wenn eine gewählte Primärfarbe die Stufe AA (4,5:1) für
  Schaltflächen nicht erreicht. Die Vordergrundfarbe wird automatisch passend
  gewählt.
- **Versionsanzeige** in der Fußzeile, auf der Anmeldeseite, unter
  *Administration → System* und im Healthcheck (`/api/health`).
- **Systemübersicht** unter *Administration → System*: Fassung, Build-Zeitpunkt,
  Git-Commit, Zustand von Datenbank, Hintergrundjob und SSO sowie dieser
  Änderungsverlauf.
- **Branding in den Reports**: Logo, Organisation und ein frei wählbarer
  Fußzeilenzusatz erscheinen in PDF und Excel.
- **Update-Skript `update.sh`** – aktualisiert den Docker-Stack in einem
  Durchgang: Sicherung, `git pull`, Neubau, Migrationen, Neustart und
  Healthcheck. Bricht bei Problemen mit einem Rollback-Hinweis ab.

### Geändert

- Die Kopfzeile zeigt statt eines festen Symbols das konfigurierte Logo.
- Der Browsertitel richtet sich nach dem eingestellten Anwendungsnamen.

---

## [1.0.0] – 2026-07-29

Erste einsatzfähige Fassung.

### Hinzugefügt

- **Datenmodell und Datenbank**: Aufgaben, Kategorien, Fälligkeiten,
  Durchführungen, Nachweise, Abweichungen, Benutzer und Audit-Log auf
  PostgreSQL 16 mit Prisma-Migrationen.
- **Revisionssicheres Audit-Log**: Einträge lassen sich ausschließlich
  einfügen; `UPDATE` und `DELETE` werden zusätzlich per Datenbank-Trigger
  abgewiesen. Benutzer mit Protokolleinträgen sind nicht löschbar, sondern
  werden deaktiviert.
- **Anmeldung** über interne Benutzerverwaltung (E-Mail und Passwort,
  bcrypt) sowie optional über einen generischen OIDC-Provider
  (Entra ID, Keycloak). SSO erscheint nur bei gesetzten `OIDC_*`-Variablen.
  Neue SSO-Konten erhalten die Rolle Auditor.
- **Rollen** ADMIN, EDITOR und AUDITOR mit serverseitiger Prüfung in jeder
  Seite und jeder Server Action.
- **Erzwungener Passwortwechsel** beim ersten Login und nach einem
  Zurücksetzen durch die Administration.
- **Fälligkeitslogik** als reine, systemzeitfreie Funktionen: sieben
  Intervalltypen, feste Taktung oder Rechnung ab Erledigungsdatum, Vorlauf-
  und Karenztage, Begrenzung auf Monatsenden.
- **Täglicher Hintergrundjob** (node-cron) für Überfälligkeiten und fehlende
  Fälligkeiten, zusätzlich per Token über `POST /api/cron` auslösbar.
- **Aufgabenverwaltung** mit Filtern, Volltextsuche, Markdown-Prüfanleitung
  und Aussetzen einzelner Fälligkeiten mit protokollierter Begründung.
- **Erledigen-Vorgang** mit Ergebnis, Kommentar, Mehrfach-Upload und
  Abweichungen. Durchführungen sind unveränderlich; das Ergebnis
  *Abweichung* erzwingt eine Abweichung, `evidenceRequired` einen Nachweis.
- **Nachweise** mit SHA-256-Prüfsumme, Whitelist (pdf, png, jpg, txt, log,
  csv, xlsx, docx), 25 MB je Datei, Ablage im Docker-Volume und
  protokolliertem Download.
- **Abweichungsverfolgung** mit Schweregrad, Verantwortlichkeit, Frist und
  Abschluss über einen Maßnahmenkommentar.
- **Dashboard** mit Kennzahlen, nächsten Fälligkeiten und Ampel je Kategorie.
- **Kalender** als Monatsansicht.
- **Vier Reports** als PDF und Excel mit Zeitraum- und Kategorienfilter:
  Compliance-Übersicht, Aufgabenhistorie, Abweichungsbericht und
  Fälligkeitsvorschau.
- **Administrationsbereich** mit Benutzerverwaltung, Kategorien und
  filterbarer, lesender Audit-Log-Ansicht.
- **Docker-Compose-Stack** mit Multi-Stage-Build, Healthchecks, benannten
  Volumes `pgdata` und `uploads` sowie automatischen Migrationen und
  einmaligem Seed beim ersten Start.
- **Tests**: Unit-Tests für die gesamte Fälligkeits- und Datumslogik sowie
  einen Integrationstest gegen eine echte PostgreSQL-Instanz.
- **Seed-Daten**: Administrator, sechs Kategorien und elf realistische
  Beispielaufgaben mit ausformulierten Prüfanleitungen.

[Unveröffentlicht]: https://github.com/florianwilde/wartungsplaner/-/compare/v1.1.0...main
[1.1.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.1.0
[1.0.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.0.0
