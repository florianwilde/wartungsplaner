#!/bin/sh
# ---------------------------------------------------------------------------
# Sicherung des Wartungsplaners: Datenbank und Nachweise.
#
# Aufruf aus dem Projektverzeichnis heraus:
#     ./backup.sh [Zielverzeichnis]
#
# Standard-Zielverzeichnis: ./backups
# Alte Sicherungen werden nach AUFBEWAHRUNG_TAGE Tagen entfernt.
# ---------------------------------------------------------------------------
set -eu

# Git Bash unter Windows wandelt Argumente, die wie Unix-Pfade aussehen, in
# Windows-Pfade um - dadurch schlagen die Container-Einhängepunkte fehl. Unter
# Linux ist die Variable wirkungslos.
export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL='*'

ZIEL="${1:-./backups}"
AUFBEWAHRUNG_TAGE="${AUFBEWAHRUNG_TAGE:-30}"
STAND="$(date +%Y-%m-%d_%H%M)"

if [ ! -f .env ]; then
  echo "Fehler: .env nicht gefunden. Bitte im Projektverzeichnis ausführen." >&2
  exit 1
fi

# Die .env wird bewusst NICHT per "." eingelesen: Werte wie
# CRON_SCHEDULE=15 2 * * * enthalten Leerzeichen und Sternchen und würden von
# der Shell als Kommando bzw. Dateimuster ausgewertet. Stattdessen werden
# gezielt die benötigten Variablen ausgelesen.
lies_env() {
  grep -E "^$1=" .env 2>/dev/null |
    head -n 1 |
    cut -d= -f2- |
    tr -d '\r' |
    sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//'
}

POSTGRES_USER="$(lies_env POSTGRES_USER)"
POSTGRES_DB="$(lies_env POSTGRES_DB)"

if [ -z "$POSTGRES_USER" ] || [ -z "$POSTGRES_DB" ]; then
  echo "Fehler: POSTGRES_USER oder POSTGRES_DB fehlen in der .env." >&2
  exit 1
fi

# Docker Compose leitet die Volume-Namen vom Projektnamen ab (Verzeichnisname,
# sofern COMPOSE_PROJECT_NAME nicht gesetzt ist).
PROJEKT="$(lies_env COMPOSE_PROJECT_NAME)"
: "${PROJEKT:=$(basename "$(pwd)")}"
VOLUME_UPLOADS="${PROJEKT}_uploads"

if ! docker volume inspect "$VOLUME_UPLOADS" >/dev/null 2>&1; then
  echo "Fehler: Volume \"$VOLUME_UPLOADS\" nicht gefunden." >&2
  echo "        Läuft der Stack? Ggf. COMPOSE_PROJECT_NAME in der .env setzen." >&2
  exit 1
fi

mkdir -p "$ZIEL"

echo "[Backup] Datenbank wird gesichert ..."
docker compose exec -T db pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc \
  > "$ZIEL/wartungsplaner-db-$STAND.dump"

echo "[Backup] Nachweise werden gesichert ..."
docker run --rm \
  -v "$VOLUME_UPLOADS":/daten:ro \
  -v "$(pwd)/$ZIEL":/sicherung \
  alpine tar czf "/sicherung/wartungsplaner-uploads-$STAND.tar.gz" -C /daten .

echo "[Backup] Konfiguration wird gesichert ..."
cp .env "$ZIEL/wartungsplaner-env-$STAND.txt"
chmod 600 "$ZIEL/wartungsplaner-env-$STAND.txt"

echo "[Backup] Sicherungen älter als $AUFBEWAHRUNG_TAGE Tage werden entfernt ..."
find "$ZIEL" -name 'wartungsplaner-*' -type f -mtime "+$AUFBEWAHRUNG_TAGE" -delete

echo "[Backup] Fertig. Ablage: $ZIEL"
ls -lh "$ZIEL" | tail -n 5
