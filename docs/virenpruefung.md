[← Handbuch](README.md)

# Virenprüfung

Belege werden von anderen Personen wieder heruntergeladen. Ohne Prüfung wäre
die Nachweisablage ein bequemer Verteilweg – und zwar einer, dem man vertraut,
weil er aus der eigenen Anwendung stammt.

Die Prüfung ist **freiwillig**: Ohne hinterlegten Dienst wird nicht geprüft und
die Anwendung läuft unverändert.

## Einrichten

ClamAV läuft als eigener Dienst im Stack. Er steckt bewusst in einer eigenen
Datei: Das Signaturverzeichnis belegt rund ein Gigabyte, das soll niemand
ungefragt mitschleppen müssen.

```bash
docker compose -f docker-compose.yml -f docker-compose.clamav.yml up -d
```

Dazu in der `.env`:

```
CLAMAV_HOST=clamav
```

Beim ersten Start lädt der Dienst seine Signaturen; das dauert einige Minuten.
Unter **Administration → System** steht, ob er erreichbar ist und mit welcher
Fassung.

## Was geprüft wird

Jede hochgeladene Datei – Nachweise beim Erledigen ebenso wie Belege an einem
Prüfbogen. Geprüft wird **vor** dem Schreiben: Eine erkannte Datei landet gar
nicht erst im Ablageverzeichnis.

Wird etwas gefunden, lehnt die Anwendung die Datei ab und nennt den Namen des
Fundes. Das gilt immer, unabhängig von der Einstellung unten.

## Wenn der Dienst ausfällt

Hier gibt es zwei vertretbare Wege, und die Wahl gehört Ihnen:

| `VIRENPRUEFUNG_PFLICHT` | Verhalten bei nicht erreichbarem Dienst                  |
| ----------------------- | -------------------------------------------------------- |
| `false` (Standard)      | Die Datei wird **angenommen**, der Ausfall protokolliert |
| `true`                  | Die Datei wird **abgelehnt**                             |

Der Standard ist bewusst so gewählt: Die Anwendung dient der Nachweisführung.
Eine Prüfung, die sich nicht dokumentieren lässt, weil der Upload scheiterte,
ist ein größerer Schaden als eine ungeprüfte Datei aus dem eigenen Netz – zumal
nur angemeldete Beschäftigte hochladen können und die Dateitypen ohnehin auf
eine Whitelist begrenzt sind (siehe
[Fälligkeiten erledigen](faelligkeiten-erledigen.md#nachweise)).

Wer das anders gewichtet, setzt `VIRENPRUEFUNG_PFLICHT=true`. Dann kommt bei
ausgefallenem Dienst kein Upload mehr durch – das ist eine bewusste
Entscheidung gegen die Verfügbarkeit und für die Vorsicht.

## Selbst prüfen

Mit der EICAR-Testdatei – einer harmlosen Zeichenkette, auf die jedes
Virenschutzprogramm anspricht:

```bash
npm run test:viren
```

Der Test verlangt einen erreichbaren Dienst und prüft eine harmlose Datei,
die Testdatei, eine große Datei über mehrere Übertragungsabschnitte sowie das
Verhalten bei ausgefallenem Dienst in beiden Betriebsarten.

## Weitere Einstellungen

| Variable                | Standard | Bedeutung                      |
| ----------------------- | -------- | ------------------------------ |
| `CLAMAV_HOST`           | leer     | Ohne Angabe wird nicht geprüft |
| `CLAMAV_PORT`           | `3310`   | Port von `clamd`               |
| `CLAMAV_TIMEOUT_MS`     | `30000`  | Zeitgrenze je Datei            |
| `VIRENPRUEFUNG_PFLICHT` | `false`  | Siehe oben                     |
