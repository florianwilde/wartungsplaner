[← Handbuch](README.md)

# Audit-Referenzen

Eine Audit-Referenz benennt eine **Anforderung aus einer Norm** – etwa
`ISO 27001 A.8.13` (Informationssicherung). Aufgaben lassen sich ihnen
zuordnen, und zwar mehreren gleichzeitig: Eine Prüfung deckt oft mehr als eine
Anforderung ab.

Gepflegt werden sie unter **Administration → Audit-Referenzen**.

## Warum Stammdaten statt Freitext

Bis zur Umstellung war die Referenz ein Freitextfeld an der Aufgabe. Damit
ließ sich weder mehr als eine angeben noch verlässlich danach filtern:
`ISO 27001 A.8.13` und `ISO27001 A.8.13` waren zwei verschiedene Dinge.

Genau die Frage, die ein Audit stellt – **„welche Prüfungen decken diese
Anforderung ab?“** – blieb damit unbeantwortbar. Als Stammdatum ist sie in
einem Griff zu beantworten.

## Eine Referenz anlegen

| Feld             | Bedeutung                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| **Rahmenwerk**   | Norm oder Regelwerk, etwa `ISO 27001`, `TISAX`, `DSGVO`. Freie Eingabe; häufige Werte werden vorgeschlagen. |
| **Kurzzeichen**  | Die Kennung der Anforderung, etwa `A.8.13`. Pflichtangabe.                                                  |
| **Bezeichnung**  | Klartext, etwa „Informationssicherung“. Ohne Angabe steht das Kurzzeichen für sich.                         |
| **Beschreibung** | Was die Anforderung verlangt – für alle, die die Norm nicht auswendig kennen.                               |
| **Aktiv**        | Nur aktive Referenzen werden zur Zuordnung angeboten.                                                       |

Innerhalb eines Rahmenwerks ist das Kurzzeichen eindeutig. Dasselbe
Kurzzeichen darf in verschiedenen Rahmenwerken vorkommen – `A.8.13` bedeutet
in TISAX etwas anderes als in ISO 27001.

## Zuordnen

Beim Anlegen oder Bearbeiten einer Aufgabe unter **Audit-Referenzen**.
Mehrfachauswahl, nach Rahmenwerk gruppiert.

Die zugeordneten Kurzzeichen erscheinen als Kennzeichen an der Aufgabe und in
der Aufgabenliste.

## Filtern

- **Aufgabenliste** – Filterfeld „Audit-Referenz“. Angeboten werden nur
  Referenzen, denen tatsächlich Aufgaben zugeordnet sind; ein Filter, der stets
  leer ausgeht, hilft niemandem.
- **Suche** – findet Aufgaben auch über Kurzzeichen, Bezeichnung und
  Rahmenwerk.
- **Verwaltung** – die Anzahl neben jeder Referenz führt direkt zur gefilterten
  Aufgabenliste.

## Löschen und deaktivieren

Eine Referenz mit zugeordneten Aufgaben lässt sich **nicht löschen**. Sonst
verschwände stillschweigend die Angabe, welche Anforderung eine Prüfung
abdeckt. Zum Ausmustern gibt es das Kennzeichen **aktiv**: Die Referenz wird
nicht mehr zur Neuvergabe angeboten, bestehende Zuordnungen bleiben erhalten.

## Was beim Update mit den alten Freitexten geschah

Die Umstellung hat den vorhandenen Bestand übernommen: Jeder Freitext wurde zu
einem Stammsatz, und die Aufgaben wurden ihm zugeordnet. Gleiche Texte ergaben
denselben Stammsatz – aus mehreren Aufgaben mit `ISO 27001 A.8.13` wurde eine
Referenz mit mehreren Zuordnungen.

Die Aufteilung in Rahmenwerk und Kurzzeichen wurde bewusst **nicht geraten**:
Der vollständige Text steht im Kurzzeichen. Das Ordnen nach Rahmenwerken ist
eine fachliche Entscheidung – tragen Sie es in der Verwaltung nach. Referenzen
ohne Rahmenwerk stehen dort in einer eigenen Gruppe am Ende.

## Mehrere auf einmal löschen

Jede Referenz lässt sich markieren; über der Liste erscheint dann
**Markierte löschen**. Es gilt dieselbe Regel wie beim einzelnen Löschen:
Referenzen mit zugeordneten Aufgaben bleiben geschützt – sonst verschwände
stillschweigend die Angabe, welche Anforderung eine Prüfung abdeckt.

Blockiert eine einzige markierte Referenz, wird der ganze Vorgang
abgelehnt und nennt sie beim Namen. Zum Ausmustern gibt es das Kennzeichen
**aktiv**.

## Import und Export

Der Aufgaben-Export führt die Referenzen als Spalte `auditreferenzen`, mit
Komma getrennt (`ISO 27001 A.8.13, ISO 27001 A.8.24`).

Beim Import werden unbekannte Referenzen **angelegt** – ein Bestand aus einer
anderen Installation lässt sich damit übernehmen, ohne vorher jede Anforderung
von Hand nachzupflegen. Der letzte Bestandteil des Namens gilt dabei als
Kurzzeichen, alles davor als Rahmenwerk.
