#!/usr/bin/env bash
#
# Spielt die Beispieldateien in eine frisch gestartete Wegwerf-Instanz ein.
#
# Die Prüfung der Dateien allein genügt nicht: Erst der vollständige Lauf
# gegen eine echte Datenbank zeigt, ob Kategorien, Referenzen und Aufgaben
# zueinander passen und ob die Reihenfolge stimmt.
#
# Ausführen:  npm run test:einspielen
# Voraussetzung: Docker.

set -euo pipefail

BLAU='\033[1;34m'
ROT='\033[1;31m'
GRUEN='\033[1;32m'
AUS='\033[0m'

PROJEKT="wartungsplaner-einspieltest"
DB_PORT="${EINSPIEL_DB_PORT:-55434}"
URL="postgresql://test:test@localhost:${DB_PORT}/test?schema=public"

aufraeumen() {
  docker rm -f "$PROJEKT" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

echo -e "${BLAU}[Einspieltest]${AUS} Leere Datenbank wird gestartet ..."
aufraeumen
docker run -d --rm --name "$PROJEKT" \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test \
  -p "127.0.0.1:${DB_PORT}:5432" postgres:16 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$PROJEKT" pg_isready -U test >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! docker exec "$PROJEKT" pg_isready -U test >/dev/null 2>&1; then
  echo -e "${ROT}[Fehler]${AUS} Die Testdatenbank wurde nicht bereit."
  exit 1
fi

echo -e "${BLAU}[Einspieltest]${AUS} Schema wird angelegt ..."
DATABASE_URL="$URL" npx prisma migrate deploy >/dev/null

echo -e "${BLAU}[Einspieltest]${AUS} Dateien werden eingespielt ..."
DATABASE_URL="$URL" npx tsx scripts/einspieltest.ts
