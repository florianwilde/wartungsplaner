# Mitarbeiten

Danke für Ihr Interesse. Dieses Projekt ist aus dem Bedarf einer
IT-Abteilung entstanden, die wiederkehrende Prüfungen nach ISO 27001 und
TISAX nachweisen muss. Was diesem Zweck dient, ist willkommen.

## Bevor Sie anfangen

Bei größeren Änderungen bitte zuerst ein Issue öffnen. Es erspart beiden
Seiten Arbeit, wenn sich vorher zeigt, dass eine Idee nicht ins Bild passt
oder schon jemand daran sitzt. Kleine Korrekturen – Tippfehler, ein
schiefer Satz in einer Anleitung, ein offensichtlicher Fehler – können Sie
direkt als Pull Request schicken.

## Umgebung einrichten

Vorausgesetzt werden Node 22 (siehe `.nvmrc`) und Docker.

```bash
cp .env.example .env          # AUTH_SECRET erzeugen: openssl rand -base64 32
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm ci
npx prisma migrate deploy
npm run db:seed               # legt nur das Verwaltungskonto an
npm run dev                   # http://localhost:3007
```

Beispieldaten sind bewusst **nicht** Teil des Seeds. Wer einen gefüllten
Bestand zum Ausprobieren braucht, spielt `beispiele/pruefplan/` über
_Verwaltung → Import und Export_ ein; die Reihenfolge steht in
`beispiele/pruefplan/LIESMICH.md`.

## Vor jedem Pull Request

```bash
npm run pruefen    # Formatierung, Regeln, Typen, Unit-Tests
```

Das muss durchlaufen; die CI führt dasselbe aus. Wo eine Änderung
Datenbank oder Dateisystem berührt, gibt es zusätzlich Integrationstests
gegen eine Wegwerf-Datenbank – `npm run` zeigt alle. Für Änderungen an
den Beispieldateien: `npm run test:beispiele` und `npm run test:einspielen`.

## Wie der Code aufgebaut ist

| Ort                   | Was dort liegt                                                 |
| --------------------- | -------------------------------------------------------------- |
| `src/lib/`            | Reine Funktionen ohne Datenbank. Hier sind Unit-Tests Pflicht. |
| `src/server/`         | Alles mit Datenbank- oder Dateizugriff.                        |
| `src/server/actions/` | Server Actions. Jede beginnt mit einer Rechteprüfung.          |
| `src/app/`            | Seiten und API-Routen (App Router).                            |
| `prisma/`             | Schema, Migrationen, Seed.                                     |
| `docs/`               | Anleitungen für Betrieb und Benutzung.                         |

Zwei Regeln, die sich in der Praxis bewährt haben:

1. **Fachlogik gehört nach `src/lib/`.** Was dort steht, lässt sich ohne
   Datenbank testen – und wird es auch. Ein Terminberechnungsfehler fällt
   in einem Unit-Test auf, im Betrieb erst ein Quartal später.
2. **Jede Server Action prüft zuerst die Rechte**, über
   `benutzerFuerAktion(...)` aus `src/lib/session.ts`. Nicht die Seite,
   nicht die Middleware – die Action selbst.

## Sprache

Die Anwendung ist deutsch: Oberfläche, Bezeichner, Kommentare, Commits.
Das ist Absicht – die Fachbegriffe der Prüfnormen sind deutsch, und eine
Übersetzung nach `evidence` und `occurrence` und zurück hat mehr Fehler
erzeugt als verhindert. Nur da, wo eine Bibliothek den Namen vorgibt
(`Task`, `Attachment` im Prisma-Schema), bleibt es beim Englischen.

Bitte echte Umlaute schreiben, nicht `ae`/`oe`/`ue`. Commit-Betreffzeilen
folgen dem Muster `art: kurze beschreibung` (`feat`, `fix`, `docs`,
`refactor`, `test`, `style`, `chore`) und beschreiben, was sich für die
Benutzerin ändert – nicht, welche Datei angefasst wurde.

## Lizenz

Mit Ihrem Beitrag stellen Sie ihn unter die MIT-Lizenz des Projekts.
