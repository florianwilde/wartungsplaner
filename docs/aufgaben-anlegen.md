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

## Aufgaben deaktivieren statt löschen

Wird eine Prüfung nicht mehr benötigt, **deaktivieren** Sie die Aufgabe. Die
Historie bleibt vollständig erhalten und die Nachweise bleiben abrufbar –
genau das braucht ein Audit später. Eine deaktivierte Aufgabe erzeugt keine
neuen Fälligkeiten.

Wird sie später wieder aktiviert und hat keine offene Fälligkeit, entsteht
sofort wieder eine.

## Viele Aufgaben auf einmal

Zehn Restore-Tests für zehn Systeme legt niemand gern einzeln an. Dafür gibt
es [Import und Export](import-und-export.md): Vorlage herunterladen, in
Excel ausfüllen, mit Vorschau einspielen.
