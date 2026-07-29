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
2. **Keine Zwei-Faktor-Authentisierung.** Passkeys sind für Fassung 1.4.0
   vorgesehen (siehe [ROADMAP.md](ROADMAP.md)).
3. **`style-src` erlaubt `unsafe-inline`.** Siehe Begründung oben.
4. **Nachweisdateien werden nicht auf Schadsoftware geprüft.** Sie werden nur
   heruntergeladen, nie ausgeführt, und stammen ausschließlich von
   angemeldeten Mitarbeitenden. Eine Anbindung an einen Virenscanner ließe
   sich in `src/server/dateiablage.ts` ergänzen.
5. **Keine Ende-zu-Ende-Verschlüsselung der Nachweise.** Der Schutz ergibt sich
   aus Dateisystemrechten und dem Zugriffsschutz der Anwendung.

---

## Meldung von Schwachstellen

Vermutete Schwachstellen bitte **nicht** als öffentliches Issue erfassen,
sondern direkt an die IT-Leitung melden.
