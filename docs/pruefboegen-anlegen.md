[← Handbuch](README.md)

# Prüfbögen anlegen

Ein Prüfbogen ist die **Vorlage** für eine strukturierte Prüfung. Statt den
Befund in einer Word-Datei außerhalb festzuhalten und sie anschließend
hochzuladen, findet die Prüfung in der Anwendung statt – und der Nachweis
entsteht daraus.

Prüfbögen pflegen Administratoren unter **Administration → Prüfbögen**.

## Wann lohnt sich ein Prüfbogen?

Immer dann, wenn die Prüfung aus mehreren Fragen besteht und die Antworten
später nachvollziehbar sein sollen:

- **Rezertifizierung von Berechtigungen** – je Konto eine Entscheidung
- **Restore-Test** – geprüfte Systeme, Vollständigkeit, Stichproben
- **Zutrittsberechtigungen** – Transponder, Person, Entscheidung
- **Regelprüfung** (Firewall, Patchstand, Zertifikate) – Regel, Befund, Maßnahme

Für eine Prüfung, die mit „erledigt, Protokoll im Anhang“ auskommt, genügt der
gewohnte [Erledigen-Vorgang](faelligkeiten-erledigen.md).

## Einen Bogen anlegen

1. **Administration → Prüfbögen → Prüfbogen anlegen**
2. Name vergeben, etwa „Rezertifizierung Berechtigungen“
3. Wahlweise einer **Aufgabe zuordnen** – dann wird er dort zuerst angeboten.
   Ohne Zuordnung steht er allen Aufgaben zur Verfügung.
4. **Vier-Augen-Prinzip** entscheiden (siehe unten)
5. Prüfpunkte anlegen
6. Speichern

## Prüfpunkte

Jeder Punkt hat eine Frage, wahlweise einen Hinweis, eine Antwortart und ein
Pflichtkennzeichen.

| Antwortart | Auswahl | Wofür |
| --- | --- | --- |
| **Bewertung** | erfüllt / nicht erfüllt / entfällt | die übliche Ja-Nein-Frage |
| **Entscheidung** | belassen / entziehen / ändern | einzelne Berechtigung |
| **Zeilenliste** | je Zeile belassen / entziehen / ändern | viele gleichartige Einträge |
| **Freitext** | – | Beobachtung, Stichprobenumfang |
| **Zahl** | – | Anzahl geprüfter Systeme, Dauer |
| **Datum** | – | Zeitpunkt der Wiederherstellung |

**Pflichtpunkte** müssen ausgefüllt sein, bevor der Bogen vorgelegt oder
abgeschlossen werden kann. Die Anwendung nennt dabei die offenen Punkte mit
Nummer.

Als **Feststellung** gelten die Antworten *nicht erfüllt*, *entziehen* und
*ändern*. Sie erscheinen hervorgehoben im PDF, im Nachweisregister und lassen
sich mit einem Griff in [Abweichungen](abweichungen.md) überführen.

### Zeilenlisten

Eine Rezertifizierung von achtzig Konten wäre mit achtzig einzelnen
Prüfpunkten nicht zu bewältigen. Dafür gibt es die Antwortart **Zeilenliste**:
Ein einziger Prüfpunkt nimmt beliebig viele gleichartige Zeilen auf – je Konto,
Transponder oder Firewall-Regel eine Entscheidung.

Welche Zeilen es gibt, entscheidet sich erst beim Prüfen; die Vorlage legt nur
die Frage fest. Beim Ausfüllen lassen sich die Zeilen aus einer CSV-Datei
übernehmen, etwa unverändert aus einem AD-Export. Siehe
[Prüfnachweise führen](pruefnachweise-fuehren.md#zeilen-aus-einer-csv-datei-übernehmen).

## Vier-Augen-Prinzip

Ist es eingeschaltet, durchläuft jeder Nachweis den Weg
*Entwurf → vorgelegt → gegengezeichnet*. Die gegenzeichnende Person **darf
nicht die erfassende sein** – die Anwendung setzt das durch, nicht nur die
Oberfläche.

Ohne Vier-Augen-Prinzip schließt die erfassende Person den Bogen selbst ab. Im
Nachweisregister wird das als „ohne Gegenzeichnung“ ausgewiesen; es wird keine
zweite Person vorgetäuscht.

Faustregel: Wo eine Prüfung Entscheidungen über Berechtigungen oder Zugänge
trifft, gehört die Gegenzeichnung dazu. Wo sie einen Zustand feststellt
(Patchstand, Zertifikatslaufzeit), ist sie meist entbehrlich.

## Was sich später nicht mehr ändern lässt

Sobald mit einem Bogen **abgeschlossene Nachweise** entstanden sind, lassen
sich seine Prüfpunkte nicht mehr ändern. Andernfalls bekämen bestehende
Nachweise nachträglich eine andere Bedeutung: Die Antwort „erfüllt“ stünde
plötzlich unter einer anderen Frage.

Für Änderungen legen Sie einen **neuen Bogen** an. Den alten deaktivieren Sie –
löschen lässt er sich nicht mehr, solange Nachweise darauf verweisen.

## Bögen deaktivieren

Ein deaktivierter Bogen wird nicht mehr zur Auswahl angeboten. Bestehende
Nachweise bleiben unberührt und vollständig lesbar.
