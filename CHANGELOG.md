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

## [1.3.5] – 2026-07-29

### Hinzugefügt

- **Dunkles Farbschema.** Umschaltbar zwischen *Hell*, *Dunkel* und
  *Systemvorgabe* – in der Kopfzeile und bereits auf der Anmeldeseite.
  - Die Auswahl liegt in einem Cookie, damit der Server sie schon beim Rendern
    kennt. Ein Skript im Seitenkopf setzt das Schema vor dem ersten Zeichnen,
    sodass die helle Fassung nicht kurz aufblitzt.
  - Bei *Systemvorgabe* folgt die Anwendung der Einstellung des Geräts, auch
    wenn diese im laufenden Betrieb wechselt.
  - Die Farben leiten sich weiterhin aus den Markenfarben ab; die Primärfarbe
    wird für dunklen Grund automatisch aufgehellt.
- Das unter *Erscheinungsbild* hinterlegte **Logo für dunklen Hintergrund**
  wird jetzt verwendet und per CSS umgeschaltet. Bisher war es zwar
  speicherbar, blieb aber ungenutzt.

---

## [1.3.0] – 2026-07-29

### Hinzugefügt

- **Export von Stammdaten** unter *Administration → Import / Export*:
  Kategorien, Aufgaben und Benutzer als CSV oder JSON, dazu ein Gesamtexport
  aller Bereiche in einer Datei. Passwörter werden nie exportiert.
- **Import derselben Daten mit Vorschau**: Vor dem Schreiben zeigt die
  Anwendung Zeile für Zeile, was angelegt und was geändert würde – bei
  Änderungen mit Angabe der betroffenen Felder.
- **Zuordnung über fachliche Schlüssel** (Kategoriename, Aufgabentitel,
  E-Mail-Adresse) statt über interne Kennungen. Dadurch sind Daten zwischen
  Installationen übertragbar, und ein Export lässt sich unverändert wieder
  einlesen.
- **Strenge Prüfung:** Ein einziger fehlerhafter Datensatz verhindert den
  gesamten Lauf. Ein halb eingespielter Bestand wäre schlimmer als gar keiner.
  Geschrieben wird in einer Transaktion.
- **Vorlagendateien** je Bereich mit Kopfzeile und Beispielzeile.
- Jeder Import und Export erzeugt einen Audit-Eintrag.

### Sicherheit

- **Schutz vor CSV Injection:** Werte, die mit `=`, `+`, `-` oder `@` beginnen,
  werden beim Export entschärft. Andernfalls könnte Excel sie beim Öffnen als
  Formel ausführen.
- Import und Export sind Administratoren vorbehalten – der Export enthält die
  vollständige Benutzerliste.
- Beim Import bestehender Konten bleiben Anmeldeverfahren und Passwort
  unangetastet; ein Wechsel würde ein vorhandenes Passwort entwerten oder eine
  SSO-Verknüpfung zerstören.
- Die Prüfung läuft vor dem Schreiben erneut gegen den aktuellen Datenbestand –
  der Vorschau aus dem Browser wird nicht vertraut.

---

## [1.2.0] – 2026-07-29

### Hinzugefügt

- **E-Mail-Benachrichtigungen.** Der Wartungsplaner meldet sich von selbst,
  statt darauf zu warten, dass jemand ins Dashboard schaut:
  - Sammelnachricht je verantwortlicher Person über anstehende und überfällige
    Prüfungen – bewusst eine Nachricht statt einer je Aufgabe
  - Erinnerung an Fristen offener Abweichungen, mit einstellbarem Vorlauf
  - Eskalation lange überfälliger Prüfungen an eine zentrale Stelle,
    höchstens einmal je Kalenderwoche
  - Wöchentliche Übersicht je Person; wer nichts offen hat, erhält nichts
  - Wiederholungssicher: derselbe Vorgang wird nicht zweimal gemeldet,
    Überfälliges dagegen wöchentlich erneut
  - Eigener Zeitplan (`MAIL_CRON_SCHEDULE`, Standard 07:00 Uhr), damit der
    Fälligkeitsabgleich vorher gelaufen ist
- **Administration → Benachrichtigungen**: Ein- und Ausschalten je
  Nachrichtenart, Eskalationsempfänger, Wochentag der Übersicht, Testnachricht,
  sofortiger Lauf, Abmeldung je Benutzer und Übersicht der letzten Sendungen.
- **[ROADMAP.md](ROADMAP.md)** – die geplante Weiterentwicklung ist jetzt Teil
  des Projekts.
- **[SICHERHEIT.md](SICHERHEIT.md)** – Bedrohungsmodell, umgesetzte Maßnahmen,
  Ergebnis der Durchsicht und bewusste Einschränkungen.

### Sicherheit

Durchsicht der gesamten Anwendung mit folgenden Härtungen:

- **Begrenzung der Anmeldeversuche**: nach fünf Fehlversuchen je Konto und
  Netzwerkadresse eine Sperre von 15 Minuten. Zuvor waren Passwörter unbegrenzt
  oft ratbar. Sperren erscheinen im Audit-Log.
- **Content-Security-Policy mit Nonce** je Anfrage, ohne `unsafe-inline` für
  Skripte, dazu `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-*` und `Strict-Transport-Security` bei HTTPS.
- **CSRF-Schutz der Server Actions abgesichert**: Die erlaubten Ursprünge
  werden aus `APP_URL`/`AUTH_URL` abgeleitet, damit die Origin-Prüfung auch
  hinter einem Reverse Proxy zuverlässig greift.
- **Sitzungs-Cookies** erhalten `Secure` und das Präfix `__Secure-`
  automatisch, sobald die Anwendung über HTTPS erreichbar ist.
- **Header Injection in E-Mails** unterbunden: Betreffzeilen werden von
  Steuerzeichen und Zeilenumbrüchen befreit.
- `/api/branding` ist ohne Anmeldung erreichbar, damit ein hochgeladenes Logo
  auf der Anmeldeseite erscheint.

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

[Unveröffentlicht]: https://github.com/florianwilde/wartungsplaner/-/compare/v1.3.5...main
[1.3.5]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.3.5
[1.3.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.3.0
[1.2.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.2.0
[1.1.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.1.0
[1.0.0]: https://github.com/florianwilde/wartungsplaner/-/tags/v1.0.0
