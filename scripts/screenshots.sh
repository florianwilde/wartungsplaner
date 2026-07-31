#!/usr/bin/env bash
#
# Erzeugt die Bildschirmfotos für README und Handbuch.
#
# Startet dafür eine **eigene Demo-Instanz** in einem getrennten
# Compose-Projekt mit eigener Datenbank, befüllt sie mit Beispieldaten und
# räumt hinterher auf. Der laufende Betrieb bleibt unberührt – und in die
# Bilder gerät nichts, was jemandem gehört.
#
# Ausführen:  npm run screenshots
# Voraussetzung: Docker, und einmalig `npx playwright install chromium`.

set -euo pipefail

BLAU='\033[1;34m'
ROT='\033[1;31m'
GRUEN='\033[1;32m'
AUS='\033[0m'

PROJEKT="wartungsplaner-demo"
APP_PORT="${DEMO_APP_PORT:-3009}"
DB_PORT="${DEMO_DB_PORT:-55433}"
BASIS="http://localhost:${APP_PORT}"
DEMO_EMAIL="admin@example.com"
DEMO_PASSWORT="Start!1234"

aufraeumen() {
  echo -e "${BLAU}[Screenshots]${AUS} Demo-Instanz wird entfernt ..."
  docker compose -p "$PROJEKT" -f docker-compose.yml -f docker-compose.demo.yml \
    down -v --remove-orphans >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

echo -e "${BLAU}[Screenshots]${AUS} Demo-Instanz wird gestartet (Port ${APP_PORT}) ..."
aufraeumen

# Eigene Ports und ein eigener Projektname: Damit bekommt die Demo eigene
# Container *und* eigene Volumes, ohne den vorhandenen Stack zu berühren.
APP_PORT="$APP_PORT" POSTGRES_PORT="$DB_PORT" \
  APP_URL="$BASIS" AUTH_URL="$BASIS" \
  SEED_ADMIN_EMAIL="$DEMO_EMAIL" SEED_ADMIN_PASSWORD="$DEMO_PASSWORT" \
  CRON_ENABLED=false \
  docker compose -p "$PROJEKT" -f docker-compose.yml -f docker-compose.demo.yml \
  up -d --build

echo -e "${BLAU}[Screenshots]${AUS} Warten auf Betriebsbereitschaft ..."
bereit=0
for _ in $(seq 1 90); do
  if curl -fsS "${BASIS}/api/health" >/dev/null 2>&1; then bereit=1; break; fi
  sleep 2
done
if [ "$bereit" -ne 1 ]; then
  echo -e "${ROT}[Fehler]${AUS} Die Demo-Instanz wurde nicht bereit."
  docker compose -p "$PROJEKT" logs app --tail 30 || true
  exit 1
fi

echo -e "${BLAU}[Screenshots]${AUS} Beispieldaten werden ergänzt ..."
DATABASE_URL="postgresql://${POSTGRES_USER:-wartungsplaner}:${POSTGRES_PASSWORD:-wartungsplaner_dev}@localhost:${DB_PORT}/${POSTGRES_DB:-wartungsplaner}?schema=public" \
  DEMO_BESTAETIGT=ja npx tsx scripts/demodaten.ts

mkdir -p docs/bilder

echo -e "${BLAU}[Screenshots]${AUS} Bilder werden aufgenommen ..."
DEMO_BASIS_URL="$BASIS" DEMO_EMAIL="$DEMO_EMAIL" DEMO_PASSWORT="$DEMO_PASSWORT" \
  npx playwright test --config playwright.screenshots.config.ts

echo
echo -e "${GRUEN}[Screenshots]${AUS} Fertig. Ablage: docs/bilder"
ls -la docs/bilder
