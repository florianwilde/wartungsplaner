[← Handbuch](README.md)

# Aufgaben anlegen

Eine Aufgabe beschreibt eine **wiederkehrende Prüfung** – etwa „Restore-Test
ERP-System“ oder „Rezertifizierung der Zugriffsberechtigungen“. Aus ihr
erzeugt die Anwendung selbstständig die einzelnen Fälligkeiten.

Anlegen und ändern dürfen Aufgaben nur Administratoren.

## Schritt für Schritt

1. **Aufgaben → Neue Aufgabe**
2. Titel, Kategorie und verantwortliche Person angeben
3. Intervall und Startdatum festlegen
4. Vorlauf- und Karenztage prüfen
5. Speichern – die erste Fälligkeit entsteht sofort zum Startdatum

## Die Felder im Einzelnen

### Titel und Beschreibung

Der Titel erscheint überall dort, wo die Prüfung auftaucht – im Dashboard, im
Kalender, in den Berichten. Er sollte für sich sprechen: „Restore-Test
ERP-System“ ist brauchbar, „Test 3“ nicht.

Die **Prüfanleitung** darunter nimmt Markdown entgegen und ist der Ort für das
Vorgehen: welche Systeme, welche Schritte, worauf zu achten ist. Wer die
Prüfung übernimmt, findet sie auf der Seite der Aufgabe.

### Verantwortliche Person

Sie erhält die Benachrichtigungen und erscheint in den Auswertungen. Die
Prüfung durchführen darf jede Person mit Ausführungsrecht – die
Verantwortlichkeit sagt, wer sich darum kümmert, nicht wer es tun darf.

### Intervall und Rhythmus

| Intervall | Bedeutung |
| --- | --- |
| Täglich, wöchentlich, monatlich | wie erwartet |
| Vierteljährlich, halbjährlich, jährlich | wie erwartet |
| Alle N Tage | freier Abstand, etwa alle 45 Tage |

Der **Rhythmus** entscheidet, woran der nächste Termin hängt:

- **Fester Termin** – der nächste Termin ergibt sich aus dem *vorigen Termin*.
  Eine verspätete Durchführung verschiebt den Rhythmus nicht. Richtig für alles,
  was zu festen Zeitpunkten stattfinden soll: quartalsweise Reviews,
  Jahresprüfungen.
- **Nach Durchführung** – der nächste Termin ergibt sich aus dem *Tag der
  Durchführung*. Richtig, wenn zwischen zwei Prüfungen ein Mindestabstand
  liegen soll, etwa „spätestens 90 Tage nach dem letzten Restore-Test“.

> Beispiel: Quartalsweise, Termin am 1. April, durchgeführt am 20. April.
> Bei **festem Termin** ist der nächste Termin der 1. Juli.
> **Nach Durchführung** wäre es der 20. Juli.

### Vorlauf und Karenz

- **Vorlaufzeit** – ab wie vielen Tagen vor dem Termin die Fälligkeit als
  „bald fällig“ gilt (gelbe Ampel) und die Benachrichtigung hinausgeht.
- **Karenztage** – wie viele Tage nach dem Termin sie noch als offen gilt.
  Erst danach wird sie **überfällig** (rote Ampel).

Karenztage sind kein Schummeln: Sie bilden ab, dass eine monatliche Prüfung
nicht auf den Tag genau stattfinden muss. Für die Pünktlichkeitsquote in der
Compliance-Übersicht zählt die Karenzfrist mit.

### Kritikalität

Beeinflusst keine Automatik, sondern die Darstellung und die Reihenfolge in
Berichten. Sie hilft bei der Frage, was zuerst abzuarbeiten ist.

### Nachweis verpflichtend

Ist der Haken gesetzt, verlangt der Erledigen-Vorgang mindestens einen
Nachweis. Das kann eine hochgeladene Datei sein **oder** ein abgeschlossener
Prüfbogen – siehe [Fälligkeiten erledigen](faelligkeiten-erledigen.md).

### Audit-Referenzen

Mehrfachauswahl aus den gepflegten Anforderungen, etwa `ISO 27001 A.8.13`.
Eine Prüfung deckt oft mehrere ab. Siehe
[Audit-Referenzen](audit-referenzen.md).

## Was nach dem Speichern geschieht

Die erste Fälligkeit entsteht sofort zum Startdatum. Jede Nacht prüft die
Anwendung den Bestand: Sie setzt überfällige Termine, und wo keine offene
Fälligkeit mehr besteht, legt sie die nächste an.

## Mehrere Aufgaben auf einmal bearbeiten

In der Aufgabenliste lässt sich jede Zeile markieren; über der Liste
erscheint dann ein Balken mit den Sammelaktionen **Deaktivieren**,
**Aktivieren** und **Löschen**.

**Gelöscht wird nur, was keine Historie hat.** Sobald an einer markierten
Aufgabe eine protokollierte Durchführung hängt, ist die Schaltfläche
gesperrt, und darunter steht, wie viele Aufgaben es betrifft. Der Grund
steht im nächsten Abschnitt.

Sammelaktionen gelten **ganz oder gar nicht**: Blockiert ein einziger
Eintrag, wird der Vorgang abgelehnt und nennt die betroffenen Aufgaben.
Ein halb ausgeführtes Löschen hinterließe die Frage, was nun gilt.

### Wenn doch etwas weg muss

Testdaten aus der Einführungsphase oder ein misslungener Import lassen
sich nicht deaktivieren – die sollen wirklich verschwinden. Dafür gibt es
für **Administratoren** die Schaltfläche **„Mit Nachweisen löschen"**.
Sie erscheint nur, wenn unter den markierten Aufgaben welche mit Historie
sind.

Der Dialog zeigt zuerst, was verlorenginge – Fälligkeiten,
Durchführungen, Nachweisdateien, Abweichungen – und verlangt dann eine
**Begründung** und das abgetippte Wort `LOESCHEN`.

> **Der Vorgang steht anschließend im Audit-Log**: mit Ihrem Namen, dem
> Umfang, den Prüfsummen der entfernten Dateien und Ihrer Begründung. Das
> Protokoll ist unveränderlich und übersteht die Löschung. Für ein Audit
> bleibt damit nachvollziehbar, dass es die Nachweise gab und warum sie
> entfernt wurden.

Für eine Prüfung, die nur nicht mehr stattfinden soll, ist das der
falsche Weg. Dafür steht das Deaktivieren im nächsten Abschnitt.

## Aufgaben deaktivieren statt löschen

Wird eine Prüfung nicht mehr benötigt, **deaktivieren** Sie die Aufgabe. Die
Historie bleibt vollständig erhalten und die Nachweise bleiben abrufbar –
genau das braucht ein Audit später. Eine deaktivierte Aufgabe erzeugt keine
neuen Fälligkeiten.

Wird sie später wieder aktiviert und hat keine offene Fälligkeit, entsteht
sofort wieder eine.

## Eine Aufgabe duplizieren

Auf der Seite einer Aufgabe legt **Duplizieren** eine Kopie mit allen
Einstellungen an: Kategorie, Zuständigkeit, Intervall, Vorlauf, Karenz,
Kritikalität, Nachweispflicht, Beschreibung, Prüfanleitung und
Audit-Referenzen.

**Nicht mit kommt die Vergangenheit.** Fälligkeiten, Durchführungen und
Nachweise bleiben bei der Vorlage; die Kopie beginnt bei null. Eine erfundene
Historie stünde sonst in jedem Bericht.

Im Dialog geben Sie an:

| Feld | Bedeutung |
| --- | --- |
| **Titel** | Ein Titel je Zeile – so entstehen mehrere Aufgaben auf einmal |
| **Erste Fälligkeit am** | Das Startdatum der Vorlage liegt meist in der Vergangenheit |
| **Prüfbögen mitkopieren** | Jede Kopie bekommt einen eigenen Bogen mit denselben Prüfpunkten |
| **Sofort aktiv** | Ohne Haken entsteht die Aufgabe still und lässt sich vorher nacharbeiten |

### Für mehrere Systeme ausrollen

Genau dafür ist das Titelfeld mehrzeilig. Aus

```
Restore-Test DC01
Restore-Test DC02
Restore-Test DC03
```

entstehen drei Aufgaben mit identischen Einstellungen. Leerzeilen und
Doppelte werden übergangen; höchstens 25 auf einmal.

Werden die Prüfbögen mitkopiert, trägt jeder den Namen seiner Aufgabe – sonst
stünden in der Verwaltung zehn gleich benannte Bögen nebeneinander.

## Noch mehr Aufgaben auf einmal

Für größere Bestände – oder wenn sich die Aufgaben in mehr als dem Titel
unterscheiden – gibt es [Import und Export](import-und-export.md): Vorlage
herunterladen, in Excel ausfüllen, mit Vorschau einspielen.
