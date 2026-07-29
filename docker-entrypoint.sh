#!/bin/sh
# ---------------------------------------------------------------------------
# Startskript des App-Containers.
#
#  1. Wartet, bis die Datenbank erreichbar ist
#  2. Wendet ausstehende Migrationen an
#  3. Führt den Seed beim allerersten Start aus (nur wenn noch kein Benutzer
#     existiert – dadurch werden bestehende Daten nie überschrieben)
#  4. Startet den Next.js-Server
# ---------------------------------------------------------------------------
set -e

echo "[Wartungsplaner] Warte auf die Datenbank ..."
VERSUCH=0
until node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRaw\`SELECT 1\`.then(() => p.\$disconnect()).then(() => process.exit(0)).catch(() => process.exit(1));
" 2>/dev/null; do
  VERSUCH=$((VERSUCH + 1))
  if [ "$VERSUCH" -ge 30 ]; then
    echo "[Wartungsplaner] Die Datenbank ist nach 60 Sekunden nicht erreichbar. Abbruch."
    exit 1
  fi
  sleep 2
done
echo "[Wartungsplaner] Datenbank erreichbar."

echo "[Wartungsplaner] Wende Migrationen an ..."
./node_modules/.bin/prisma migrate deploy

BENUTZER_ANZAHL=$(node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.count().then((n) => { console.log(n); return p.\$disconnect(); }).catch(() => { console.log('-1'); process.exit(0); });
" 2>/dev/null | tail -n 1)

if [ "$BENUTZER_ANZAHL" = "0" ]; then
  echo "[Wartungsplaner] Leere Datenbank erkannt – Seed wird ausgeführt ..."
  ./node_modules/.bin/tsx prisma/seed.ts
else
  echo "[Wartungsplaner] Bestehende Daten gefunden ($BENUTZER_ANZAHL Benutzer) – Seed wird übersprungen."
fi

echo "[Wartungsplaner] Starte Anwendung ..."
exec "$@"
