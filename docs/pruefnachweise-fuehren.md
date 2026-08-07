[← Handbuch](README.md)

# Prüfnachweise führen

Ein Prüfnachweis ist ein **ausgefüllter Prüfbogen** zu einer bestimmten
Fälligkeit. Aus ihm entsteht ein PDF mit allen Prüfpunkten, Befunden und
Unterschriftenfeldern.

Die Seite **Nachweise** zeigt Ihre offenen Bögen, die zur Gegenzeichnung
vorgelegten und die zuletzt abgeschlossenen.

## Einen Bogen beginnen

Aus dem Erledigen-Dialog über „Prüfbogen ausfüllen“, oder direkt auf der Seite
der Aufgabe über **Prüfbogen**. Wählen Sie die Vorlage – zugeordnete Bögen
stehen oben.

Zu einer Fälligkeit gibt es je Vorlage höchstens einen Bogen. Ein zweiter
Aufruf führt zum bestehenden.

## Ausfüllen

Beantworten Sie die Prüfpunkte. **Zwischenstand speichern** hält den Stand
fest – ein umfangreiches Review muss nicht in einem Zug fertig werden.

Pflichtpunkte sind mit `*` gekennzeichnet. Der Kopf der Karte zeigt jederzeit,
wie viele Punkte beantwortet sind und welche noch fehlen.

Bei einer Feststellung – _nicht erfüllt_, _entziehen_, _ändern_ – gehört die
**Maßnahme** in das Bemerkungsfeld. Sie steht später im PDF und im
Nachweisregister.

### Zeilen aus einer CSV-Datei übernehmen

Prüfpunkte der Art **Zeilenliste** nehmen beliebig viele Einträge auf. Statt
sie abzutippen:

1. Export aus dem Quellsystem erzeugen, etwa aus dem AD
2. Datei bei „Zeilen aus CSV übernehmen“ auswählen
3. **Übernehmen**

Erkannt werden Semikolon, Komma und Tabulator als Trennzeichen sowie eine
Kopfzeile. Die **erste Spalte** wird zur Bezeichnung, weitere Spalten zum
Zusatz. Doppelte und namenlose Zeilen werden übersprungen und gemeldet – nicht
stillschweigend verworfen.

Mit **Vorhandene Zeilen ersetzen** entscheiden Sie, ob die Datei den Bestand
ersetzt oder ergänzt.

### Sammelentscheidung

Bei einer Rezertifizierung ist die überwiegende Mehrheit der Einträge in
Ordnung. Über die Schaltflächen **„Übrige N Zeilen auf einmal“** setzen Sie
alle noch offenen Zeilen auf denselben Wert. Bereits entschiedene Zeilen
bleiben unangetastet – erst die Ausnahmen einzeln bearbeiten, dann den Rest in
einem Zug.

Eine Liste gilt erst als beantwortet, wenn Zeilen vorhanden **und** alle
entschieden sind. Eine leere Liste belegt nichts.

## Belege beifügen

Der Prüfbogen hält fest, _was_ geprüft wurde – der Beleg zeigt, _woran_.
Unter **Belege** laden Sie die tatsächlichen Nachweise aus den geprüften
Systemen hoch: AD-Export, Screenshot, Herstellerprotokoll, Sicherungsbericht.

Ein Beleg lässt sich **einem einzelnen Prüfpunkt zuordnen** oder dem gesamten
Bogen. Bei einer Rezertifizierung mit dreißig Punkten ist das der Unterschied
zwischen nachvollziehbar und unbrauchbar.

Jede Datei erhält eine SHA-256-Prüfsumme und ist einzeln herunterladbar. Bis
zu 25 Belege je Bogen.

### Screenshot einfügen

Der häufigste Beleg ist der Screenshot – und der Umweg über „Speichern unter“
und den Explorer der lästigste Teil daran. Drei Wege führen zum Ziel:

- **Einfügen mit Strg+V**, sobald der Bereich sichtbar ist. Ein eingefügtes
  Bild bekommt einen sprechenden Namen mit Zeitpunkt, etwa
  `bildschirmfoto-2026-07-30-172305.png` – „image.png“ wäre nach dem dritten
  Beleg unbrauchbar.
- **Dateien in den Bereich ziehen.**
- **Über die Schaltfläche auswählen** wie bisher.

Alle drei sammeln sich in derselben Liste; einzelne Einträge lassen sich
wieder entfernen, bevor hochgeladen wird. Dasselbe gilt im Erledigen-Dialog
für die Nachweise einer Durchführung.

## Vorlegen und gegenzeichnen

Verlangt der Bogen das Vier-Augen-Prinzip:

1. **Zur Gegenzeichnung vorlegen** – möglich, sobald alle Pflichtangaben
   ausgefüllt sind
2. Die berechtigten Personen werden benachrichtigt; der Vorgang erscheint auf
   ihrem Dashboard
3. Die zweite Person **zeichnet gegen** oder **weist zurück**

Eine Zurückweisung verlangt eine Begründung von mindestens zehn Zeichen. Der
Bogen kehrt in die Bearbeitung zurück, und die erfassende Person wird sofort
benachrichtigt.

Gegenzeichnen kann nur, wer den Nachweis **nicht selbst erfasst** hat.

Ohne Vier-Augen-Prinzip gibt es stattdessen **Abschließen**.

## Was beim Abschluss entsteht

- Ein **PDF-Nachweis** mit Kopfdaten, allen Prüfpunkten samt Befund, den
  Zeilen einer Liste, einem Verzeichnis der Belege mit Prüfsummen und
  Unterschriftenfeldern beider Personen
- Der Bogen wird **unveränderlich**

Das PDF wartet am Bogen, bis die Fälligkeit erledigt wird – dann wandert es
mitsamt den Belegen an die Durchführung. Ist die Fälligkeit bereits erledigt,
kommt es sogleich dorthin.

## Feststellungen in Abweichungen überführen

Nach dem Abschluss zeigt die Seite alle Prüfpunkte mit Befund. Über **Als
Abweichung anlegen** entsteht daraus eine nachverfolgbare Abweichung – Titel
und Beschreibung sind vorbelegt, einzugeben bleiben Schwere, Frist und
verantwortliche Person.

Je Feststellung entsteht höchstens eine Abweichung; die Seite zeigt, welche
bereits überführt sind. Möglich ist das, sobald die Fälligkeit erledigt ist –
vorher gibt es keine Durchführung, an der eine Abweichung hängen könnte.

## Einen fremden Entwurf übernehmen

Ausfüllen darf einen Bogen nur die erfassende Person. Hat eine Kollegin einen
Entwurf angelegt und ist im Urlaub, stünde die Prüfung sonst still. Auf der
Seite des Nachweises gibt es deshalb zwei Auswege:

- **Entwurf übernehmen** – die bisherigen Angaben bleiben erhalten. Wer
  übernimmt, gilt als erfassende Person und kann anschließend **nicht selbst
  gegenzeichnen**; das Vier-Augen-Prinzip bleibt gewahrt. Der Wechsel steht
  mit beiden Namen im Audit-Log.
- **Entwurf verwerfen** – für die Administration auch bei fremden Entwürfen.
  Danach lässt sich ein neuer Bogen derselben Vorlage anlegen.

Den eigenen Entwurf können Sie jederzeit verwerfen. Abgeschlossene Nachweise
bleiben unantastbar.
