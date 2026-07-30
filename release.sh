#!/usr/bin/env sh
# ---------------------------------------------------------------------------
# Erzeugt zu einem Versions-Tag ein Release bei GitLab und Gitea.
#
# Ein Tag ist nur ein Zeiger auf einen Commit. Ein Release hat Titel,
# Beschreibung und eine eigene Seite – darauf lässt sich verweisen, und wer
# wissen will, was eine Fassung gebracht hat, muss nicht erst den Changelog
# durchsuchen. Die Beschreibung stammt aus CHANGELOG.md, damit es nur eine
# Quelle gibt.
#
# Aufruf:
#   ./release.sh v1.8.0      eine Fassung
#   ./release.sh --alle      alle vorhandenen Versions-Tags nachtragen
#
# Zugangsdaten (Umgebungsvariable oder .env):
#   GITLAB_TOKEN   Persönliches Zugriffstoken mit Bereich "api"
#   GITEA_TOKEN    Zugriffstoken mit Schreibrecht auf das Repository
#
# Fehlt ein Token, wird das betreffende Ziel übersprungen und benannt –
# das Skript bricht deswegen nicht ab.
#
# Bestehende Releases werden aktualisiert, nicht doppelt angelegt.
# ---------------------------------------------------------------------------
set -eu

meldung() { printf '\n\033[1;34m[Release]\033[0m %s\n' "$1"; }
hinweis() { printf '           %s\n' "$1"; }
fehler()  { printf '\n\033[1;31m[Fehler]\033[0m %s\n' "$1" >&2; }

# --- .env einlesen ----------------------------------------------------------
# Gezielt und nicht per "." – ein Wert wie "15 2 * * *" würde sonst als
# Befehl ausgeführt.
lies_env() {
  [ -f .env ] || return 0
  wert="$(grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- | sed 's/^"//; s/"$//')"
  printf '%s' "$wert"
}

GITLAB_TOKEN="${GITLAB_TOKEN:-$(lies_env GITLAB_TOKEN)}"
GITEA_TOKEN="${GITEA_TOKEN:-$(lies_env GITEA_TOKEN)}"

# --- Voraussetzungen --------------------------------------------------------
command -v curl >/dev/null 2>&1 || { fehler 'curl wird benötigt.'; exit 1; }
command -v node >/dev/null 2>&1 || { fehler 'node wird benötigt.'; exit 1; }
[ -f CHANGELOG.md ] || { fehler 'CHANGELOG.md nicht gefunden.'; exit 1; }

# --- Ziel aus der Remote-URL ableiten ---------------------------------------
# Aus "http://host/gruppe/projekt.git" wird Basis-URL und Projektpfad.
basis_url() { printf '%s' "$1" | sed -E 's#^(https?://[^/]+)/.*#\1#'; }
projekt_pfad() { printf '%s' "$1" | sed -E 's#^https?://[^/]+/##; s#\.git$##'; }

# URL-Kodierung des Schrägstrichs – GitLab erwartet den Pfad so.
kodiere() { printf '%s' "$1" | sed 's#/#%2F#g'; }

# --- JSON sicher bauen ------------------------------------------------------
# Der Changelog enthält Anführungszeichen, Umlaute und Zeilenumbrüche.
baue_json() {
  CL_TAG="$1" CL_NAME="$2" CL_BODY_DATEI="$3" CL_FELD="$4" node -e '
    const fs = require("node:fs")
    const body = fs.readFileSync(process.env.CL_BODY_DATEI, "utf8")
    const daten = { tag_name: process.env.CL_TAG, name: process.env.CL_NAME }
    daten[process.env.CL_FELD] = body
    process.stdout.write(JSON.stringify(daten))
  '
}

# --- Ein Release je Ziel ----------------------------------------------------
release_gitlab() {
  tag="$1"; titel="$2"; datei="$3"
  url="$(git remote get-url origin 2>/dev/null || true)"
  [ -n "$url" ] || { hinweis 'Kein Remote "origin" – GitLab übersprungen.'; return 0; }

  if [ -z "$GITLAB_TOKEN" ]; then
    hinweis 'GITLAB_TOKEN fehlt – GitLab übersprungen.'
    return 0
  fi

  api="$(basis_url "$url")/api/v4/projects/$(kodiere "$(projekt_pfad "$url")")/releases"
  json="$(baue_json "$tag" "$titel" "$datei" description)"

  code="$(printf '%s' "$json" | curl -s -o /tmp/release-gitlab.json -w '%{http_code}' \
    -X POST "$api" \
    -H 'Content-Type: application/json' \
    -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    --data-binary @-)"

  if [ "$code" = "409" ]; then
    # Bereits vorhanden – dann aktualisieren.
    code="$(printf '%s' "$json" | curl -s -o /tmp/release-gitlab.json -w '%{http_code}' \
      -X PUT "$api/$tag" \
      -H 'Content-Type: application/json' \
      -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
      --data-binary @-)"
    [ "$code" = "200" ] && { hinweis "GitLab: $tag aktualisiert."; return 0; }
  elif [ "$code" = "201" ]; then
    hinweis "GitLab: $tag angelegt."
    return 0
  fi

  fehler "GitLab antwortete mit $code für $tag:"
  head -c 400 /tmp/release-gitlab.json >&2; printf '\n' >&2
  return 1
}

release_gitea() {
  tag="$1"; titel="$2"; datei="$3"
  url="$(git remote get-url gitea 2>/dev/null || true)"
  [ -n "$url" ] || { hinweis 'Kein Remote "gitea" – übersprungen.'; return 0; }

  if [ -z "$GITEA_TOKEN" ]; then
    hinweis 'GITEA_TOKEN fehlt – Gitea übersprungen.'
    return 0
  fi

  api="$(basis_url "$url")/api/v1/repos/$(projekt_pfad "$url")/releases"
  json="$(baue_json "$tag" "$titel" "$datei" body)"

  code="$(printf '%s' "$json" | curl -s -o /tmp/release-gitea.json -w '%{http_code}' \
    -X POST "$api" \
    -H 'Content-Type: application/json' \
    -H "Authorization: token $GITEA_TOKEN" \
    --data-binary @-)"

  if [ "$code" = "201" ]; then
    hinweis "Gitea: $tag angelegt."
    return 0
  fi

  if [ "$code" = "409" ] || [ "$code" = "422" ]; then
    # Vorhandenes Release suchen und aktualisieren.
    id="$(curl -s "$api/tags/$tag" -H "Authorization: token $GITEA_TOKEN" \
      | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(String(JSON.parse(d).id??""))}catch{}})')"
    if [ -n "$id" ]; then
      code="$(printf '%s' "$json" | curl -s -o /tmp/release-gitea.json -w '%{http_code}' \
        -X PATCH "$api/$id" \
        -H 'Content-Type: application/json' \
        -H "Authorization: token $GITEA_TOKEN" \
        --data-binary @-)"
      [ "$code" = "200" ] && { hinweis "Gitea: $tag aktualisiert."; return 0; }
    fi
  fi

  fehler "Gitea antwortete mit $code für $tag:"
  head -c 400 /tmp/release-gitea.json >&2; printf '\n' >&2
  return 1
}

# --- Eine Fassung veröffentlichen -------------------------------------------
veroeffentliche() {
  tag="$1"
  fassung="$(printf '%s' "$tag" | sed 's/^v//')"

  git rev-parse "$tag" >/dev/null 2>&1 || {
    fehler "Das Tag $tag gibt es nicht."
    return 1
  }

  datei="$(mktemp)"
  if ! node scripts/changelog-abschnitt.mjs "$fassung" > "$datei"; then
    rm -f "$datei"
    return 1
  fi

  meldung "$tag"
  release_gitlab "$tag" "Version $fassung" "$datei" || true
  release_gitea "$tag" "Version $fassung" "$datei" || true
  rm -f "$datei"
}

# --- Aufruf -----------------------------------------------------------------
if [ $# -eq 0 ]; then
  fehler 'Bitte ein Tag angeben, etwa ./release.sh v1.8.0 – oder --alle.'
  exit 2
fi

if [ "$1" = '--alle' ]; then
  # Nur echte Versions-Tags, in aufsteigender Reihenfolge.
  git tag --list 'v*' --sort=version:refname | while read -r tag; do
    [ -n "$tag" ] || continue
    veroeffentliche "$tag" || true
  done
else
  veroeffentliche "$1"
fi

meldung 'Fertig.'
