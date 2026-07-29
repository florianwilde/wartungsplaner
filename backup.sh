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

ZIEL="${1:-./backups}"
AUFBEWAHRUNG_TAGE="${AUFBEWAHRUNG_TAGE:-30}"
STAND="$(date +%Y-%m-%d_%H%M)"

# Zugangsdaten aus der .env lesen
if [ ! -f .env ]; then
  echo "Fehler: .env nicht gefunden. Bitte im Projektverzeichnis ausführen." >&2
  exit 1
fi
# shellcheck disable=SC1091
. ./.env

VOLUME_UPLOADS="$(basename "$(pwd)")_uploads"

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
