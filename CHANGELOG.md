# Änderungsverlauf

Alle nennenswerten Änderungen am Wartungsplaner werden in dieser Datei
dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
die Versionierung folgt der [Semantischen Versionierung](https://semver.org/lang/de/):

- **Hauptversion** (1.x.x) – Änderungen, die einen Eingriff beim Update erfordern
- **Nebenversion** (x.1.x) – neue Funktionen, abwärtskompatibel
- **Korrekturversion** (x.x.1) – Fehlerbehebungen und Kleinigkeiten

---

## [Unveröffentlicht]

### Geändert

- **Der Auslieferungszustand ist neutral.** Die Anwendung startete bisher
  im Corporate Design des ursprünglichen Anwenders – fremde Markenfarben,
  fremder Firmenname in Fußzeile und Berichten. Für eine Software, die
  andere einsetzen sollen, ist das der falsche Startpunkt.
  - Farben jetzt ein sachliches Blau (`#2563eb` / `#0ea5e9`), das Logo ein
    schlichtes Kreislaufsymbol, die **Organisation leer**. Wo kein Name
    hinterlegt ist, steht auch keiner – in der Fußzeile ebenso wie im
    Bericht.
  - **Bestehende Installationen ändern sich nicht**: Das Erscheinungsbild
    steht in der Datenbank. Betroffen sind nur Neuinstallationen und das
    Zurücksetzen unter *Administration → Erscheinungsbild*.
  - Das Zurücksetzen greift jetzt auf denselben Standard zurück, den auch
    eine Neuinstallation verwendet. Zwei Quellen für einen
    Auslieferungszustand laufen sonst früher oder später auseinander.

### Hinzugefügt

- **MIT-Lizenz.** Das Projekt lässt sich damit weitergeben, einsetzen und
  ändern – auch kommerziell. Alle Abhängigkeiten stehen unter freizügigen
  Lizenzen; keine verlangt die Offenlegung abgeleiteter Werke. Die
  Einzelheiten stehen im [README](README.md#lizenz).

### Behoben

- **Die Sitzung überlebte das Abmelden.** Nach dem Klick auf *Abmelden*
  erschien die Anmeldeseite, das Sitzungs-Cookie blieb aber gültig: Ein
  Schritt zurück im Browser oder die erneute Eingabe der Adresse führte
  wieder in die Anwendung. An einem gemeinsam genutzten Rechner hätte die
  nächste Person die Sitzung übernehmen können.
  - Ursache waren zwei ineinandergreifende Umstände: Die Middleware stellt
    das Sitzungs-Cookie bei jeder Anfrage neu aus – auch bei der Abmeldung
    –, und Next.js lädt Seiten im Voraus, sodass eine dieser Anfragen das
    gerade gelöschte Cookie wieder ausstellte.
  - Ein Wettlauf um Cookies ist nicht zu gewinnen. Jedes Konto führt jetzt
    einen **Sitzungsstand**, der beim Abmelden hochzählt; ein Token mit
    altem Stand ist wertlos, gleich wie oft das Cookie neu ausgestellt
    wird. Das Abmelden selbst läuft über einen eigenen Endpunkt an der
    Middleware vorbei.
  - **Abmelden beendet damit alle Sitzungen des Kontos**, auch auf anderen
    Geräten. Bei einem Werkzeug, das Nachweise führt, ist das die richtige
    Voreinstellung.

### Hinzugefügt

- **Migrationstest** (`npm run test:migrationen`) – wendet alle Migrationen
  auf eine leere Datenbank an und vergleicht das Ergebnis mit dem Schema.
  Anlass war eine Migration, die auf dem Entwicklungsrechner lief und auf dem
  Server scheiterte, weil sie als Differenz zu einem Zwischenstand entstanden
  war. Auf einer frischen Installation wäre die Anwendung damit nicht
  gestartet.
- **End-to-End-Tests mit Playwright** (`npm run test:e2e`) – die
  dringendste Maßnahme der Roadmap. Geprüft wird die laufende Anwendung im
  Browser: Anmeldung, Rückkehr zur ursprünglich gewünschten Seite,
  Zugriffsschutz je Rolle, Abmeldung sowie der Erledigen-Vorgang mit
  Abweichung, Nachweispflicht und Folgetermin.
  - Der erste Lauf hat den Abmeldefehler oben gefunden. Typprüfung, 522
    Unit-Tests und acht Integrationsreihen waren zu diesem Zeitpunkt grün –
    diese Fehlerklasse liegt zwischen Oberfläche und Server und ist anders
    nicht zu finden.

---

## [1.10.0] – 2026-07-30

Diese Fassung senkt den Aufwand im laufenden Betrieb. Bis hierher ging es um
Vollständigkeit und Belastbarkeit – jetzt darum, dass die tägliche Arbeit
weniger Umwege verlangt.

### Hinzugefügt

- **Vertretung bei Abwesenheit.** Wer zwei Wochen im Urlaub ist, bekam die
  Erinnerungen weiterhin in ein Postfach, das niemand liest; die Fälligkeiten
  liefen über, und am ersten Arbeitstag stand ein Stapel Überfälliges da.
  - Zu hinterlegen unter *Mein Konto* – oder unter *Administration →
    Benutzer* für jemanden, der es selbst nicht mehr konnte. Der Unterschied
    steht im Audit-Log.
  - Umgeleitet werden Prüfungserinnerungen, Fristen offener Abweichungen, die
    Wochenübersicht und die Bitte um Gegenzeichnung. Jede Nachricht nennt,
    für wen sie kommt; das Dashboard zeigt, wen man gerade vertritt.
  - **Umgeleitet wird die Post, nicht die Zuständigkeit** – Aufgabe, Berichte
    und Historie bleiben unverändert.
  - Der Zeitraum ist einschließlich beider Tage und endet von selbst; niemand
    muss aufräumen. Verkettung ist erlaubt, Kreise werden abgelehnt, und eine
    gesperrte Vertretung führt die Meldung zurück zur zuständigen Person,
    statt sie ins Leere laufen zu lassen.
- **Belege aus der Zwischenablage.** Seit die Prüfbögen Belege aufnehmen, ist
  der Screenshot der häufigste – und der Umweg über „Speichern unter“ und den
  Explorer der lästigste Teil daran.
  - **Strg+V** fügt ein Bild unmittelbar ein, **Ziehen** legt Dateien ab, die
    Auswahl über die Schaltfläche bleibt daneben bestehen. Alle drei Wege
    sammeln sich in einer Liste, aus der sich einzelne Einträge vor dem
    Hochladen wieder entfernen lassen.
  - Eingefügte Bilder bekommen einen sprechenden Namen mit Zeitpunkt;
    „image.png“ wäre nach dem dritten Beleg unbrauchbar.
  - Geprüft wird schon im Browser nach denselben Regeln wie auf dem Server –
    ein nicht zugelassener Inhalt wird gar nicht erst übernommen.
  - Verfügbar an den Belegen des Prüfbogens und im Erledigen-Dialog.
- **Aufgaben duplizieren und ausrollen** – der offene Punkt aus 1.3.0. Zehn
  Restore-Tests für zehn Systeme unterscheiden sich meist nur im Titel; der
  Import konnte das, war für drei Aufgaben aber zu umständlich.
  - **Ein Titel je Zeile** legt mehrere Aufgaben auf einmal an, mit allen
    Einstellungen der Vorlage samt Prüfanleitung und Audit-Referenzen.
    Höchstens 25 auf einmal – darüber ist der Import das richtige Werkzeug.
  - **Die Vergangenheit kommt nicht mit.** Fälligkeiten, Durchführungen und
    Nachweise bleiben bei der Vorlage; eine Kopie beginnt bei null. Eine
    erfundene Historie stünde sonst in jedem Bericht.
  - **Prüfbögen wahlweise mitkopieren**: Jede Kopie bekommt einen eigenen Bogen
    mit denselben Prüfpunkten, benannt nach seiner Aufgabe.
  - Ohne „sofort aktiv“ entsteht die Aufgabe still, ohne erste Fälligkeit.
- **Kalender-Abonnement.** Wer Prüfungen plant, plant sie im Kalender – nicht
  in einer zweiten Anwendung, die man dafür öffnen muss. Unter *Mein Konto*
  gibt es eine Adresse, die Outlook laufend abruft.
  - Enthalten sind die offenen und überfälligen Fälligkeiten; vertritt man
    gerade jemanden, kommen dessen Termine mit und sind als solche
    gekennzeichnet.
  - Die Termine sind **ganztägig und unverbindlich** – eine Fälligkeit ist
    keine Besprechung und blockiert den Tag nicht. Die Erinnerung entspricht
    der Vorlaufzeit der Aufgabe, damit es keine zweite Zahl gibt, die der
    ersten widersprechen kann.
  - Kalenderprogramme können sich nicht anmelden; der Zugang ist deshalb ein
    Geheimnis in der Adresse. Es lässt sich jederzeit neu erzeugen – die alte
    Adresse läuft dann ins Leere –, das Aufheben entwertet sie ebenfalls, und
    ein deaktiviertes Konto liefert nichts mehr. Beides steht im Audit-Log.
- **SVG-Logo in den PDF-Berichten** – der offene Punkt aus 1.5.0. Bisher
  betteten die Berichte nur PNG und JPG ein; wer ein SVG hinterlegt hatte –
  das übliche Format für ein Firmenlogo –, bekam Berichte ohne Logo.
  - Gezeichnet wird als **Vektorgrafik**, nicht als gerastertes Bild: im
    Ausdruck scharf, ohne dass jemand eine Auflösung wählen muss.
  - Seitenverhältnis und Größe kommen aus dem `viewBox`; kleinere Logos
    werden nicht vergrößert.
  - Text im SVG erscheint in der Standardschrift des Berichts, weil im PDF
    keine Schriften nachgeladen werden – Schriftzüge gehören vorher in Pfade
    umgewandelt.
  - Ein unbrauchbares Logo verhindert den Bericht nicht: Er entsteht ohne.
    Auch ein umbenanntes Rasterbild wird am Inhalt erkannt statt an der
    Endung, damit die Erzeugung nicht mitten im Lauf abbricht.

---

## [1.9.0] – 2026-07-30

Diese Fassung beantwortet die Frage, ob man den Nachweisen noch trauen kann –
und wie lange sie überhaupt aufbewahrt werden.

### Hinzugefügt

- **Täglicher Prüfsummenlauf über die abgelegten Nachweise.** Die Anwendung
  führte zu jedem Nachweis eine SHA-256-Prüfsumme, hat sie aber nie
  nachgeprüft; die Revisionssicherheit war damit eine Behauptung. Ein stiller
  Verlust im Ablageverzeichnis wäre erst aufgefallen, wenn Jahre später jemand
  einen Download versucht – dann ist er nicht mehr zu heilen.
  - Geprüft wird in **beide Richtungen**: zu jedem Eintrag die Datei, zu jeder
    Datei der Eintrag.
  - Vier Befunde: fehlend, verändert, nicht lesbar, ohne Eintrag. Die ersten
    drei mindern die Beweiskraft; eine Datei ohne Eintrag ist unordentlich,
    aber es fehlt kein Beleg – sie zählt ausdrücklich nicht als Beanstandung.
  - Einsehbar unter *Administration → Unversehrtheit*, von Hand auslösbar,
    über `/api/cron?aufgabe=integritaet` ansprechbar. Beanstandungen gehen per
    Mail an die Administration.
- **Nachweisarchiv als ZIP.** Ein Bericht zeigt, *dass* geprüft wurde; ein
  Audit will die Nachweise selbst – und zwar so, dass sie auch außerhalb dieser
  Anwendung überprüfbar bleiben.
  - Alle Nachweise eines Zeitraums, gegliedert nach Kategorie und Aufgabe
  - `PRUEFSUMMEN.sha256` im Format von `sha256sum`: Die Unverändertheit lässt
    sich mit `sha256sum -c` nachrechnen, ohne dieser Anwendung zu glauben
  - `INHALT.csv` mit der Herkunft jeder Datei und `LIESMICH.txt` mit der
    Anleitung dazu
  - Wird als Datenstrom gebaut; ein Jahresbestand kann hunderte Megabyte
    umfassen
- **Aufbewahrungsfristen** unter *Administration → Aufbewahrung*. Der Bestand
  wuchs unbegrenzt, und Belege wie ein AD-Export enthalten personenbezogene
  Daten.
  - Nach Ablauf wird die **Datei** entfernt, **nicht der Eintrag**: Datum,
    Person, Ergebnis, Dateiname und Prüfsumme bleiben und belegen weiterhin,
    dass geprüft wurde. Gelöscht wird der Inhalt, nicht die Tatsache.
  - Frist je Kategorie mit globaler Vorgabe; maßgeblich ist der Zeitpunkt der
    Durchführung.
  - **Im Auslieferungszustand aus.** Gelöscht wird nie ungefragt, und die
    Vorschau ermittelt dasselbe wie der Lauf, ohne etwas anzufassen.
- **Passkey-Pflicht je Rolle** unter *Administration → System* – der letzte
  offene Punkt aus 1.4.0. Wer keinen Passkey hat, wird bei der nächsten
  Anmeldung zur Einrichtung geführt.
  - Drei Ausnahmen, damit niemand ausgesperrt wird: ohne HTTPS bleibt die
    Pflicht wirkungslos und lässt sich nicht einschalten, SSO-Konten sind
    ausgenommen, und beim Einschalten wird genannt, wie viele Personen
    betroffen wären.
- **Virenprüfung hochgeladener Dateien** über einen optionalen ClamAV-Dienst.
  Belege werden von anderen Personen wieder heruntergeladen – ohne Prüfung wäre
  die Nachweisablage ein bequemer Verteilweg.
  - Geprüft wird **vor** dem Schreiben; eine erkannte Datei landet gar nicht
    erst im Ablageverzeichnis.
  - Freiwillig: Ohne `CLAMAV_HOST` wird nicht geprüft und die Anwendung läuft
    unverändert. Der Dienst steckt in `docker-compose.clamav.yml`, weil sein
    Signaturverzeichnis rund ein Gigabyte belegt.
  - Fällt der Dienst aus, wird die Datei voreingestellt angenommen und der
    Ausfall protokolliert. Mit `VIRENPRUEFUNG_PFLICHT=true` umgekehrt.
- **Releases zu den Versions-Tags.** `release.sh` legt sie bei GitLab und Gitea
  an und nimmt den Text aus dem Changelog, damit es nur eine Quelle gibt.
- **Handbuch** unter [docs/](docs/README.md): sechzehn Anleitungen für den
  Alltag – Aufgaben anlegen, Prüfbögen aufsetzen, Nachweise führen, Reports
  ziehen. Sie erklären auch das Warum, etwa weshalb eine Durchführung
  unveränderlich ist.

### Geändert

- **Audit-Referenzen sind Stammdaten** statt eines Freitextfelds an der
  Aufgabe. Als Freitext waren „ISO 27001 A.8.13“ und „ISO27001 A.8.13“ zwei
  verschiedene Dinge, und die Frage „welche Prüfungen decken diese Anforderung
  ab?“ blieb unbeantwortbar.
  - Verwaltung unter *Administration → Audit-Referenzen* mit Rahmenwerk,
    Kurzzeichen, Bezeichnung und Beschreibung
  - **Mehrere je Aufgabe**; Aufgabenliste, Suche und alle fünf Reports lassen
    sich danach filtern, vier Reports führen sie als Spalte
  - Beim Update werden die vorhandenen Freitexte übernommen: Gleiche Texte
    ergeben denselben Stammsatz. Die Aufteilung in Rahmenwerk und Kurzzeichen
    wird bewusst nicht geraten – sie gehört in die Verwaltung.
  - Referenzen mit zugeordneten Aufgaben lassen sich nicht löschen, nur
    deaktivieren.
- **Der Prüfbogen ist im Erledigen-Dialog wählbar** – auch auf dem Dashboard,
  wo er bisher gar nicht erreichbar war.
- **Ein abgeschlossener Prüfbogen erledigt die Fälligkeit nicht mehr von
  selbst.** Zum Erledigen gehören Ergebnis und Abweichungen mit Frist und
  Verantwortlichkeit – Angaben, die ein Prüfbogen nicht enthält. Das PDF wartet
  am Bogen und wandert beim Erledigen mitsamt den Belegen an die Durchführung;
  ein Bogen lässt sich damit auch nachreichen. Bei nachweispflichtigen Aufgaben
  zählt er als Nachweis.
- **Der Erledigen-Dialog kennt den vorliegenden Prüfbogen.** Bisher bot er auch
  dann noch an, einen Bogen anzulegen, wenn längst einer ausgefüllt und
  gegengezeichnet war – der Weg vom fertigen Bogen zur erledigten Fälligkeit
  war nicht zu sehen. Jetzt nennt er den Bogen samt beiden Personen, belegt das
  Ergebnis passend vor und stellt jede Feststellung zur Übernahme als
  Abweichung bereit: ein Klick, und Titel und Bemerkung stehen im Formular.
  Bögen, die noch in Arbeit sind, werden mit ihrem Stand genannt.

### Behoben

- **Im PDF-Nachweis blieb das Unterschriftsdatum leer.** Unter der Linie stand
  „Datum, Unterschrift“, gedruckt wurde aber nur der Name – dabei sind
  Zeitpunkt der Erfassung und der Gegenzeichnung festgehalten. Beides steht
  jetzt über der Linie; die Beschriftung verspricht kein leeres Feld mehr.
- **Fremde Prüfbogen-Entwürfe waren eine Sackgasse.** Ausfüllen darf nur die
  erfassende Person, und ein zweiter Bogen derselben Vorlage ließ sich für
  dieselbe Fälligkeit nicht anlegen – war die Kollegin im Urlaub, steckte die
  Prüfung fest. Ein Entwurf lässt sich jetzt übernehmen oder verwerfen; wer
  übernimmt, gilt als erfassende Person und kann nicht selbst gegenzeichnen.
- Die **Aufgabenhistorie** zeigte nach der Umstellung auf Audit-Referenzen
  noch den alten Freitext und damit einen eingefrorenen Stand.
- `update.sh` nennt jetzt den Weg zurück, wenn sich der lokale Stand nicht
  vorspulen lässt, statt nur „bitte manuell prüfen“ zu melden.

---

## [1.8.0] – 2026-07-30

### Sicherheit

- **Die Datenbank ist von außerhalb des Compose-Stacks nicht mehr erreichbar.**
  Bisher wurde der Postgres-Port auf dem Host veröffentlicht (an `127.0.0.1`
  gebunden). Die Anwendung braucht ihn nicht – sie spricht die Datenbank im
  Compose-Netz unter dem Namen `db` an –, und auch `backup.sh` arbeitet über
  `docker compose exec`. Damit gibt es keinen Datenbankzugang mehr, der von
  einer Firewallregel oder von der Vertrauenswürdigkeit lokaler Konten auf dem
  Server abhinge.
  - **Beim Update zu beachten:** Wer vom Host aus auf die Datenbank zugreift
    (eigene Skripte, `psql`, Prisma Studio), braucht künftig
    `docker-compose.dev.yml`:
    `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`.
    Diese Datei bindet den Port wieder an `127.0.0.1` und gehört nicht auf ein
    Produktivsystem. Sicherung und Wiederherstellung sind unverändert.

### Hinzugefügt

- **Feststellungen lassen sich in Abweichungen überführen.** Ein nicht
  erfüllter Prüfpunkt beschreibt bereits, was fehlt; Titel und Beschreibung
  sind daher vorbelegt, einzugeben bleiben Schwere, Frist und verantwortliche
  Person. Die Abweichung behält einen Rückverweis auf den Prüfpunkt, und je
  Feststellung entsteht höchstens eine.
- **Benachrichtigung zur Gegenzeichnung.** Ein vorgelegter Prüfnachweis blieb
  bisher still liegen, bis jemand zufällig auf die Übersicht schaute.
  - Die Bitte geht sofort beim Vorlegen hinaus, zuerst an die verantwortliche
    Person der Aufgabe; ist sie selbst die erfassende, an alle übrigen mit
    Ausführungsrecht.
  - Wartet ein Nachweis länger als eingestellt, erinnert der Tageslauf
    wöchentlich.
  - Eine Zurückweisung wird der erfassenden Person sofort mitsamt Begründung
    gemeldet.
  - Das Dashboard weist offene Gegenzeichnungen aus. Schaltbar unter
    *Administration → Benachrichtigungen*.
- **Zeilenlisten im Prüfbogen.** Ein Prüfpunkt der neuen Art *Liste* nimmt
  beliebig viele gleichartige Zeilen auf – je Konto, Transponder oder
  Firewall-Regel eine Entscheidung.
  - **Übernahme aus einer CSV-Datei**: Semikolon, Komma und Tabulator werden
    erkannt, eine Kopfzeile ebenfalls, sodass sich ein AD-Export unverändert
    einlesen lässt. Doppelte und namenlose Zeilen werden gemeldet statt still
    verworfen.
  - **Sammelentscheidung** für alle noch offenen Zeilen; bereits entschiedene
    bleiben unangetastet. Damit bleibt nur die Ausnahme Handarbeit.
  - Eine Liste gilt erst als beantwortet, wenn Zeilen vorhanden und alle
    entschieden sind – eine leere Liste belegt nichts.
  - Zeilen mit Befund erscheinen als Feststellung und stehen einzeln im
    PDF-Nachweis.
- **Nachweisregister als fünfter Report.** Der Compliance-Bericht zeigt
  Durchführungen, nicht die Prüfvorgänge selbst. Das Register listet alle
  abgeschlossenen Prüfnachweise eines Zeitraums mit Prüfbogen, Aufgabe,
  beiden beteiligten Personen, Zeitpunkten, Anzahl der Prüfpunkte und Zeilen,
  Feststellungen, Belegen und der SHA-256-Prüfsumme des PDF-Nachweises.
  - Der Detailteil nennt jede Feststellung im Klartext und die vollständige
    Prüfsumme – das Register allein genügt damit als Beleg dafür, welche
    Prüfungen stattgefunden haben und dass die Nachweise unverändert sind.
  - Bögen ohne Vier-Augen-Pflicht werden als „ohne Gegenzeichnung“
    ausgewiesen, statt eine zweite Person vorzutäuschen.
  - Voreingestellt im Querformat; zwölf Spalten brächen im Hochformat um.
  - Als PDF und Excel verfügbar, mit anpassbarer Vorlage wie die übrigen
    Berichte.

### Dokumentation

- Roadmap um die Fassungen **1.8.0 bis 1.10.0** ergänzt und begründet.
- Fünf Punkte, die in umgesetzten Fassungen als erledigt geführt wurden, es
  aber nicht sind, mit ⏳ gekennzeichnet und den kommenden Fassungen
  zugeordnet: CSV-Übernahme von Prüfzeilen und Überführung von Feststellungen
  in Abweichungen (1.6.0), Passkey-Pflicht je Rolle (1.4.0), SVG-Logo im
  PDF-Kopf (1.5.0), Duplizieren von Aufgaben (1.3.0).

---

## [1.7.0] – 2026-07-30

### Hinzugefügt

- **Belege am Prüfbogen.** Ein Prüfbogen nimmt jetzt die tatsächlichen
  Nachweise aus den geprüften Systemen auf – AD-Export, Screenshot,
  Herstellerprotokoll, Sicherungsbericht. Bisher ließen sich Dateien nur beim
  Erledigen anhängen; ein Prüfbogen entsteht aber vorher, sodass es zum
  Zeitpunkt der Prüfung keine Ablage dafür gab.
  - Mehrere Dateien in einem Zug, bis zu 25 je Bogen, je Datei bis 25 MB.
    Zugelassen sind dieselben Dateitypen wie beim Erledigen (pdf, png, jpg,
    txt, log, csv, xlsx, docx).
  - **Zuordnung zu einem einzelnen Prüfpunkt** oder zum gesamten Bogen. Damit
    ist erkennbar, welcher Beleg welche Aussage stützt – bei einer
    Rezertifizierung mit dreißig Punkten ist das der Unterschied zwischen
    nachvollziehbar und unbrauchbar.
  - Jede Datei erhält beim Hochladen eine **SHA-256-Prüfsumme**; sie steht in
    der Übersicht und ist einzeln herunterladbar.
  - Solange der Bogen bearbeitet werden darf, lassen sich Belege wieder
    entfernen. Hinzufügen und Entfernen erscheinen im Audit-Log.
- **Belege im PDF-Nachweis**: Am Prüfpunkt steht der zugehörige Dateiname, und
  am Ende führt ein Verzeichnis alle Belege mit Größe und Prüfsumme auf. Damit
  belegt das Dokument allein, welche Dateien zur Prüfung gehörten und dass sie
  unverändert sind – auch außerhalb der Anwendung.
- Mit dem Abschluss **wandern die Belege an die Durchführung** und erscheinen
  dort neben dem erzeugten PDF, an der Aufgabe und in den Reports. Die Dateien
  werden dabei nicht kopiert, es kommt nur die Zuordnung hinzu.

### Geändert

- Ein Anhang kann jetzt an einer Durchführung *oder* an einem laufenden
  Prüfbogen hängen. Bestehende Anhänge bleiben unverändert.

---

## [1.6.0] – 2026-07-30

### Hinzugefügt

- **Nachweismodul für Reviews und Regelprüfungen.** Der Prüfvorgang findet
  jetzt in der Anwendung statt, statt in Word- oder Tabellendateien außerhalb.
  - **Prüfbögen** unter *Administration → Prüfbögen*: beliebig viele Prüfpunkte
    mit Frage, Hinweis, Antwortart (Bewertung, Entscheidung, Freitext, Zahl,
    Datum) und Pflichtkennzeichen. Ein Bogen kann fest einer Aufgabe zugeordnet
    sein oder für alle bereitstehen.
  - **Erfassen** direkt an der offenen Fälligkeit; Zwischenstände lassen sich
    speichern, ein umfangreiches Review muss nicht in einem Zug fertig werden.
  - **Neue Seite „Nachweise“** mit den eigenen offenen Bögen, den zur
    Gegenzeichnung vorgelegten und den zuletzt abgeschlossenen.
- **Vier-Augen-Prinzip**, je Prüfbogen einschaltbar:
  - Ablauf *Entwurf → vorgelegt → gegengezeichnet*, mit Zurückweisung samt
    begründeter Rückgabe an die erfassende Person.
  - Die gegenzeichnende Person **darf nicht die erfassende sein** – die
    Anwendung setzt das durch, nicht nur die Oberfläche.
  - Vorgelegt werden kann erst, wenn alle Pflichtangaben ausgefüllt sind;
    die Oberfläche nennt die offenen Punkte mit Nummer.
  - Jeder Schritt erscheint mit Person und Zeitpunkt im Audit-Log.
- **PDF-Nachweis**: Aus dem abgeschlossenen Bogen entsteht ein PDF mit
  Kopfdaten, allen Prüfpunkten samt Befund und Bemerkungen sowie
  Unterschriftenfeldern beider Personen. Feststellungen sind farblich
  hervorgehoben.
- Der Nachweis wird **automatisch als Anhang an der Durchführung hinterlegt** –
  mit SHA-256 wie jeder andere Nachweis, damit die Nachweiskette geschlossen
  bleibt. Zusätzlich ist er einzeln herunterladbar.
- Mit der Gegenzeichnung **gilt die Fälligkeit als erledigt**: Die Anwendung
  protokolliert die Durchführung, hängt das PDF daran und erzeugt den
  Folgetermin – genau wie beim gewohnten Erledigen-Vorgang. Enthält der Bogen
  eine Feststellung, lautet das Ergebnis „in Ordnung mit Bemerkungen“. War die
  Fälligkeit bereits erledigt, kommt der Nachweis zur bestehenden Durchführung
  hinzu.

### Unveränderlichkeit

- Ein gegengezeichneter Nachweis lässt sich nicht mehr ändern; Korrekturen
  erfolgen als neuer, protokollierter Vorgang – wie bei den Durchführungen.
- Die Prüfpunkte eines Bogens lassen sich nicht mehr ändern, sobald damit
  abgeschlossene Nachweise entstanden sind. Andernfalls würden bestehende
  Nachweise nachträglich eine andere Bedeutung bekommen. Für Änderungen wird
  ein neuer Bogen angelegt.
- Prüfbögen mit vorhandenen Nachweisen lassen sich nicht löschen, nur
  deaktivieren.

---

## [1.5.0] – 2026-07-29

### Hinzugefügt

- **Anpassbare PDF-Vorlagen** unter *Administration → Report-Vorlagen*. Je
  Reportart lassen sich mehrere Vorlagen anlegen; eine davon gilt als Standard:
  - **Ausrichtung** A4 hoch oder quer – Querformat schafft Platz für breite
    Tabellen
  - **Spaltenauswahl** je Report; die für die Aussagekraft nötigen Spalten sind
    fest und lassen sich nicht abwählen. Die Breiten passen sich automatisch an.
  - **Deckblatt** mit Titel, Untertitel, Zeitraum und Eckdaten; die
    Seitenzählung beginnt danach
  - **Freitextblöcke** vor und nach der Auswertung
  - **Unterschriftenfelder** mit frei wählbarer Beschriftung
  - Vorschau je Vorlage direkt aus der Verwaltung heraus
- Auf der Reports-Seite lässt sich je Bericht die gewünschte Vorlage wählen.
  Die Excel-Exporte enthalten weiterhin stets alle Felder.
- **Wählbarer Zeitraum auf dem Dashboard**: Die Liste „Nächste Fälligkeiten“
  zeigt wahlweise *diese Woche*, die *nächsten 30* oder *90 Tage* oder *alle
  offenen*. Überfällige Prüfungen erscheinen immer – sie würden sonst gerade
  dann verschwinden, wenn sie am dringendsten sind. Die Auswahl bleibt
  gespeichert.

---

## [1.4.0] – 2026-07-29

### Hinzugefügt

- **Anmeldung mit Passkeys (WebAuthn/FIDO2).** Windows Hello, Touch ID oder ein
  Sicherheitsschlüssel ersetzen das Passwort – ohne Identity Provider.
  - Anmeldung **ohne Eingabe der E-Mail-Adresse**: Der Browser bietet die
    hinterlegten Passkeys von sich aus an. Die Anwendung gibt dabei keine
    Auskunft über vorhandene Konten.
  - Mehrere Passkeys je Konto (bis zu zehn), benennbar und einzeln entfernbar
  - Neue Seite **Mein Konto** mit Übersicht über Angaben, Passwort und Passkeys
    samt Zeitpunkt der letzten Verwendung
- **Administration:** Spalte mit der Anzahl hinterlegter Passkeys und die
  Möglichkeit, sie nach einem Geräteverlust zurückzusetzen.

### Sicherheit

- Die Aufgabe (Challenge) eines WebAuthn-Vorgangs liegt **serverseitig** und
  wird nach einmaliger Verwendung sofort entfernt. Läge sie nur im Browser,
  könnte eine angreifende Person eine eigene Aufgabe vorgeben und eine früher
  abgefangene Signatur erneut einreichen.
- Der **Signaturzähler** wird bei jeder Anmeldung fortgeschrieben; er dient
  der Erkennung geklonter Schlüssel.
- Gespeichert wird ausschließlich der **öffentliche** Schlüssel – der geheime
  Teil verlässt das Gerät nie.
- Passkeys werden nur angeboten, wenn die Anwendung über **HTTPS** (oder
  localhost) erreichbar ist; andernfalls erscheint ein erklärender Hinweis
  statt einer unverständlichen Browsermeldung.
- Der **letzte Passkey** eines Kontos ohne Passwort lässt sich nicht entfernen,
  und das Zurücksetzen durch die Administration wird abgelehnt, solange kein
  Passwort hinterlegt ist – sonst bliebe der Zugang verschlossen.
- `/api/passkeys/anmeldung` ist ohne Sitzung erreichbar (es dient ja gerade dem
  Anmelden), die Registrierung unter `/api/passkeys/registrierung` dagegen
  nicht.
- Alle Vorgänge erscheinen im Audit-Log.

---

## [1.3.5] – 2026-07-29

### Hinzugefügt

- **Dunkles Farbschema.** Umschaltbar zwischen *Hell*, *Dunkel* und
  *Systemvorgabe* – in der Kopfzeile und bereits auf der Anmeldeseite.
  - Die Auswahl liegt in einem Cookie, damit der Server sie schon beim Rendern
    kennt. Ein Skript im Seitenkopf setzt das Schema vor dem ersten Zeichnen,
    sodass die helle Fassung nicht kurz aufblitzt.
  - Bei *Systemvorgabe* folgt die Anwendung der Einstellung des Geräts, auch
    wenn diese im laufenden Betrieb wechselt.
  - Die Farben leiten sich weiterhin aus den Markenfarben ab; die Primärfarbe
    wird für dunklen Grund automatisch aufgehellt.
- Das unter *Erscheinungsbild* hinterlegte **Logo für dunklen Hintergrund**
  wird jetzt verwendet und per CSS umgeschaltet. Bisher war es zwar
  speicherbar, blieb aber ungenutzt.

---

## [1.3.0] – 2026-07-29

### Hinzugefügt

- **Export von Stammdaten** unter *Administration → Import / Export*:
  Kategorien, Aufgaben und Benutzer als CSV oder JSON, dazu ein Gesamtexport
  aller Bereiche in einer Datei. Passwörter werden nie exportiert.
- **Import derselben Daten mit Vorschau**: Vor dem Schreiben zeigt die
  Anwendung Zeile für Zeile, was angelegt und was geändert würde – bei
  Änderungen mit Angabe der betroffenen Felder.
- **Zuordnung über fachliche Schlüssel** (Kategoriename, Aufgabentitel,
  E-Mail-Adresse) statt über interne Kennungen. Dadurch sind Daten zwischen
  Installationen übertragbar, und ein Export lässt sich unverändert wieder
  einlesen.
- **Strenge Prüfung:** Ein einziger fehlerhafter Datensatz verhindert den
  gesamten Lauf. Ein halb eingespielter Bestand wäre schlimmer als gar keiner.
  Geschrieben wird in einer Transaktion.
- **Vorlagendateien** je Bereich mit Kopfzeile und Beispielzeile.
- Jeder Import und Export erzeugt einen Audit-Eintrag.

### Sicherheit

- **Schutz vor CSV Injection:** Werte, die mit `=`, `+`, `-` oder `@` beginnen,
  werden beim Export entschärft. Andernfalls könnte Excel sie beim Öffnen als
  Formel ausführen.
- Import und Export sind Administratoren vorbehalten – der Export enthält die
  vollständige Benutzerliste.
- Beim Import bestehender Konten bleiben Anmeldeverfahren und Passwort
  unangetastet; ein Wechsel würde ein vorhandenes Passwort entwerten oder eine
  SSO-Verknüpfung zerstören.
- Die Prüfung läuft vor dem Schreiben erneut gegen den aktuellen Datenbestand –
  der Vorschau aus dem Browser wird nicht vertraut.

---

## [1.2.0] – 2026-07-29

### Hinzugefügt

- **E-Mail-Benachrichtigungen.** Der Wartungsplaner meldet sich von selbst,
  statt darauf zu warten, dass jemand ins Dashboard schaut:
  - Sammelnachricht je verantwortlicher Person über anstehende und überfällige
    Prüfungen – bewusst eine Nachricht statt einer je Aufgabe
  - Erinnerung an Fristen offener Abweichungen, mit einstellbarem Vorlauf
  - Eskalation lange überfälliger Prüfungen an eine zentrale Stelle,
    höchstens einmal je Kalenderwoche
  - Wöchentliche Übersicht je Person; wer nichts offen hat, erhält nichts
  - Wiederholungssicher: derselbe Vorgang wird nicht zweimal gemeldet,
    Überfälliges dagegen wöchentlich erneut
  - Eigener Zeitplan (`MAIL_CRON_SCHEDULE`, Standard 07:00 Uhr), damit der
    Fälligkeitsabgleich vorher gelaufen ist
- **Administration → Benachrichtigungen**: Ein- und Ausschalten je
  Nachrichtenart, Eskalationsempfänger, Wochentag der Übersicht, Testnachricht,
  sofortiger Lauf, Abmeldung je Benutzer und Übersicht der letzten Sendungen.
- **[ROADMAP.md](ROADMAP.md)** – die geplante Weiterentwicklung ist jetzt Teil
  des Projekts.
- **[SICHERHEIT.md](SICHERHEIT.md)** – Bedrohungsmodell, umgesetzte Maßnahmen,
  Ergebnis der Durchsicht und bewusste Einschränkungen.

### Sicherheit

Durchsicht der gesamten Anwendung mit folgenden Härtungen:

- **Begrenzung der Anmeldeversuche**: nach fünf Fehlversuchen je Konto und
  Netzwerkadresse eine Sperre von 15 Minuten. Zuvor waren Passwörter unbegrenzt
  oft ratbar. Sperren erscheinen im Audit-Log.
- **Content-Security-Policy mit Nonce** je Anfrage, ohne `unsafe-inline` für
  Skripte, dazu `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-*` und `Strict-Transport-Security` bei HTTPS.
- **CSRF-Schutz der Server Actions abgesichert**: Die erlaubten Ursprünge
  werden aus `APP_URL`/`AUTH_URL` abgeleitet, damit die Origin-Prüfung auch
  hinter einem Reverse Proxy zuverlässig greift.
- **Sitzungs-Cookies** erhalten `Secure` und das Präfix `__Secure-`
  automatisch, sobald die Anwendung über HTTPS erreichbar ist.
- **Header Injection in E-Mails** unterbunden: Betreffzeilen werden von
  Steuerzeichen und Zeilenumbrüchen befreit.
- `/api/branding` ist ohne Anmeldung erreichbar, damit ein hochgeladenes Logo
  auf der Anmeldeseite erscheint.

---

## [1.1.0] – 2026-07-29

### Hinzugefügt

- **Konfigurierbares Erscheinungsbild** unter *Administration → Erscheinungsbild*:
  Anwendungsname, Organisation, Primär- und Akzentfarbe, Logo für helle und
  dunkle Oberflächen sowie Browsersymbol lassen sich ohne Neustart ändern.
  Änderungen wirken sofort für alle Benutzer und werden protokolliert.
- **Auslieferungszustand** mit Standardfarben und einem mitgelieferten Logo
  als SVG, damit die Anwendung ohne Einrichtung ansehnlich aussieht.
- **Kontrastprüfung nach WCAG 2.1** bei der Farbwahl: Die Oberfläche weist
  darauf hin, wenn eine gewählte Primärfarbe die Stufe AA (4,5:1) für
  Schaltflächen nicht erreicht. Die Vordergrundfarbe wird automatisch passend
  gewählt.
- **Versionsanzeige** in der Fußzeile, auf der Anmeldeseite, unter
  *Administration → System* und im Healthcheck (`/api/health`).
- **Systemübersicht** unter *Administration → System*: Fassung, Build-Zeitpunkt,
  Git-Commit, Zustand von Datenbank, Hintergrundjob und SSO sowie dieser
  Änderungsverlauf.
- **Branding in den Reports**: Logo, Organisation und ein frei wählbarer
  Fußzeilenzusatz erscheinen in PDF und Excel.
- **Update-Skript `update.sh`** – aktualisiert den Docker-Stack in einem
  Durchgang: Sicherung, `git pull`, Neubau, Migrationen, Neustart und
  Healthcheck. Bricht bei Problemen mit einem Rollback-Hinweis ab.

### Geändert

- Die Kopfzeile zeigt statt eines festen Symbols das konfigurierte Logo.
- Der Browsertitel richtet sich nach dem eingestellten Anwendungsnamen.

---

## [1.0.0] – 2026-07-29

Erste einsatzfähige Fassung.

### Hinzugefügt

- **Datenmodell und Datenbank**: Aufgaben, Kategorien, Fälligkeiten,
  Durchführungen, Nachweise, Abweichungen, Benutzer und Audit-Log auf
  PostgreSQL 16 mit Prisma-Migrationen.
- **Revisionssicheres Audit-Log**: Einträge lassen sich ausschließlich
  einfügen; `UPDATE` und `DELETE` werden zusätzlich per Datenbank-Trigger
  abgewiesen. Benutzer mit Protokolleinträgen sind nicht löschbar, sondern
  werden deaktiviert.
- **Anmeldung** über interne Benutzerverwaltung (E-Mail und Passwort,
  bcrypt) sowie optional über einen generischen OIDC-Provider
  (Entra ID, Keycloak). SSO erscheint nur bei gesetzten `OIDC_*`-Variablen.
  Neue SSO-Konten erhalten die Rolle Auditor.
- **Rollen** ADMIN, EDITOR und AUDITOR mit serverseitiger Prüfung in jeder
  Seite und jeder Server Action.
- **Erzwungener Passwortwechsel** beim ersten Login und nach einem
  Zurücksetzen durch die Administration.
- **Fälligkeitslogik** als reine, systemzeitfreie Funktionen: sieben
  Intervalltypen, feste Taktung oder Rechnung ab Erledigungsdatum, Vorlauf-
  und Karenztage, Begrenzung auf Monatsenden.
- **Täglicher Hintergrundjob** (node-cron) für Überfälligkeiten und fehlende
  Fälligkeiten, zusätzlich per Token über `POST /api/cron` auslösbar.
- **Aufgabenverwaltung** mit Filtern, Volltextsuche, Markdown-Prüfanleitung
  und Aussetzen einzelner Fälligkeiten mit protokollierter Begründung.
- **Erledigen-Vorgang** mit Ergebnis, Kommentar, Mehrfach-Upload und
  Abweichungen. Durchführungen sind unveränderlich; das Ergebnis
  *Abweichung* erzwingt eine Abweichung, `evidenceRequired` einen Nachweis.
- **Nachweise** mit SHA-256-Prüfsumme, Whitelist (pdf, png, jpg, txt, log,
  csv, xlsx, docx), 25 MB je Datei, Ablage im Docker-Volume und
  protokolliertem Download.
- **Abweichungsverfolgung** mit Schweregrad, Verantwortlichkeit, Frist und
  Abschluss über einen Maßnahmenkommentar.
- **Dashboard** mit Kennzahlen, nächsten Fälligkeiten und Ampel je Kategorie.
- **Kalender** als Monatsansicht.
- **Vier Reports** als PDF und Excel mit Zeitraum- und Kategorienfilter:
  Compliance-Übersicht, Aufgabenhistorie, Abweichungsbericht und
  Fälligkeitsvorschau.
- **Administrationsbereich** mit Benutzerverwaltung, Kategorien und
  filterbarer, lesender Audit-Log-Ansicht.
- **Docker-Compose-Stack** mit Multi-Stage-Build, Healthchecks, benannten
  Volumes `pgdata` und `uploads` sowie automatischen Migrationen und
  einmaligem Seed beim ersten Start.
- **Tests**: Unit-Tests für die gesamte Fälligkeits- und Datumslogik sowie
  einen Integrationstest gegen eine echte PostgreSQL-Instanz.
- **Seed-Daten**: Administrator, sechs Kategorien und elf realistische
  Beispielaufgaben mit ausformulierten Prüfanleitungen.

[Unveröffentlicht]: https://github.com/<konto>/wartungsplaner/compare/v1.10.0...main
[1.10.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.10.0
[1.9.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.9.0
[1.8.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.8.0
[1.7.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.7.0
[1.6.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.6.0
[1.5.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.5.0
[1.4.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.4.0
[1.3.5]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.3.5
[1.3.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.3.0
[1.2.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.2.0
[1.1.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.1.0
[1.0.0]: https://github.com/<konto>/wartungsplaner/releases/tag/v1.0.0
