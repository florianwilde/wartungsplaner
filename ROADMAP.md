# Roadmap

Geplante Weiterentwicklung des Wartungsplaners. Die Reihenfolge ergibt sich aus
dem Nutzen im Alltag und der Auditfähigkeit, nicht aus dem Aufwand.

Umgesetzte Fassungen sind in [CHANGELOG.md](CHANGELOG.md) dokumentiert.

**Legende:** ✅ umgesetzt · 🔨 in Arbeit · 📋 geplant · 💡 Idee, noch nicht terminiert

---

## Umgesetzt

| Fassung | Inhalt |
| --- | --- |
| ✅ **1.0.0** | Grundfunktion: Datenmodell, Anmeldung mit Rollen und optionalem SSO, Fälligkeitslogik, Erledigen-Vorgang mit Nachweisen, Abweichungen, Dashboard, Kalender, vier Reports, Administrationsbereich, revisionssicheres Audit-Log, Docker-Stack |
| ✅ **1.1.0** | Corporate Design, konfigurierbares Erscheinungsbild, Versionierung mit Änderungsverlauf, Update-Skript |
| ✅ **1.2.0** | E-Mail-Benachrichtigungen, Sicherheitshärtung (CSP, CSRF, Brute-Force-Schutz), Roadmap und Sicherheitsdokumentation |
| ✅ **1.3.0** | Import und Export von Kategorien, Aufgaben und Benutzern mit Vorschau |
| ✅ **1.3.5** | Dunkles Farbschema mit Umschalter und Systemvorgabe |
| ✅ **1.4.0** | Anmeldung mit Passkeys (WebAuthn), Kontoseite, Zurücksetzen durch die Administration |

---

## 1.2.0 – E-Mail-Benachrichtigungen ✅

**Warum zuerst:** Ohne Benachrichtigungen muss jemand täglich ins Dashboard
schauen. Das ist der größte funktionale Hebel für den Alltagsnutzen.

- Sammelnachricht je verantwortlicher Person über anstehende und überfällige
  Prüfungen – bewusst eine Nachricht statt einer je Aufgabe
- Erinnerung an Fristen offener Abweichungen
- Eskalation lange überfälliger Prüfungen an eine zentrale Stelle
- Wöchentliche Übersicht je Person
- Wiederholungssicherheit: derselbe Vorgang wird nicht zweimal gemeldet,
  Überfälliges dagegen wöchentlich erneut
- SMTP-Konfiguration über die `.env`, Ein-/Ausschalten und Testnachricht im
  Administrationsbereich, Abmeldung je Benutzer

---

## 1.3.0 – Import und Export von Stammdaten ✅

**Warum:** Zehn Restore-Tests für zehn Systeme legt heute niemand gern einzeln
an. Außerdem erleichtert der Export Migration, Sicherung und Abstimmung mit
Fachbereichen außerhalb der Anwendung.

- **Export** von Kategorien, Aufgaben und Benutzern als CSV und JSON
- **Import** derselben Daten mit Vorschau vor dem Schreiben: Was wird angelegt,
  was aktualisiert, was übersprungen?
- Zuordnung über einen fachlichen Schlüssel statt über technische IDs, damit
  Daten zwischen Installationen übertragbar bleiben
- Strenge Prüfung vor dem Import; ein fehlerhafter Datensatz bricht den Lauf ab,
  statt einen halben Bestand zu hinterlassen
- Jeder Import erzeugt Audit-Einträge mit Anzahl und Art der Änderungen
- Vorlagendateien zum Herunterladen, damit das erwartete Format klar ist
- Aufgaben zusätzlich duplizieren können (Vorlage → neue Aufgabe)

---

## 1.3.5 – Dunkles Farbschema ✅

**Warum:** Prüfungen finden oft abends oder im abgedunkelten Serverraum statt.
Ein dunkles Schema ist dort keine Spielerei, sondern eine Frage der
Augenbelastung.

- Umschaltung zwischen **Hell**, **Dunkel** und **Systemvorgabe** – in der
  Kopfzeile und bereits auf der Anmeldeseite
- Auswahl in einem Cookie, damit der Server sie schon beim Rendern kennt;
  ein kleines Skript im Seitenkopf verhindert das Aufblitzen der hellen
  Fassung
- Bei „Systemvorgabe“ folgt die Anwendung der Einstellung des Geräts, auch
  wenn diese im laufenden Betrieb wechselt
- Alle Farben leiten sich aus den Markenfarben ab; die Primärfarbe wird für
  dunklen Grund automatisch aufgehellt
- Das hinterlegte **Logo für dunklen Hintergrund** wird jetzt tatsächlich
  verwendet und per CSS umgeschaltet

---

## 1.4.0 – Passkeys für die lokale Anmeldung ✅

**Warum:** Passwörter sind der schwächste Punkt der internen Benutzerverwaltung.
Passkeys (WebAuthn/FIDO2) beseitigen Phishing und Wiederverwendung, ohne einen
Identity Provider zu erfordern – das bleibt SSO-Installationen vorbehalten.

- Registrierung eines oder mehrerer Passkeys je Benutzerkonto
  (Windows Hello, Touch ID, Sicherheitsschlüssel)
- Anmeldung wahlweise per Passkey oder Passwort; Passkey als bevorzugter Weg
- Verwaltung der eigenen Passkeys im Benutzerkonto: benennen, entfernen,
  letzte Verwendung einsehen
- Administrative Übersicht: wer hat Passkeys hinterlegt, Zurücksetzen bei
  Geräteverlust
- Optional erzwingbar je Rolle (z. B. Passkey-Pflicht für Administratoren)
- Alle Vorgänge im Audit-Log

---

## 1.5.0 – Anpassbare PDF-Exporte und Vorlagen 📋

**Warum:** Jedes Audit hat eigene Erwartungen an Aufbau und Umfang der
Nachweise. Heute ist das Layout fest im Code hinterlegt.

- Vorlagen je Reportart im Administrationsbereich anpassen: Kopf- und
  Fußzeile, Deckblatt, Freitextblöcke, Unterschriftenfelder
- Auswahl der Spalten und ihrer Reihenfolge je Report
- Eigene Vorlagen speichern und benennen (z. B. „Jahresaudit“,
  „Kurzfassung Geschäftsführung“)
- Vorschau vor dem Erzeugen
- Seitenformat und Ausrichtung (A4 hoch/quer) je Vorlage
- Logo in den PDF-Kopf auch aus SVG-Dateien (heute nur PNG und JPG)

### Dashboard: Zeithorizont wählbar

- Die Liste „Nächste Fälligkeiten“ zeigt heute stets die nächsten zwölf
  Einträge. Künftig lässt sich einstellen, ob **alle** offenen Fälligkeiten
  erscheinen oder nur die der **nächsten Woche**, der **nächsten 30 Tage**
  oder eines frei gewählten Zeitraums.
- Die Auswahl bleibt je Person gespeichert.

---

## 1.6.0 – Nachweismodul für Reviews und Regelprüfungen 📋

**Warum:** Bei Reviews entsteht der Nachweis heute außerhalb der Anwendung –
als Word-Datei, Tabelle oder E-Mail-Verlauf – und wird anschließend hochgeladen.
Der eigentliche Prüfvorgang bleibt damit unstrukturiert, und die Qualität der
Nachweise hängt daran, wie sorgfältig jemand ein Dokument ausfüllt. Das Modul
führt den Vorgang in der Anwendung durch und erzeugt den Nachweis daraus.

### Nachweise strukturiert erfassen

- **Prüfbögen je Aufgabe**: eine Aufgabe erhält eine Vorlage mit Prüfpunkten
  (Frage, erwartetes Ergebnis, Antwortart: erfüllt / nicht erfüllt / entfällt,
  Freitext, Zahl, Datum)
- Typische Bögen für die wiederkehrenden Fälle:
  - **Rezertifizierung von Berechtigungen** – Liste je Person oder Gruppe mit
    Entscheidung „belassen / entziehen / ändern“ je Zeile
  - **Restore-Test** – geprüfte Systeme, Start- und Endzeit, Vollständigkeit,
    Stichproben
  - **Zutrittsberechtigungen** – Transponder, Person, Entscheidung
  - **Regelprüfung** (Firewall, Patchstand, Zertifikate) – Regel bzw. System,
    Befund, Maßnahme
- Zeilen lassen sich aus einer CSV-Datei übernehmen (etwa ein AD-Export), damit
  niemand hunderte Einträge abtippt
- Zwischenspeichern: ein umfangreiches Review muss nicht in einem Zug fertig
  werden

### Vier-Augen-Prinzip

- Je Aufgabe einstellbar, ob ein Nachweis **gegengezeichnet** werden muss
- Ablauf: *erfassen* → *zur Prüfung vorgelegt* → *gegengezeichnet* oder
  *zurückgewiesen mit Begründung*
- Die gegenzeichnende Person darf nicht die erfassende sein – die Anwendung
  setzt das durch
- Erst nach der Gegenzeichnung gilt der Nachweis als gültig und die zugehörige
  Fälligkeit als vollständig erledigt
- Jeder Schritt mit Person und Zeitpunkt im Audit-Log

### Ergebnis

- Aus dem ausgefüllten Bogen entsteht ein **PDF-Nachweis** mit Kopfdaten,
  allen Prüfpunkten, Befunden, Unterschriftenfeldern beider Personen und
  Prüfsumme
- Der Nachweis wird **automatisch als Anhang an der Durchführung hinterlegt** –
  mit SHA-256 wie jeder andere Nachweis, damit die Nachweiskette geschlossen
  bleibt
- Zusätzlich einzeln **herunterladbar**
- Nicht erfüllte Prüfpunkte lassen sich mit einem Griff in **Abweichungen**
  überführen, statt sie erneut zu erfassen

### Abgrenzung

Das Modul ersetzt nicht den Datei-Upload: Wo ein Nachweis außerhalb entsteht
(Screenshot, Herstellerprotokoll), bleibt der Upload der richtige Weg. Beides
steht nebeneinander.

---

## Danach geplant

### Auditfähigkeit

- 📋 **Nachweis-Export als Archiv** – ein ZIP mit allen Nachweisen eines
  Zeitraums plus Prüfsummenliste. Das ist es, was eine prüfende Person
  tatsächlich mitnehmen möchte.
- 📋 **Aufbewahrungsfristen und Archivierung** – derzeit wächst der Bestand
  unbegrenzt. Nötig sind definierte Fristen und ein Archivstatus statt einer
  Löschung.
- 💡 **Signierte Nachweise** – Zeitstempel oder Signatur über die Prüfsumme,
  damit die Unverändertheit auch ohne Vertrauen in die Datenbank belegbar ist.

### Alltagstauglichkeit

- 📋 **Kalender-Abonnement (iCal)** – ein `.ics`-Feed je Person, den Outlook
  abonniert; Fälligkeiten erscheinen direkt im gewohnten Kalender.
- 📋 **Aufgabenvorlagen** – wiederkehrende Muster einmal definieren und für
  mehrere Systeme ausrollen (ergänzt den Import aus 1.3.0).
- 💡 **Wartungsfenster und Feiertage** – Fälligkeiten, die auf einen Feiertag
  oder in eine Betriebsruhe fallen, automatisch verschieben.
- 💡 **Anhänge direkt aus der Zwischenablage** – Screenshots einfügen, statt
  sie erst als Datei zu speichern.
- 💡 **Mobile Ansicht für die Durchführung** – Prüfungen im Serverraum am
  Telefon abhaken.

### Technik und Betrieb

- 📋 **End-to-End-Tests mit Playwright** – der Erledigen-Vorgang samt
  Datei-Upload ist bislang nicht automatisiert geprüft. Das ist die größte
  verbleibende Testlücke.
- 📋 **CI-Pipeline in GitLab** – Typprüfung, Tests, Build und Image bei jedem
  Commit; ein Tag erzeugt eine Fassung.
- 💡 **Strukturiertes Logging und Metrik-Endpunkt** – Anbindung an die
  vorhandene Überwachung.
- 💡 **Mehrsprachigkeit** – die Oberfläche ist derzeit bewusst einsprachig
  deutsch. Eine englische Fassung wäre für externe Prüfende hilfreich.

---

## Nicht geplant

Bewusste Abgrenzungen, damit die Anwendung ihren Zweck behält:

- **Kein Ticketsystem.** Der Wartungsplaner verwaltet wiederkehrende Prüfungen,
  keine Störungen oder Anfragen.
- **Keine Inventarverwaltung.** Systeme werden als Freitext in Aufgaben
  benannt; eine CMDB gehört in ein eigenes Werkzeug.
- **Keine Mandantenfähigkeit.** Eine Installation dient einer Organisation.

---

## Änderungswünsche

Anregungen bitte als Issue im GitLab-Projekt erfassen. Für die Einordnung
hilfreich: Was ist der Anlass, wie oft tritt er auf, und welcher Weg wird
heute stattdessen gegangen?
