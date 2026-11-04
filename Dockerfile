# =============================================================================
# Wartungsplaner – Production-Image (Multi-Stage)
# =============================================================================

# --- Stufe 1: alle Abhängigkeiten (inkl. Build-Werkzeuge) --------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Nur die Manifeste kopieren, damit diese Schicht im Cache bleibt, solange
# sich die Abhängigkeiten nicht ändern.
COPY package.json package-lock.json ./
RUN npm ci


# --- Stufe 2: Produktions-Abhängigkeiten ------------------------------------
# Ergibt einen vollständigen node_modules-Baum ohne Entwicklungspakete. Er wird
# im Laufzeit-Image verwendet. `prisma generate` lädt dabei die Schema-Engine
# herunter, die `migrate deploy` beim Start des Containers braucht; der Client
# selbst landet seit Prisma 7 in src/generated und kommt aus der Build-Stufe.
FROM node:22-alpine AS proddeps
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate


# --- Stufe 3: Build ----------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Git-Commit des Builds; wird von update.sh bzw. docker-compose übergeben und
# ist später unter Administration -> System und in /api/health sichtbar.
ARG GIT_COMMIT=""
ENV GIT_COMMIT=${GIT_COMMIT}

# Der Prisma-Client wird zur Bauzeit erzeugt. Für `next build` genügt eine
# syntaktisch gültige DATABASE_URL – es wird keine Verbindung aufgebaut.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"

RUN npx prisma generate && npx next build


# --- Stufe 4: Laufzeit -------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

# tzdata: Zeitzone Europe/Berlin für node-cron und die Datumsformatierung.
# openssl: wird von der Prisma-Schema-Engine (migrate deploy) benötigt.
RUN apk add --no-cache tzdata openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=Europe/Berlin
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_DIR=/app/uploads

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 wartungsplaner

# 1. Vollständige Produktions-Abhängigkeiten. Bewusst der komplette Baum statt
#    einzelner Pakete: pdfkit lädt Schriftmetriken zur Laufzeit nach und die
#    Prisma-CLI wird für `migrate deploy` gebraucht – beides erkennt die
#    Dateiverfolgung von Next.js nicht zuverlässig.
COPY --from=proddeps --chown=wartungsplaner:nodejs /app/node_modules ./node_modules

# 2. Standalone-Ausgabe von Next.js (server.js und die verfolgten Dateien).
COPY --from=builder --chown=wartungsplaner:nodejs /app/.next/standalone ./
COPY --from=builder --chown=wartungsplaner:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=wartungsplaner:nodejs /app/public ./public

# 3. Schema, Migrationen und Seed für den Start des Containers.
COPY --from=builder --chown=wartungsplaner:nodejs /app/prisma ./prisma
COPY --from=builder --chown=wartungsplaner:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=wartungsplaner:nodejs /app/src/generated ./src/generated
COPY --from=builder --chown=wartungsplaner:nodejs /app/src/lib/prisma-basis.ts ./src/lib/prisma-basis.ts
COPY --from=builder --chown=wartungsplaner:nodejs /app/src/lib/dates.ts ./src/lib/dates.ts
COPY --from=builder --chown=wartungsplaner:nodejs /app/tsconfig.json ./tsconfig.json

# 4. Änderungsverlauf – wird unter Administration -> System angezeigt.
COPY --from=builder --chown=wartungsplaner:nodejs /app/CHANGELOG.md ./CHANGELOG.md

COPY --chown=wartungsplaner:nodejs docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Ablage der Nachweise (im Compose-Stack als benanntes Volume eingehängt).
RUN mkdir -p /app/uploads && chown -R wartungsplaner:nodejs /app/uploads

USER wartungsplaner
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
