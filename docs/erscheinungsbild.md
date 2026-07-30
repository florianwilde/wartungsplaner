[← Handbuch](README.md)

# Erscheinungsbild

Unter **Administration → Erscheinungsbild** passt sich die Anwendung an das
Erscheinungsbild des Unternehmens an – ohne Eingriff in den Quellcode.

| Einstellung | Wirkt sich aus auf |
| --- | --- |
| **Anwendungsname** | Titelzeile, Berichte, Betreff der Nachrichten |
| **Organisation** | Kopf der Berichte, Fußzeile der Nachrichten |
| **Primärfarbe** | Bedienelemente, Kennzeichen, Kopfzeile der Berichte |
| **Logo** | Kopfzeile und Anmeldeseite; PDF-Berichte bei PNG und JPG |
| **Logo für dunklen Hintergrund** | Wird im dunklen Farbschema verwendet |
| **Favicon** | Symbol im Browsertab |
| **Fußzeile der Berichte** | Freitext unter jeder Berichtsseite |

## Farben

Aus der Primärfarbe leitet die Anwendung das übrige Farbschema ab – auch die
dunkle Fassung, für die sie die Farbe automatisch aufhellt.

Der **Kontrast** wird geprüft: Reicht er für die Lesbarkeit nach WCAG AA nicht
aus, erscheint ein Hinweis. Eine schlecht lesbare Oberfläche ist kein
Corporate Design.

## Logos

PNG, JPG und SVG – alle drei erscheinen in der Oberfläche **und** in den
PDF-Berichten. Ein SVG wird dabei als Vektorgrafik gezeichnet und bleibt auch
im Ausdruck scharf.

Zwei Einschränkungen, die man beim Entwurf kennen sollte:

- **Text im SVG** wird in der Standardschrift des Berichts gesetzt, weil im
  PDF keine Schriften nachgeladen werden. Wandeln Sie Schriftzüge vor dem
  Hochladen in Pfade um – dann sieht das Logo überall gleich aus.
- Andere Formate (webp, ico) bleiben der Oberfläche vorbehalten; der Bericht
  führt dann nur den Namen der Organisation.

Lässt sich ein Logo nicht einbetten, entsteht der Bericht trotzdem – ohne
Logo. Ein Erscheinungsbild darf keinen Nachweis verhindern.

## Zurücksetzen

Ein Griff stellt den Auslieferungszustand wieder her. Hochgeladene Dateien
bleiben dabei erhalten.
