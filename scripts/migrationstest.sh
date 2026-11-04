#!/usr/bin/env bash
#
# Prüft die Migrationen gegen eine leere Datenbank.
#
# Warum: Eine Migration, die auf dem Entwicklungsrechner läuft, muss nicht auf
# einem gewachsenen Bestand laufen – und umgekehrt. Wird sie als Differenz zu
# einer Datenbank erzeugt, die einen Zwischenstand enthält, landet dieser
# Zwischenstand in der Migration und scheitert überall sonst. Genau das ist
# einmal passiert.
#
# Geprüft wird zweierlei:
#   1. Alle Migrationen laufen auf einer leeren Datenbank durch.
#   2. Das Ergebnis entspricht dem Schema – keine Abweichung, kein Rest.
#
# Ausführen:  npm run test:migrationen
# Voraussetzung: Docker.

set -euo pipefail

BLAU='\033[1;34m'
ROT='\033[1;31m'
GRUEN='\033[1;32m'
AUS='\033[0m'

NAME="wartungsplaner-migrationstest"
PORT="${MIGRATIONSTEST_PORT:-55432}"
URL="postgresql://test:test@localhost:${PORT}/test?schema=public"

aufraeumen() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
}
trap aufraeumen EXIT

echo -e "${BLAU}[Migrationstest]${AUS} Leere Datenbank wird gestartet ..."
aufraeumen
docker run -d --rm --name "$NAME" \
  -e POSTGRES_PASSWORD=test -e POSTGRES_USER=test -e POSTGRES_DB=test \
  -p "${PORT}:5432" postgres:16 >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U test >/dev/null 2>&1; then break; fi
  sleep 1
done
if ! docker exec "$NAME" pg_isready -U test >/dev/null 2>&1; then
  echo -e "${ROT}[Fehler]${AUS} Die Testdatenbank wurde nicht bereit."
  exit 1
fi

echo -e "${BLAU}[Migrationstest]${AUS} Migrationen werden angewendet ..."
if ! DATABASE_URL="$URL" npx prisma migrate deploy; then
  echo -e "${ROT}[Fehler]${AUS} Mindestens eine Migration ist auf einem leeren"
  echo "         Bestand nicht anwendbar. Auf einer frischen Installation"
  echo "         würde die Anwendung damit nicht starten."
  exit 1
fi

echo -e "${BLAU}[Migrationstest]${AUS} Ergebnis wird mit dem Schema verglichen ..."
ABWEICHUNG=$(
  # Prisma 7: --from-url heißt --from-config-datasource (Adresse aus
  # prisma.config.ts, also aus DATABASE_URL), --to-schema-datamodel --to-schema.
  DATABASE_URL="$URL" npx prisma migrate diff \
    --from-config-datasource \
    --to-schema prisma/schema.prisma \
    --script 2>/dev/null
)

if ! grep -q "empty migration" <<<"$ABWEICHUNG"; then
  echo -e "${ROT}[Fehler]${AUS} Der migrierte Bestand weicht vom Schema ab:"
  echo "$ABWEICHUNG"
  exit 1
fi

echo -e "${GRUEN}[Migrationstest]${AUS} Alle Migrationen laufen auf einem leeren"
echo "                  Bestand durch und ergeben genau das Schema."
