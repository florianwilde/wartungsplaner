# Wartungsplaner

Interne Webanwendung zur Planung und revisionssicheren Nachweisführung
wiederkehrender IT-Prüf- und Wartungsaufgaben – zum Beispiel Restore-Tests,
Reviews von Zugriffs- und Zutrittsberechtigungen, Patch-Status-Kontrollen oder
der jährliche USV-Test.

Die Anwendung erzeugt aus hinterlegten Intervallen automatisch Fälligkeiten,
protokolliert jede Durchführung unveränderlich mit Datei-Nachweisen und
SHA-256-Prüfsumme, verfolgt Abweichungen bis zum Abschluss und erstellt
auditfertige Reports als PDF und Excel.

---

## Inhalt

- [Funktionsumfang](#funktionsumfang)
- [Rollen und Berechtigungen](#rollen-und-berechtigungen)
- [Fälligkeitslogik](#fälligkeitslogik)
- [Installation mit Docker Compose](#installation-mit-docker-compose)
- [Konfiguration (.env)](#konfiguration-env)
- [Anmeldung über SSO (OIDC)](#anmeldung-über-sso-oidc)
- [Erste Schritte nach der Installation](#erste-schritte-nach-der-installation)
- [Erscheinungsbild anpassen](#erscheinungsbild-anpassen)
- [Aktualisierung](#aktualisierung)
- [Versionierung und Änderungsverlauf](#versionierung-und-änderungsverlauf)
- [Datensicherung und Wiederherstellung](#datensicherung-und-wiederherstellung)
- [Betrieb](#betrieb)
- [Entwicklung](#entwicklung)
- [Technischer Aufbau](#technischer-aufbau)

---

## Funktionsumfang

| Bereich | Beschreibung |
| --- | --- |
| **Dashboard** (`/`) | Kacheln für Überfällig, Diese Woche fällig, Offen gesamt und Offene Abweichungen; Liste der nächsten Fälligkeiten mit direktem Erledigen-Dialog; Ampel je Kategorie |
| **Aufgaben** (`/tasks`) | Liste mit Filtern nach Kategorie, Verantwortlichem, Status und Kritikalität sowie Volltextsuche |
| **Aufgaben-Detail** (`/tasks/[id]`) | Stammdaten, Prüfanleitung in Markdown, offene Fälligkeiten und vollständige Historie aller Durchführungen inklusive Nachweisen |
| **Erledigen-Dialog** | Ergebnis, Kommentar, Mehrfach-Upload von Nachweisen und Anlegen von Abweichungen in einem Schritt |
| **Abweichungen** (`/findings`) | Liste mit Status, Schweregrad und Frist; Bearbeiten und Schließen mit Maßnahmenkommentar |
| **Kalender** (`/calendar`) | Monatsansicht aller Fälligkeiten mit farbcodierten Kategorien |
| **Reports** (`/reports`) | Vier Auswertungen als PDF und Excel, jeweils mit Zeitraum- und Kategorienfilter |
| **Administration** (`/admin`) | Benutzerverwaltung, Kategorien, Erscheinungsbild, Systemübersicht und lesende, filterbare Audit-Log-Ansicht |

### Reports

1. **Compliance-Übersicht** – Erfüllungsgrad gesamt und je Kategorie
   (pünktlich / verspätet / offen / überfällig / ausgesetzt)
2. **Aufgabenhistorie** – je Aufgabe alle Durchführungen mit Datum, Person,
   Ergebnis und Anhangsliste inklusive SHA-256
3. **Abweichungsbericht** – alle Abweichungen mit Status und Maßnahmen
4. **Fälligkeitsvorschau** – kommende Prüfungen der nächsten X Monate

Jeder Report trägt im Kopf Anwendungsname, Zeitraum, Kategorienfilter sowie
Erstellungsdatum und erstellende Person; PDF-Berichte zusätzlich eine
Seitenzählung („Seite X von Y“). Jeder Abruf wird im Audit-Log protokolliert.

### Revisionssicherheit

- Abgeschlossene Durchführungen und ihre Nachweise sind **unveränderlich**.
  Korrekturen erfolgen ausschließlich als neuer, protokollierter Vorgang.
- Zu jeder hochgeladenen Datei wird eine **SHA-256-Prüfsumme** gespeichert und
  in der Oberfläche sowie in den Reports ausgewiesen.
- Das **Audit-Log ist append only**: Es wird nicht nur von der Anwendung so
  behandelt, sondern zusätzlich per Datenbank-Trigger abgesichert – `UPDATE`
  und `DELETE` auf der Tabelle `AuditLog` werden von PostgreSQL abgewiesen.
- Benutzer werden **nie gelöscht, sondern deaktiviert**, damit alle
  Protokolleinträge dauerhaft zuordenbar bleiben.
- Beim Ergebnis *Abweichung* muss mindestens eine Abweichung erfasst werden;
  bei Aufgaben mit Nachweispflicht mindestens eine Datei.

---

## Rollen und Berechtigungen

| Rolle | Rechte |
| --- | --- |
| **ADMIN** (Administrator) | Vollzugriff: Aufgaben und Kategorien pflegen, Benutzer verwalten, Fälligkeiten aussetzen, Audit-Log einsehen, alles aus EDITOR |
| **EDITOR** (Bearbeiter) | Fälligkeiten erledigen, Nachweise hochladen, Abweichungen anlegen, bearbeiten und schließen; Reports abrufen |
| **AUDITOR** (Auditor) | Strikt lesender Zugriff auf alle Daten inklusive Reports; keine schreibende Aktion |

Die Prüfung erfolgt serverseitig in jeder Seite und jeder Server Action, nicht
nur in der Oberfläche.

---

## Fälligkeitslogik

- Beim Anlegen einer aktiven Aufgabe entsteht die **erste Fälligkeit zum
  Startdatum**.
- Nach der Erledigung ergibt sich die nächste Fälligkeit
  - bei `FIXED` (fester Rhythmus) aus **letzter Soll-Fälligkeit + Intervall** –
    eine verspätete Erledigung verschiebt den Takt also nicht,
  - bei `AFTER_COMPLETION` aus **Erledigungsdatum + Intervall**.
- Ein **täglicher Hintergrundjob** setzt Fälligkeiten mit
  `dueDate + graceDays < heute` auf *überfällig* und stellt sicher, dass jede
  aktive Aufgabe genau eine unerledigte Fälligkeit besitzt.
- Ab `dueDate - leadTimeDays` erscheint eine Fälligkeit auf dem Dashboard als
  *bald fällig*.
- Intervalle: täglich, wöchentlich, monatlich, vierteljährlich, halbjährlich,
  jährlich sowie „alle N Tage“. Bei monatsbasierten Intervallen wird auf den
  letzten Tag des Zielmonats begrenzt (31.01. + 1 Monat = 28./29.02.).

Die gesamte Logik liegt als reine, systemzeitfreie Funktionen in
[`src/lib/scheduling.ts`](src/lib/scheduling.ts) und
[`src/lib/dates.ts`](src/lib/dates.ts) und ist mit Vitest abgedeckt
(Schaltjahre, Monatsenden, Sommer-/Winterzeitwechsel, Karenz- und
Vorlauftage).

Alle Datums- und Zeitangaben beziehen sich auf die Zeitzone **Europe/Berlin**.

---

## Installation mit Docker Compose

**Voraussetzungen:** Docker und Docker Compose. Weitere Software wird nicht
benötigt – Node.js, PostgreSQL und alle Abhängigkeiten stecken im Stack.

```bash
git clone https://github.com/florianwilde/wartungsplaner.git
cd wartungsplaner

# 1. Konfiguration anlegen
cp .env.example .env

# 2. Geheimnisse setzen (siehe nächster Abschnitt)
#    - POSTGRES_PASSWORD
#    - AUTH_SECRET      (openssl rand -base64 32)
#    - SEED_ADMIN_PASSWORD
#    - APP_URL / AUTH_URL auf die tatsächliche Adresse setzen
nano .env

# 3. Stack starten
docker compose up -d --build

# 4. Log verfolgen, bis "Ready" erscheint
docker compose logs -f app
```

Die Anwendung ist anschließend unter der in `APP_PORT` konfigurierten Adresse
erreichbar (Standard: <http://localhost:3000>).

Beim ersten Start geschieht automatisch:

1. Warten auf die Datenbank,
2. `prisma migrate deploy` (alle Migrationen inklusive des
   Audit-Log-Triggers),
3. der Seed – **nur wenn die Datenbank noch keinen Benutzer enthält**. Bestehende
   Daten werden dadurch niemals überschrieben.

Der Seed legt an: den Administrator, sechs Kategorien (Backup & Restore,
Berechtigungen, Zutritt, Infrastruktur, Sicherheit, Dokumentation) und elf
realistische Beispielaufgaben mit ausformulierten Prüfanleitungen.

### Der Stack im Überblick

| Service | Beschreibung |
| --- | --- |
| `app` | Next.js im Production-Build (Multi-Stage-Dockerfile, Standalone-Ausgabe, unprivilegierter Benutzer), Healthcheck auf `/api/health` |
| `db` | `postgres:16` mit Healthcheck (`pg_isready`); der Port ist nur an `127.0.0.1` gebunden |

| Volume | Inhalt |
| --- | --- |
| `pgdata` | PostgreSQL-Datenverzeichnis |
| `uploads` | Hochgeladene Nachweise (im Container unter `/app/uploads`) |

---

## Konfiguration (.env)

Alle Einstellungen werden über die Datei `.env` gesetzt; sie ist per
`.gitignore` vom Repository ausgeschlossen. Als Vorlage dient
[`.env.example`](.env.example). Nichts ist im Quelltext hartkodiert.

### Pflichtangaben

| Variable | Bedeutung |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Zugangsdaten der Datenbank. Der App-Container bildet seine Verbindungs-URL daraus selbst. |
| `AUTH_SECRET` | Geheimnis für die Session-Cookies. Erzeugen mit `openssl rand -base64 32`. **Muss** vor dem Produktivbetrieb geändert werden. |
| `APP_URL`, `AUTH_URL` | Öffentlich erreichbare Basis-URL ohne abschließenden Slash, z. B. `https://wartungsplaner.firma.de`. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | Zugang des per Seed angelegten Administrators. Das Passwort muss beim ersten Login geändert werden. |

### Weitere Einstellungen

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `APP_PORT` | `3000` | Port auf dem Host |
| `POSTGRES_PORT` | `5432` | Postgres-Port auf dem Host (nur `127.0.0.1`) |
| `TZ` | `Europe/Berlin` | Zeitzone von Anwendung und Datenbank |
| `AUTH_TRUST_HOST` | `true` | Hinter einem Reverse Proxy auf `true` lassen |
| `UPLOAD_DIR` | `/app/uploads` | Ablage der Nachweise im Container |
| `CRON_ENABLED` | `true` | Täglichen Hintergrundjob aktivieren |
| `CRON_SCHEDULE` | `15 2 * * *` | Zeitplan des Jobs (Europe/Berlin) |
| `CRON_TOKEN` | leer | Wenn gesetzt, kann der Job zusätzlich per HTTP ausgelöst werden |

> **Hinweis zu `DATABASE_URL`:** Die Variable in der `.env` richtet sich an
> Werkzeuge, die *vom Host aus* laufen (`prisma migrate`, `pg_dump`, `psql`) und
> zeigt deshalb auf `localhost`. Der App-Container bildet seine eigene URL mit
> dem Servicenamen `db` (siehe `docker-compose.yml`). Sonderzeichen im Passwort
> müssen in der URL kodiert werden (`@` wird zu `%40`).

---

## Anmeldung über SSO (OIDC)

Neben der internen Benutzerverwaltung (E-Mail und Passwort, bcrypt-Hash)
unterstützt die Anwendung einen generischen OIDC-Provider, der zu Microsoft
Entra ID, Keycloak und vergleichbaren Identity Providern kompatibel ist.

SSO wird **nur aktiviert, wenn alle drei Variablen gesetzt sind**. Erst dann
erscheint der zusätzliche Anmeldeknopf auf der Login-Seite; ohne Konfiguration
bleibt die Anwendung mit reiner Passwortanmeldung voll nutzbar.

```dotenv
OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0
OIDC_CLIENT_ID=<client-id>
OIDC_CLIENT_SECRET=<client-secret>
OIDC_NAME=Unternehmens-SSO          # Beschriftung des Anmeldeknopfs
OIDC_SCOPES=openid profile email    # Standard reicht in der Regel
```

Beispiel für Keycloak:

```dotenv
OIDC_ISSUER=https://keycloak.firma.de/realms/<realm>
```

**Redirect-URI beim Identity Provider eintragen:**

```
<APP_URL>/api/auth/callback/oidc
```

**Verhalten beim ersten SSO-Login:**

- Existiert bereits ein Konto mit derselben E-Mail-Adresse, wird die Anmeldung
  damit verknüpft; die vorhandene Rolle bleibt erhalten.
- Andernfalls wird ein neues Konto mit der Rolle **AUDITOR** (nur lesend)
  angelegt. Ein Administrator passt die Rolle anschließend unter
  `/admin/benutzer` an.
- Deaktivierte Konten können sich auch über SSO nicht anmelden.

Konten ohne lokales Passwort (reine SSO-Konten) lassen sich in der
Benutzerverwaltung gezielt anlegen.

---

## Erste Schritte nach der Installation

1. Unter `APP_URL` mit `SEED_ADMIN_EMAIL` und `SEED_ADMIN_PASSWORD` anmelden.
2. Das Startpasswort ändern – die Anwendung erzwingt das vor dem ersten Zugriff.
3. Unter **Administration → Benutzer** die Kolleginnen und Kollegen anlegen
   (Rolle *Bearbeiter* für die ausführende IT, *Auditor* für Revision und
   Geschäftsführung).
4. Unter **Administration → Kategorien** die Gliederung an die eigene
   Organisation anpassen.
5. Unter **Aufgaben** die Beispielaufgaben prüfen: Verantwortliche zuweisen,
   Intervalle, Vorlauf- und Karenztage anpassen, nicht benötigte Aufgaben
   deaktivieren und eigene ergänzen.
6. Unter **Administration → Erscheinungsbild** das Logo hochladen und die
   Farben feinjustieren (siehe nächster Abschnitt).
7. Das Dashboard zeigt danach den aktuellen Stand; der tägliche Job hält die
   Fälligkeiten fortlaufend aktuell.

---

## Erscheinungsbild anpassen

Unter **Administration → Erscheinungsbild** lassen sich Farben, Logos und
Bezeichnungen ohne Neustart ändern. Die Änderung wirkt sofort für alle
Benutzer und wird im Audit-Log protokolliert.

| Einstellung | Wirkung |
| --- | --- |
| **Anwendungsname** | Kopfzeile, Browsertitel, Report-Kopf |
| **Organisation** | Fußzeile der Anwendung, Kopf und Fuß der Reports, Dateieigenschaften der Exporte |
| **Primärfarbe** | Schaltflächen, Links, Hervorhebungen, Trennlinie im PDF-Kopf |
| **Akzentfarbe** | Verläufe und sekundäre Hervorhebungen |
| **Logo (hell / dunkel)** | Kopfzeile, Anmeldeseite und – bei PNG/JPG – Kopf der PDF-Reports |
| **Browsersymbol** | Symbol im Browsertab |
| **Report-Fußzeile** | Freitext, z. B. „Vertraulich – nur zur internen Verwendung“ |

**Auslieferungszustand:** Die Anwendung startet im Corporate Design der
Beispiel GmbH – Markenfarben `#1b7cb5` (Primär) und `#2f9bd8` (Akzent),
abgeleitet aus der Bildmarke, sowie ein mitgeliefertes Logo als SVG.

> **Für ein typografisch exaktes Logo** laden Sie die Originaldatei hoch. Das
> mitgelieferte SVG ist eine Nachbildung; der Schriftzug nutzt eine
> Systemschrift und trifft die Hausschrift daher nicht exakt.

Hinweise:

- **Dateiformate:** svg, png, jpg, webp, ico – maximal 2 MB je Datei.
- **PDF-Reports** können nur PNG und JPG einbetten. Ist ein SVG hinterlegt,
  erscheint im Report-Kopf statt des Logos der Anwendungsname. Laden Sie für
  die Reports zusätzlich eine PNG-Fassung hoch.
- **Kontrast:** Die Oberfläche prüft die gewählte Primärfarbe gegen
  WCAG 2.1 Stufe AA (4,5:1) und warnt, wenn Schaltflächen schlecht lesbar
  würden. Die Schriftfarbe darauf wird automatisch passend gewählt.
- **Dunkles Farbschema:** Die Primärfarbe wird dafür automatisch aufgehellt,
  damit sie auf dunklem Grund kontrastreich bleibt.
- **Zurücksetzen** stellt Farben, Bezeichnungen und Logos in einem Schritt auf
  den Auslieferungszustand zurück.

---

## Aktualisierung

Für das Update des laufenden Stacks liegt das Skript `update.sh` bei. Es führt
Sicherung, `git pull`, Neubau, Migrationen und Neustart in einem Durchgang aus
und prüft danach, ob die Anwendung wieder betriebsbereit ist.

```bash
cd /opt/wartungsplaner
./update.sh
```

Ablauf im Einzelnen:

1. **Voraussetzungen prüfen** – Git-Repository, laufender Docker-Dienst,
   vorhandene `.env`. Liegen **lokale Änderungen** vor, bricht das Skript ab,
   statt sie zu überschreiben.
2. **Sicherung** von Datenbank, Nachweisen und Konfiguration (`backup.sh`).
3. **`git pull --ff-only`** – bewusst ohne automatischen Merge. Sind die
   Historien auseinandergelaufen, bricht das Update ab und der Stack läuft
   unverändert weiter. Die neuen Commits werden aufgelistet.
4. **Neubau** des App-Images; der Git-Commit wird als Build-Argument in die
   Anwendung übernommen und ist später unter *Administration → System*
   sichtbar.
5. **Neustart**; die Migrationen wendet der Container beim Start selbst an.
6. **Warten auf den Healthcheck** und Ausgabe der neuen Fassung. Meldet der
   Container einen Fehler, zeigt das Skript die letzten Protokollzeilen und
   den passenden Rollback-Befehl.

| Option | Wirkung |
| --- | --- |
| *(ohne)* | Sicherung, `git pull`, Neubau, Neustart |
| `--ohne-sicherung` | überspringt die Sicherung (nicht empfohlen) |
| `--nur-neubau` | ohne `git pull`, nur Image neu bauen und neu starten |
| `--branch <name>` | auf einen anderen Branch wechseln, z. B. `stable` |
| `--help` | Kurzhilfe |

**Rückweg bei Problemen:**

```bash
git checkout <alter-commit>
./update.sh --nur-neubau --ohne-sicherung
```

Betrifft das Problem die Datenbank, zusätzlich die Sicherung einspielen
(siehe [Datensicherung](#datensicherung-und-wiederherstellung)). Beachten Sie,
dass ein Rückschritt auf eine ältere Fassung bereits angewendete Migrationen
nicht rückgängig macht.

---

## Versionierung und Änderungsverlauf

Die Fassung steht in der `package.json` und wird zur Bauzeit in die Anwendung
übernommen. Sie ist sichtbar

- in der Fußzeile jeder Seite und auf der Anmeldeseite,
- unter **Administration → System** samt Git-Commit und Build-Zeitpunkt,
- im Healthcheck: `curl http://localhost:3000/api/health`.

Die Versionierung folgt der [Semantischen Versionierung](https://semver.org/lang/de/).
Alle Änderungen sind in [CHANGELOG.md](CHANGELOG.md) dokumentiert; derselbe
Text erscheint auch in der Anwendung unter *Administration → System*.

**Beim Veröffentlichen einer neuen Fassung:**

```bash
# 1. Version anheben und Änderungsverlauf ergänzen
npm version 1.2.0 --no-git-tag-version
$EDITOR CHANGELOG.md

# 2. Commit und Tag
git add package.json package-lock.json CHANGELOG.md
git commit -m "chore: fassung 1.2.0"
git tag -a v1.2.0 -m "Fassung 1.2.0"
git push && git push --tags
```

---

## Datensicherung und Wiederherstellung

Zu sichern sind **zwei** Dinge: die Datenbank und das Upload-Volume. Ein Backup
ohne die Nachweisdateien wäre für ein Audit wertlos.

### Sicherung

```bash
# 1. Datenbank
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > wartungsplaner-db-$(date +%F).dump

# 2. Nachweise aus dem Upload-Volume
docker run --rm \
  -v wartungsplaner_uploads:/daten:ro \
  -v "$(pwd)":/sicherung \
  alpine tar czf /sicherung/wartungsplaner-uploads-$(date +%F).tar.gz -C /daten .

# 3. Zusätzlich die .env sichern (enthält AUTH_SECRET und Zugangsdaten)
```

Als Cron-Eintrag auf dem Host, täglich um 01:30 Uhr:

```cron
30 1 * * * cd /opt/wartungsplaner && ./backup.sh >> /var/log/wartungsplaner-backup.log 2>&1
```

### Wiederherstellung

```bash
# Datenbank
docker compose up -d db
docker compose exec -T db pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  --clean --if-exists < wartungsplaner-db-2026-07-29.dump

# Nachweise
docker run --rm \
  -v wartungsplaner_uploads:/daten \
  -v "$(pwd)":/sicherung \
  alpine sh -c "tar xzf /sicherung/wartungsplaner-uploads-2026-07-29.tar.gz -C /daten"

docker compose up -d
```

> Prüfen Sie die Wiederherstellung regelmäßig – am besten als eigene Aufgabe im
> Wartungsplaner. Die Beispielaufgabe „Restore-Test ERP-System“ ist eine
> passende Vorlage.

---

## Betrieb

### Täglicher Hintergrundjob

Der Job läuft im App-Container (node-cron, Standard 02:15 Uhr Europe/Berlin) und
wird beim Start der Anwendung registriert. Er setzt überfällige Fälligkeiten und
zieht fehlende offene Fälligkeiten nach. Jeder Lauf erzeugt einen
Audit-Eintrag (`CRON_RUN`) und ist idempotent.

Optional lässt er sich zusätzlich per HTTP auslösen – etwa aus einem zentralen
Scheduler. Dazu `CRON_TOKEN` setzen und neu starten:

```bash
curl -X POST -H "Authorization: Bearer <CRON_TOKEN>" \
  https://wartungsplaner.firma.de/api/cron
```

Ohne gesetztes `CRON_TOKEN` ist der Endpunkt nicht ansprechbar.

### Healthcheck

`GET /api/health` prüft die Datenbankverbindung und liefert bei Erfolg
`{"status":"ok","datenbank":"erreichbar"}` (sonst HTTP 503). Der Compose-Stack
nutzt den Endpunkt für den Container-Healthcheck.

### Datei-Uploads

- Erlaubte Dateitypen: `pdf`, `png`, `jpg`, `txt`, `log`, `csv`, `xlsx`, `docx`
- Maximale Größe: 25 MB je Datei
- Ablage im Volume unter `JJJJ/MM/<uuid>.<endung>`; in der Datenbank stehen nur
  Metadaten inklusive SHA-256
- Der Download läuft über die Anwendung (`/api/attachments/<id>`), erfordert eine
  Anmeldung und wird protokolliert

### Reverse Proxy

Hinter nginx oder Traefik `AUTH_TRUST_HOST=true` setzen und `APP_URL`/`AUTH_URL`
auf die öffentliche HTTPS-Adresse zeigen lassen. Die Weiterleitungen der
Anwendung werten `X-Forwarded-Host` und `X-Forwarded-Proto` aus.

---

## Entwicklung

**Voraussetzungen:** Node.js 22 oder neuer, Docker (für PostgreSQL).

```bash
npm install
cp .env.example .env          # DATABASE_URL auf localhost belassen

docker compose up -d db       # nur die Datenbank
npx prisma migrate dev        # Schema anlegen
npm run db:seed               # Beispieldaten

npm run dev                   # http://localhost:3000
```

### Skripte

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Prisma-Client erzeugen und Production-Build |
| `npm start` | Production-Server starten |
| `npm run typecheck` | TypeScript prüfen |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:watch` | Unit-Tests im Watch-Modus |
| `npm run test:integration` | Integrationstest gegen die laufende Datenbank |
| `npm run db:migrate` | Migration erzeugen und anwenden |
| `npm run db:deploy` | Migrationen anwenden (Produktion) |
| `npm run db:seed` | Seed ausführen |
| `npm run db:studio` | Prisma Studio |

### Tests

- **Unit-Tests** (`npm test`) decken die gesamte Intervall- und
  Fälligkeitslogik, die Datumsfunktionen und die Upload-Validierung ab –
  einschließlich Schaltjahren, Monatsenden und Zeitumstellung.
- **Integrationstest** (`npm run test:integration`) prüft gegen eine echte
  PostgreSQL-Instanz den Erledigen-Vorgang: Folgetermine in beiden
  Planungsmodi, Unveränderlichkeit abgeschlossener Durchführungen,
  Nachweispflicht, Abweichungspflicht, ausgesetzte Fälligkeiten, die
  Audit-Protokollierung und den Tagesabgleich. Er legt eigene Testdaten an und
  räumt sie wieder auf.

---

## Technischer Aufbau

| Baustein | Verwendung |
| --- | --- |
| Next.js 16 (App Router) mit TypeScript | Oberfläche und Server Actions |
| Prisma ORM mit PostgreSQL 16 | Datenmodell und Migrationen |
| Auth.js v5 | Credentials- und OIDC-Provider, Session-Cookies |
| Tailwind CSS 4 + shadcn/ui | Oberfläche, vollständig auf Deutsch |
| pdfkit / exceljs | Serverseitige Report-Erzeugung |
| node-cron | Täglicher Hintergrundjob |
| Vitest | Unit-Tests |

### Verzeichnisse

```
prisma/          Schema, Migrationen, Seed
scripts/         Integrationstest
src/app/         Seiten und API-Routen (Route-Gruppe "(app)" = angemeldeter Bereich)
src/components/  Wiederverwendbare Bausteine, ui/ enthält die shadcn-Primitiven
src/lib/         Reine Logik: Fälligkeiten, Datum, Rollen, Audit, Uploads
src/server/      Datenbanknahe Dienste, Server Actions und Report-Erzeugung
```

Skripte im Projektverzeichnis:

| Datei | Zweck |
| --- | --- |
| [`update.sh`](update.sh) | Stack aktualisieren (Sicherung, `git pull`, Neubau, Neustart) |
| [`backup.sh`](backup.sh) | Datenbank, Nachweise und Konfiguration sichern |
| [`docker-entrypoint.sh`](docker-entrypoint.sh) | Start im Container: warten, migrieren, ggf. seeden |

Zentrale Dateien:

- [`src/lib/scheduling.ts`](src/lib/scheduling.ts) – Fälligkeitslogik (rein, getestet)
- [`src/lib/farben.ts`](src/lib/farben.ts) – Farbableitung und Kontrastprüfung (rein, getestet)
- [`src/lib/branding.ts`](src/lib/branding.ts) / [`src/server/branding.ts`](src/server/branding.ts) – Erscheinungsbild
- [`src/server/faelligkeiten.ts`](src/server/faelligkeiten.ts) – Tagesabgleich und Folgetermine
- [`src/server/durchfuehrung-service.ts`](src/server/durchfuehrung-service.ts) – Erledigen-Vorgang mit allen Fachregeln
- [`src/lib/rbac.ts`](src/lib/rbac.ts) / [`src/lib/session.ts`](src/lib/session.ts) – Rollen und serverseitige Prüfung
- [`src/lib/audit.ts`](src/lib/audit.ts) – Audit-Protokollierung
- [`src/proxy.ts`](src/proxy.ts) – Zugriffskontrolle vor dem Rendern

---

## Lizenz

Interne Anwendung. Alle Rechte vorbehalten.
