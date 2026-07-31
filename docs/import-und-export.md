[← Handbuch](README.md)

# Import und Export

Zehn Restore-Tests für zehn Systeme legt niemand gern einzeln an. Unter
**Administration → Import / Export** lassen sich fünf Bereiche in größerer
Zahl pflegen: **Kategorien**, **Aufgaben**, **Benutzer**,
**Audit-Referenzen** und **Prüfbögen**.

> **Reihenfolge beim ersten Einspielen:** Kategorien und Benutzer zuerst,
> dann Audit-Referenzen, dann Aufgaben, zuletzt Prüfbögen. Jeder Bereich
> verweist auf die davorstehenden.

## Export

Je Bereich als **CSV** oder **JSON**, dazu ein Gesamtexport aller Bereiche in
einer Datei.

CSV wird mit Semikolon getrennt und mit BOM ausgeliefert – Excel öffnet es
damit ohne Nachfragen richtig.

**Passwörter werden nie exportiert.**

## Import

1. **Vorlage herunterladen** – je Bereich mit Kopfzeile und Beispielzeile
2. In Excel oder einem Texteditor ausfüllen
3. Datei hochladen – es erscheint zunächst eine **Vorschau**
4. Prüfen, was angelegt und was geändert würde
5. Übernehmen

### Die Vorschau

Zeile für Zeile wird gezeigt, was geschehen würde: **anlegen**, **ändern**
(mit Angabe der betroffenen Felder) oder **unverändert**. Erst danach wird
geschrieben.

### Zuordnung über fachliche Schlüssel

Verknüpft wird über Kategoriename, Aufgabentitel und E-Mail-Adresse – nicht
über interne Kennungen. Dadurch sind Daten zwischen Installationen übertragbar,
und ein Export lässt sich unverändert wieder einlesen.

### Strenge Prüfung

Ein einziger fehlerhafter Datensatz verhindert den **gesamten** Lauf.
Geschrieben wird in einer Transaktion. Ein halb eingespielter Bestand wäre
schlimmer als gar keiner: Man wüsste nicht, was gilt.

### Was der Import mit Audit-Referenzen macht

Die Spalte `auditreferenzen` nimmt mehrere Werte mit Komma getrennt auf.
Unbekannte Referenzen werden angelegt – siehe
[Audit-Referenzen](audit-referenzen.md#import-und-export).

### Audit-Referenzen

Spalten: `rahmenwerk`, `kuerzel`, `bezeichnung`, `beschreibung`, `aktiv`,
`reihenfolge`.

Zugeordnet wird über **Rahmenwerk und Kurzzeichen zusammen**. „A.8.13"
allein sagt nichts – dieselbe Kennung kann in ISO 27001 und in einem
anderen Rahmenwerk Verschiedenes bedeuten. Ohne Rahmenwerk zählt das
Kurzzeichen allein; das ist für eigene Vorgaben gedacht.

Die **Zuordnung zu Aufgaben** wird dabei nicht angerührt. Sie steht in der
Aufgabendatei, Spalte `auditreferenzen`.

### Prüfbögen

Spalten: `pruefbogen`, `beschreibung`, `aufgabe`, `vier_augen`, `aktiv`,
`position`, `frage`, `hinweis`, `art`, `pflicht`.

**In einer Zeile steht ein Prüfpunkt, nicht ein Bogen.** Für einen Bogen
mit fünf Punkten steht sein Name fünfmal untereinander; die Angaben zum
Bogen wiederholen sich dabei. Das ist redundant, aber der einzige Weg, eine
geschachtelte Struktur in einer Tabelle abzubilden, die sich in Excel
bearbeiten lässt.

```
pruefbogen;beschreibung;aufgabe;vier_augen;aktiv;position;frage;hinweis;art;pflicht
Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;1;Sind alle Konten begründet?;;BEWERTUNG;ja
Rezertifizierung;Halbjährliche Durchsicht;;ja;ja;2;Anzahl geprüfter Konten;;ZAHL;ja
```

Erlaubte Werte für `art`: `BEWERTUNG`, `TEXT`, `ZAHL`, `DATUM`, `LISTE`,
`ENTSCHEIDUNG` – siehe [Prüfbögen anlegen](pruefboegen-anlegen.md).
Bleibt `position` leer, zählt die Reihenfolge in der Datei. Bleibt
`aufgabe` leer, steht der Bogen für alle Aufgaben zur Wahl.

#### Was mit einem bereits benutzten Bogen geschieht

Wurde mit einem Bogen schon geprüft, **lassen sich seine Prüfpunkte nicht
mehr über den Import ändern**. Der Lauf wird abgelehnt und nennt den
betroffenen Bogen.

Der Grund ist nicht Vorsicht, sondern Beweiskraft: An den Prüfpunkten
hängen die Antworten, Belege und Abweichungen geführter Nachweise. Ein
Austausch würde sie mitlöschen – ein abgeschlossener Nachweis sähe
nachträglich anders aus, als er unterschrieben wurde.

Was weiterhin geht: **Beschreibung**, **Aufgabenzuordnung**,
**Vier-Augen-Pflicht** und **Aktiv-Status** ändern. Diese Angaben berühren
keinen geführten Nachweis. Brauchen Sie andere Prüfpunkte, legen Sie einen
Bogen unter neuem Namen an und setzen den alten auf inaktiv – die
bisherigen Nachweise bleiben damit lesbar.

## Protokollierung

Jeder Import und Export erzeugt einen Audit-Eintrag mit Anzahl und Art der
Änderungen.
