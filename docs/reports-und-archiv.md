[← Handbuch](README.md)

# Reports und Archiv

Unter **Reports** entstehen auditfertige Auswertungen als PDF oder Excel.
Jeder Abruf wird protokolliert – auch das ist Teil des Nachweises.

## Die fünf Auswertungen

| Bericht | Beantwortet die Frage |
| --- | --- |
| **Compliance-Übersicht** | Wie viele Prüfungen wurden pünktlich erledigt – gesamt und je Kategorie? |
| **Aufgabenhistorie** | Was wurde wann von wem geprüft, mit welchem Ergebnis und welchen Nachweisen? |
| **Abweichungsbericht** | Welche Feststellungen gab es, wer ist verantwortlich, wie ist der Stand? |
| **Fälligkeitsvorschau** | Was steht in den nächsten Monaten an? |
| **Nachweisregister** | Welche Prüfnachweise wurden abgeschlossen, von wem erfasst und gegengezeichnet? |

Der **Zeitraum** und die **Kategorien** lassen sich je Bericht einstellen; die
Fälligkeitsvorschau fragt stattdessen nach der Anzahl der Monate.

### Compliance-Übersicht

Zeigt je Kategorie: pünktlich, verspätet, offen, überfällig, ausgesetzt sowie
den Erfüllungsgrad und die Pünktlichkeitsquote. Ausgesetzte Fälligkeiten
zählen nicht gegen den Erfüllungsgrad – sie wurden bewusst nicht durchgeführt.

Für die Pünktlichkeit zählt die **Karenzfrist** der Aufgabe mit.

### Aufgabenhistorie

Je Aufgabe alle Durchführungen mit Datum, Person, Ergebnis, Kommentar und den
Nachweisen inklusive SHA-256-Prüfsumme. Das ist der Bericht, den eine prüfende
Person meist zuerst sehen will.

### Nachweisregister

Alle abgeschlossenen Prüfnachweise mit Prüfbogen, Aufgabe, beiden beteiligten
Personen, Zeitpunkten, Anzahl der Prüfpunkte und Zeilen, Feststellungen,
Belegen und der Prüfsumme des PDF.

Der Detailteil nennt **jede Feststellung im Klartext** und die vollständige
Prüfsumme. Bögen ohne Vier-Augen-Pflicht werden als „ohne Gegenzeichnung“
ausgewiesen.

Voreingestellt im Querformat – zwölf Spalten brächen im Hochformat um.

## Vorlagen anpassen

Unter **Administration → Report-Vorlagen** lässt sich je Reportart bestimmen:

- **Ausrichtung** A4 hoch oder quer
- **Spaltenauswahl** und Reihenfolge; die für die Aussagekraft nötigen Spalten
  sind fest und lassen sich nicht abwählen
- **Deckblatt** mit Titel, Untertitel und Eckdaten; die Seitenzählung beginnt
  danach
- **Freitextblöcke** vor und nach der Auswertung – etwa die Einordnung für ein
  bestimmtes Audit
- **Unterschriftenfelder** mit frei wählbarer Beschriftung

Mehrere Vorlagen je Reportart sind möglich, etwa „Jahresaudit“ und
„Kurzfassung Geschäftsführung“. Eine gilt als Standard. Auf der Reports-Seite
wählen Sie je Bericht die gewünschte Vorlage.

Die **Excel-Exporte** enthalten stets alle Felder – dort wird nicht gekürzt,
weil damit weitergerechnet wird.

## Archiv der Nachweise

Ein Bericht zeigt, *dass* geprüft wurde. Ein Audit will die **Nachweise
selbst** – und zwar so, dass sie auch außerhalb dieser Anwendung überprüfbar
bleiben.

Unter **Reports → Archiv der Nachweise** entsteht ein ZIP mit allen Nachweisen
eines Zeitraums, gegliedert nach Kategorie und Aufgabe. Beigelegt sind:

| Datei | Inhalt |
| --- | --- |
| `INHALT.csv` | Verzeichnis aller Dateien mit Aufgabe, Fälligkeit, Durchführungsdatum, hochladender Person und Prüfsumme |
| `PRUEFSUMMEN.sha256` | Prüfsummen im Format von `sha256sum` |
| `LIESMICH.txt` | Erläuterung samt Anleitung zum Nachrechnen |

### Unverändertheit nachrechnen

Niemand muss der Anwendung glauben. Im entpackten Archiv:

```bash
sha256sum -c PRUEFSUMMEN.sha256
```

Unter Windows in der PowerShell je Datei:

```powershell
Get-FileHash -Algorithm SHA256 <Datei>
```

Stimmen alle Summen überein, ist der Bestand seit dem Hochladen unverändert.

Fehlt zu einem Eintrag die Datei, wird sie ausgelassen und in der Erläuterung
namentlich benannt – ein unvollständiges, aber ehrliches Archiv ist mehr wert
als gar keines. Dass so etwas gar nicht erst unbemerkt bleibt, dafür sorgt der
[Prüfsummenlauf](unversehrtheit.md).

> Bei großen Zeiträumen kann der Download eine Weile dauern. Das Archiv wird
> als Datenstrom gebaut, nicht erst vollständig im Speicher zusammengesetzt.
