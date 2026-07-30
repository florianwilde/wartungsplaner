[← Handbuch](README.md)

# Import und Export

Zehn Restore-Tests für zehn Systeme legt niemand gern einzeln an. Unter
**Administration → Import / Export** lassen sich Kategorien, Aufgaben und
Benutzer in größerer Zahl pflegen.

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

## Protokollierung

Jeder Import und Export erzeugt einen Audit-Eintrag mit Anzahl und Art der
Änderungen.
