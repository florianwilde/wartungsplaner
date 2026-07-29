#!/bin/sh
# ---------------------------------------------------------------------------
# Aktualisiert den Wartungsplaner-Stack in einem Durchgang.
#
#   1. Voraussetzungen prüfen (Git-Repository, Docker, .env, sauberer Stand)
#   2. Sicherung von Datenbank, Nachweisen und Konfiguration
#   3. Quellstand aktualisieren (git pull --ff-only)
#   4. Image neu bauen und Stack neu starten
#      (Migrationen laufen automatisch im Entrypoint des App-Containers)
#   5. Auf den Healthcheck warten und die neue Fassung melden
#
# Aufruf:
#   ./update.sh                  Sicherung, Aktualisierung, Neustart
#   ./update.sh --ohne-sicherung Sicherung überspringen (nicht empfohlen)
#   ./update.sh --nur-neubau     ohne git pull, nur Image neu bauen
#   ./update.sh --branch stable  einen anderen Branch verwenden
#
# Das Skript bricht bei jedem Fehler ab und lässt den bisherigen Stand
# unangetastet, solange der Neubau nicht erfolgreich war.
# ---------------------------------------------------------------------------
set -eu

SICHERUNG=ja
GIT_PULL=ja
BRANCH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --ohne-sicherung) SICHERUNG=nein ;;
    --nur-neubau)     GIT_PULL=nein ;;
    --branch)         shift; BRANCH="${1:-}" ;;
    -h|--help)
      sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unbekannte Option: $1 (siehe ./update.sh --help)" >&2
      exit 1
      ;;
  esac
  shift
done

meldung()  { printf '\n\033[1;34m[Update]\033[0m %s\n' "$1"; }
hinweis()  { printf '         %s\n' "$1"; }
fehler()   { printf '\n\033[1;31m[Fehler]\033[0m %s\n' "$1" >&2; }

# --- 1. Voraussetzungen -----------------------------------------------------
meldung 'Voraussetzungen werden geprüft ...'

if [ ! -f docker-compose.yml ]; then
  fehler 'docker-compose.yml nicht gefunden. Bitte im Projektverzeichnis ausführen.'
  exit 1
fi

if [ ! -f .env ]; then
  fehler '.env nicht gefunden. Bitte zuerst aus .env.example anlegen.'
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  fehler 'Docker ist nicht verfügbar.'
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  fehler 'Der Docker-Dienst läuft nicht.'
  exit 1
fi

if [ "$GIT_PULL" = ja ]; then
  if ! command -v git >/dev/null 2>&1 || [ ! -d .git ]; then
    fehler 'Kein Git-Repository. Für ein Update ohne git bitte --nur-neubau verwenden.'
    exit 1
  fi
  # Lokale Änderungen würden beim Zusammenführen verloren gehen oder zu
  # Konflikten führen - deshalb wird hier bewusst abgebrochen.
  if [ -n "$(git status --porcelain)" ]; then
    fehler 'Es liegen lokale Änderungen vor. Bitte committen oder verwerfen:'
    git status --short >&2
    exit 1
  fi
fi

VERSION_VORHER="$(node -p "require('./package.json').version" 2>/dev/null || echo 'unbekannt')"
COMMIT_VORHER="$(git rev-parse HEAD 2>/dev/null || echo '')"
hinweis "Aktuelle Fassung: $VERSION_VORHER"
[ -n "$COMMIT_VORHER" ] && hinweis "Aktueller Commit: $(echo "$COMMIT_VORHER" | cut -c1-12)"

# --- 2. Sicherung -----------------------------------------------------------
if [ "$SICHERUNG" = ja ]; then
  meldung 'Sicherung wird erstellt ...'
  if [ -x ./backup.sh ]; then
    ./backup.sh
  elif [ -f ./backup.sh ]; then
    sh ./backup.sh
  else
    fehler 'backup.sh nicht gefunden. Mit --ohne-sicherung überspringen.'
    exit 1
  fi
else
  meldung 'Sicherung wird übersprungen (--ohne-sicherung).'
  hinweis 'Ein Rückweg besteht dann nur über eine ältere Sicherung.'
fi

# --- 3. Quellstand aktualisieren -------------------------------------------
if [ "$GIT_PULL" = ja ]; then
  meldung 'Quellstand wird aktualisiert ...'
  if [ -n "$BRANCH" ]; then
    git fetch origin "$BRANCH"
    git checkout "$BRANCH"
  else
    git fetch origin
  fi

  # --ff-only: kein automatischer Merge-Commit. Sind Historien auseinander-
  # gelaufen, bricht das Update ab, statt einen unklaren Stand zu erzeugen.
  if ! git pull --ff-only; then
    fehler 'git pull fehlgeschlagen (Historien auseinandergelaufen?).'
    hinweis 'Bitte den Stand manuell prüfen. Der Stack läuft unverändert weiter.'
    exit 1
  fi

  COMMIT_NACHHER="$(git rev-parse HEAD)"
  if [ "$COMMIT_VORHER" = "$COMMIT_NACHHER" ]; then
    hinweis 'Es gibt keinen neuen Stand - das Image wird trotzdem neu gebaut.'
  else
    hinweis 'Neue Commits:'
    git --no-pager log --oneline "$COMMIT_VORHER..$COMMIT_NACHHER" | sed 's/^/           /'
  fi
else
  meldung 'git pull wird übersprungen (--nur-neubau).'
fi

VERSION_NACHHER="$(node -p "require('./package.json').version" 2>/dev/null || echo 'unbekannt')"
GIT_COMMIT="$(git rev-parse HEAD 2>/dev/null || echo '')"

# --- 4. Neu bauen und starten ----------------------------------------------
meldung 'Image wird gebaut ...'
if ! docker compose build --build-arg "GIT_COMMIT=$GIT_COMMIT" app; then
  fehler 'Der Build ist fehlgeschlagen. Der bisherige Stand läuft unverändert weiter.'
  exit 1
fi

meldung 'Stack wird neu gestartet ...'
hinweis 'Migrationen werden dabei automatisch angewendet.'
docker compose up -d

# --- 5. Auf den Healthcheck warten -----------------------------------------
meldung 'Es wird auf die Betriebsbereitschaft gewartet ...'
VERSUCH=0
while [ "$VERSUCH" -lt 60 ]; do
  ZUSTAND="$(docker inspect --format '{{.State.Health.Status}}' wartungsplaner-app 2>/dev/null || echo 'unbekannt')"
  case "$ZUSTAND" in
    healthy)
      meldung 'Die Anwendung ist betriebsbereit.'
      break
      ;;
    unhealthy)
      fehler 'Der Container meldet einen Fehlerzustand. Letzte Protokollzeilen:'
      docker compose logs app --tail 40 >&2
      hinweis ''
      hinweis 'Rückweg: git checkout '"$(echo "$COMMIT_VORHER" | cut -c1-12)"' && ./update.sh --nur-neubau --ohne-sicherung'
      hinweis 'Bei einem Datenbankproblem zusätzlich die Sicherung einspielen (siehe README).'
      exit 1
      ;;
  esac
  VERSUCH=$((VERSUCH + 1))
  sleep 2
done

if [ "$VERSUCH" -ge 60 ]; then
  fehler 'Zeitüberschreitung: Die Anwendung wurde nicht betriebsbereit.'
  docker compose logs app --tail 40 >&2
  exit 1
fi

# --- Abschluss --------------------------------------------------------------
meldung 'Update abgeschlossen.'
hinweis "Fassung vorher:  $VERSION_VORHER"
hinweis "Fassung nachher: $VERSION_NACHHER"
[ -n "$GIT_COMMIT" ] && hinweis "Commit:          $(echo "$GIT_COMMIT" | cut -c1-12)"

APP_PORT_WERT="$(grep -E '^APP_PORT=' .env | cut -d= -f2 | tr -d '\r' || true)"
: "${APP_PORT_WERT:=3000}"
hinweis ''
hinweis 'Rückmeldung der Anwendung:'
curl -fsS "http://127.0.0.1:${APP_PORT_WERT}/api/health" 2>/dev/null | sed 's/^/           /' || \
  hinweis '           (Healthcheck vom Host aus nicht erreichbar - das ist bei abweichender Portbindung normal.)'

printf '\n'
echo "Was sich geändert hat, steht im Änderungsverlauf: CHANGELOG.md"
echo "oder in der Anwendung unter Administration -> System."
