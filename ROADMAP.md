# Roadmap

Geplante Weiterentwicklung des Wartungsplaners. Die Reihenfolge ergibt sich aus
dem Nutzen im Alltag und der Auditfähigkeit, nicht aus dem Aufwand.

Umgesetzte Fassungen sind in [CHANGELOG.md](CHANGELOG.md) dokumentiert.

**Legende:** ✅ umgesetzt · ⏳ angekündigt, aber noch offen · 🔨 in Arbeit ·
📋 geplant · 💡 Idee, noch nicht terminiert

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
| ✅ **1.5.0** | Anpassbare PDF-Vorlagen und wählbarer Zeitraum auf dem Dashboard |
| ✅ **1.6.0** | Nachweismodul für Reviews und Regelprüfungen mit Vier-Augen-Prinzip |
| ✅ **1.7.0** | Belege am Prüfbogen: AD-Exporte, Screenshots und Protokolle mit Prüfsumme |
| ✅ **1.8.0** | Prüfvorgang zu Ende geführt: Benachrichtigung zur Gegenzeichnung, Feststellungen als Abweichungen, Zeilenlisten, Nachweisregister |
| ✅ **1.9.0** | Nachweise belastbar aufbewahren: Prüfsummenlauf, Archiv-Export, Aufbewahrungsfristen, Passkey-Pflicht, Virenprüfung; dazu Audit-Referenzen als Stammdaten und ein Handbuch |
| ✅ **1.10.0** | Alltagstauglichkeit: Vertretung bei Abwesenheit, Belege aus der Zwischenablage, Aufgaben duplizieren, Kalender-Abonnement, SVG-Logo im PDF |

## Vorgesehen

| Fassung | Inhalt |
| --- | --- |
| 💡 **1.11.0** | Noch offen – siehe die Ideen unten: Wartungsfenster und Feiertage, mobile Ansicht für die Durchführung |

Quer dazu und unabhängig von einer Fassung: **End-to-End-Tests** und eine
**CI-Pipeline** – siehe [Technik und Betrieb](#technik-und-betrieb).

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
- ✅ Aufgaben zusätzlich duplizieren können (Vorlage → neue Aufgabe) –
  umgesetzt in 1.10.0

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
- ✅ Optional erzwingbar je Rolle (z. B. Passkey-Pflicht für Administratoren) –
  umgesetzt in 1.9.0
- Alle Vorgänge im Audit-Log

---

## 1.5.0 – Anpassbare PDF-Exporte und Vorlagen ✅

**Warum:** Jedes Audit hat eigene Erwartungen an Aufbau und Umfang der
Nachweise. Heute ist das Layout fest im Code hinterlegt.

- Vorlagen je Reportart im Administrationsbereich anpassen: Kopf- und
  Fußzeile, Deckblatt, Freitextblöcke, Unterschriftenfelder
- Auswahl der Spalten und ihrer Reihenfolge je Report
- Eigene Vorlagen speichern und benennen (z. B. „Jahresaudit“,
  „Kurzfassung Geschäftsführung“)
- Vorschau vor dem Erzeugen
- Seitenformat und Ausrichtung (A4 hoch/quer) je Vorlage
- ✅ Logo in den PDF-Kopf auch aus SVG-Dateien – umgesetzt in 1.10.0

### Dashboard: Zeithorizont wählbar

- Die Liste „Nächste Fälligkeiten“ zeigt heute stets die nächsten zwölf
  Einträge. Künftig lässt sich einstellen, ob **alle** offenen Fälligkeiten
  erscheinen oder nur die der **nächsten Woche**, der **nächsten 30 Tage**
  oder eines frei gewählten Zeitraums.
- Die Auswahl bleibt je Person gespeichert.

---

## 1.6.0 – Nachweismodul für Reviews und Regelprüfungen ✅

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
- ✅ Zeilen lassen sich aus einer CSV-Datei übernehmen (etwa ein AD-Export),
  damit niemand hunderte Einträge abtippt – umgesetzt in 1.8.0 als Prüfpunkt-Art
  „Liste“.
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
- ✅ Nicht erfüllte Prüfpunkte lassen sich mit einem Griff in **Abweichungen**
  überführen – umgesetzt in 1.8.0, mit Rückverweis auf den Prüfpunkt.

---

## 1.7.0 – Belege am Prüfbogen ✅

**Warum:** Der Prüfbogen hält fest, *was* geprüft wurde – der Beleg zeigt,
*woran*. Dateien ließen sich bisher nur beim Erledigen anhängen, ein Prüfbogen
entsteht aber vorher. Zum Zeitpunkt der Prüfung gab es also keine Ablage für
den AD-Export oder den Screenshot, auf den sich eine Antwort stützt.

- Belege direkt am Prüfbogen hochladen, mehrere in einem Zug
- Zuordnung zu einem einzelnen Prüfpunkt oder zum gesamten Bogen
- SHA-256 je Datei, einzeln herunterladbar
- Verzeichnis der Belege mit Prüfsumme im PDF-Nachweis
- Mit dem Abschluss wandern die Belege an die Durchführung und erscheinen an
  der Aufgabe und in den Reports

---

## Empfehlung für die nächsten Fassungen

Die Reihenfolge folgt zwei Fragen: Wo bricht der Ablauf heute ab, und worauf
verlässt sich die Anwendung, ohne es zu prüfen?

---

## 1.8.0 – Den Prüfvorgang zu Ende führen ✅

**Warum zuerst:** Das Nachweismodul erfasst und zeichnet gegen, lässt die
prüfende Person danach aber allein. Ein vorgelegter Bogen liegt still da,
Feststellungen müssen von Hand als Abweichung nacherfasst werden, und eine
Rezertifizierung von achtzig Konten ist mit fest definierten Prüfpunkten nicht
zu bewältigen. Das sind keine neuen Ideen, sondern die verbliebenen Lücken des
begonnenen Ablaufs – und die kosten im Alltag am meisten.

### Benachrichtigung zur Gegenzeichnung

- ✅ Nachricht an die berechtigten Personen, sobald ein Nachweis **vorgelegt**
  wird. Heute erfährt niemand davon; der Bogen bleibt liegen, bis jemand
  zufällig auf die Seite „Nachweise“ schaut.
- ✅ Erinnerung, wenn eine Gegenzeichnung länger als vereinbart aussteht, und
  Nachricht an die erfassende Person bei **Zurückweisung**.
- ✅ Anzeige offener Gegenzeichnungen auf dem Dashboard.

### Feststellungen in Abweichungen überführen

- ✅ Aus einem nicht erfüllten Prüfpunkt wird mit einem Griff eine Abweichung –
  Titel, Beschreibung und Bezug sind bereits bekannt und müssen nicht erneut
  eingegeben werden (offener Punkt aus 1.6.0).
- ✅ Rückverweis von der Abweichung auf den Prüfpunkt, aus dem sie stammt.

### Zeilenlisten im Prüfbogen

- ✅ Ein Prüfpunkt vom Typ **Liste**: viele gleichartige Zeilen mit derselben
  Frage – je Konto, Transponder oder Firewall-Regel eine Entscheidung
  (offener Punkt aus 1.6.0).
- ✅ Zeilen aus einer **CSV-Datei** übernehmen, etwa direkt aus einem
  AD-Export. Ohne das ist eine Rezertifizierung größerer Bestände Handarbeit.
- ✅ Sammelentscheidung für alle Zeilen ohne eigenen Befund („übrige
  belassen“), damit nur die Ausnahmen einzeln zu bearbeiten sind.

### Nachweisregister

- ✅ Fünfter Report: alle Nachweise eines Zeitraums mit Prüfbogen, Aufgabe,
  beiden Personen, Zeitpunkten, Anzahl Feststellungen und Prüfsumme. Der
  Compliance-Report zeigt heute Durchführungen, nicht die Prüfvorgänge selbst.

---

## 1.9.0 – Nachweise belastbar aufbewahren ✅

**Warum:** Die Anwendung verspricht Revisionssicherheit über Prüfsummen –
prüft aber nie nach, ob die Dateien noch da sind und noch zusammenpassen. Ein
stiller Verlust im Upload-Volume fällt heute erst auf, wenn jemand Jahre später
einen Download versucht. Genau dann ist er nicht mehr zu heilen.

- ✅ **Prüfsummenlauf** – regelmäßiger Abgleich aller Nachweise: Ist die Datei
  vorhanden, stimmt der SHA-256 noch? Ergebnis als Bericht und, bei
  Abweichung, als Nachricht an die Administration.
- 📋 **Verwaiste Dateien erkennen** – Dateien im Volume ohne Eintrag in der
  Datenbank und umgekehrt. Beides entsteht bei Abbrüchen und bleibt bislang
  unbemerkt.
- ✅ **Nachweis-Export als Archiv** – ein ZIP mit allen Nachweisen eines
  Zeitraums samt Prüfsummenliste. Das ist es, was eine prüfende Person
  tatsächlich mitnehmen möchte.
- ✅ **Aufbewahrungsfristen und Archivierung** – der Bestand wächst unbegrenzt.
  Nötig sind Fristen je Kategorie und ein Archivstatus statt einer Löschung.
  Mit den Belegen aus 1.7.0 hat das eine zweite Seite: Ein AD-Export enthält
  personenbezogene Daten und sollte nicht unbefristet liegen bleiben.
- ✅ **Virenprüfung hochgeladener Dateien** – Belege werden von anderen Personen
  wieder heruntergeladen. Eine Prüfung beim Hochladen (etwa gegen ClamAV im
  Stack) verhindert, dass die Nachweisablage zum Verteilweg wird.
- ✅ **Passkey-Pflicht je Rolle** – für Administratoren erzwingbar
  (offener Punkt aus 1.4.0).
- 💡 **Signierte Nachweise** – Zeitstempel oder Signatur über die Prüfsumme,
  damit die Unverändertheit auch ohne Vertrauen in die Datenbank belegbar ist.

---

## 1.10.0 – Alltagstauglichkeit ✅

**Warum:** Bis hierher ging es um Vollständigkeit und Belastbarkeit. Diese
Fassung senkt den Aufwand im laufenden Betrieb.

- ✅ **Vertretung** – je Person eine vertretende Person mit Zeitraum. Fällt
  jemand länger aus, laufen die Fälligkeiten sonst schlicht über. Umgeleitet
  wird die Post, nicht die Zuständigkeit: Erinnerungen, Wochenübersicht und
  Gegenzeichnungsbitten gehen an die Vertretung, die Aufgabe bleibt beim
  Eigentümer. Eine Vertretung *je Aufgabe* wurde bewusst nicht umgesetzt – sie
  müsste bei jedem Urlaub an jeder Aufgabe einzeln gepflegt werden.
- ✅ **Belege aus der Zwischenablage** – Screenshot einfügen, statt ihn erst
  als Datei zu speichern. Seit 1.7.0 ist der Screenshot der häufigste Beleg,
  und der Umweg über den Explorer war der lästigste Teil daran. Zusätzlich
  lassen sich Dateien in den Bereich ziehen; eingefügte Bilder erhalten einen
  Namen mit Zeitpunkt.
- ✅ **Aufgaben duplizieren und ausrollen** – wiederkehrende Muster einmal
  definieren und für mehrere Systeme ausrollen (offener Punkt aus 1.3.0,
  ergänzt den Import). Ein Titel je Zeile legt mehrere Aufgaben an; die
  Vergangenheit der Vorlage kommt bewusst nicht mit. Eigene
  „Aufgabenvorlagen“ als Stammdaten braucht es dafür nicht – jede bestehende
  Aufgabe ist die Vorlage.
- ✅ **Kalender-Abonnement (iCal)** – ein `.ics`-Feed je Person, den Outlook
  abonniert; Fälligkeiten erscheinen im gewohnten Kalender. Ganztägig und
  unverbindlich, mit der Vorlaufzeit der Aufgabe als Erinnerung. Die
  Abweichungsfristen bleiben bewusst draußen: Sie ändern sich häufig und
  gehören ins Dashboard, nicht in einen Kalender, der nur alle paar Stunden
  abgerufen wird.
- ✅ **SVG-Logo im PDF-Kopf** – die Reports betteten nur PNG und JPG ein
  (offener Punkt aus 1.5.0). Ein SVG wird jetzt als Vektorgrafik gezeichnet
  und bleibt im Ausdruck scharf; Text im Logo gehört vorher in Pfade
  umgewandelt, weil im PDF keine Schriften nachgeladen werden.

---

## 1.11.0 – noch offen 💡

Aus 1.10.0 übrig geblieben, weil beides eine eigene Fassung verdient:

- 💡 **Wartungsfenster und Feiertage** – Fälligkeiten, die auf einen Feiertag
  oder in eine Betriebsruhe fallen, automatisch verschieben. Das braucht eine
  gepflegte Feiertagsliste je Standort und eine Regel, ob vor- oder
  nachgezogen wird – keine Kleinigkeit nebenbei.
- 💡 **Mobile Ansicht für die Durchführung** – Prüfungen im Serverraum am
  Telefon abhaken.

---

## Technik und Betrieb

- 📋 **End-to-End-Tests mit Playwright** – *die dringendste Maßnahme dieser
  Liste.* Beide Fehler, die in 1.6.0 auffielen, lagen zwischen Oberfläche und
  Server: Der Prüfbogen meldete sich als vollständig, während der Server einen
  leeren Stand bewertete, und der PDF-Nachweis entstand im Regelfall gar nicht.
  Beides bestand jede Typprüfung und jeden Unit-Test. Diese Klasse von Fehlern
  findet nur ein Test, der die Anwendung tatsächlich bedient.
- 📋 **CI-Pipeline in GitLab** – Typprüfung, Unit-Tests, Integrationstests,
  Build und Image bei jedem Commit; ein Tag erzeugt eine Fassung.
- 📋 **Wiederherstellungstest der Anwendung selbst** – `backup.sh` schreibt
  Sicherungen, ob sie sich einspielen lassen, ist nie geprüft worden. Für ein
  Werkzeug, das Restore-Tests verwaltet, eine unangenehme Lücke.
- 💡 **Strukturiertes Logging und Metrik-Endpunkt** – Anbindung an die
  vorhandene Überwachung.
- 💡 **Mehrsprachigkeit** – die Oberfläche ist bewusst einsprachig deutsch.
  Eine englische Fassung wäre für externe Prüfende hilfreich.

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
