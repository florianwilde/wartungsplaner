# Sicherheit

Dieses Dokument beschreibt die Schutzmaßnahmen des Wartungsplaners, das
Ergebnis der Durchsicht vom 29.07.2026 und die bewusst in Kauf genommenen
Einschränkungen.

---

## Bedrohungsmodell

Der Wartungsplaner ist eine **interne Anwendung** ohne Zugang aus dem Internet.
Angenommen wird:

- Alle Benutzer sind namentlich bekannt und der Organisation zugeordnet.
- Der Betrieb erfolgt hinter einem Reverse Proxy mit TLS.
- Die Datenbank ist nicht von außen erreichbar (Portbindung an `127.0.0.1`).

Geschützt wird vorrangig gegen:

1. **Verfälschung der Nachweise** – das eigentliche Schutzziel einer
   Auditanwendung.
2. **Rechteausweitung** – Auditoren dürfen nichts schreiben, Bearbeiter nichts
   administrieren.
3. **Übernahme von Sitzungen** über CSRF, XSS oder gestohlene Cookies.
4. **Erraten von Passwörtern**.

---

## Umgesetzte Maßnahmen

### Authentifizierung

| Maßnahme | Umsetzung |
| --- | --- |
| Passwortspeicherung | bcrypt mit Kostenfaktor 12 |
| Passwortstärke | mindestens 12 Zeichen aus drei von vier Zeichenklassen |
| Erzwungener Wechsel | beim ersten Login und nach jedem Zurücksetzen |
| Benutzerauskunft vermeiden | einheitliche Fehlermeldung, unabhängig davon, ob das Konto existiert |
| Zeitangriffe | auch bei unbekannter E-Mail wird ein Hash-Vergleich durchgeführt, damit die Antwortzeit gleich bleibt |
| Erraten von Passwörtern | nach 5 Fehlversuchen je Konto **und** Netzwerkadresse eine Sperre von 15 Minuten; gleitendes Zeitfenster von 15 Minuten |
| Deaktivierte Konten | wirken sofort – Rolle und Status werden bei jeder Anfrage frisch aus der Datenbank gelesen |
| SSO | optionaler OIDC-Provider; neue Konten erhalten die niedrigste Rolle (Auditor) |

### Sitzungen

- JWT im Cookie, Laufzeit 12 Stunden
- `HttpOnly`, `SameSite=Lax`, `Path=/`
- `Secure` und das Präfix `__Secure-` automatisch, sobald `AUTH_URL` mit
  `https://` beginnt
- Rolle und Kontostatus werden nicht aus dem Cookie geglaubt, sondern je
  Anfrage neu gelesen

### CSRF

Drei voneinander unabhängige Ebenen:

1. **Server Actions** – Next.js vergleicht bei jedem Aufruf den `Origin`-Header
   mit dem Host. Hinter einem Reverse Proxy weicht der Host ab; die öffentliche
   Adresse ist deshalb in `next.config.ts` über `serverActions.allowedOrigins`
   ausdrücklich erlaubt (abgeleitet aus `APP_URL`/`AUTH_URL`). Fremde Ursprünge
   werden in jedem Fall abgewiesen.
2. **Auth.js** – eigener CSRF-Token für alle Anmeldeendpunkte.
3. **Content-Security-Policy** – `form-action 'self'` verhindert, dass
   Formulare an fremde Ziele gesendet werden.

Schreibende Vorgänge laufen ausschließlich über Server Actions oder über
tokengeschützte Endpunkte. Es gibt keine schreibende Route, die allein durch
ein Cookie autorisiert wäre.

### Content-Security-Policy und Schutz-Header

In `src/proxy.ts` wird je Anfrage ein Nonce erzeugt und in die CSP eingesetzt.
Next.js übernimmt ihn automatisch für seine eigenen Skripte – dadurch kommt die
Richtlinie **ohne `unsafe-inline` für Skripte** aus.

```
default-src 'self'
script-src  'self' 'nonce-<je Anfrage>' 'strict-dynamic'
style-src   'self' 'unsafe-inline'
img-src     'self' data: blob:
object-src  'none'
base-uri    'self'
form-action 'self'
frame-ancestors 'none'
```

Zusätzlich: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`
(Kamera, Mikrofon, Standort, Zahlung, USB abgeschaltet),
`Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy` sowie
`Strict-Transport-Security` bei HTTPS.

`style-src` erlaubt bewusst `unsafe-inline`: Next.js und die konfigurierbaren
Markenfarben betten Stile direkt ein. Das Risiko ist dort erheblich geringer
als bei Skripten.

### XSS

- React maskiert alle Ausgaben. `dangerouslySetInnerHTML` wird an genau einer
  Stelle verwendet – für die Markenfarben, deren Werte zuvor auf `#rrggbb`
  normalisiert wurden.
- Die Markdown-Prüfanleitungen werden **ohne** `rehype-raw` gerendert;
  eingebettetes HTML bleibt Text.
- In den E-Mail-Vorlagen wird jeder Wert aus der Datenbank maskiert
  (`maskiereHtml`).

### Dateien

| Bereich | Maßnahme |
| --- | --- |
| Nachweise | Positivliste der Endungen (pdf, png, jpg, txt, log, csv, xlsx, docx), höchstens 25 MB; Größe wird nach dem Einlesen erneut geprüft, nicht nur anhand der Client-Angabe |
| Logos | Positivliste (svg, png, jpg, webp, ico), höchstens 2 MB |
| Speicherpfade | generierte Namen (UUID); der Anzeigename wird nur für den Download verwendet |
| Path Traversal | `absoluterPfad()` löst auf und weist alles ab, was das Upload-Verzeichnis verlässt |
| Auslieferung | ausschließlich über die Anwendung, mit `Content-Disposition: attachment`, `nosniff` und Protokollierung jedes Abrufs |
| Hochgeladene SVG | werden mit `Content-Security-Policy: sandbox` ausgeliefert und stets über `<img>` eingebunden – Skripte darin werden nicht ausgeführt |

### E-Mail

- Betreffzeilen durchlaufen `einzeilig()`: Steuerzeichen und Zeilenumbrüche
  werden entfernt. Ohne diese Maßnahme könnte ein Administrator über den
  Anwendungsnamen zusätzliche Mail-Kopfzeilen einschleusen (Header Injection).
- HTML-Inhalte werden vollständig maskiert.
- Zugangsdaten stehen ausschließlich in der `.env`, nie in der Datenbank.

### Datenbank

- Prisma verwendet durchgehend parametrisierte Abfragen – SQL-Injection ist
  ausgeschlossen. Die einzige Rohabfrage ist `SELECT 1` im Healthcheck.
- Das Audit-Log ist per Datenbank-Trigger auf `INSERT` beschränkt.
- Benutzer mit Protokolleinträgen sind nicht löschbar (`onDelete: Restrict`).

### Weiteres

- **Offene Weiterleitung:** Das Ziel nach der Anmeldung wird auf
  anwendungsinterne Pfade begrenzt (`sichereZielUrl`).
- **Container:** läuft als unprivilegierter Benutzer (UID 1001), nicht als root.
- **Datenbank ohne veröffentlichten Port:** Postgres ist ausschließlich im
  Compose-Netz unter dem Namen `db` erreichbar; auf dem Host wird kein Port
  gebunden. Damit ist die Datenbank auch dann nicht erreichbar, wenn jemand
  lokalen Zugang zum Server erhält oder eine Firewallregel fehlt. Die
  Sicherung arbeitet über `docker compose exec` und braucht keinen Port.
  Für Entwicklungszugriffe gibt es `docker-compose.dev.yml`, das ihn bewusst
  und ausdrücklich an `127.0.0.1` bindet.
- **Hintergrundjob über HTTP:** nur erreichbar, wenn `CRON_TOKEN` gesetzt ist,
  und dann ausschließlich per Bearer-Token – ein Cookie genügt nicht.

---

## Ergebnis der Durchsicht vom 29.07.2026

Behoben:

| Befund | Bewertung | Behebung |
| --- | --- | --- |
| Keine Begrenzung der Anmeldeversuche | **hoch** – Passwörter waren unbegrenzt oft ratbar | Sperre nach 5 Fehlversuchen je Konto und Adresse |
| Keine Schutz-Header, keine CSP | **mittel** – XSS und Clickjacking wären ungebremst | Nonce-basierte CSP und weitere Header über den Proxy |
| Server Actions ohne `allowedOrigins` | **mittel** – hinter einem Reverse Proxy hätte die Origin-Prüfung fehlschlagen oder umgangen werden können | Ursprünge aus `APP_URL`/`AUTH_URL` abgeleitet |
| Sitzungs-Cookie ohne `Secure`-Zwang | **mittel** – bei intern unverschlüsseltem Proxy fehlte das Kennzeichen | aus `AUTH_URL` abgeleitet, inkl. `__Secure-`-Präfix |
| Betreffzeilen ungefiltert | **niedrig** – Header Injection über den Anwendungsnamen; nur für Administratoren erreichbar | `einzeilig()` auf allen Betreffzeilen |
| `/api/branding` hinter der Anmeldung | **niedrig** – Logo auf der Anmeldeseite nicht ladbar | Pfad vom Anmeldezwang ausgenommen |

Geprüft und für unbedenklich befunden: SQL-Injection, Path Traversal,
offene Weiterleitungen, Benutzerauskunft bei der Anmeldung, Rechteprüfung in
Seiten und Server Actions, Unveränderlichkeit der Durchführungen.

---

## Bekannte Einschränkungen

Bewusste Entscheidungen, die bei geändertem Betriebsmodell zu überdenken sind:

1. **Die Begrenzung der Anmeldeversuche liegt im Arbeitsspeicher.** Bei mehreren
   App-Instanzen zählt jede für sich. Ein Neustart hebt bestehende Sperren auf.
   Für den Betrieb mit einem Container ist das ausreichend; andernfalls wäre
   ein gemeinsamer Speicher (etwa Redis) nötig. Die Schnittstelle in
   `src/lib/anmeldeversuche.ts` ist darauf vorbereitet.
2. **Passkeys sind möglich, aber nicht durchgängig erzwungen.** Seit 1.4.0
   vorhanden, seit 1.9.0 je Rolle erzwingbar – ohne HTTPS bleibt die
   Pflicht jedoch wirkungslos, und SSO-Konten sind ausgenommen.
3. **`style-src` erlaubt `unsafe-inline`.** Siehe Begründung oben.
4. **Die Virenprüfung ist freiwillig.** Seit 1.9.0 vorhanden, aber nur
   wirksam, wenn ein ClamAV-Dienst konfiguriert ist (`CLAMAV_HOST`). Ohne
   ihn werden Dateien ungeprüft angenommen.
5. **Keine Ende-zu-Ende-Verschlüsselung der Nachweise.** Der Schutz ergibt sich
   aus Dateisystemrechten und dem Zugriffsschutz der Anwendung.

---

## Löschen von Nachweisen

Die Anwendung schützt Nachweise: Eine Aufgabe mit protokollierter
Durchführung lässt sich nicht löschen, zum Ausmustern gibt es das
Deaktivieren. Für Testdaten und Fehlimporte gibt es davon **eine**
Ausnahme.

### Der Ausnahmeweg

*Aufgaben → markieren → „Mit Nachweisen löschen"* entfernt eine Aufgabe
samt Fälligkeiten, Durchführungen, Nachweisdateien, Abweichungen und
Prüfbögen.

Bedingungen:

| | |
| --- | --- |
| **Rolle** | nur Administratoren – das Verwalten von Aufgaben genügt nicht |
| **Begründung** | Pflichtfeld, mindestens 15 Zeichen |
| **Bestätigung** | das Wort `LOESCHEN` muss abgetippt werden |
| **Umfang** | wird vor der Bestätigung angezeigt, frisch aus der Datenbank ermittelt |
| **Höchstzahl** | 200 Aufgaben je Vorgang |

### Warum kein dauerhafter Modus

Ein einschaltbarer „Super-Admin-Modus" wäre bequemer und deshalb
gefährlicher: Er wird eingeschaltet, vergessen, und dann verschwindet
nebenbei etwas Echtes. Der Weg ist bewusst eine Einzelhandlung, die sich
nicht vorab freischalten lässt.

### Was bestehen bleibt

Der Audit-Eintrag entsteht **vor** dem Löschen, in derselben Transaktion,
und enthält:

- den Namen der handelnden Person und den Zeitpunkt
- die Titel der gelöschten Aufgaben
- den Umfang: Zahl der Fälligkeiten, Durchführungen, Nachweisdateien,
  Abweichungen, Prüfnachweise und Prüfbögen
- **Dateiname und SHA-256-Prüfsumme jeder entfernten Nachweisdatei**
- die Begründung im Wortlaut

Das Audit-Log ist durch einen Datenbank-Trigger unveränderlich und
übersteht die Löschung. Der Grundsatz dahinter: Wenn ein Nachweis schon
verschwinden muss, darf wenigstens die Tatsache nicht verschwinden, dass
es ihn gab – und die Prüfsumme belegt später, welche Datei genau fehlt.

Die Dateien werden auch von der Platte entfernt, nicht nur ihre Einträge.
Sonst meldete der nächste Prüfsummenlauf sie als herrenlos.

### Was das für ein Audit bedeutet

Ein Prüfer, der eine Lücke in der Nachweiskette findet, findet im
Audit-Log den zugehörigen Eintrag mit Begründung. Das ist keine
Rechtfertigung für eine Löschung, aber es macht sie nachvollziehbar.
**Für das Ausmustern laufender Prüfungen ist dieser Weg der falsche** –
dafür gibt es das Deaktivieren, bei dem die Historie erhalten bleibt.

---

## Lieferkette

Stand 31.07.2026. Die Anwendung bringt **36 direkte Abhängigkeiten** mit;
im Produktionscontainer liegen daraus **439 Pakete**. Wer das nachrechnen
will:

```bash
npm ls --omit=dev --all --parseable | wc -l
npm audit --omit=dev
```

### Erzwungene Fassungen

In `package.json` stehen unter `overrides` drei Pakete, die tiefer im Baum
liegen und dort in verwundbaren Fassungen gezogen würden:

| Paket | Erzwungen | Grund |
| --- | --- | --- |
| `postcss` | `^8.5.25` | Next.js bringt intern 8.4.31 mit; drei Meldungen, u. a. Pfaddurchgriff über `sourceMappingURL` |
| `sharp` | `^0.35.3` | CVEs in libvips |
| `uuid` | `^11.1.1` | fehlende Bereichsprüfung; kommt über `exceljs` |

Nach jeder Änderung an diesen Fassungen gehört `npm run test:ausgabe`
ausgeführt: Ein Eingriff in `exceljs` oder `archiver` fällt weder bei der
Typprüfung noch in den Unit-Tests auf – erst die erzeugte Datei zeigt es.

### Verbleibende Meldungen und warum sie hier nicht greifen

Zwei Meldungen bleiben bestehen. Beide sind in dieser Anwendung nicht
auslösbar – das ist eine Einschätzung, keine Entwarnung, und sie gehört bei
jedem Update erneut geprüft:

| Meldung | Weg hierher | Einschätzung |
| --- | --- | --- |
| `brace-expansion` – Speicherüberlauf durch unbegrenzte Expansion | `exceljs` → `archiver` → `glob` → `minimatch` | **Nicht erreichbar.** `archiver` wird ausschließlich mit `.append()` verwendet, nie mit Glob-Mustern (siehe `src/server/reports/archiv.ts`). Muster kämen ohnehin nie von außen. Behoben ist die Meldung erst ab 5.0.8; die Fassung erzwingen hieße, eine andere Hauptfassung in `minimatch` 3 zu schieben |
| `nodemailer` – `raw` umgeht `disableFileAccess`/`disableUrlAccess` | direkt | **Nicht erreichbar.** Nachrichten werden ausschließlich aus `from`, `to`, `subject`, `text` und `html` gebaut; die Option `raw` wird nirgends verwendet, Anhänge gibt es nicht. Die behobene Fassung 9.x lässt sich nicht einsetzen, ohne `npm ci` zu brechen: `next-auth` verlangt als Peer `^7 \|\| ^8` |

### Anmeldung auf einer Vorabfassung

**`next-auth` läuft in der Fassung `5.0.0-beta.32`.** Eine stabile Fassung 5
gibt es bisher nicht; `latest` verweist auf 4.24.15, das eine andere
Schnittstelle hat und den App Router nicht in gleicher Weise unterstützt.
Ein Wechsel wäre ein Umbau der gesamten Anmeldung, kein Fassungswechsel.

Die Fassung ist deshalb **exakt festgenagelt** (ohne `^`), damit kein
unbeabsichtigter Sprung passiert. Sobald eine stabile Fassung 5 erscheint,
gehört der Wechsel vorgezogen.

---

## Meldung von Schwachstellen

Vermutete Schwachstellen bitte **nicht** als öffentliches Issue erfassen.

- **Im Betrieb einer Installation:** an die dortige IT-Leitung.
- **Am Projekt selbst:** über die private Meldefunktion von GitHub
  („Report a vulnerability" im Reiter *Security*).

Bitte geben Sie an, was Sie beobachtet haben und wie es sich nachstellen
lässt. Eine Rückmeldung erfolgt, sobald der Sachverhalt eingeschätzt ist;
zugesagte Fristen gibt es bei einem Projekt dieser Größe nicht.
